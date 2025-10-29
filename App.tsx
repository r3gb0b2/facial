import React, { useState, useEffect, useCallback } from 'react';
import LoginView from './components/views/LoginView.tsx';
import EventSelectionView from './components/views/EventSelectionView.tsx';
import AdminView from './components/views/AdminView.tsx';
import RegisterView from './components/views/RegisterView.tsx';
import SupplierAdminView from './components/views/SupplierAdminView.tsx';
import RegistrationClosedView from './components/views/RegistrationClosedView.tsx';
import { Event, Attendee, Supplier, Sector, CheckinStatus } from './types.ts';
import * as api from './firebase/service.ts';
import { useTranslation } from './hooks/useTranslation.tsx';

type View = 'LOADING' | 'LOGIN' | 'EVENT_SELECTION' | 'ADMIN' | 'SUPPLIER_REGISTRATION' | 'SUPPLIER_ADMIN' | 'REGISTRATION_CLOSED' | 'ERROR';

const App: React.FC = () => {
    const { t } = useTranslation();
    const [view, setView] = useState<View>('LOADING');
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [events, setEvents] = useState<Event[]>([]);
    const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
    const [eventData, setEventData] = useState<{ attendees: Attendee[], suppliers: Supplier[], sectors: Sector[] } | null>(null);
    
    // State for supplier/public views
    const [supplierInfo, setSupplierInfo] = useState<{ data: Supplier & { eventId: string }, name: string, sectors: Sector[] } | null>(null);
    const [supplierAdminData, setSupplierAdminData] = useState<{ eventName: string, attendees: Attendee[], eventId: string, supplierId: string } | null>(null);
    

    const clearError = () => setError(null);

    const handleSetError = (message: string) => {
        setError(message);
        setTimeout(() => clearError(), 5000);
    };

    const loadEvents = useCallback(async () => {
        try {
            const fetchedEvents = await api.getEvents();
            setEvents(fetchedEvents);
        } catch (err) {
            handleSetError(t('errors.loadEvents'));
        }
    }, [t]);

    // Check URL params on initial load
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const eventId = params.get('eventId');
        const supplierId = params.get('supplierId');
        const adminToken = params.get('verify');

        if (adminToken) {
            const unsub = api.subscribeToSupplierAdminData(
                adminToken,
                (data) => {
                    setSupplierAdminData(data);
                    setView('SUPPLIER_ADMIN');
                },
                (err) => {
                    console.error(err);
                    setView('REGISTRATION_CLOSED');
                }
            );
            return () => unsub();
        } else if (eventId && supplierId) {
            api.getSupplierForRegistration(eventId, supplierId).then(async (data) => {
                if (data && data.data.active) {
                    const count = await api.getRegistrationsCountForSupplier(eventId, supplierId);
                    if (count >= data.data.registrationLimit) {
                         setView('REGISTRATION_CLOSED');
                         setError(t('errors.registrationLimitReached'));
                    } else {
                        setSupplierInfo(data);
                        setView('SUPPLIER_REGISTRATION');
                    }
                } else {
                    setView('REGISTRATION_CLOSED');
                }
            }).catch(() => setView('REGISTRATION_CLOSED'));
        } else {
            setView('LOGIN');
        }
    }, [t]);

    useEffect(() => {
        if (isLoggedIn) {
            setView('EVENT_SELECTION');
            loadEvents();
        } else {
            // This condition prevents resetting the view for public links
            if (!['SUPPLIER_REGISTRATION', 'SUPPLIER_ADMIN', 'REGISTRATION_CLOSED'].includes(view)) {
                setView('LOGIN');
            }
        }
    }, [isLoggedIn, loadEvents, view]);

    // Subscribe to event data when an event is selected
    useEffect(() => {
        if (selectedEvent) {
            const unsubscribe = api.subscribeToEventData(
                selectedEvent.id,
                (data) => setEventData(data),
                (err) => {
                    console.error(err);
                    handleSetError(t('errors.subscriptionError'));
                }
            );
            return () => unsubscribe();
        } else {
            setEventData(null);
        }
    }, [selectedEvent, t]);


    const handleLogin = (password: string) => {
        clearError();
        // In a real app, this would be a proper auth check.
        // For this demo, we'll use a hardcoded password.
        if (password === '1234') {
            setIsLoggedIn(true);
        } else {
            setError(t('login.errors.invalidPassword'));
        }
    };

    const handleEventSelect = (event: Event) => {
        setSelectedEvent(event);
        setView('ADMIN');
    };

    const handleBackToEvents = () => {
        setSelectedEvent(null);
        setView('EVENT_SELECTION');
    };

    const handleSaveEvent = async (name: string, eventId?: string) => {
        try {
            if (eventId) {
                await api.updateEvent(eventId, name);
            } else {
                await api.createEvent(name);
            }
            loadEvents();
        } catch (err) {
            handleSetError(t('errors.saveEvent'));
        }
    };

    const handleDeleteEvent = async (event: Event) => {
        try {
            await api.deleteEvent(event.id);
            loadEvents();
        } catch (err) {
            handleSetError(t('errors.deleteEvent'));
        }
    };
    
    const handleRegister = async (newAttendee: Omit<Attendee, 'id' | 'status' | 'eventId' | 'createdAt'>, supplierId?: string) => {
        const eventId = supplierInfo?.data.eventId || selectedEvent?.id;
        if (!eventId) {
            throw new Error("No event selected for registration.");
        }
        
        if (supplierInfo) {
            const count = await api.getRegistrationsCountForSupplier(eventId, supplierInfo.data.id);
            if (count >= supplierInfo.data.registrationLimit) {
                setView('REGISTRATION_CLOSED');
                setError(t('errors.registrationLimitReached'));
                throw new Error(t('errors.registrationLimitReached'));
            }
        }

        await api.addAttendee(eventId, newAttendee, supplierId || supplierInfo?.data.id);
    };

    const renderView = () => {
        switch (view) {
            case 'LOGIN':
                return <LoginView onLogin={handleLogin} error={error} />;
            case 'EVENT_SELECTION':
                return <EventSelectionView events={events} onSelectEvent={handleEventSelect} onCreateEvent={() => {}} onEditEvent={() => {}} onDeleteEvent={handleDeleteEvent} />;
            case 'ADMIN':
                if (selectedEvent && eventData) {
                    return (
                        <AdminView
                            event={selectedEvent}
                            attendees={eventData.attendees}
                            suppliers={eventData.suppliers}
                            sectors={eventData.sectors}
                            onBack={handleBackToEvents}
                            onRegister={handleRegister}
                            setError={handleSetError}
                        />
                    );
                }
                return null; // Or a loading indicator
            case 'SUPPLIER_REGISTRATION':
                if (supplierInfo) {
                    const { data, name, sectors } = supplierInfo;
                    const permittedSectors = sectors.filter(s => data.sectors.includes(s.id));
                    return <RegisterView 
                                onRegister={handleRegister} 
                                setError={handleSetError}
                                sectors={permittedSectors}
                                predefinedSector={data.sectors.length === 1 ? data.sectors[0] : data.sectors}
                                eventName={name}
                                supplierName={data.name}
                                supplierInfo={supplierInfo}
                           />;
                }
                return <RegistrationClosedView message={t('errors.invalidSupplierLink')} />;
             case 'SUPPLIER_ADMIN':
                 if (supplierAdminData) {
                     return <SupplierAdminView {...supplierAdminData} />;
                 }
                 return null;
            case 'REGISTRATION_CLOSED':
                return <RegistrationClosedView message={error || undefined} />;
            case 'LOADING':
                 return <div className="text-white text-center">Loading...</div>; // Replace with a proper spinner/loader
            default:
                return <div className="text-red-500 text-center">An unexpected error occurred.</div>;
        }
    };

    return (
        <div className="bg-gray-900 text-white min-h-screen font-sans">
            <div className="container mx-auto px-4 py-8">
                 {error && view !== 'LOGIN' && (
                    <div className="fixed top-5 right-5 bg-red-600 text-white py-2 px-4 rounded-lg shadow-lg z-50">
                        {error}
                    </div>
                 )}
                {renderView()}
            </div>
        </div>
    );
};

export default App;
