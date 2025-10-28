import React, { useState, useEffect, useCallback } from 'react';
import { Attendee, Event, Sector, Supplier, CheckinStatus } from './types.ts';
import * as api from './firebase/service.ts';
import LoginView from './components/views/LoginView.tsx';
import EventSelectionView from './components/views/EventSelectionView.tsx';
import AdminView from './components/views/AdminView.tsx';
import RegisterView from './components/views/RegisterView.tsx';
import SupplierAdminView from './components/views/SupplierAdminView.tsx';
import RegistrationClosedView from './components/views/RegistrationClosedView.tsx';
import { useTranslation } from './hooks/useTranslation.tsx';

// This is a simplified routing based on URL hash
const getAppRoute = () => {
  const hash = window.location.hash.slice(1);
  if (hash.startsWith('supplier/')) {
    const supplierId = hash.split('/')[1];
    if (hash.endsWith('/admin')) {
        return { view: 'supplier_admin', supplierId: supplierId.replace('/admin', '') };
    }
    return { view: 'supplier_registration', supplierId };
  }
  return { view: 'admin' };
};

const App: React.FC = () => {
    const { t } = useTranslation();
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isAuthenticated, setIsAuthenticated] = useState(() => sessionStorage.getItem('isAuthenticated') === 'true');
    
    // App route/view state
    const [appRoute, setAppRoute] = useState(getAppRoute());

    // Event state
    const [events, setEvents] = useState<Event[]>([]);
    const [currentEvent, setCurrentEvent] = useState<Event | null>(null);
    
    // Data for the current event
    const [attendees, setAttendees] = useState<Attendee[]>([]);
    const [sectors, setSectors] = useState<Sector[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);

    // State for supplier-specific views
    const [currentSupplierInfo, setCurrentSupplierInfo] = useState<{data: Supplier, attendees: Attendee[]} | null>(null);


    useEffect(() => {
        const handleHashChange = () => {
            setAppRoute(getAppRoute());
        };
        window.addEventListener('hashchange', handleHashChange);
        return () => window.removeEventListener('hashchange', handleHashChange);
    }, []);

    // Clear error message after a few seconds
    useEffect(() => {
        if (error) {
            const timer = setTimeout(() => setError(null), 5000);
            return () => clearTimeout(timer);
        }
    }, [error]);

    const handleLogin = (password: string) => {
        if (password === 'admin') {
            sessionStorage.setItem('isAuthenticated', 'true');
            setIsAuthenticated(true);
            setError(null);
        } else {
            setError(t('login.errors.invalidPassword'));
        }
    };

    const handleLogout = useCallback(() => {
        sessionStorage.removeItem('isAuthenticated');
        sessionStorage.removeItem('currentEventId');
        setCurrentEvent(null);
        setIsAuthenticated(false);
    }, []);

    const handleSelectEvent = useCallback((event: Event) => {
        sessionStorage.setItem('currentEventId', event.id);
        setCurrentEvent(event);
    }, []);
    
    // Main data loading and session restoration logic for the admin view
    useEffect(() => {
        if (appRoute.view === 'admin') {
            if (!isAuthenticated) {
                setIsLoading(false);
                return;
            }

            // If an event is already loaded, don't re-run this logic
            if (currentEvent) {
                return; 
            }

            const savedEventId = sessionStorage.getItem('currentEventId');
            if (savedEventId) {
                // Restore session to a specific event
                api.getEvent(savedEventId).then(event => {
                    if (event) {
                        setCurrentEvent(event);
                    } else {
                        sessionStorage.removeItem('currentEventId');
                        api.getEvents().then(setEvents);
                    }
                }).catch(err => {
                    console.error("Failed to restore event:", err);
                    sessionStorage.removeItem('currentEventId');
                    setError("Falha ao carregar o evento anterior.");
                    api.getEvents().then(setEvents);
                }).finally(() => {
                    setIsLoading(false);
                });
            } else {
                // No saved event, load the list of events
                api.getEvents().then(setEvents).catch(err => {
                    console.error(err);
                    setError(t('events.errors.load'));
                }).finally(() => {
                    setIsLoading(false);
                });
            }
        }
    }, [isAuthenticated, appRoute.view, t, currentEvent]);

    // Fetch data when a supplier route is accessed
    useEffect(() => {
        if (appRoute.view === 'supplier_registration' || appRoute.view === 'supplier_admin') {
            const { supplierId } = appRoute;
            if (supplierId) {
                setIsLoading(true);
                Promise.all([
                    api.getSupplierInfoForRegistration(supplierId),
                    api.getAttendeesForSupplier(supplierId)
                ]).then(([supplierData, supplierAttendees]) => {
                    setCurrentSupplierInfo({ data: supplierData, attendees: supplierAttendees });
                    // We need sectors for the registration form
                    if (supplierData.eventId) {
                        api.getSectors(supplierData.eventId).then(setSectors);
                    }
                }).catch(err => {
                    console.error(err);
                    setError("Link de fornecedor inválido ou o evento não foi encontrado.");
                }).finally(() => setIsLoading(false));
            }
        }
    }, [appRoute]);


    // Subscribe to live data for the selected event
    useEffect(() => {
        if (currentEvent) {
            const unsubscribeAttendees = api.subscribeToAttendees(currentEvent.id, setAttendees);
            const unsubscribeSectors = api.subscribeToSectors(currentEvent.id, setSectors);
            const unsubscribeSuppliers = api.subscribeToSuppliers(currentEvent.id, setSuppliers);
            
            return () => {
                unsubscribeAttendees();
                unsubscribeSectors();
                unsubscribeSuppliers();
            };
        } else {
            // Clear data if no event is selected
            setAttendees([]);
            setSectors([]);
            setSuppliers([]);
        }
    }, [currentEvent]);
    
    // Event handlers
    const handleAddEvent = async (name: string) => {
        await api.addEvent(name);
        // Refetch events
        api.getEvents().then(setEvents);
    };

    const handleUpdateEvent = async (eventId: string, name: string) => {
        await api.updateEvent(eventId, name);
        api.getEvents().then(setEvents);
    };

    const handleDeleteEvent = async (event: Event) => {
        if (window.confirm(t('events.deleteConfirm', event.name))) {
            try {
                await api.deleteEvent(event.id);
                api.getEvents().then(setEvents);
            } catch (error) {
                console.error(error);
                setError(t('events.errors.delete'));
            }
        }
    };

    // Handler for new attendee registration
    const handleRegister = useCallback(async (newAttendee: Omit<Attendee, 'id' | 'status' | 'eventId' | 'createdAt'>) => {
        const eventId = currentEvent?.id || currentSupplierInfo?.data.eventId;
        if (!eventId) {
            setError("Nenhum evento selecionado para o cadastro.");
            throw new Error("Missing eventId");
        }

        // Add supplierId if it exists on the supplier link
        const supplierId = appRoute.view === 'supplier_registration' ? appRoute.supplierId : undefined;

        const completeAttendee = {
            ...newAttendee,
            eventId,
            ...(supplierId && { supplierId }),
            status: CheckinStatus.PENDING,
        };

        try {
            await api.addAttendee(completeAttendee as Omit<Attendee, 'id' | 'createdAt'> & {createdAt?: Date});
        } catch (error) {
            console.error(error);
            setError(t('register.errors.submit'));
            throw error; // Re-throw to be caught by the form
        }
    }, [currentEvent, currentSupplierInfo, appRoute, t]);

    const handleUpdateAttendeeDetails = async (attendeeId: string, data: Partial<Pick<Attendee, 'name' | 'cpf' | 'sector' | 'wristbandNumber' | 'subCompany'>>) => {
        if (!currentEvent) return;
        try {
            await api.updateAttendeeDetails(currentEvent.id, attendeeId, data);
        } catch(e) {
            setError('Falha ao atualizar os dados.');
        }
    }
    
    const handleDeleteAttendee = async (attendeeId: string) => {
        if(!currentEvent) return;
        await api.deleteAttendee(currentEvent.id, attendeeId);
    }
    
    // Main render logic
    const renderContent = () => {
        if (isLoading) {
            return <div className="min-h-screen flex items-center justify-center text-white">Carregando...</div>;
        }

        if (appRoute.view === 'supplier_registration' && currentSupplierInfo) {
            if (!currentSupplierInfo.data.registrationOpen) {
                return <RegistrationClosedView />;
            }
            return (
                <div className="min-h-screen flex flex-col justify-center items-center p-4">
                    <RegisterView 
                        onRegister={handleRegister}
                        setError={setError}
                        sectors={sectors}
                        predefinedSector={currentSupplierInfo.data.sectors}
                        supplierName={currentSupplierInfo.data.name}
                        supplierInfo={currentSupplierInfo}
                    />
                </div>
            );
        }
        
        if (appRoute.view === 'supplier_admin' && currentSupplierInfo) {
            return <SupplierAdminView supplierName={currentSupplierInfo.data.name} attendees={currentSupplierInfo.attendees} />;
        }

        // Default to admin flow
        if (!isAuthenticated) {
            return (
                <div className="min-h-screen flex flex-col justify-center items-center p-4">
                    <header className="py-6 text-center">
                        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-500">
                            {t('header.title')}
                        </h1>
                        <p className="text-gray-400 mt-2">{t('header.subtitle')}</p>
                    </header>
                    <LoginView onLogin={handleLogin} error={error} />
                </div>
            );
        }

        if (!currentEvent) {
            return (
                <EventSelectionView
                    events={events}
                    onSelectEvent={handleSelectEvent}
                    onCreateEvent={() => {/* Logic to open modal */}}
                    onEditEvent={(event) => {/* Logic to open modal */}}
                    onDeleteEvent={handleDeleteEvent}
                />
            );
        }

        return (
            <AdminView
                currentEvent={currentEvent}
                attendees={attendees}
                sectors={sectors}
                suppliers={suppliers}
                onRegister={handleRegister}
                onUpdateAttendeeDetails={handleUpdateAttendeeDetails}
                onDeleteAttendee={handleDeleteAttendee}
                onAddSector={(label, color) => api.addSector(currentEvent.id, label, color)}
                onUpdateSector={(id, data) => api.updateSector(currentEvent.id, id, data)}
                onDeleteSector={(sector) => api.deleteSector(currentEvent.id, sector.id, attendees)}
                onAddSupplier={(name, sectorIds) => api.addSupplier(currentEvent.id, name, sectorIds)}
                onUpdateSupplier={(id, data) => api.updateSupplier(currentEvent.id, id, data)}
                onDeleteSupplier={(supplier) => api.deleteSupplier(currentEvent.id, supplier.id)}
                onToggleSupplierRegistration={(id, isOpen) => api.toggleSupplierRegistration(currentEvent.id, id, isOpen)}
                onLogout={handleLogout}
                setError={setError}
            />
        );
    };

    return (
        <div className="bg-gray-900 text-white min-h-screen font-sans">
            <main>
                {renderContent()}
            </main>
            {error && (
                <div className="fixed bottom-4 right-4 bg-red-600 text-white py-2 px-4 rounded-lg shadow-lg animate-pulse">
                    {error}
                </div>
            )}
        </div>
    );
};

export default App;