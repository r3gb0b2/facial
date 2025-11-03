import React, { useState, useEffect } from 'react';
import * as api from './firebase/service.ts';
import { User, Event, Attendee, Supplier, Sector } from './types.ts';
import { useTranslation } from './hooks/useTranslation.tsx';
import LoginView from './components/views/LoginView.tsx';
import EventSelectionView from './components/views/EventSelectionView.tsx';
import AdminView from './components/views/AdminView.tsx';
import RegisterView from './components/views/RegisterView.tsx';
import SupplierAdminView from './components/views/SupplierAdminView.tsx';
import RegistrationClosedView from './components/views/RegistrationClosedView.tsx';
import { XMarkIcon } from './components/icons.tsx';

const App: React.FC = () => {
    const { t } = useTranslation();
    const [user, setUser] = useState<User | null>(null);
    const [events, setEvents] = useState<Event[]>([]);
    const [currentEventId, setCurrentEventId] = useState<string | null>(null);
    const [eventData, setEventData] = useState<{ attendees: Attendee[], suppliers: Supplier[], sectors: Sector[] }>({ attendees: [], suppliers: [], sectors: [] });
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    
    // States for public link routes
    const [supplierInfo, setSupplierInfo] = useState<{ data: Supplier & { eventId: string }, name: string, sectors: Sector[] } | null>(null);
    const [supplierAdminData, setSupplierAdminData] = useState<{ eventName: string, attendees: Attendee[], eventId: string, supplierId: string, supplier: Supplier, sectors: Sector[] } | null>(null);
    const [publicLinkError, setPublicLinkError] = useState<string | null>(null);

    // Check for URL parameters on initial load to handle public links
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const eventId = params.get('eventId');
        const supplierId = params.get('supplierId');
        const adminToken = params.get('verify');

        if (adminToken) {
             const unsubscribe = api.subscribeToSupplierAdminData(
                adminToken,
                (data) => {
                    setSupplierAdminData(data);
                    setIsLoading(false);
                },
                (err) => {
                    console.error(err);
                    setPublicLinkError("Token inválido ou expirado.");
                    setIsLoading(false);
                }
            );
            return () => unsubscribe();
        } else if (eventId && supplierId) {
            const unsubscribe = api.subscribeToSupplierForRegistration(
                eventId,
                supplierId,
                (data) => {
                    if (data && data.data.active) {
                        setSupplierInfo(data);
                    } else {
                        setPublicLinkError(t('supplierRegistration.closedMessage'));
                    }
                    setIsLoading(false);
                },
                (err) => {
                    console.error(err);
                    setPublicLinkError(err.message || "Link inválido ou evento/fornecedor não encontrado.");
                    setIsLoading(false);
                }
            );
            return () => unsubscribe();
        } else {
            // No public link params, proceed with normal auth flow
            setIsLoading(false);
        }
    }, [t]);

    // Effect for handling main app data subscription
    useEffect(() => {
        if (user && currentEventId) {
            const unsubscribe = api.subscribeToEventData(
                currentEventId,
                (data) => setEventData(data),
                (err) => setError(err.message)
            );
            return () => unsubscribe();
        } else if (user && user.role === 'superadmin' && !currentEventId) {
            // Fetch events for superadmin on event selection screen
            api.getEvents().then(setEvents).catch(err => setError(err.message));
        } else if (user && (user.role === 'admin' || user.role === 'checkin') && !currentEventId) {
            // Fetch only linked events for other roles
            api.getEvents().then(allEvents => {
                const linkedEvents = allEvents.filter(e => user.linkedEventIds.includes(e.id));
                setEvents(linkedEvents);
            }).catch(err => setError(err.message));
        }
    }, [user, currentEventId]);

    const handleLogin = async (username: string, password: string) => {
        try {
            setError(null);
            const authenticatedUser = await api.authenticateUser(username, password);
            if (authenticatedUser) {
                setUser(authenticatedUser);
            } else {
                setError('Usuário ou senha inválidos.');
            }
        } catch (err: any) {
            setError(err.message);
        }
    };
    
    const handleLogout = () => {
        setUser(null);
        setCurrentEventId(null);
        setEventData({ attendees: [], suppliers: [], sectors: [] });
    };

    const handleSelectEvent = (eventId: string) => {
        setCurrentEventId(eventId);
    };
    
    const handleBackToEvents = () => {
        setCurrentEventId(null);
        setEventData({ attendees: [], suppliers: [], sectors: [] });
    };

    // CRUD operations passed down to AdminView
    const handleCreateEvent = async (name: string) => {
        await api.createEvent(name);
        const fetchedEvents = await api.getEvents();
        setEvents(fetchedEvents);
    };

    const handleUpdateEvent = async (id: string, name: string) => {
        await api.updateEvent(id, name);
        const fetchedEvents = await api.getEvents();
        setEvents(fetchedEvents);
    };

    const handleDeleteEvent = async (id: string) => {
        await api.deleteEvent(id);
        const fetchedEvents = await api.getEvents();
        setEvents(fetchedEvents);
    };

    const handleRegister = async (newAttendee: Omit<Attendee, 'id' | 'status' | 'eventId' | 'createdAt'>, supplierId?: string) => {
        const eventId = currentEventId || supplierInfo?.data.eventId;
        if (!eventId) {
            setError("Nenhum evento selecionado para o registro.");
            return;
        }
        await api.addAttendee(eventId, newAttendee, supplierId);
    };

    const handleUpdateAttendeeDetails = async (attendeeId: string, data: Partial<Attendee>) => {
        if (!currentEventId) return;
        await api.updateAttendeeDetails(currentEventId, attendeeId, data);
    };

    const handleDeleteAttendee = async (attendeeId: string) => {
        if (!currentEventId) return;
        await api.deleteAttendee(currentEventId, attendeeId);
    };

    // Approval flows
    const handleApproveSubstitution = (attendeeId: string) => api.approveSubstitution(currentEventId!, attendeeId);
    const handleRejectSubstitution = (attendeeId: string) => api.rejectSubstitution(currentEventId!, attendeeId);
    const handleApproveSectorChange = (attendeeId: string) => api.approveSectorChange(currentEventId!, attendeeId);
    const handleRejectSectorChange = (attendeeId: string) => api.rejectSectorChange(currentEventId!, attendeeId);
    const handleApproveNewRegistration = (attendeeId: string) => api.approveNewRegistration(currentEventId!, attendeeId);
    const handleRejectNewRegistration = (attendeeId: string) => api.rejectNewRegistration(currentEventId!, attendeeId);
    
    const clearError = () => setError(null);
    
    const renderContent = () => {
        if (isLoading) {
            return <div className="text-white text-center">Carregando...</div>;
        }

        // Public Routes
        if (supplierAdminData) {
            return <SupplierAdminView {...supplierAdminData} />;
        }
        if (supplierInfo) {
             const { data: supplierData, name: eventName, sectors } = supplierInfo;
             // Here we can't easily check the limit without a subscription.
             // The check is performed inside the registration modal instead.
            return (
                <div className="p-4 md:p-8">
                    <RegisterView
                      onRegister={handleRegister}
                      setError={setError}
                      sectors={sectors}
                      predefinedSector={supplierData.sectors}
                      eventName={eventName}
                      supplierName={supplierData.name}
                      supplierInfo={supplierInfo}
                    />
                </div>
            );
        }
         if (publicLinkError) {
            return <RegistrationClosedView message={publicLinkError} />;
        }

        // Authenticated Routes
        if (!user) {
            return <LoginView onLogin={handleLogin} error={error} />;
        }
        if (!currentEventId) {
            return (
                <EventSelectionView
                    user={user}
                    events={events}
                    onSelectEvent={handleSelectEvent}
                    onCreateEvent={handleCreateEvent}
                    onUpdateEvent={handleUpdateEvent}
                    onDeleteEvent={handleDeleteEvent}
                    onLogout={handleLogout}
                />
            );
        }
        return (
            <AdminView
                user={user}
                eventData={eventData}
                currentEventId={currentEventId}
                currentEventName={events.find(e => e.id === currentEventId)?.name || ''}
                onBackToEvents={handleBackToEvents}
                onLogout={handleLogout}
                onRegister={onRegister}
                onUpdateAttendeeDetails={handleUpdateAttendeeDetails}
                onDeleteAttendee={handleDeleteAttendee}
                onApproveSubstitution={handleApproveSubstitution}
                onRejectSubstitution={handleRejectSubstitution}
                onApproveSectorChange={handleApproveSectorChange}
                onRejectSectorChange={handleRejectSectorChange}
                onApproveNewRegistration={handleApproveNewRegistration}
                onRejectNewRegistration={handleRejectNewRegistration}
                setError={setError}
            />
        );
    };

    return (
        <div className="bg-gray-900 text-white min-h-screen font-sans">
            {error && (
                <div className="fixed top-5 right-5 bg-red-600 text-white py-3 px-5 rounded-lg shadow-lg z-50 flex items-center gap-4 animate-fade-in-down">
                    <p>{error}</p>
                    <button onClick={clearError} className="p-1 rounded-full hover:bg-red-700">
                        <XMarkIcon className="w-5 h-5"/>
                    </button>
                </div>
            )}
            <main className="min-h-screen flex items-center justify-center">
               {renderContent()}
            </main>
        </div>
    );
};

export default App;
