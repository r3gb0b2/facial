

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

const NO_PHOTO_PLACEHOLDER = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIiB2aWV3Qm94PSIwIDAgMjAwIDIwMCIgZmlsbD0ibm9uZSI+PHJlY3Qgd2lkdGg9IjIwMCIgaGVpZHRoPSIyMDAiIGZpbGw9IiMzNzQxNTEiLz48dGV4dCB4PSI1MCUiIHk9IjUwJSIgZG9taW5hbnQtYmFzZWxpbmU9Im1pZGRsZSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZm9udC1mYW1pbHk9InNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMjQiIGZpbGw9IiNFNUU3RUIiIGZvbnQtd2VpZHRoPSJib2xkIj5TRU0gRk9UTzwvdGV4dD48L3N2Zz4=';


const App: React.FC = () => {
  const { t } = useTranslation();
  const [isLoggedIn, setIsLoggedIn] = useState(sessionStorage.getItem('isLoggedIn') === 'true');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [view, setView] = useState<View>('login');
  const [isLoading, setIsLoading] = useState(true);
  const [globalError, setGlobalError] = useState<string>('');

  // Data state
  const [events, setEvents] = useState<Event[]>([]);
  const [currentEvent, setCurrentEvent] = useState<Event | null>(() => {
    const savedEvent = sessionStorage.getItem('currentEvent');
    return savedEvent ? JSON.parse(savedEvent) : null;
  });
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [sectors, setSectors] = useState<Sector[]>([]);
  
  // Supplier view state
  const [supplierInfo, setSupplierInfo] = useState<{data: Supplier, name: string} | null>(null);
  const [supplierAdminData, setSupplierAdminData] = useState<{eventName: string, attendees: Attendee[], eventId: string, supplierId: string, supplier: Supplier, sectors: Sector[]} | null>(null);

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
    if (password === '12345') {
      sessionStorage.setItem('isLoggedIn', 'true');
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
    let unsubscribe: (() => void) | null = null;
    const checkUrlParams = async () => {
        const params = new URLSearchParams(window.location.search);
        const eventId = params.get('eventId');
        const supplierId = params.get('supplierId');
        const verifyToken = params.get('verify');

        if (verifyToken) {
            setIsLoading(true);
            unsubscribe = api.subscribeToSupplierAdminData(
                verifyToken,
                (data) => {
                    setSupplierAdminData(data);
                    setView('supplier-admin');
                    setIsLoading(false);
                },
                (error) => {
                    console.error(error);
                    setGlobalError('Link de administrador inválido ou expirado.');
                    setView('closed');
                    setIsLoading(false);
                }
            );
        } else if (eventId && supplierId) {
            setIsLoading(true);
            unsubscribe = api.subscribeToSupplierForRegistration(
                eventId,
                supplierId,
                (registrationData) => {
                    if (registrationData) {
                        if (registrationData.data.active) {
                            setSupplierInfo({ data: registrationData.data, name: registrationData.name });
                            setSectors(registrationData.sectors);
                            setView('supplier-registration');
                        } else {
                             setView('closed');
                        }
                    } else {
                        // This case might not be hit if onError handles it, but good to have.
                        setGlobalError(t('errors.invalidSupplierLink'));
                        setView('login');
                    }
                    setIsLoading(false);
                },
                (error) => {
                    console.error(error);
                    setGlobalError(t('errors.invalidSupplierLink'));
                    setView('login');
                    setIsLoading(false);
                }
            );
        } else {
            if (isLoggedIn) {
                if (currentEvent) {
                    setView('admin');
                } else {
                    setView('event-selection');
                }
            } else {
                setView('login');
            }
            setIsLoading(false);
        }
    };
    checkUrlParams();

    return () => {
        if (unsubscribe) {
            unsubscribe();
        }
    };
  }, [t, isLoggedIn, currentEvent]);
  
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
    sessionStorage.setItem('currentEvent', JSON.stringify(event));
    setCurrentEvent(event);
    setView('admin');
  };
  
  const handleBackToEvents = () => {
    sessionStorage.removeItem('currentEvent');
    if (currentEvent) {
        sessionStorage.removeItem(`activeTab_${currentEvent.id}`);
        sessionStorage.removeItem(`filters_${currentEvent.id}`);
    }
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
      if (error instanceof Error) {
        setGlobalError(error.message);
      } else {
        setGlobalError(t('errors.saveEvent'));
      }
    }
  };

  const handleDeleteEvent = async (event: Event) => {
    if (window.confirm(t('events.deleteConfirm', event.name))) {
      try {
        await api.deleteEvent(event.id);
        await loadEvents();
      } catch (error) {
        console.error(error);
        if (error instanceof Error) {
          setGlobalError(error.message);
        } else {
          setGlobalError(t('errors.deleteEvent'));
        }
      }
    }
  };
  
  // Attendee Handlers
  const handleRegister = async (newAttendee: Omit<Attendee, 'id' | 'status' | 'eventId' | 'createdAt'>, supplierIdFromForm?: string) => {
    const eventId = currentEvent?.id || supplierInfo?.data.eventId;
    if (!eventId) {
      setGlobalError("ID do evento não encontrado.");
      return;
    }

    const supplierId = supplierInfo?.data.id || supplierIdFromForm;
    
    // Supplier registration limit check
    if (supplierId) {
      const currentSupplier = supplierInfo ? supplierInfo.data : suppliers.find(s => s.id === supplierId);
      if (currentSupplier) {
        const currentCount = await api.getRegistrationsCountForSupplier(eventId, supplierId);
        if (currentCount >= currentSupplier.registrationLimit) {
            setGlobalError(t('errors.registrationLimitReached'));
            throw new Error('Limit reached');
        }
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

  const handleApproveSubstitution = async (attendeeId: string) => {
    if (!currentEvent) return;
    await api.approveSubstitution(currentEvent.id, attendeeId);
  };
  
  const handleRejectSubstitution = async (attendeeId: string) => {
    if (!currentEvent) return;
    await api.rejectSubstitution(currentEvent.id, attendeeId);
  };

  const handleApproveSectorChange = async (attendeeId: string) => {
    if (!currentEvent) return;
    await api.approveSectorChange(currentEvent.id, attendeeId);
  };
  
  const handleRejectSectorChange = async (attendeeId: string) => {
    if (!currentEvent) return;
    await api.rejectSectorChange(currentEvent.id, attendeeId);
  };

  const handleImportAttendees = async (data: any[]) => {
    if (!currentEvent) {
      throw new Error("Nenhum evento selecionado para importação.");
    }
    
    const sectorMap = new Map(sectors.map(s => [s.label.toLowerCase(), s.id]));
    const supplierMap = new Map(suppliers.map(s => [s.name.toLowerCase(), s.id]));

    const failedRows: { row: any, reason: string }[] = [];
    let successCount = 0;

    const currentAttendees = await api.getAttendees(currentEvent.id);

    for (const row of data) {
        try {
            const { name, cpf, sector, fornecedor, empresa } = row;

            if (!name || !cpf || !sector) {
                failedRows.push({ row, reason: t('import.errors.requiredColumns') });
                continue;
            }

            const sectorId = sectorMap.get(String(sector).toLowerCase());
            if (!sectorId) {
                failedRows.push({ row, reason: `Setor "${sector}" não encontrado.` });
                continue;
            }

            let supplierId: string | undefined = undefined;
            if (fornecedor) {
                supplierId = supplierMap.get(String(fornecedor).toLowerCase());
                if (!supplierId) {
                    failedRows.push({ row, reason: `Fornecedor "${fornecedor}" não encontrado.` });
                    continue;
                }
            }
            
            const rawCpf = String(cpf).replace(/\D/g, '');
            if (rawCpf.length !== 11) {
                failedRows.push({ row, reason: `CPF inválido: "${cpf}"` });
                continue;
            }
            
            const existing = currentAttendees.some(a => a.cpf === rawCpf);
            if(existing) {
                 failedRows.push({ row, reason: `CPF "${cpf}" já cadastrado neste evento.` });
                continue;
            }

            const newAttendee: Omit<Attendee, 'id' | 'status' | 'eventId' | 'createdAt'> = {
                name,
                cpf: rawCpf,
                photo: NO_PHOTO_PLACEHOLDER,
                sectors: [sectorId],
                subCompany: empresa || undefined,
            };

            await api.addAttendee(currentEvent.id, newAttendee, supplierId);
            successCount++;

        } catch (error) {
            // FIX: The 'error' object in a catch block is of type 'unknown'. We must verify it's an instance of Error before accessing the 'message' property to avoid a type error.
            const reason = error instanceof Error ? `Erro no servidor: ${error.message}` : 'Erro no servidor: desconhecido.';
            failedRows.push({ row, reason });
        }
    }

    let summaryMessage = t('spreadsheet.importSuccess', successCount);
    if (failedRows.length > 0) {
        summaryMessage += ` ${failedRows.length} falharam. Verifique o console para detalhes.`;
        console.error("Falhas na importação:", failedRows);
    }
    alert(summaryMessage);
    return;
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
    try {
      await api.deleteSupplier(currentEvent.id, supplier.id);
    } catch (error) {
      // FIX: The 'error' object in a catch block is of type 'unknown'. We must verify it's an instance of Error before accessing the 'message' property to avoid a type error. This ensures we only pass a string to setGlobalError.
      if (error instanceof Error) {
        setGlobalError(error.message);
      } else {
        setGlobalError('An unknown error occurred while deleting the supplier.');
      }
    }
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

  // Company Handlers
  const handleUpdateSectorsForSelectedAttendees = async (attendeeIds: string[], sectorIds: string[]) => {
    if (!currentEvent) return;
    try {
        await api.updateSectorsForAttendees(currentEvent.id, attendeeIds, sectorIds);
    } catch (error) {
        console.error(error);
        setGlobalError("Falha ao atualizar os setores dos colaboradores selecionados.");
    }
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
            onApproveSubstitution={handleApproveSubstitution}
            onRejectSubstitution={handleRejectSubstitution}
            onApproveSectorChange={handleApproveSectorChange}
            onRejectSectorChange={handleRejectSectorChange}
            onUpdateSectorsForSelectedAttendees={handleUpdateSectorsForSelectedAttendees}
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
            eventName={supplierInfo.name}
            supplierName={supplierInfo.data.name}
            supplierInfo={supplierInfo}
          />
        }
        return null;
      case 'supplier-admin':
        if (supplierAdminData) {
          return <SupplierAdminView 
            eventName={supplierAdminData.eventName} 
            attendees={supplierAdminData.attendees}
            eventId={supplierAdminData.eventId}
            supplier={supplierAdminData.supplier}
            sectors={supplierAdminData.sectors}
          />;
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