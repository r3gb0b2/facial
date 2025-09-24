import React, { useState, useEffect, useCallback } from 'react';

import RegisterView from './components/views/RegisterView';
import CheckinView from './components/views/CheckinView';
import AdminView from './components/views/AdminView';
import LoginView from './components/views/LoginView';
import EventSelectionView from './components/views/EventSelectionView';
import EventModal from './components/EventModal';

import { Attendee, CheckinStatus, Supplier, Event } from './types';
import * as FirebaseService from './firebase/service';
import { useTranslation } from './hooks/useTranslation';
import { CheckCircleIcon, XMarkIcon } from './components/icons';

const ADMIN_PASSWORD = "12345"; // In a real app, this would not be in the source code

type View = 'register' | 'checkin' | 'admin';

const App: React.FC = () => {
  const { t } = useTranslation();
  
  // App State
  const [currentView, setCurrentView] = useState<View>('register');
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  
  // Auth State
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    // Bypass login if it's a supplier link
    const params = new URLSearchParams(window.location.search);
    return params.has('eventId') && params.has('supplier');
  });
  const [loginError, setLoginError] = useState<string | null>(null);

  // UI State
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isEventModalOpen, setEventModalOpen] = useState(false);
  const [eventToEdit, setEventToEdit] = useState<Event | null>(null);
  const [predefinedColors, setPredefinedColors] = useState<string[] | undefined>(undefined);

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
    if (!isAuthenticated) return;
    const unsubscribe = FirebaseService.onEventsUpdate(setEvents, (err) => {
        console.error(err);
        showError("Não foi possível carregar os eventos.");
    });
    return () => unsubscribe();
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    const params = new URLSearchParams(window.location.search);
    const eventId = params.get('eventId');

    if (eventId && events.length > 0) {
      const event = events.find(e => e.id === eventId);
      if (event) {
        setSelectedEvent(event);
      }
    }
    setIsLoading(false);
  }, [events, isAuthenticated]);


  useEffect(() => {
    if (!isAuthenticated || !selectedEvent?.id) return;

    let unsubscribeAttendees: () => void = () => {};
    let unsubscribeSuppliers: () => void = () => {};

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
            setPredefinedColors(supplier.braceletColors);
            setCurrentView('register');
          }
        }
    }, (err) => {
        console.error(err);
        showError("Erro ao carregar fornecedores.");
    });
    
    return () => {
      unsubscribeAttendees();
      unsubscribeSuppliers();
    };
  }, [selectedEvent, isAuthenticated]);


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

  const handleManualCheckin = async (attendee: Attendee) => {
    if (attendee.status === CheckinStatus.CHECKED_IN) return;
    if (window.confirm(t('checkin.manualConfirm', attendee.name))) {
        if (!selectedEvent?.id || !attendee.id) return;
        try {
            await FirebaseService.updateAttendee(selectedEvent.id, attendee.id, {
                status: CheckinStatus.CHECKED_IN,
                checkinTime: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
            });
            showSuccess(t('checkin.success', attendee.name));
        } catch (err) {
            console.error(err);
            showError("Erro ao confirmar check-in.");
        }
    }
  };
  
  const handleLogin = (password: string) => {
    if (password === ADMIN_PASSWORD) {
      setIsAuthenticated(true);
      setLoginError(null);
    } else {
      setLoginError(t('login.error'));
      setTimeout(() => setLoginError(null), 3000);
    }
  };

  const handleAddSupplier = async (name: string, colors: string[]) => {
    if (!selectedEvent?.id) return;
    const slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    try {
      await FirebaseService.addSupplier(selectedEvent.id, { name, braceletColors: colors, slug });
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
  
  const isSupplierView = !!predefinedColors;

  const renderView = () => {
    if (currentView === 'register') {
      return <RegisterView onRegister={handleRegister} setError={showError} predefinedColors={predefinedColors} />;
    }
    if (currentView === 'checkin') {
      return <CheckinView attendees={attendees} onCheckin={handleManualCheckin} />;
    }
    if (currentView === 'admin') {
      // Safeguard to prevent crash if selectedEvent or its ID is missing.
      // This state should ideally not be reachable due to the outer check, but this makes it robust.
      if (!selectedEvent?.id) {
        return null;
      }
      return <AdminView eventId={selectedEvent.id} suppliers={suppliers} onAddSupplier={handleAddSupplier} setSuccess={showSuccess} setError={showError}/>;
    }
    return null;
  };

  if (!isAuthenticated) {
    return (
      <div className="bg-gray-900 text-white min-h-screen flex items-center justify-center p-4">
        <LoginView onLogin={handleLogin} error={loginError} />
      </div>
    );
  }
  
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
  
  return (
    <div className="bg-gray-900 text-white min-h-screen font-sans">
      {(error || success) && (
        <div className={`fixed top-5 right-5 p-4 rounded-lg shadow-lg text-white z-50 flex items-center gap-2 ${error ? 'bg-red-500' : 'bg-green-500'}`}>
          {error ? <XMarkIcon className="w-6 h-6"/> : <CheckCircleIcon className="w-6 h-6"/>}
          {error || success}
        </div>
      )}

      <header className="py-6 text-center">
        <h1 
          onClick={!isSupplierView ? () => { window.history.pushState({}, '', window.location.pathname); setSelectedEvent(null); } : undefined} 
          className={`text-4xl md:text-5xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-500 ${!isSupplierView ? 'cursor-pointer' : ''}`}
        >
          {t('header.title')}
        </h1>
        <p className="text-gray-400 mt-2">{selectedEvent.name}</p>
      </header>

      {!isSupplierView && (
        <nav className="flex justify-center mb-8 bg-black/20 p-2 rounded-full max-w-lg mx-auto">
          {(['register', 'checkin', 'admin'] as View[]).map(view => (
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

    </div>
  );
};

export default App;