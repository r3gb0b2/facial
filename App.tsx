import React, { useState, useEffect } from 'react';
import * as api from './firebase/service';
import { Attendee, CheckinStatus, Event, Supplier, Sector } from './types';

import EventSelectionView from './components/views/EventSelectionView';
import AdminView from './components/views/AdminView';
import EventModal from './components/EventModal';
import LoginView from './components/views/LoginView';
import RegisterView from './components/views/RegisterView';
import RegistrationClosedView from './components/views/RegistrationClosedView';
import { SpinnerIcon } from './components/icons';
import { useTranslation } from './hooks/useTranslation';

const App: React.FC = () => {
  const { t } = useTranslation();
  // Common state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');

  // Admin flow state
  const [events, setEvents] = useState<Event[]>([]);
  const [currentEvent, setCurrentEvent] = useState<Event | null>(null);
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [eventToEdit, setEventToEdit] = useState<Event | null>(null);
  
  // Supplier registration flow state
  const [isSupplierView, setIsSupplierView] = useState(false);
  const [supplierConfig, setSupplierConfig] = useState<{event: Event, supplier: Supplier} | null>(null);
  const [registrationClosedMessage, setRegistrationClosedMessage] = useState('');


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
    setRegistrationClosedMessage(t('supplierRegistration.closedMessage')); // Default message

    try {
      const [event, supplier, eventSectors] = await Promise.all([
        api.getEvent(eventId),
        api.getSupplier(eventId, supplierId),
        api.getSectors(eventId)
      ]);

      if (event && supplier) {
          if (!supplier.active) {
              setSupplierConfig(null); // Link disabled
          } else {
              const count = await api.getAttendeeCountForSupplier(eventId, supplierId);
              if (count >= supplier.registrationLimit) {
                  setRegistrationClosedMessage(t('supplierRegistration.limitReachedMessage'));
                  setSupplierConfig(null); // Limit reached
              } else {
                  setSupplierConfig({ event, supplier });
                  setSectors(eventSectors); // <-- FIX: Load sectors for the supplier view
              }
          }
      } else {
        setSupplierConfig(null); // Event or supplier not found
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

  // Effect to listen for real-time data updates when an event is selected
  useEffect(() => {
    if (!currentEvent) {
      return; // No event selected, do nothing.
    }

    setLoading(true);

    let initialLoads = { attendees: false, suppliers: false, sectors: false };
    const checkAllLoaded = () => {
        if (initialLoads.attendees && initialLoads.suppliers && initialLoads.sectors) {
            setLoading(false);
        }
    };

    const unsubscribeAttendees = api.listenToAttendees(currentEvent.id, 
        (newAttendees) => {
            setAttendees(newAttendees);
            if (!initialLoads.attendees) {
                initialLoads.attendees = true;
                checkAllLoaded();
            }
        },
        (error) => {
            console.error("Attendee listener error:", error);
            showError('Falha ao carregar participantes em tempo real.');
            setLoading(false); // Stop loading on error too
        }
    );

    const unsubscribeSuppliers = api.listenToSuppliers(currentEvent.id, 
        (newSuppliers) => {
            setSuppliers(newSuppliers);
            if (!initialLoads.suppliers) {
                initialLoads.suppliers = true;
                checkAllLoaded();
            }
        },
        (error) => {
            console.error("Supplier listener error:", error);
            showError('Falha ao carregar fornecedores em tempo real.');
            setLoading(false);
        }
    );

    const unsubscribeSectors = api.listenToSectors(currentEvent.id, 
        (newSectors) => {
            setSectors(newSectors);
            if (!initialLoads.sectors) {
                initialLoads.sectors = true;
                checkAllLoaded();
            }
        },
        (error) => {
            console.error("Sector listener error:", error);
            showError('Falha ao carregar setores em tempo real.');
            setLoading(false);
        }
    );

    // Return a cleanup function that unsubscribes from all listeners.
    return () => {
        unsubscribeAttendees();
        unsubscribeSuppliers();
        unsubscribeSectors();
    };
  }, [currentEvent]);


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

  const handleSelectEvent = (event: Event) => {
    setCurrentEvent(event);
  };
  
  const handleBackToEvents = () => {
    setCurrentEvent(null);
    setAttendees([]);
    setSuppliers([]);
    setSectors([]);
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

    // Check for duplicates within the current event
    const alreadyExists = await api.isCpfRegisteredInEvent(currentEvent.id, newAttendee.cpf);
    if (alreadyExists) {
      showError('Este CPF já está registrado neste evento.');
      return;
    }

    try {
      await api.addAttendee(currentEvent.id, newAttendee);
      showSuccess(`${newAttendee.name} registrado com sucesso!`);
    } catch (e) {
      showError('Falha ao registrar participante.');
    }
  };

  const handleSupplierRegister = async (newAttendee: Omit<Attendee, 'id' | 'status' | 'eventId' | 'createdAt' | 'supplierId'>) => {
    if (!supplierConfig) return;

    // Check for duplicates within the current event
    const alreadyExists = await api.isCpfRegisteredInEvent(supplierConfig.event.id, newAttendee.cpf);
    if (alreadyExists) {
      showError('Este CPF já está registrado neste evento.');
      throw new Error('CPF already registered in this event.');
    }

    try {
      await api.registerAttendeeForSupplier(supplierConfig.event.id, supplierConfig.supplier.id, newAttendee);
      showSuccess(`${newAttendee.name} registrado com sucesso!`);
    } catch (e: any) {
      showError(e.message || 'Falha ao registrar participante.');
      throw e; // re-throw to be caught in the component
    }
  };

  const handleStatusUpdate = async (attendee: Attendee, newStatus: CheckinStatus) => {
    if (!currentEvent) return;
    try {
      await api.updateAttendeeStatus(currentEvent.id, attendee.id, newStatus);
      showSuccess(`Status de ${attendee.name} atualizado.`);
    } catch (e) {
      showError('Falha ao atualizar status.');
    }
  };
  
  const handleAddSupplier = async (name: string, sectors: string[], registrationLimit: number) => {
      if (!currentEvent) return;
      try {
          await api.addSupplier(currentEvent.id, name, sectors, registrationLimit);
          showSuccess('Link de fornecedor gerado com sucesso!');
      } catch (e) {
          showError('Falha ao gerar link.');
      }
  };

  const handleUpdateSupplier = async (supplierId: string, data: Partial<Supplier>) => {
    if (!currentEvent) return;
    try {
        await api.updateSupplier(currentEvent.id, supplierId, data);
        showSuccess('Dados do fornecedor atualizados.');
    } catch (e) {
        showError('Falha ao atualizar dados do fornecedor.');
    }
  };
  
  const handleSupplierStatusUpdate = async (supplierId: string, active: boolean) => {
      if (!currentEvent) return;
      try {
          await api.updateSupplierStatus(currentEvent.id, supplierId, active);
          showSuccess('Status do link atualizado.');
      } catch (e) {
          showError('Falha ao atualizar status do link.');
      }
  };

  // Sector Handlers
  const handleAddSector = async (label: string) => {
    if (!currentEvent) return;
    try {
      await api.addSector(currentEvent.id, label);
      showSuccess('Setor criado com sucesso!');
    } catch (e: any) {
      showError(e.message || 'Falha ao criar setor.');
    }
  };

  const handleUpdateSector = async (sectorId: string, label: string) => {
    if (!currentEvent) return;
    try {
      await api.updateSector(currentEvent.id, sectorId, label);
      showSuccess('Setor atualizado com sucesso!');
    } catch (e) {
      showError('Falha ao atualizar setor.');
    }
  };

  const handleDeleteSector = async (sector: Sector) => {
    if (!currentEvent) return;
    try {
      await api.deleteSector(currentEvent.id, sector.id);
      showSuccess('Setor deletado com sucesso!');
    } catch (e) {
      throw e; // Re-throw to be handled by the component
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
            sectors={sectors} // <-- FIX: Pass the loaded sectors, not an empty array
            predefinedSector={supplierConfig.supplier.sectors.length === 1 ? supplierConfig.supplier.sectors[0] : supplierConfig.supplier.sectors}
          />
        </div>;
      }
      return <RegistrationClosedView message={registrationClosedMessage} />;
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
        sectors={sectors}
        onRegister={handleRegister}
        onStatusUpdate={handleStatusUpdate}
        onAddSupplier={handleAddSupplier}
        onUpdateSupplier={handleUpdateSupplier}
        onSupplierStatusUpdate={handleSupplierStatusUpdate}
        onAddSector={handleAddSector}
        onUpdateSector={handleUpdateSector}
        onDeleteSector={handleDeleteSector}
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