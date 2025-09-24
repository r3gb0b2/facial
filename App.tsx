import React, { useState, useEffect } from 'react';
import { Attendee, Event, Sector, Supplier } from './types.ts';
import * as api from './firebase/service.ts';
import LoginView from './components/views/LoginView.tsx';
import EventSelectionView from './components/views/EventSelectionView.tsx';
import AdminView from './components/views/AdminView.tsx';
import RegisterView from './components/views/RegisterView.tsx';
import RegistrationClosedView from './components/views/RegistrationClosedView.tsx';
import EventModal from './components/EventModal.tsx';
import { SpinnerIcon } from './components/icons.tsx';

// Simple password check (replace with real auth in a real app)
const ADMIN_PASSWORD = "admin";

const App: React.FC = () => {
    // App State
    const [isLoading, setIsLoading] = useState(true);
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [loginError, setLoginError] = useState<string | null>(null);
    const [appError, setAppError] = useState('');
    
    // View State
    const [currentView, setCurrentView] = useState<'login' | 'event_selection' | 'admin' | 'supplier_registration' | 'registration_closed'>('login');
    
    // Data State
    const [events, setEvents] = useState<Event[]>([]);
    const [currentEvent, setCurrentEvent] = useState<Event | null>(null);
    const [attendees, setAttendees] = useState<Attendee[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [sectors, setSectors] = useState<Sector[]>([]);
    
    // Supplier specific state
    const [supplierInfo, setSupplierInfo] = useState<{ id: string; eventId: string; data: Supplier; registrationCount: number } | null>(null);
    
    // Modal State
    const [isEventModalOpen, setIsEventModalOpen] = useState(false);
    const [eventToEdit, setEventToEdit] = useState<Event | null>(null);

    // Handle URL parameters for supplier links
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const eventId = params.get('eventId');
        const supplierId = params.get('supplierId');
        
        if (eventId && supplierId) {
            handleSupplierLink(eventId, supplierId);
        } else {
            setIsLoading(false); // No supplier link, proceed to normal auth flow
        }
    }, []);
    
    // Firebase Listeners
    useEffect(() => {
        if (!isLoggedIn) return;
        const unsubscribe = api.getEvents(setEvents);
        return () => unsubscribe();
    }, [isLoggedIn]);

    useEffect(() => {
        if (!currentEvent) {
            setAttendees([]);
            setSuppliers([]);
            setSectors([]);
            return;
        }
        const unsubAttendees = api.getAttendees(currentEvent.id, (data) => {
            setAttendees(data);
            // Update registration count for supplier view
            if (supplierInfo) {
                const count = data.filter(a => a.supplierId === supplierInfo.id).length;
                setSupplierInfo(prev => prev ? {...prev, registrationCount: count} : null);
            }
        });
        const unsubSuppliers = api.getSuppliers(currentEvent.id, setSuppliers);
        const unsubSectors = api.getSectors(currentEvent.id, setSectors);
        
        return () => {
            unsubAttendees();
            unsubSuppliers();
            unsubSectors();
        };
    }, [currentEvent, supplierInfo]);

    // Error handling
    useEffect(() => {
        if (appError) {
            const timer = setTimeout(() => setAppError(''), 5000);
            return () => clearTimeout(timer);
        }
    }, [appError]);

    // --- Handlers ---
    
    const handleLogin = (password: string) => {
        if (password === ADMIN_PASSWORD) {
            setIsLoggedIn(true);
            setCurrentView('event_selection');
            setLoginError(null);
        } else {
            setLoginError('Senha incorreta.');
        }
    };
    
    const handleSupplierLink = async (eventId: string, supplierId: string) => {
        try {
            const supplierData = await api.getSupplier(eventId, supplierId);
            if (supplierData && supplierData.active) {
                const eventData = { id: eventId, name: '', createdAt: new Date() } as Event; // Mock event, we don't need full data
                setCurrentEvent(eventData); // Set event to trigger listeners
                
                // We need to fetch attendees to check the limit
                const unsub = api.getAttendees(eventId, (attendeesData) => {
                    const registrationCount = attendeesData.filter(a => a.supplierId === supplierId).length;
                     if (registrationCount >= supplierData.registrationLimit) {
                        setCurrentView('registration_closed');
                    } else {
                        setSupplierInfo({ id: supplierId, eventId, data: supplierData, registrationCount });
                        setCurrentView('supplier_registration');
                    }
                    setIsLoading(false);
                    unsub(); // We only need the initial count
                });
            } else {
                setCurrentView('registration_closed');
                setIsLoading(false);
            }
        } catch (error) {
            setCurrentView('registration_closed');
            setIsLoading(false);
        }
    };

    const handleSelectEvent = (event: Event) => {
        setCurrentEvent(event);
        setCurrentView('admin');
    };
    
    const handleBackToEvents = () => {
        setCurrentEvent(null);
        setCurrentView('event_selection');
    };
    
    const handleSaveEvent = async (name: string, eventId?: string) => {
        try {
            if (eventId) {
                await api.updateEvent(eventId, name);
            } else {
                await api.addEvent(name);
            }
            setIsEventModalOpen(false);
            setEventToEdit(null);
        } catch (e) {
            setAppError('Falha ao salvar evento.');
        }
    };

    const handleDeleteEvent = async (event: Event) => {
        if (window.confirm(`Tem certeza que deseja deletar o evento "${event.name}"? Todos os dados associados serão perdidos.`)) {
             try {
                await api.deleteEvent(event.id);
            } catch (e) {
                setAppError('Falha ao deletar evento.');
            }
        }
    };
    
    const handleRegister = async (newAttendee: Omit<Attendee, 'id' | 'status' | 'eventId' | 'createdAt'>) => {
        if (!currentEvent) return;
        try {
            await api.addAttendee(currentEvent.id, newAttendee);
        } catch (e) {
            setAppError('Falha ao registrar participante.');
            throw e; // re-throw to be caught in RegisterView
        }
    };
    
    const handleSupplierRegister = async (newAttendee: Omit<Attendee, 'id' | 'status' | 'eventId' | 'createdAt'>) => {
        if (!supplierInfo) return;
        if (supplierInfo.registrationCount >= supplierInfo.data.registrationLimit) {
            setAppError('Limite de inscrições atingido.');
            setCurrentView('registration_closed');
            return;
        }
        try {
            await api.addAttendee(supplierInfo.eventId, { ...newAttendee, supplierId: supplierInfo.id });
        } catch (e) {
             setAppError('Falha ao registrar participante.');
             throw e;
        }
    };

    const handleImportAttendees = async (data: any[]): Promise<{ successCount: number; errors: { row: number; message: string }[] }> => {
        if (!currentEvent) return { successCount: 0, errors: [] };
        
        let successCount = 0;
        const errors: { row: number, message: string }[] = [];

        for (const [index, row] of data.entries()) {
            const { nome, cpf, setor } = row;
            const rawCpf = (cpf || '').replace(/\D/g, '');

            if (!nome || !rawCpf || !setor) {
                errors.push({ row: index + 2, message: 'Dados incompletos.' });
                continue;
            }

            // Find sector ID from label
            const existingSector = sectors.find(s => s.label.toLowerCase() === setor.toLowerCase());
            
            if (!existingSector) {
                errors.push({ row: index + 2, message: `Setor "${setor}" não encontrado.` });
                continue;
            }
             
            // We don't provide a photo for spreadsheet uploads. A placeholder could be used.
            const placeholderPhoto = "data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=";

            try {
                await api.addAttendee(currentEvent.id, { name: nome, cpf: rawCpf, sector: existingSector.id, photo: placeholderPhoto });
                successCount++;
            } catch (error) {
                errors.push({ row: index + 2, message: 'Erro ao salvar no banco de dados.' });
            }
        }
        return { successCount, errors };
    };

    const handleAddSupplier = (name: string, sectors: string[], registrationLimit: number) => {
        if (!currentEvent) return Promise.reject();
        return api.addSupplier(currentEvent.id, name, sectors, registrationLimit);
    };
    
    const handleUpdateSupplier = (supplierId: string, data: Partial<Supplier>) => {
        if (!currentEvent) return Promise.reject();
        return api.updateSupplier(currentEvent.id, supplierId, data);
    };

    const handleSupplierStatusUpdate = (supplierId: string, active: boolean) => {
        if (!currentEvent) return Promise.reject();
        return api.updateSupplier(currentEvent.id, supplierId, { active });
    };

    const handleAddSector = (label: string) => {
        if (!currentEvent) return Promise.reject();
        return api.addSector(currentEvent.id, label);
    };

    const handleUpdateSector = (sectorId: string, label: string) => {
        if (!currentEvent) return Promise.reject();
        return api.updateSector(currentEvent.id, sectorId, label);
    };

    const handleDeleteSector = (sector: Sector) => {
        if (!currentEvent) return Promise.reject();
        return api.deleteSector(currentEvent.id, sector.id);
    };

    // --- Render Logic ---
    
    const renderContent = () => {
        if (isLoading) {
            return <div className="flex items-center justify-center min-h-screen"><SpinnerIcon className="w-12 h-12 text-white" /></div>;
        }
        
        switch (currentView) {
            case 'login':
                return <LoginView onLogin={handleLogin} error={loginError} />;
            case 'event_selection':
                return <EventSelectionView
                    events={events}
                    onSelectEvent={handleSelectEvent}
                    onCreateEvent={() => { setEventToEdit(null); setIsEventModalOpen(true); }}
                    onEditEvent={(event) => { setEventToEdit(event); setIsEventModalOpen(true); }}
                    onDeleteEvent={handleDeleteEvent}
                />;
            case 'admin':
                if (!currentEvent) return null; // Should not happen
                return <AdminView
                    currentEvent={currentEvent}
                    attendees={attendees}
                    suppliers={suppliers}
                    sectors={sectors}
                    onRegister={handleRegister}
                    onImportAttendees={handleImportAttendees}
                    onAddSupplier={handleAddSupplier}
                    onUpdateSupplier={handleUpdateSupplier}
                    onSupplierStatusUpdate={handleSupplierStatusUpdate}
                    onAddSector={handleAddSector}
                    onUpdateSector={handleUpdateSector}
                    onDeleteSector={handleDeleteSector}
                    onBack={handleBackToEvents}
                    setError={setAppError}
                />;
            case 'supplier_registration':
                if (!supplierInfo) return <RegistrationClosedView />;
                return <RegisterView
                    onRegister={handleSupplierRegister}
                    setError={setAppError}
                    sectors={sectors}
                    predefinedSector={supplierInfo.data.sectors}
                 />;
            case 'registration_closed':
                 return <RegistrationClosedView />;
            default:
                return <LoginView onLogin={handleLogin} error={loginError} />;
        }
    };
    
    return (
        <div className="bg-gray-900 text-white min-h-screen">
            <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))]"></div>
            <div className="relative z-10 flex items-center justify-center min-h-screen">
                {renderContent()}
            </div>
             {appError && (
                <div className="fixed bottom-5 right-5 bg-red-600 text-white py-2 px-4 rounded-lg shadow-lg z-50">
                    {appError}
                </div>
            )}
            <EventModal 
                isOpen={isEventModalOpen}
                onClose={() => setIsEventModalOpen(false)}
                onSave={handleSaveEvent}
                eventToEdit={eventToEdit}
            />
        </div>
    );
};

export default App;
