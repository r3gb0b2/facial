import React, { useState, useEffect } from 'react';
import { Attendee, Event, Sector, Supplier, SupplierCategory } from './types.ts';
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
    const [currentView, setCurrentView] = useState<'login' | 'event_selection' | 'admin' | 'category_registration' | 'registration_closed'>('login');
    
    // Data State
    const [events, setEvents] = useState<Event[]>([]);
    const [currentEvent, setCurrentEvent] = useState<Event | null>(null);
    const [attendees, setAttendees] = useState<Attendee[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [supplierCategories, setSupplierCategories] = useState<SupplierCategory[]>([]);
    const [sectors, setSectors] = useState<Sector[]>([]);
    
    // Category registration specific state
    const [categoryRegistrationInfo, setCategoryRegistrationInfo] = useState<{
        eventId: string;
        category: SupplierCategory;
        suppliers: Supplier[];
        sectors: Sector[];
        attendees: Attendee[];
    } | null>(null);
    
    // Modal State
    const [isEventModalOpen, setIsEventModalOpen] = useState(false);
    const [eventToEdit, setEventToEdit] = useState<Event | null>(null);

    // Handle URL parameters and persisted login state on initial load
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const eventId = params.get('eventId');
        const categoryId = params.get('categoryId');

        // Category links take priority over admin login
        if (eventId && categoryId) {
            handleCategoryLink(eventId, categoryId);
        } else {
            // If no supplier link, check for a persisted admin session
            const isAdminLoggedIn = sessionStorage.getItem('isFacialAdminLoggedIn');
            if (isAdminLoggedIn === 'true') {
                setIsLoggedIn(true);
                setCurrentView('event_selection');
            }
            // In either case (logged in or not), we're done with initial checks.
            setIsLoading(false);
        }
    }, []);
    
    // Firebase Listeners for Admin View
    useEffect(() => {
        if (!isLoggedIn) return;
        const unsubscribe = api.getEvents(setEvents);
        return () => unsubscribe();
    }, [isLoggedIn]);

    // This effect manages the real-time data listeners for the admin view.
    useEffect(() => {
        if (currentView !== 'admin' || !currentEvent) {
            return;
        }

        const unsubAttendees = api.getAttendees(currentEvent.id, setAttendees);
        const unsubSuppliers = api.getSuppliers(currentEvent.id, setSuppliers);
        const unsubSectors = api.getSectors(currentEvent.id, setSectors);
        const unsubCategories = api.getSupplierCategories(currentEvent.id, setSupplierCategories);
        
        return () => {
            unsubAttendees();
            unsubSuppliers();
            unsubSectors();
            unsubCategories();
            setAttendees([]);
            setSuppliers([]);
            setSectors([]);
            setSupplierCategories([]);
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
            sessionStorage.setItem('isFacialAdminLoggedIn', 'true'); // Persist login state
            setIsLoggedIn(true);
            setCurrentView('event_selection');
            setLoginError(null);
        } else {
            setLoginError('Senha incorreta.');
        }
    };
    
    const handleCategoryLink = async (eventId: string, categoryId: string) => {
        try {
            const [category, suppliers, sectors, attendees] = await Promise.all([
                api.getSupplierCategory(eventId, categoryId),
                api.getSuppliersForCategory(eventId, categoryId),
                api.getSectorsForEvent(eventId),
                api.getAttendeesOnce(eventId), // Fetch all attendees once to check limits
            ]);

            if (category && suppliers.length > 0) {
                setCategoryRegistrationInfo({ eventId, category, suppliers, sectors, attendees });
                setCurrentView('category_registration');
            } else {
                setCurrentView('registration_closed');
            }
        } catch (error) {
            console.error("Failed to process category link:", error);
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
        if (!categoryRegistrationInfo) return;
        try {
            // The supplierId is now part of the newAttendee object from the form
            await api.addAttendee(categoryRegistrationInfo.eventId, newAttendee);
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

    const handleAddSupplierCategory = async (name: string) => {
        if (!currentEvent) return Promise.reject();
        await api.addSupplierCategory(currentEvent.id, name);
    };
    const handleUpdateSupplierCategory = (categoryId: string, name: string) => {
        if (!currentEvent) return Promise.reject();
        return api.updateSupplierCategory(currentEvent.id, categoryId, name);
    };
    const handleDeleteSupplierCategory = (category: SupplierCategory) => {
        if (!currentEvent) return Promise.reject();
        return api.deleteSupplierCategory(currentEvent.id, category.id);
    };


    const handleAddSupplier = async (name: string, sectors: string[], registrationLimit: number, categoryId: string) => {
        if (!currentEvent) return Promise.reject();
        await api.addSupplier(currentEvent.id, name, sectors, registrationLimit, categoryId);
    };
    
    const handleUpdateSupplier = (supplierId: string, data: Partial<Supplier>) => {
        if (!currentEvent) return Promise.reject();
        return api.updateSupplier(currentEvent.id, supplierId, data);
    };

    const handleDeleteSupplier = (supplier: Supplier) => {
        if (!currentEvent) return Promise.reject();
        return api.deleteSupplier(currentEvent.id, supplier.id);
    };

    const handleSupplierStatusUpdate = (supplierId: string, active: boolean) => {
        if (!currentEvent) return Promise.reject();
        return api.updateSupplier(currentEvent.id, supplierId, { active });
    };

    const handleAddSector = async (label: string, color: string) => {
        if (!currentEvent) return Promise.reject();
        await api.addSector(currentEvent.id, label, color);
    };

    const handleUpdateSector = (sectorId: string, data: { label: string; color: string; }) => {
        if (!currentEvent) return Promise.reject();
        return api.updateSector(currentEvent.id, sectorId, data);
    };

    const handleDeleteSector = (sector: Sector) => {
        if (!currentEvent) return Promise.reject();
        return api.deleteSector(currentEvent.id, sector.id);
    };
    
    const handleAttendeeDetailsUpdate = (attendeeId: string, data: Partial<Pick<Attendee, 'name' | 'cpf' | 'sector' | 'wristbandNumber'>>) => {
        if (!currentEvent) return Promise.reject();
        return api.updateAttendeeDetails(currentEvent.id, attendeeId, data);
    };

    const handleDeleteAttendee = async (attendeeId: string) => {
        if (!currentEvent) return;
        if (window.confirm('Tem certeza que deseja deletar este participante? Esta ação é irreversível.')) {
            try {
                await api.deleteAttendee(currentEvent.id, attendeeId);
            } catch (e) {
                setAppError('Falha ao deletar participante.');
            }
        }
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
                    supplierCategories={supplierCategories}
                    sectors={sectors}
                    onRegister={handleRegister}
                    onImportAttendees={handleImportAttendees}
                    onAddSupplierCategory={handleAddSupplierCategory}
                    onUpdateSupplierCategory={handleUpdateSupplierCategory}
                    onDeleteSupplierCategory={handleDeleteSupplierCategory}
                    onAddSupplier={handleAddSupplier}
                    onUpdateSupplier={handleUpdateSupplier}
                    onDeleteSupplier={handleDeleteSupplier}
                    onSupplierStatusUpdate={handleSupplierStatusUpdate}
                    onAddSector={handleAddSector}
                    onUpdateSector={handleUpdateSector}
                    onDeleteSector={handleDeleteSector}
                    onAttendeeDetailsUpdate={handleAttendeeDetailsUpdate}
                    onDeleteAttendee={handleDeleteAttendee}
                    onBack={handleBackToEvents}
                    setError={setAppError}
                />;
            case 'category_registration':
                if (!categoryRegistrationInfo) return <RegistrationClosedView />;
                return <RegisterView
                    onRegister={handleSupplierRegister}
                    setError={setAppError}
                    categoryRegistrationInfo={categoryRegistrationInfo}
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