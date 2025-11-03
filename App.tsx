import React, { useState, useEffect } from 'react';
import * as api from './firebase/service.ts';
import { User, Event, Attendee, Supplier, Sector, UserRole } from './types.ts';
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

    // Check for URL parameters or saved session on initial load
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
            // No public link params, check for a saved session
            try {
                const savedUser = sessionStorage.getItem('currentUser');
                if (savedUser) {
                    setUser(JSON.parse(savedUser));
                }
            } catch (e) {
                console.error("Failed to parse user from session storage", e);
                sessionStorage.removeItem('currentUser');
            }
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
            let authenticatedUser: User | null = null;
            
            if (username === 'superadmin' && password === 'superadmin') {
                authenticatedUser = {
                    id: 'superadmin',
                    username: 'superadmin',
                    role: 'superadmin',
                    linkedEventIds: [] // superadmin has access to all events
                };
            } else {
                authenticatedUser = await api.authenticateUser(username, password);
            }
            
            if (authenticatedUser) {
                setUser(authenticatedUser);
                sessionStorage.setItem('currentUser', JSON.stringify(authenticatedUser));
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
        sessionStorage.removeItem('currentUser');
    };

    const handleSelectEvent = (eventId: string) => {
        setCurrentEventId(eventId);
    };
    
    const handleBackToEvents = () => {
        setCurrentEventId(null);
        setEventData({ attendees: [], suppliers: [], sectors: [] });
    };

    // Helper to refetch and filter events for the current user
    const refreshAndFilterEvents = async (currentUser: User) => {
        const allEvents = await api.getEvents();
        if (currentUser.role === 'superadmin') {
            setEvents(allEvents);
        } else {
            const linkedEvents = allEvents.filter(e => currentUser.linkedEventIds.includes(e.id));
            setEvents(linkedEvents);
        }
    };

    // CRUD operations passed down to AdminView
    const handleCreateEvent = async (name: string) => {
        if (!user) return;
        const newEventRef = await api.createEvent(name);
        const newEventId = newEventRef.id;

        if (user.role === 'admin') {
            const updatedLinkedEventIds = [...user.linkedEventIds, newEventId];
            await api.updateUser(user.id, { linkedEventIds: updatedLinkedEventIds });
            // Update the user state; the useEffect will handle refreshing the event list
            const updatedUser = { ...user, linkedEventIds: updatedLinkedEventIds };
            setUser(updatedUser);
            sessionStorage.setItem('currentUser', JSON.stringify(updatedUser));
        } else {
            // For superadmin, just refresh all events
            await refreshAndFilterEvents(user);
        }
    };

    const handleUpdateEvent = async (id: string, name: string) => {
        if (!user) return;
        await api.updateEvent(id, name);
        await refreshAndFilterEvents(user);
    };

    const handleDeleteEvent = async (id: string) => {
        if (!user) return;
        
        await api.deleteEvent(id);

        if (user.role === 'admin') {
            const updatedLinkedEventIds = user.linkedEventIds.filter(eventId => eventId !== id);
            await api.updateUser(user.id, { linkedEventIds: updatedLinkedEventIds }); 
            // Update the user state; the useEffect will handle refreshing the event list
            const updatedUser = { ...user, linkedEventIds: updatedLinkedEventIds };
            setUser(updatedUser);
            sessionStorage.setItem('currentUser', JSON.stringify(updatedUser));
        } else {
            await refreshAndFilterEvents(user);
        }
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
                onRegister={handleRegister}
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