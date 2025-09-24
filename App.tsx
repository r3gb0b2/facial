import React, { useState, useEffect, useCallback } from 'react';

import RegisterView from './components/views/RegisterView';
import CheckinView from './components/views/CheckinView';
import FastCheckinView from './components/views/FastCheckinView';
import AdminView from './components/views/AdminView';
import LoginView from './components/views/LoginView';
import EventSelectionView from './components/views/EventSelectionView';
import VerificationModal from './components/VerificationModal';
import EventModal from './components/EventModal';

import { Attendee, CheckinStatus, Supplier, Event } from './types';
import * as FirebaseService from './firebase/service';
import { useTranslation } from './hooks/useTranslation';
import { CheckCircleIcon, XMarkIcon } from './components/icons';

const ADMIN_PASSWORD = "admin"; // In a real app, this would not be in the source code

type View = 'register' | 'checkin' | 'fast-checkin' | 'admin';

const App: React.FC = () => {
  const { t } = useTranslation();
  
  // App State
  const [currentView, setCurrentView] = useState<View>('register');
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  
  // Auth State
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // UI State
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isVerificationModalOpen, setVerificationModalOpen] = useState(false);
  const [attendeeToVerify, setAttendeeToVerify] = useState<Attendee | null>(null);
  const [isEventModalOpen, setEventModalOpen] = useState(false);
  const [eventToEdit, setEventToEdit] = useState<Event | null>(null);
  const [predefinedSector, setPredefinedSector] = useState<string | undefined>(undefined);

  const clearMessages = () => {
    setError('');
    setSuccess('');
  };

  const showSuccess = (message: string) => {
    clearMessages();
    setSuccess(message);
    setTimeout(() => setSuccess(''), 3000);
  }

  const showError = (message: string) => {
    clearMessages();
    setError(message);
    setTimeout(() => setError(''), 4000);
  }
  
  // Effects
  useEffect(() => {
    const unsubscribe = FirebaseService.onEventsUpdate(setEvents, (err) => {
        console.error(err);
        showError("Não foi possível carregar os eventos.");
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const eventId = params.get('eventId');

    if (eventId && events.length > 0) {
      const event = events.find(e => e.id === eventId);
      if (event) {
        setSelectedEvent(event);
      }
    }
    setIsLoading(false);
  }, [events]);


  useEffect(() => {
    let unsubscribeAttendees: () => void = () => {};
    let unsubscribeSuppliers: () => void = () => {};

    if (selectedEvent?.id) {
        const eventId = selectedEvent.id;
        unsubscribeAttendees = FirebaseService.onAttendeesUpdate(eventId, setAttendees, (err) => {
            console.error(err);
            showError("Erro ao carregar participantes.");
        });
        unsubscribeSuppliers = FirebaseService.onSuppliersUpdate(eventId, (fetchedSuppliers) => {
            setSuppliers(fetchedSuppliers);
            // Check for supplier slug in URL after suppliers are loaded
            const params = new URLSearchParams(window.location.search);
            const supplierSlug = params.get('supplier');
            if (supplierSlug) {
              const supplier = fetchedSuppliers.find(s => s.slug === supplierSlug);
              if (supplier) {
                setPredefinedSector(supplier.sector);
                setCurrentView('register');
              }
            }
        }, (err) => {
            console.error(err);
            showError("Erro ao carregar fornecedores.");
        });
    }
    return () => {
      unsubscribeAttendees();
      unsubscribeSuppliers();
    };
  }, [selectedEvent]);


  // Handlers
  const handleRegister = async (newAttendee: Omit<Attendee, 'id' | 'status'>) => {
    if (!selectedEvent?.id) return;
    try {
      const attendeeData = {
        ...newAttendee,
        status: CheckinStatus.REGISTERED
      };
      await FirebaseService.addAttendee(selectedEvent.id, attendeeData);
      showSuccess(t('register.success'));
    } catch (err: any) {
      console.error(err);
      if (err.code === 'duplicate-cpf') {
        showError(t('register.errors.duplicateCpf'));
      } else {
        showError(t('register.errors.generic'));
      }
      throw err;
    }
  };

  const handleSelectAttendee = (attendee: Attendee) => {
    if (attendee.status === CheckinStatus.CHECKED_IN) return;
    setAttendeeToVerify(attendee);
    setVerificationModalOpen(true);
  };

  const handleConfirmCheckin = async () => {
    if (!attendeeToVerify || !selectedEvent?.id) return;
    try {
      await FirebaseService.updateAttendee(selectedEvent.id, attendeeToVerify.id!, {
        status: CheckinStatus.CHECKED_IN,
        checkinTime: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      });
      showSuccess(t('fastCheckin.success', attendeeToVerify.name));
    } catch (err) {
      console.error(err);
      showError("Erro ao confirmar check-in.");
    } finally {
      setVerificationModalOpen(false);
      setAttendeeToVerify(null);
    }
  };
  
  const handleFastCheckinVerify = async (photo: string) => {
      showError("Funcionalidade de reconhecimento facial não implementada.");
  }
  
  const handleLogin = (password: string) => {
    if (password === ADMIN_PASSWORD) {
      setIsAuthenticated(true);
      setLoginError(null);
    } else {
      setLoginError(t('login.error'));
    }
  };

  const handleAddSupplier = async (name: string, sector: string) => {
    if (!selectedEvent?.id) return;
    const slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    try {
      await FirebaseService.addSupplier(selectedEvent.id, { name, sector, slug });
      showSuccess(t('admin.success.supplierAdded'));
    } catch (err: any) {
        if(err.code === 'duplicate-slug') {
            showError(t('admin.errors.duplicate'));
        } else {
            showError(t('admin.errors.generic'));
        }
        throw err;
    }
  };

  const handleEventSave = async (name: string, eventId?: string) => {
    try {
        if (eventId) {
            await FirebaseService.updateEvent(eventId, name);
        } else {
            await FirebaseService.addEvent(name);
        }
        setEventModalOpen(false);
        setEventToEdit(null);
    } catch(err) {
        console.error(err);
        showError("Erro ao salvar evento.");
    }
  }

  const handleEventDelete = async (event: Event) => {
    if (window.confirm(t('events.deleteConfirm', event.name)) && event.id) {
        try {
            await FirebaseService.deleteEvent(event.id);
        } catch(err) {
            console.error(err);
            showError("Erro ao deletar evento.");
        }
    }
  }
  
  const renderView = () => {
    if (currentView === 'register') {
      return <RegisterView onRegister={handleRegister} setError={showError} predefinedSector={predefinedSector} />;
    }
    if (currentView === 'checkin') {
      return <CheckinView attendees={attendees} onSelectAttendee={handleSelectAttendee} />;
    }
    if (currentView === 'fast-checkin') {
        return <FastCheckinView onVerify={handleFastCheckinVerify} />
    }
    if (currentView === 'admin') {
      if (!isAuthenticated) return <LoginView onLogin={handleLogin} error={loginError} />;
      return <AdminView eventId={selectedEvent!.id!} suppliers={suppliers} onAddSupplier={handleAddSupplier} setSuccess={showSuccess} setError={showError}/>;
    }
    return null;
  };
  
  if (isLoading) {
    return (
      <div className="bg-gray-900 text-white min-h-screen flex items-center justify-center">
        <p>Carregando...</p>
      </div>
    );
  }
  
  if (!selectedEvent) {
    return (
        <div className="bg-gray-900 text-white min-h-screen">
            <EventSelectionView
                events={events}
                onSelectEvent={setSelectedEvent}
                onCreateEvent={() => { setEventToEdit(null); setEventModalOpen(true); }}
                onEditEvent={(event) => { setEventToEdit(event); setEventModalOpen(true); }}
                onDeleteEvent={handleEventDelete}
            />
            <EventModal
                isOpen={isEventModalOpen}
                onClose={() => setEventModalOpen(false)}
                onSave={handleEventSave}
                eventToEdit={eventToEdit}
            />
        </div>
    );
  }
  
  const isSupplierView = !!predefinedSector;

  return (
    <div className="bg-gray-900 text-white min-h-screen font-sans">
      {(error || success) && (
        <div className={`fixed top-5 right-5 p-4 rounded-lg shadow-lg text-white z-50 flex items-center gap-2 ${error ? 'bg-red-500' : 'bg-green-500'}`}>
          {error ? <XMarkIcon className="w-6 h-6"/> : <CheckCircleIcon className="w-6 h-6"/>}
          {error || success}
        </div>
      )}

      <header className="py-6 text-center">
        <h1 onClick={() => { window.history.pushState({}, '', window.location.pathname); setSelectedEvent(null); }} className="text-4xl md:text-5xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-500 cursor-pointer">
          {t('header.title')}
        </h1>
        <p className="text-gray-400 mt-2">{selectedEvent.name}</p>
      </header>

      {!isSupplierView && (
        <nav className="flex justify-center mb-8 bg-black/20 p-2 rounded-full max-w-lg mx-auto">
          {(['register', 'checkin', 'fast-checkin', 'admin'] as View[]).map(view => (
            <button
              key={view}
              onClick={() => setCurrentView(view)}
              className={`px-4 py-2 rounded-full font-semibold transition-colors duration-300 ${currentView === view ? 'bg-indigo-600 text-white' : 'text-gray-300 hover:bg-gray-700'}`}
            >
              {t(`nav.${view.replace('-', '')}`)}
            </button>
          ))}
        </nav>
      )}

      <main className="container mx-auto px-4 pb-12">
        {renderView()}
      </main>

      {isVerificationModalOpen && attendeeToVerify && (
        <VerificationModal
          attendee={attendeeToVerify}
          onClose={() => setVerificationModalOpen(false)}
          onConfirm={handleConfirmCheckin}
        />
      )}
    </div>
  );
};

export default App;
