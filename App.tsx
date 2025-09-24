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
const ADMIN_PASSWORD = "12345";

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
    const [supplierInfo, setSupplierInfo] = useState<{ id: string; eventId: string; data: Supplier; } | null>(null);
    
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
    
    // Firebase Listeners for Admin View
    useEffect(() => {
        if (!isLoggedIn) return;
        const unsubscribe = api.getEvents(setEvents);
        return () => unsubscribe();
    }, [isLoggedIn]);

    useEffect(() => {
        if (!currentEvent || currentView !== 'admin') {
            setAttendees([]);
            setSuppliers([]);
            setSectors([]);
            return;
        }

        const unsubAttendees = api.getAttendees(currentEvent.id, setAttendees);
        const unsubSuppliers = api.getSuppliers(currentEvent.id, setSuppliers);
        const unsubSectors = api.getSectors(currentEvent.id, setSectors);
        
        return () => {
            unsubAttendees();
            unsubSuppliers();
            unsubSectors();
        };
    }, [currentEvent, currentView]);

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
            const [supplierData, eventSectors, registrationCount] = await Promise.all([
                api.getSupplier(eventId, supplierId),
                api.getSectorsForEvent(eventId),
                api.getAttendeeCountForSupplier(eventId, supplierId)
            ]);

            if (supplierData && supplierData.active && registrationCount < supplierData.registrationLimit) {
                setSectors(eventSectors); // Set sectors before rendering the view
                setSupplierInfo({ id: supplierId, eventId, data: supplierData });
                setCurrentView('supplier_registration');
            } else {
                setCurrentView('registration_closed');
            }
        } catch (error) {
            console.error("Failed to process supplier link:", error);
            setCurrentView('registration_closed');
        } finally {
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
        try {
            await api.registerAttendeeForSupplier(supplierInfo.eventId, supplierInfo.id, newAttendee);
        } catch (e: any) {
             setAppError(e.message || 'Falha ao registrar participante.');
             if (e.message.includes("Limite")) {
                setCurrentView('registration_closed');
             }
             throw e;
        }
    };

    const handleImportAttendees = (data: any[]) => {
        if (!currentEvent) return Promise.resolve({ successCount: 0, errors: [] });
        return api.addAttendeesFromSpreadsheet(currentEvent.id, data, sectors, attendees);
    };

    const handleAddSupplier = async (name: string, sectors: string[], registrationLimit: number) => {
        if (!currentEvent) return Promise.reject();
        await api.addSupplier(currentEvent.id, name, sectors, registrationLimit);
    };
    
    const handleUpdateSupplier = (supplierId: string, data: Partial<Supplier>) => {
        if (!currentEvent) return Promise.reject();
        return api.updateSupplier(currentEvent.id, supplierId, data);
    };

    const handleSupplierStatusUpdate = (supplierId: string, active: boolean) => {
        if (!currentEvent) return Promise.reject();
        return api.updateSupplier(currentEvent.id, supplierId, { active });
    };

    const handleAddSector = async (label: string) => {
        if (!currentEvent) return Promise.reject();
        await api.addSector(currentEvent.id, label);
    };

    const handleUpdateSector = (sectorId: string, label: string) => {
        if (!currentEvent) return Promise.reject();
        return api.updateSector(currentEvent.id, sectorId, label);
    };

    const handleDeleteSector = (sector: Sector) => {
        if (!currentEvent) return Promise.reject();
        return api.deleteSector(currentEvent.id, sector.id);
    };
    
    const handleAttendeeDetailsUpdate = (attendeeId: string, data: Partial<Pick<Attendee, 'name' | 'cpf' | 'sector'>>) => {
        if (!currentEvent) return Promise.reject();
        return api.updateAttendeeDetails(currentEvent.id, attendeeId, data);
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
                    onAttendeeDetailsUpdate={handleAttendeeDetailsUpdate}
                    onBack={handleBackToEvents}
                    setError={setAppError}
                />;
            case 'supplier_registration':
                if (!supplierInfo) return <RegistrationClosedView />;
                
                // Filter the main sectors list to only those allowed for this supplier
                const allowedSectors = sectors.filter(s => supplierInfo.data.sectors.includes(s.id));
                
                return <RegisterView
                    onRegister={handleSupplierRegister}
                    setError={setAppError}
                    sectors={allowedSectors} // Pass only the allowed sectors
                    // If there's only one sector, predefine it to hide the dropdown.
                    // Otherwise, pass the array of allowed sector IDs.
                    predefinedSector={allowedSectors.length === 1 ? allowedSectors[0].id : supplierInfo.data.sectors}
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
