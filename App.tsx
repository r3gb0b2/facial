import React, { useState, useEffect } from 'react';
import * as api from './firebase/service.ts';
import { User, Event, Attendee, Supplier, Sector, UserRole, EventModules } from './types.ts';
import { useTranslation } from './hooks/useTranslation.tsx';
import LoginView from './components/views/LoginView.tsx';
import EventSelectionView from './components/views/EventSelectionView.tsx';
import AdminView from './components/views/AdminView.tsx';
import RegisterView from './components/views/RegisterView.tsx';
import SupplierAdminView from './components/views/SupplierAdminView.tsx';
import RegistrationClosedView from './components/views/RegistrationClosedView.tsx';
import UserRegistrationView from './components/views/UserRegistrationView.tsx';
import { XMarkIcon, SpinnerIcon } from './components/icons.tsx';

const App: React.FC = () => {
    const { t } = useTranslation();
    const [user, setUser] = useState<User | null>(null);
    const [events, setEvents] = useState<Event[]>([]);
    const [currentEventId, setCurrentEventId] = useState<string | null>(null);
    const [eventData, setEventData] = useState<{ attendees: Attendee[], suppliers: Supplier[], sectors: Sector[] }>({ attendees: [], suppliers: [], sectors: [] });
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    
    // States for public link routes
    const [supplierInfo, setSupplierInfo] = useState<{ data: Supplier & { eventId: string }, name: string, sectors: Sector[], allowPhotoChange: boolean, allowGuestUploads: boolean } | null>(null);
    const [supplierAdminData, setSupplierAdminData] = useState<{ eventName: string, attendees: Attendee[], eventId: string, supplierId: string, supplier: Supplier, sectors: Sector[] } | null>(null);
    const [publicLinkError, setPublicLinkError] = useState<string | null>(null);
    const [isUserSignupMode, setIsUserSignupMode] = useState(false);
    const [inviteToken, setInviteToken] = useState<string | null>(null);

    // Check for URL parameters or saved session on initial load
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const eventId = params.get('eventId');
        const supplierId = params.get('supplierId');
        const adminToken = params.get('verify');
        const mode = params.get('mode');
        const token = params.get('token');

        if (mode === 'signup') {
            setIsUserSignupMode(true);
            setInviteToken(token);
            setIsLoading(false);
            return;
        }

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

    // Helper to refetch and filter events for the current user
    const refreshAndFilterEvents = async (currentUser: User) => {
        try {
            const allEvents = await api.getEvents();
            if (currentUser.role === 'superadmin') {
                setEvents(allEvents);
            } else {
                const linkedEvents = allEvents.filter(e => currentUser.linkedEventIds.includes(e.id));
                setEvents(linkedEvents);
            }
        } catch (err: any) {
            setError(err.message);
        }
    };

    // Effect for handling main app data subscription
    useEffect(() => {
        if (user && currentEventId) {
            const unsubscribe = api.subscribeToEventData(
                currentEventId,
                (data) => setEventData(data),
                (err) => setError(err.message)
            );
            return () => unsubscribe();
        } else if (user) {
            // Load events list when user is logged in but no event selected
             refreshAndFilterEvents(user);
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
        setIsUserSignupMode(false);
        setInviteToken(null);
        window.location.href = window.location.origin; // Clear URL params
    };

    const handleSelectEvent = (eventId: string) => {
        setCurrentEventId(eventId);
    };
    
    const handleBackToEvents = () => {
        setCurrentEventId(null);
        setEventData({ attendees: [], suppliers: [], sectors: [] });
    };

    // --- Event CRUD Wrappers ---
    const handleCreateEvent = async (name: string, modules?: EventModules, allowPhotoChange?: boolean, allowGuestUploads?: boolean) => {
        try {
            await api.createEvent(name, modules, allowPhotoChange, allowGuestUploads);
            if (user) refreshAndFilterEvents(user);
        } catch (err: any) {
            setError(err.message);
        }
    };

    const handleUpdateEvent = async (id: string, name: string, modules?: EventModules, allowPhotoChange?: boolean, allowGuestUploads?: boolean) => {
        try {
            await api.updateEvent(id, name, modules, allowPhotoChange, allowGuestUploads);
            if (user) refreshAndFilterEvents(user);
        } catch (err: any) {
            setError(err.message);
        }
    };

    const handleDeleteEvent = async (id: string) => {
        try {
            await api.deleteEvent(id);
            if (user) refreshAndFilterEvents(user);
        } catch (err: any) {
             setError(err.message);
        }
    };

    // --- Attendee CRUD Wrappers ---
    const handleRegister = async (newAttendee: Omit<Attendee, 'id' | 'status' | 'eventId' | 'createdAt'>, supplierId?: string) => {
        if (!currentEventId) return;
        await api.addAttendee(currentEventId, newAttendee, supplierId);
    };

    const handlePublicRegister = async (newAttendee: Omit<Attendee, 'id' | 'status' | 'eventId' | 'createdAt'>, supplierId?: string) => {
        if (!supplierInfo) return;
        await api.addAttendee(supplierInfo.data.eventId, newAttendee, supplierInfo.data.id);
    };

    const handleUpdateAttendeeDetails = async (attendeeId: string, data: Partial<Attendee>) => {
        if (!currentEventId) return;
        await api.updateAttendeeDetails(currentEventId, attendeeId, data);
    };

    const handleDeleteAttendee = async (attendeeId: string) => {
        if (!currentEventId) return;
        await api.deleteAttendee(currentEventId, attendeeId);
    };

    const handleApproveSubstitution = async (attendeeId: string) => {
        if (!currentEventId) return;
        await api.approveSubstitution(currentEventId, attendeeId);
    };

    const handleRejectSubstitution = async (attendeeId: string) => {
        if (!currentEventId) return;
        await api.rejectSubstitution(currentEventId, attendeeId);
    };

    const handleApproveSectorChange = async (attendeeId: string) => {
        if (!currentEventId) return;
        await api.approveSectorChange(currentEventId, attendeeId);
    };

    const handleRejectSectorChange = async (attendeeId: string) => {
        if (!currentEventId) return;
        await api.rejectSectorChange(currentEventId, attendeeId);
    };
    
    const handleApproveNewRegistration = async (attendeeId: string) => {
        if (!currentEventId) return;
        await api.approveNewRegistration(currentEventId, attendeeId);
    };

    const handleRejectNewRegistration = async (attendeeId: string) => {
        if (!currentEventId) return;
        await api.rejectNewRegistration(currentEventId, attendeeId);
    };


    if (isLoading) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <div className="text-center">
                    <SpinnerIcon className="w-12 h-12 text-indigo-500 animate-spin mx-auto mb-4"/>
                    <p className="text-gray-400">Carregando sistema...</p>
                </div>
            </div>
        );
    }

    // 1. User Self-Registration Route
    if (isUserSignupMode) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
                <UserRegistrationView 
                    onBack={() => {
                        setIsUserSignupMode(false);
                        window.location.href = window.location.origin;
                    }} 
                    token={inviteToken} 
                />
            </div>
        );
    }

    // 2. Public Link Error
    if (publicLinkError) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
                <RegistrationClosedView message={publicLinkError} />
            </div>
        );
    }

    // 3. Public Supplier Registration View
    if (supplierInfo) {
         return (
            <div className="min-h-screen bg-gray-900 py-10 px-4">
                <RegisterView
                    onRegister={handlePublicRegister}
                    setError={(msg) => alert(msg)} // Simple alert for public view or create a local toast state
                    sectors={supplierInfo.sectors}
                    predefinedSector={supplierInfo.data.sectors} // Can be string[] 
                    eventName={supplierInfo.name}
                    supplierName={supplierInfo.data.name}
                    supplierInfo={supplierInfo}
                    allowPhotoChange={supplierInfo.allowPhotoChange}
                    allowGuestUploads={supplierInfo.allowGuestUploads}
                />
            </div>
        );
    }

    // 4. Supplier Admin Dashboard (Read-Only/Request Mode)
    if (supplierAdminData) {
        return (
            <div className="min-h-screen bg-gray-900">
                <SupplierAdminView 
                    eventName={supplierAdminData.eventName}
                    attendees={supplierAdminData.attendees}
                    eventId={supplierAdminData.eventId}
                    supplier={supplierAdminData.supplier}
                    sectors={supplierAdminData.sectors}
                />
            </div>
        );
    }

    // 5. Login View
    if (!user) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
                <LoginView onLogin={handleLogin} error={error} />
            </div>
        );
    }

    // 6. Event Selection View (Logged in, no event selected)
    if (!currentEventId) {
        return (
             <div className="min-h-screen bg-gray-900 p-4 flex items-center justify-center">
                <EventSelectionView
                    user={user}
                    events={events}
                    onSelectEvent={handleSelectEvent}
                    onCreateEvent={handleCreateEvent}
                    onUpdateEvent={handleUpdateEvent}
                    onDeleteEvent={handleDeleteEvent}
                    onLogout={handleLogout}
                />
            </div>
        );
    }

    // 7. Main Admin Dashboard (Logged in, event selected)
    const currentEvent = events.find(e => e.id === currentEventId);
    
    // Safety check in case event was deleted while user was active
    if (!currentEvent) {
        handleBackToEvents();
        return null;
    }

    return (
        <div className="min-h-screen bg-gray-900 text-gray-100 font-sans">
             {error && (
                <div className="fixed top-4 right-4 z-50 bg-red-500 text-white px-6 py-4 rounded-lg shadow-xl flex items-center gap-3 animate-fade-in-down">
                    <XMarkIcon className="w-6 h-6 cursor-pointer" onClick={() => setError(null)} />
                    <p>{error}</p>
                </div>
            )}
            <AdminView
                user={user}
                eventData={eventData}
                currentEvent={currentEvent}
                currentEventId={currentEventId}
                currentEventName={currentEvent.name}
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
        </div>
    );
};

export default App;