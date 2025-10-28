import React, { useState, useEffect } from 'react';
import { Attendee, Event, Sector, SubCompany, Supplier } from './types.ts';
import * as api from './firebase/service.ts';
import LoginView from './components/views/LoginView.tsx';
import EventSelectionView from './components/views/EventSelectionView.tsx';
import AdminView from './components/views/AdminView.tsx';
import RegisterView from './components/views/RegisterView.tsx';
import RegistrationClosedView from './components/views/RegistrationClosedView.tsx';
import SupplierAdminView from './components/views/SupplierAdminView.tsx';
import EventModal from './components/EventModal.tsx';
import { SpinnerIcon } from './components/icons.tsx';
import { useTranslation } from './hooks/useTranslation.tsx';

// Simple password check (replace with real auth in a real app)
const ADMIN_PASSWORD = "12345";

const App: React.FC = () => {
    const { t } = useTranslation();
    // App State
    const [isLoading, setIsLoading] = useState(true);
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [loginError, setLoginError] = useState<string | null>(null);
    const [appError, setAppError] = useState('');
    
    // View State
    const [currentView, setCurrentView] = useState<'login' | 'event_selection' | 'admin' | 'supplier_registration' | 'registration_closed' | 'supplier_admin'>('login');
    
    // Data State
    const [events, setEvents] = useState<Event[]>([]);
    const [currentEvent, setCurrentEvent] = useState<Event | null>(null);
    const [attendees, setAttendees] = useState<Attendee[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [sectors, setSectors] = useState<Sector[]>([]);
    
    // Supplier specific state
    const [supplierInfo, setSupplierInfo] = useState<{ id: string; eventId: string; data: Supplier; } | null>(null);
    const [supplierAdminData, setSupplierAdminData] = useState<{ supplierName: string; attendees: Attendee[] } | null>(null);

    
    // Modal State
    const [isEventModalOpen, setIsEventModalOpen] = useState(false);
    const [eventToEdit, setEventToEdit] = useState<Event | null>(null);

    // Handle URL parameters and persisted login state on initial load
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const eventId = params.get('eventId');
        const supplierId = params.get('supplierId');
        const verifyToken = params.get('verify'); // New, unique parameter for the admin view

        const loadPersistedAdminSession = async (persistedEventId: string) => {
            try {
                const eventData = await api.getEvent(persistedEventId);
                if (eventData) {
                    setCurrentEvent(eventData);
                    setCurrentView('admin');
                } else {
                    // Event was not found, likely deleted. Clear storage and go to selection.
                    sessionStorage.removeItem('currentEventId');
                    setCurrentView('event_selection');
                }
            } catch (error) {
                console.error("Failed to load persisted admin session:", error);
                setAppError("Falha ao carregar sessão anterior.");
                sessionStorage.removeItem('currentEventId');
                setCurrentView('event_selection');
            } finally {
                setIsLoading(false);
            }
        };


        // The new verify link has the highest priority to avoid conflicts.
        if (verifyToken) {
            handleSupplierAdminLink(verifyToken);
        } else if (eventId && supplierId) {
            handleSupplierLink(eventId, supplierId);
        } else {
            // If no special link, check for a persisted admin session
            const isAdminLoggedIn = sessionStorage.getItem('isFacialAdminLoggedIn');
            const persistedEventId = sessionStorage.getItem('currentEventId');
            if (isAdminLoggedIn === 'true') {
                setIsLoggedIn(true);
                if (persistedEventId) {
                    // If an event was selected, restore that view directly
                    loadPersistedAdminSession(persistedEventId);
                } else {
                    // If just logged in, go to event selection
                    setCurrentView('event_selection');
                    setIsLoading(false);
                }
            } else {
                // Not logged in and no special links, show login page
                setIsLoading(false);
            }
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
        // If we are not in the admin view or there's no selected event, we should not have any listeners active.
        // The cleanup function from the previous render will handle detaching them.
        if (currentView !== 'admin' || !currentEvent) {
            return;
        }

        // We are in the admin view with an event selected, so attach the listeners.
        const unsubAttendees = api.getAttendees(currentEvent.id, setAttendees);
        const unsubSuppliers = api.getSuppliers(currentEvent.id, setSuppliers);
        const unsubSectors = api.getSectors(currentEvent.id, setSectors);
        
        // This cleanup function is crucial. It runs when the dependencies change (e.g., when the user
        // navigates away from the admin view by changing `currentView` or `currentEvent`).
        return () => {
            unsubAttendees();
            unsubSuppliers();
            unsubSectors();
            // Clear the data to ensure no stale data flashes on the screen when returning to the admin view later.
            setAttendees([]);
            setSuppliers([]);
            setSectors([]);
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

    const handleSupplierAdminLink = async (token: string) => {
        setIsLoading(true);
        try {
            // The service function now throws specific errors instead of returning null.
            const data = await api.getSupplierDataForAdminView(token);
            setSupplierAdminData(data); // `data` will not be null if we reach here
            setCurrentView('supplier_admin');
        } catch (error: any) {
            console.error("Failed to process supplier admin link:", error);
            // The custom error message from the service will be displayed in the toast.
            setAppError(error.message || t('supplierAdmin.invalidLink')); 
            // We still need a view to show while the error toast is visible.
            setCurrentView('registration_closed');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSelectEvent = (event: Event) => {
        sessionStorage.setItem('currentEventId', event.id);
        setCurrentEvent(event);
        setCurrentView('admin');
    };
    
    const handleBackToEvents = () => {
        sessionStorage.removeItem('currentEventId');
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

    const handleAddSupplier = async (name: string, sectors: string[], registrationLimit: number, subCompanies: SubCompany[]) => {
        if (!currentEvent) return Promise.reject();
        await api.addSupplier(currentEvent.id, name, sectors, registrationLimit, subCompanies);
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

    const handleRegenerateSupplierAdminToken = (supplierId: string) => {
        if (!currentEvent) return Promise.reject();
        return api.regenerateSupplierAdminToken(currentEvent.id, supplierId);
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
    
    const handleAttendeeDetailsUpdate = (attendeeId: string, data: Partial<Pick<Attendee, 'name' | 'cpf' | 'sectors' | 'wristbandNumber' | 'subCompany'>>) => {
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
                    sectors={sectors}
                    onRegister={handleRegister}
                    onImportAttendees={handleImportAttendees}
                    onAddSupplier={handleAddSupplier}
                    onUpdateSupplier={handleUpdateSupplier}
                    onDeleteSupplier={handleDeleteSupplier}
                    onSupplierStatusUpdate={handleSupplierStatusUpdate}
                    onRegenerateAdminToken={handleRegenerateSupplierAdminToken}
                    onAddSector={handleAddSector}
                    onUpdateSector={handleUpdateSector}
                    onDeleteSector={handleDeleteSector}
                    onAttendeeDetailsUpdate={handleAttendeeDetailsUpdate}
                    onDeleteAttendee={handleDeleteAttendee}
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
                    supplierName={supplierInfo.data.name}
                    supplierInfo={supplierInfo}
                    // If there's only one sector, predefine it to hide the dropdown.
                    // Otherwise, pass the array of allowed sector IDs.
                    predefinedSector={allowedSectors.length === 1 ? allowedSectors[0].id : supplierInfo.data.sectors}
                 />;
            case 'supplier_admin':
                 if (!supplierAdminData) return <RegistrationClosedView message={t('supplierAdmin.invalidLink')} />;
                 return <SupplierAdminView 
                    supplierName={supplierAdminData.supplierName} 
                    attendees={supplierAdminData.attendees} 
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