import React, { useState, useEffect, useCallback } from 'react';
import { Attendee, Event, Sector, Supplier, CheckinStatus, SubCompany } from './types.ts';
import * as api from './firebase/service.ts';
import { useTranslation } from './hooks/useTranslation.tsx';

import LoginView from './components/views/LoginView.tsx';
import EventSelectionView from './components/views/EventSelectionView.tsx';
import AdminView from './components/views/AdminView.tsx';
import RegisterView from './components/views/RegisterView.tsx';
import SupplierAdminView from './components/views/SupplierAdminView.tsx';
import RegistrationClosedView from './components/views/RegistrationClosedView.tsx';
import EventModal from './components/EventModal.tsx';

type View = 'login' | 'event-selection' | 'admin' | 'supplier-registration' | 'supplier-admin' | 'closed';

const App: React.FC = () => {
  const { t } = useTranslation();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [view, setView] = useState<View>('login');
  const [isLoading, setIsLoading] = useState(true);
  const [globalError, setGlobalError] = useState<string>('');

  // Data state
  const [events, setEvents] = useState<Event[]>([]);
  const [currentEvent, setCurrentEvent] = useState<Event | null>(null);
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [sectors, setSectors] = useState<Sector[]>([]);
  
  // Supplier view state
  const [supplierInfo, setSupplierInfo] = useState<{data: Supplier, name: string} | null>(null);
  const [supplierAdminData, setSupplierAdminData] = useState<{name: string, attendees: Attendee[]} | null>(null);

  // Modal state
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [eventToEdit, setEventToEdit] = useState<Event | null>(null);

  const clearGlobalError = () => {
    if (globalError) {
      setTimeout(() => setGlobalError(''), 5000);
    }
  };

  useEffect(clearGlobalError, [globalError]);

  const handleLogin = (password: string) => {
    if (password === 'admin') {
      setIsLoggedIn(true);
      setLoginError(null);
      setView('event-selection');
    } else {
      setLoginError(t('login.errors.invalidPassword'));
    }
  };

  const loadEvents = useCallback(async () => {
    setIsLoading(true);
    try {
      const fetchedEvents = await api.getEvents();
      setEvents(fetchedEvents);
    } catch (error) {
      console.error(error);
      setGlobalError(t('errors.loadEvents'));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (isLoggedIn) {
      loadEvents();
    }
  }, [isLoggedIn, loadEvents]);

  useEffect(() => {
    const checkUrlParams = async () => {
        const params = new URLSearchParams(window.location.search);
        const eventId = params.get('eventId');
        const supplierId = params.get('supplierId');
        const verifyToken = params.get('verify');

        if (verifyToken) {
            setIsLoading(true);
            const data = await api.getSupplierAdminData(verifyToken);
            if (data) {
                setSupplierAdminData(data);
                setView('supplier-admin');
            } else {
                setGlobalError('Link de administrador inválido ou expirado.');
                setView('closed');
            }
            setIsLoading(false);
        } else if (eventId && supplierId) {
            setIsLoading(true);
            const supplierData = await api.getSupplierForRegistration(eventId, supplierId);
            if (supplierData) {
                if (supplierData.data.active) {
                    setSupplierInfo(supplierData);
                    setView('supplier-registration');
                } else {
                     setView('closed');
                }
            } else {
                setGlobalError(t('errors.invalidSupplierLink'));
                setView('login'); // Fallback to login
            }
            setIsLoading(false);
        } else {
            setView('login');
            setIsLoading(false);
        }
    };
    checkUrlParams();
  }, [t]);
  
  useEffect(() => {
    let unsubscribe: () => void = () => {};
    if (currentEvent) {
      setIsLoading(true);
      unsubscribe = api.subscribeToEventData(currentEvent.id, (data) => {
        setAttendees(data.attendees);
        setSuppliers(data.suppliers);
        setSectors(data.sectors);
        setIsLoading(false);
      }, (error) => {
        console.error(error);
        setGlobalError(t('errors.subscriptionError'));
        setIsLoading(false);
      });
    }
    return () => unsubscribe();
  }, [currentEvent, t]);

  const handleSelectEvent = (event: Event) => {
    setCurrentEvent(event);
    setView('admin');
  };
  
  const handleBackToEvents = () => {
    setCurrentEvent(null);
    setAttendees([]);
    setSuppliers([]);
    setSectors([]);
    setView('event-selection');
  };

  // Event handlers
  const handleSaveEvent = async (name: string, eventId?: string) => {
    try {
      if (eventId) {
        await api.updateEvent(eventId, name);
      } else {
        await api.createEvent(name);
      }
      await loadEvents();
      setIsEventModalOpen(false);
      setEventToEdit(null);
    } catch (error) {
      console.error(error);
      setGlobalError(t('errors.saveEvent'));
    }
  };

  const handleDeleteEvent = async (event: Event) => {
    if (window.confirm(t('events.deleteConfirm', event.name))) {
      try {
        await api.deleteEvent(event.id);
        await loadEvents();
      } catch (error) {
        console.error(error);
        setGlobalError(t('errors.deleteEvent'));
      }
    }
  };
  
  // Attendee Handlers
  const handleRegister = async (newAttendee: Omit<Attendee, 'id' | 'status' | 'eventId' | 'createdAt'>) => {
    const eventId = currentEvent?.id || supplierInfo?.data.eventId;
    if (!eventId) {
      setGlobalError("ID do evento não encontrado.");
      return;
    }

    const supplierId = supplierInfo?.data.id || undefined;
    
    // Supplier registration limit check
    if (supplierId && supplierInfo) {
      const currentCount = await api.getRegistrationsCountForSupplier(eventId, supplierId);
      if (currentCount >= supplierInfo.data.registrationLimit) {
          setGlobalError(t('errors.registrationLimitReached'));
          throw new Error('Limit reached');
      }
    }
    
    await api.addAttendee(eventId, newAttendee, supplierId);
  };
  
  const handleUpdateAttendeeDetails = async (attendeeId: string, data: Partial<Attendee>) => {
    if (!currentEvent) return;
    await api.updateAttendeeDetails(currentEvent.id, attendeeId, data);
  };

  const handleDeleteAttendee = async (attendeeId: string) => {
    if (!currentEvent) return;
    await api.deleteAttendee(currentEvent.id, attendeeId);
  };

  const handleImportAttendees = async (data: any[]) => {
      if (!currentEvent) return;
      return api.importAttendees(currentEvent.id, data, sectors, suppliers);
  };

  // Supplier Handlers
  const handleAddSupplier = async (name: string, sectors: string[], registrationLimit: number, subCompanies: SubCompany[]) => {
    if (!currentEvent) return;
    await api.addSupplier(currentEvent.id, name, sectors, registrationLimit, subCompanies);
  };

  const handleUpdateSupplier = async (supplierId: string, data: Partial<Supplier>) => {
    if (!currentEvent) return;
    await api.updateSupplier(currentEvent.id, supplierId, data);
  };

  const handleDeleteSupplier = async (supplier: Supplier) => {
    if (!currentEvent) return;
    await api.deleteSupplier(currentEvent.id, supplier.id);
  };
  
  const handleSupplierStatusUpdate = async (supplierId: string, active: boolean) => {
    if (!currentEvent) return;
    await api.updateSupplierStatus(currentEvent.id, supplierId, active);
  };

  const handleRegenerateAdminToken = async (supplierId: string): Promise<string> => {
      if (!currentEvent) throw new Error("Evento não selecionado");
      return api.regenerateSupplierAdminToken(currentEvent.id, supplierId);
  };
  
  // Sector Handlers
  const handleAddSector = async (label: string, color: string) => {
    if (!currentEvent) return;
    await api.addSector(currentEvent.id, label, color);
  };

  const handleUpdateSector = async (sectorId: string, data: { label: string, color: string }) => {
    if (!currentEvent) return;
    await api.updateSector(currentEvent.id, sectorId, data);
  };

  const handleDeleteSector = async (sector: Sector) => {
    if (!currentEvent) return;
    await api.deleteSector(currentEvent.id, sector.id);
  };
  
  
  const renderContent = () => {
    if (isLoading) {
      return <div className="min-h-screen flex items-center justify-center"><div className="w-16 h-16 border-4 border-dashed rounded-full animate-spin border-indigo-500"></div></div>;
    }
    
    switch (view) {
      case 'login':
        return <LoginView onLogin={handleLogin} error={loginError} />;
      case 'event-selection':
        return <EventSelectionView events={events} onSelectEvent={handleSelectEvent} onCreateEvent={() => { setEventToEdit(null); setIsEventModalOpen(true); }} onEditEvent={(e) => { setEventToEdit(e); setIsEventModalOpen(true); }} onDeleteEvent={handleDeleteEvent} />;
      case 'admin':
        if (currentEvent) {
          return <AdminView 
            isLoading={isLoading}
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
            onRegenerateAdminToken={handleRegenerateAdminToken}
            onAddSector={handleAddSector}
            onUpdateSector={handleUpdateSector}
            onDeleteSector={handleDeleteSector}
            onAttendeeDetailsUpdate={handleUpdateAttendeeDetails}
            onDeleteAttendee={handleDeleteAttendee}
            onBack={handleBackToEvents}
            setError={setGlobalError}
          />;
        }
        return null;
      case 'supplier-registration':
        if (supplierInfo) {
          return <RegisterView 
            onRegister={handleRegister} 
            setError={setGlobalError} 
            sectors={sectors} 
            predefinedSector={supplierInfo.data.sectors}
            supplierName={supplierInfo.name}
            supplierInfo={supplierInfo}
          />
        }
        return null;
      case 'supplier-admin':
        if (supplierAdminData) {
          return <SupplierAdminView supplierName={supplierAdminData.name} attendees={supplierAdminData.attendees} />;
        }
        return null;
      case 'closed':
        return <RegistrationClosedView />;
      default:
        return <LoginView onLogin={handleLogin} error={loginError} />;
    }
  };

  return (
    <div className="bg-gray-900 text-white min-h-screen font-sans bg-grid">
      <div className="relative z-10">
        {renderContent()}
        {isEventModalOpen && (
          <EventModal 
            isOpen={isEventModalOpen}
            onClose={() => { setIsEventModalOpen(false); setEventToEdit(null); }}
            onSave={handleSaveEvent}
            eventToEdit={eventToEdit}
          />
        )}
        {globalError && (
          <div className="fixed bottom-5 right-5 bg-red-600 text-white py-3 px-5 rounded-lg shadow-lg animate-fade-in-up">
            <p>{globalError}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;