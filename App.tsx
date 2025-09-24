// FIX: Provided full content for `App.tsx` which is the main application component.
import React, { useState, useEffect, useCallback } from 'react';
import { Attendee, CheckinStatus, Event, Sector, Supplier } from './types';
import * as api from './firebase/service';
import { useTranslation } from './hooks/useTranslation';
import { ADMIN_PASSWORD, SUPPLIERS as STATIC_SUPPLIERS } from './suppliers';

import LoginView from './components/views/LoginView';
import UserSelectionView from './components/views/UserSelectionView';
import RegisterView from './components/views/RegisterView';
import CheckinView from './components/views/CheckinView';
import FastCheckinView from './components/views/FastCheckinView';
import AdminView from './components/views/AdminView';
import EventSelectionView from './components/views/EventSelectionView';
import RegistrationClosedView from './components/views/RegistrationClosedView';
import EventModal from './components/EventModal';

type View =
  | 'login'
  | 'user-selection'
  | 'register'
  | 'checkin'
  | 'fast-checkin'
  | 'admin'
  | 'event-selection'
  | 'registration-closed';

const App: React.FC = () => {
  const { t } = useTranslation();
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [view, setView] = useState<View>('event-selection');
  const [loggedInUser, setLoggedInUser] = useState<string | null>(null);
  const [predefinedSector, setPredefinedSector] = useState<string | string[] | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [eventToEdit, setEventToEdit] = useState<Event | null>(null);


  const fetchEvents = useCallback(async () => {
    try {
      const eventsData = await api.getEvents();
      setEvents(eventsData);
    } catch (err: any) {
      console.error("Failed to fetch events:", err);
      setError("Falha ao carregar eventos. Verifique sua conexão e a configuração do Firebase.");
    }
  }, []);
  
  // Load events on initial mount
  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  // Set up listeners when an event is selected
  useEffect(() => {
    let unsubAttendees: () => void = () => {};
    let unsubSectors: () => void = () => {};
    let unsubSuppliers: () => void = () => {};

    if (selectedEvent) {
      localStorage.setItem('selectedEventId', selectedEvent.id);
      unsubAttendees = api.listenForAttendees(selectedEvent.id, setAttendees);
      unsubSectors = api.listenForSectors(selectedEvent.id, setSectors);
      unsubSuppliers = api.listenForSuppliers(selectedEvent.id, setSuppliers);
    } else {
      localStorage.removeItem('selectedEventId');
      setAttendees([]);
      setSectors([]);
      setSuppliers([]);
    }
    return () => {
      unsubAttendees();
      unsubSectors();
      unsubSuppliers();
    };
  }, [selectedEvent]);

  // Handlers
  const handleLogin = (password: string) => {
    if (password === ADMIN_PASSWORD) {
      setLoggedInUser('admin');
      setView('admin');
      setError(null);
      return;
    }
    const supplier = STATIC_SUPPLIERS.find(s => s.password === password);
    if (supplier) {
      setLoggedInUser(supplier.name);
      setPredefinedSector(supplier.sectors);
      setView('user-selection');
      setError(null);
    } else {
      setError("Senha inválida.");
      setTimeout(() => setError(null), 3000);
    }
  };

  const handleLogout = () => {
    setLoggedInUser(null);
    setPredefinedSector(undefined);
    setSelectedEvent(null);
    setView('event-selection');
  };

  const setTimedError = (message: string) => {
    setError(message);
    setTimeout(() => setError(null), 4000);
  }

  const setTimedSuccess = (message: string) => {
    setSuccess(message);
    setTimeout(() => setSuccess(null), 3000);
  }

  const handleRegister = async (newAttendee: Omit<Attendee, 'id' | 'status' | 'eventId' | 'createdAt'>) => {
    try {
        await api.addAttendee(newAttendee);
        setTimedSuccess("Participante registrado com sucesso!");
    } catch (err: any) {
        console.error("Registration failed:", err);
        setTimedError("Falha ao registrar participante. Tente novamente.");
        throw err; // re-throw to be caught in the component
    }
  };

  const handleStatusUpdate = async (attendee: Attendee, newStatus: CheckinStatus) => {
    try {
      await api.updateAttendeeStatus(attendee.id, newStatus);
      setTimedSuccess(`Status de ${attendee.name} atualizado.`);
    } catch (err) {
      console.error("Status update failed:", err);
      setTimedError("Falha ao atualizar status.");
    }
  };

  // Event CRUD
  const handleSaveEvent = async (name: string, eventId?: string) => {
    try {
      if (eventId) {
        await api.updateEvent(eventId, name);
        setTimedSuccess("Evento atualizado com sucesso!");
      } else {
        await api.addEvent(name);
        setTimedSuccess("Evento criado com sucesso!");
      }
      fetchEvents();
      setIsEventModalOpen(false);
      setEventToEdit(null);
    } catch (error) {
      console.error("Failed to save event:", error);
      setTimedError("Falha ao salvar evento.");
    }
  };

  const handleDeleteEvent = async (event: Event) => {
    if (window.confirm(`Tem certeza que deseja apagar o evento "${event.name}"? Esta ação é irreversível.`)) {
      try {
        await api.deleteEvent(event.id);
        setTimedSuccess("Evento apagado com sucesso!");
        fetchEvents();
      } catch (error) {
        console.error("Failed to delete event:", error);
        setTimedError("Falha ao apagar evento. Verifique se ele não possui dados associados.");
      }
    }
  };
  
  // Admin CRUD Handlers
  const handleAddSector = async (label: string) => await api.addSector(label).catch(e => setTimedError(e.message));
  const handleUpdateSector = async (id: string, label: string) => await api.updateSector(id, label).catch(e => setTimedError(e.message));
  const handleDeleteSector = async (sector: Sector) => await api.deleteSector(sector.id).catch(e => {
    if (e.message.includes('in use')) {
      setTimedError(t('sectors.deleteErrorInUse', sector.label));
    } else {
      setTimedError("Falha ao deletar o setor.");
    }
    throw e;
  });

  const renderView = () => {
    switch (view) {
      case 'event-selection':
        return <EventSelectionView
            events={events}
            onSelectEvent={(event) => { setSelectedEvent(event); setView('login'); }}
            onCreateEvent={() => { setEventToEdit(null); setIsEventModalOpen(true); }}
            onEditEvent={(event) => { setEventToEdit(event); setIsEventModalOpen(true); }}
            onDeleteEvent={handleDeleteEvent}
        />;
      case 'login':
        return <LoginView onLogin={handleLogin} error={error} />;
      case 'user-selection':
        return <UserSelectionView
            onSelectRegister={() => setView('register')}
            onSelectCheckin={() => setView('checkin')}
            onSelectFastCheckin={() => setView('fast-checkin')}
        />;
      case 'register':
        return <RegisterView
          onRegister={handleRegister}
          setError={setTimedError}
          sectors={sectors}
          predefinedSector={predefinedSector}
        />;
      case 'checkin':
        return <CheckinView attendees={attendees} sectors={sectors} onStatusUpdate={handleStatusUpdate} />;
      case 'fast-checkin':
        return <FastCheckinView onVerify={async () => { return null; }} />;
      case 'admin':
        return <AdminView
          sectors={sectors}
          suppliers={suppliers}
          onAddSector={handleAddSector}
          onUpdateSector={handleUpdateSector}
          onDeleteSector={handleDeleteSector}
          setError={setTimedError}
        />;
      case 'registration-closed':
          return <RegistrationClosedView />;
      default:
        return <LoginView onLogin={handleLogin} error={error} />;
    }
  };

  const TopBar = () => (
    <div className="absolute top-0 left-0 w-full p-4 flex justify-between items-center text-white bg-black/20">
        <div>
            {selectedEvent && <h1 className="text-xl font-bold">{selectedEvent.name}</h1>}
        </div>
        <div className="flex items-center gap-4">
            {loggedInUser && <span>Logado como: <strong>{loggedInUser}</strong></span>}
            <button onClick={handleLogout} className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg transition-colors">Sair</button>
        </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-900 text-white font-sans bg-cover bg-center" style={{ backgroundImage: "url('/background.svg')"}}>
      {(view !== 'login' && view !== 'event-selection') && <TopBar />}
      {error && <div className="fixed top-5 left-1/2 -translate-x-1/2 bg-red-600 text-white py-2 px-6 rounded-lg shadow-lg z-50 animate-pulse">{error}</div>}
      {success && <div className="fixed top-5 left-1/2 -translate-x-1/2 bg-green-600 text-white py-2 px-6 rounded-lg shadow-lg z-50">{success}</div>}
      <main className="flex flex-col items-center justify-center min-h-screen p-4 pt-16">
        {renderView()}
      </main>
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
