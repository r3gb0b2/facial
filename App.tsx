import React, { useState, useEffect } from 'react';
import * as api from './firebase/service';
import { Attendee, CheckinStatus, Event, Supplier } from './types';

import EventSelectionView from './components/views/EventSelectionView';
import AdminView from './components/views/AdminView';
import EventModal from './components/EventModal';
import LoginView from './components/views/LoginView';
import RegisterView from './components/views/RegisterView';
import RegistrationClosedView from './components/views/RegistrationClosedView';
import { SpinnerIcon } from './components/icons';

const App: React.FC = () => {
  // Common state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');

  // Admin flow state
  const [events, setEvents] = useState<Event[]>([]);
  const [currentEvent, setCurrentEvent] = useState<Event | null>(null);
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [eventToEdit, setEventToEdit] = useState<Event | null>(null);
  
  // Supplier registration flow state
  const [isSupplierView, setIsSupplierView] = useState(false);
  const [supplierConfig, setSupplierConfig] = useState<{event: Event, supplier: Supplier} | null>(null);

  // Effects
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const eventId = params.get('eventId');
    const supplierId = params.get('supplierId');

    if (eventId && supplierId) {
      loadSupplierData(eventId, supplierId);
    } else {
      setIsSupplierView(false); // Not a supplier link
      setLoading(false); // Stop loading if not a supplier link
    }
  }, []);

  const loadSupplierData = async (eventId: string, supplierId: string) => {
    setLoading(true);
    setIsSupplierView(true);
    try {
      const [event, supplier] = await Promise.all([
        api.getEvent(eventId),
        api.getSupplier(eventId, supplierId)
      ]);

      if (event && supplier && supplier.active) {
        setSupplierConfig({ event, supplier });
      } else {
        setSupplierConfig(null); // Will render RegistrationClosedView
      }
    } catch (e) {
      console.error(e);
      setError("Failed to load registration information.");
      setSupplierConfig(null);
    } finally {
      setLoading(false);
    }
  };


  useEffect(() => {
    if (isAuthenticated) {
      loadEvents();
    }
  }, [isAuthenticated]);

  const showSuccess = (message: string) => {
    setSuccess(message);
    setTimeout(() => setSuccess(''), 3000);
  };

  const showError = (message: string) => {
    setError(message);
    setTimeout(() => setError(''), 5000);
  };

  const handleLogin = (password: string) => {
    if (password === '12345') {
      setIsAuthenticated(true);
      setLoginError(null);
    } else {
      setLoginError('Senha incorreta.');
    }
  };

  // Event handlers
  const loadEvents = async () => {
    setLoading(true);
    try {
      const eventsData = await api.getEvents();
      setEvents(eventsData);
    } catch (e) {
      showError('Falha ao carregar eventos.');
    } finally {
      setLoading(false);
    }
  };

  const loadAttendees = async (eventId: string, showLoader = true) => {
    if (showLoader) setLoading(true);
    try {
      const [attendeesData, suppliersData] = await Promise.all([
          api.getAttendees(eventId),
          api.getSuppliersForEvent(eventId)
      ]);
      setAttendees(attendeesData);
      setSuppliers(suppliersData);
    } catch (e) {
      showError('Falha ao carregar participantes.');
    } finally {
      if (showLoader) setLoading(false);
    }
  };

  const handleSelectEvent = (event: Event) => {
    setCurrentEvent(event);
    loadAttendees(event.id, true);
  };
  
  const handleBackToEvents = () => {
    setCurrentEvent(null);
    setAttendees([]);
    setSuppliers([]);
  };

  const handleSaveEvent = async (name: string, eventId?: string) => {
    try {
      if (eventId) {
        await api.updateEvent(eventId, name);
        showSuccess('Evento atualizado com sucesso!');
      } else {
        await api.addEvent(name);
        showSuccess('Evento criado com sucesso!');
      }
      loadEvents();
      setIsEventModalOpen(false);
      setEventToEdit(null);
    } catch (e) {
      showError('Falha ao salvar o evento.');
    }
  };
  
  const handleDeleteEvent = async (event: Event) => {
    if (window.confirm(`Tem certeza que deseja deletar o evento "${event.name}" e todos os seus participantes?`)) {
      try {
        await api.deleteEvent(event.id);
        showSuccess('Evento deletado com sucesso!');
        loadEvents();
      } catch (e) {
        showError('Falha ao deletar o evento.');
      }
    }
  };

  const handleRegister = async (newAttendee: Omit<Attendee, 'id' | 'status' | 'eventId' | 'createdAt'>) => {
    if (!currentEvent) return;
    try {
      await api.addAttendee(currentEvent.id, newAttendee);
      showSuccess(`${newAttendee.name} registrado com sucesso!`);
      loadAttendees(currentEvent.id, false); // silent reload
    } catch (e) {
      showError('Falha ao registrar participante.');
    }
  };

  const handleSupplierRegister = async (newAttendee: Omit<Attendee, 'id' | 'status' | 'eventId' | 'createdAt'>) => {
    if (!supplierConfig) return;
    try {
      await api.addAttendee(supplierConfig.event.id, newAttendee);
      showSuccess(`${newAttendee.name} registrado com sucesso!`);
    } catch (e) {
      showError('Falha ao registrar participante.');
      throw e; // re-throw to be caught in the component
    }
  };

  const handleStatusUpdate = async (attendee: Attendee, newStatus: CheckinStatus) => {
    if (!currentEvent) return;
    try {
      await api.updateAttendeeStatus(currentEvent.id, attendee.id, newStatus);
      showSuccess(`Status de ${attendee.name} atualizado.`);
      // Reload attendees without showing the full-page loader
      loadAttendees(currentEvent.id, false); 
    } catch (e) {
      showError('Falha ao atualizar status.');
    }
  };
  
  const handleAddSupplier = async (name: string, sectors: string[]) => {
      if (!currentEvent) return;
      try {
          await api.addSupplier(currentEvent.id, name, sectors);
          showSuccess('Link de fornecedor gerado com sucesso!');
          loadAttendees(currentEvent.id, false); // silent reload
      } catch (e) {
          showError('Falha ao gerar link.');
      }
  };
  
  const handleSupplierStatusUpdate = async (supplierId: string, active: boolean) => {
      if (!currentEvent) return;
      try {
          await api.updateSupplierStatus(currentEvent.id, supplierId, active);
          showSuccess('Status do link atualizado.');
          loadAttendees(currentEvent.id, false); // silent reload
      } catch (e) {
          showError('Falha ao atualizar status do link.');
      }
  };


  // Render logic
  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex justify-center items-center h-screen">
          <SpinnerIcon className="w-12 h-12 text-indigo-400" />
        </div>
      );
    }
    
    if (isSupplierView) {
      if (supplierConfig) {
        return <div className="min-h-screen flex items-center justify-center p-4">
          <RegisterView 
            onRegister={handleSupplierRegister} 
            setError={showError}
            predefinedSector={supplierConfig.supplier.sectors.length === 1 ? supplierConfig.supplier.sectors[0] : supplierConfig.supplier.sectors}
          />
        </div>;
      }
      return <RegistrationClosedView />;
    }

    if (!isAuthenticated) {
      return <div className="min-h-screen flex items-center justify-center p-4"><LoginView onLogin={handleLogin} error={loginError} /></div>;
    }

    if (currentEvent) {
      return <AdminView
        currentEventId={currentEvent.id}
        eventName={currentEvent.name}
        attendees={attendees}
        suppliers={suppliers}
        onRegister={handleRegister}
        onStatusUpdate={handleStatusUpdate}
        onAddSupplier={handleAddSupplier}
        onSupplierStatusUpdate={handleSupplierStatusUpdate}
        onBack={handleBackToEvents}
        setError={showError}
      />;
    }

    return <EventSelectionView
      events={events}
      onSelectEvent={handleSelectEvent}
      onCreateEvent={() => { setEventToEdit(null); setIsEventModalOpen(true); }}
      onEditEvent={(event) => { setEventToEdit(event); setIsEventModalOpen(true); }}
      onDeleteEvent={handleDeleteEvent}
    />;
  };

  return (
    <div className="bg-gray-900 text-white min-h-screen font-sans">
      <div className="container mx-auto p-4 md:p-8">
        {error && <div className="fixed top-5 right-5 bg-red-500 text-white py-2 px-4 rounded-lg shadow-lg animate-pulse">{error}</div>}
        {success && <div className="fixed top-5 right-5 bg-green-500 text-white py-2 px-4 rounded-lg shadow-lg">{success}</div>}
        {renderContent()}
      </div>
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
