import React, { useState, useEffect } from 'react';
import { GoogleGenAI, Type } from "@google/genai";
import { Attendee, CheckinStatus, Supplier, Event } from './types';
import VerificationModal from './components/VerificationModal';
import { UsersIcon, FingerPrintIcon, SparklesIcon, CogIcon, ArrowUturnLeftIcon } from './components/icons';
import { useTranslation } from './hooks/useTranslation';
import RegisterView from './components/views/RegisterView';
import CheckinView from './components/views/CheckinView';
import FastCheckinView from './components/views/FastCheckinView';
import AdminView from './components/views/AdminView';
import EventSelectionView from './components/views/EventSelectionView';
import EventModal from './components/EventModal';
import { onAttendeesUpdate, addAttendee, updateAttendee, onSuppliersUpdate, addSupplier, onEventsUpdate, addEvent, updateEvent, deleteEvent } from './firebase/service';

type View = 'register' | 'checkin' | 'fast-checkin' | 'admin';
type DbConnectionStatus = 'connecting' | 'connected' | 'error';

const getBase64 = (dataUrl: string) => dataUrl.split(',')[1];

const urlToInfo = async (url: string): Promise<{ data: string; mimeType: string }> => {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const dataUrl = reader.result as string;
            resolve({ data: dataUrl.split(',')[1], mimeType: blob.type || 'image/png' });
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
};

const App: React.FC = () => {
  const { t } = useTranslation();
  const [view, setView] = useState<View>('register');
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [selectedAttendee, setSelectedAttendee] = useState<Attendee | null>(null);
  const [dbConnectionState, setDbConnectionState] = useState<{ status: DbConnectionStatus; message: string | null }>({ status: 'connecting', message: null });
  const [currentSupplier, setCurrentSupplier] = useState<Supplier | null | undefined>(undefined);
  const [supplierError, setSupplierError] = useState<string | null>(null);
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [eventToEdit, setEventToEdit] = useState<Event | null>(null);

  useEffect(() => {
    const unsubEvents = onEventsUpdate(
        setEvents,
        (err: any) => {
            console.error('Firestore listener error (events):', err.message);
            let errorMessage = t('register.errors.dbConnection');
            if (err.code === 'permission-denied') errorMessage = t('register.errors.dbPermissionDenied');
            setDbConnectionState({ status: 'error', message: errorMessage });
        }
    );
    return () => unsubEvents();
  }, [t]);

  useEffect(() => {
    if (!selectedEvent) return;

    const unsubAttendees = onAttendeesUpdate(
      selectedEvent.id!,
      (newAttendees) => {
        const sortedAttendees = newAttendees.sort((a, b) => a.name.localeCompare(b.name));
        setAttendees(sortedAttendees);
        setDbConnectionState({ status: 'connected', message: null });
      },
      (err: any) => {
        console.error('Firestore listener error (attendees):', err.message);
        setDbConnectionState({ status: 'error', message: t('register.errors.dbConnection') });
      }
    );

    const unsubSuppliers = onSuppliersUpdate(
        selectedEvent.id!,
        setSuppliers,
        (err: any) => console.error('Firestore listener error (suppliers):', err.message)
    );

    return () => {
        unsubAttendees();
        unsubSuppliers();
    };
  }, [selectedEvent, t]);
  
  // Effect to check for supplier link on mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const eventId = urlParams.get('eventId');
    const supplierSlug = urlParams.get('supplier');

    if (eventId && events.length > 0) {
        const foundEvent = events.find(e => e.id === eventId);
        if (foundEvent) {
            setSelectedEvent(foundEvent);
        } else {
            setSupplierError("Event not found.");
            return;
        }
    }
    
    if (supplierSlug && selectedEvent && suppliers.length > 0) {
        const foundSupplier = suppliers.find(s => s.slug === supplierSlug);
        if (foundSupplier) {
            setCurrentSupplier(foundSupplier);
        } else {
            setSupplierError(t('supplier.invalidLink'));
        }
    } else if (!supplierSlug) {
        setCurrentSupplier(null);
    }
  }, [events, suppliers, selectedEvent, t]);


  const handleRegister = async (newAttendee: Omit<Attendee, 'id' | 'status'>) => {
    if (!selectedEvent?.id) return;
    try {
      const attendee: Omit<Attendee, 'id'> = { ...newAttendee, status: CheckinStatus.REGISTERED };
      await addAttendee(selectedEvent.id, attendee);
      setSuccess(t('register.success', { name: attendee.name }));
      setTimeout(() => {
        setSuccess('');
        if (!currentSupplier) setView('checkin');
      }, 2000);
    } catch (e: any) {
        console.error('Failed to add attendee:', e.message);
        if (e.code === 'permission-denied') setError(t('register.errors.dbPermissionDenied'));
        else if (e.code === 'duplicate-cpf') setError(t('register.errors.duplicateCpf'));
        else setError(t('register.errors.dbConnection'));
        setTimeout(() => setError(''), 5000);
        throw e;
    }
  };

  const handleAddSupplier = async (name: string, sector: string) => {
    if (!selectedEvent?.id) return;
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    try {
        await addSupplier(selectedEvent.id, { name, sector, slug });
        setSuccess(t('admin.success.supplierAdded', { name }));
        setTimeout(() => setSuccess(''), 3000);
    } catch (e: any) {
        console.error('Failed to add supplier:', e.message);
        if (e.code === 'duplicate-slug') setError(t('admin.errors.duplicate'));
        else setError(t('register.errors.dbConnection'));
        setTimeout(() => setError(''), 5000);
        throw e;
    }
  };

  const handleCheckIn = async (attendeeId: string) => {
    if (!selectedEvent?.id) return;
    const attendee = attendees.find(att => att.id === attendeeId);
    if (!attendee) return;
    try {
        await updateAttendee(selectedEvent.id, attendeeId, {
            status: CheckinStatus.CHECKED_IN,
            checkinTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        });
        setSuccess(t('checkin.checkedInSuccess', { name: attendee.name }));
        setSelectedAttendee(null);
        setTimeout(() => setSuccess(''), 3000);
    } catch (e: any) {
        console.error('Failed to check in attendee:', e.message);
        setError("Failed to check in attendee.");
        setTimeout(() => setError(''), 3000);
    }
  };

  const handleFacialSearch = async (livePhoto: string): Promise<void> => {
    if (!selectedEvent?.id) return;
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const unCheckedInAttendees = attendees.filter(a => a.status === CheckinStatus.REGISTERED);
      if (unCheckedInAttendees.length === 0) {
        setError(t('fastCheckin.noOneToScan'));
        setTimeout(() => setError(''), 3000);
        return;
      }
      
      const liveImagePart = { inlineData: { mimeType: 'image/png', data: getBase64(livePhoto) } };
      const registeredPhotosInfo = await Promise.all(unCheckedInAttendees.map(attendee => urlToInfo(attendee.photo)));
      const candidateParts = unCheckedInAttendees.flatMap((attendee, index) => {
        if (!attendee.id) return [];
        const photoInfo = registeredPhotosInfo[index];
        return [{ text: `${t('fastCheckin.apiPromptBatch.candidateIdLabel')} ${attendee.id}` }, { inlineData: { mimeType: photoInfo.mimeType, data: photoInfo.data } }];
      });

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts: [{ text: t('fastCheckin.apiPromptBatch.livePhotoHeader') }, liveImagePart, { text: t('fastCheckin.apiPromptBatch.candidatesHeader') }, ...candidateParts, { text: t('fastCheckin.apiPromptBatch.instruction') }] },
        config: { responseMimeType: "application/json", responseSchema: { type: Type.OBJECT, properties: { match: { type: Type.STRING, nullable: true } } } }
      });

      const result = JSON.parse(response.text);
      if (result.match) {
        await handleCheckIn(result.match);
      } else {
        setError(t('fastCheckin.noMatch'));
        setTimeout(() => setError(''), 3000);
      }
    } catch (e: any) {
      console.error('Gemini API Error:', e.message);
      let errorMessage = t('fastCheckin.apiError');
      if (e.message && (e.message.includes('API key not valid') || e.message.includes('API key is missing'))) errorMessage = t('fastCheckin.apiKeyError');
      setError(errorMessage);
      setTimeout(() => setError(''), 5000);
    }
  };

  // Event Management Handlers
  const handleSaveEvent = async (name: string, id?: string) => {
    try {
        if (id) {
            await updateEvent(id, name);
            setSuccess(t('events.success.updated', { eventName: name }));
        } else {
            await addEvent(name);
            setSuccess(t('events.success.created', { eventName: name }));
        }
        setIsEventModalOpen(false);
        setEventToEdit(null);
        setTimeout(() => setSuccess(''), 3000);
    } catch (e: any) {
        setError(t('register.errors.dbConnection'));
        setTimeout(() => setError(''), 3000);
    }
  };

  const handleDeleteEvent = async (event: Event) => {
    if (window.confirm(t('events.deleteConfirm', { eventName: event.name }))) {
        try {
            await deleteEvent(event.id!);
            setSuccess(t('events.success.deleted'));
            setTimeout(() => setSuccess(''), 3000);
        } catch (e: any) {
            setError(t('register.errors.dbConnection'));
            setTimeout(() => setError(''), 3000);
        }
    }
  };

  const renderEventDashboard = (event: Event) => (
    <>
      <header className="py-6 text-center">
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-500">
          {event.name}
        </h1>
        <p className="text-gray-400 mt-2">{t('header.subtitle')}</p>
      </header>

      <nav className="flex justify-center mb-8">
        <div className="bg-gray-800 p-1 rounded-full border border-gray-700 flex flex-wrap justify-center gap-1">
          <button onClick={() => setSelectedEvent(null)} className="px-3 py-2 rounded-full text-sm font-semibold transition-all duration-300 text-gray-300 hover:bg-gray-700 flex items-center gap-2">
              <ArrowUturnLeftIcon className="w-5 h-5"/> {t('nav.backToEvents')}
          </button>
          <button onClick={() => setView('register')} className={`px-4 py-2 rounded-full text-sm font-semibold transition-all duration-300 ${view === 'register' ? 'bg-indigo-600 text-white' : 'text-gray-300 hover:bg-gray-700'}`}> <UsersIcon className="w-5 h-5 inline-block mr-2" />{t('nav.register')}</button>
          <button onClick={() => setView('checkin')} className={`px-4 py-2 rounded-full text-sm font-semibold transition-all duration-300 ${view === 'checkin' ? 'bg-indigo-600 text-white' : 'text-gray-300 hover:bg-gray-700'}`}><FingerPrintIcon className="w-5 h-5 inline-block mr-2" />{t('nav.checkin')}</button>
          <button onClick={() => setView('fast-checkin')} className={`px-4 py-2 rounded-full text-sm font-semibold transition-all duration-300 ${view === 'fast-checkin' ? 'bg-indigo-600 text-white' : 'text-gray-300 hover:bg-gray-700'}`}><SparklesIcon className="w-5 h-5 inline-block mr-2" />{t('nav.fastCheckin')}</button>
          <button onClick={() => setView('admin')} className={`px-4 py-2 rounded-full text-sm font-semibold transition-all duration-300 ${view === 'admin' ? 'bg-indigo-600 text-white' : 'text-gray-300 hover:bg-gray-700'}`}><CogIcon className="w-5 h-5 inline-block mr-2" />{t('nav.admin')}</button>
        </div>
      </nav>
      
      <main className="container mx-auto px-4 pb-12">
        {view === 'register' && <RegisterView onRegister={handleRegister} setError={setError} />}
        {view === 'checkin' && <CheckinView attendees={attendees} onSelectAttendee={(a) => setSelectedAttendee(a)} />}
        {view === 'fast-checkin' && <FastCheckinView onVerify={handleFacialSearch} />}
        {view === 'admin' && <AdminView eventId={event.id!} suppliers={suppliers} onAddSupplier={handleAddSupplier} setSuccess={setSuccess} setError={setError} />}
      </main>

      {selectedAttendee && selectedAttendee.id && <VerificationModal attendee={selectedAttendee} onClose={() => setSelectedAttendee(null)} onConfirm={() => handleCheckIn(selectedAttendee.id!)} />}
    </>
  );

  const renderSupplierView = (supplier: Supplier) => (
    <>
      <header className="py-6 text-center">
        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white">{t('supplier.registerTitle', { supplierName: supplier.name })}</h1>
        <p className="text-gray-400 mt-2">{t('header.subtitle')}</p>
      </header>
      <main className="container mx-auto px-4 pb-12">
        <RegisterView onRegister={handleRegister} setError={setError} predefinedSector={supplier.sector} />
      </main>
    </>
  );
  
  const renderContent = () => {
    if (dbConnectionState.status === 'error') {
      return (
        <div className="flex items-center justify-center min-h-screen"><div className="text-center text-red-300 bg-red-900/30 p-8 rounded-2xl border border-red-500/50">
          <h2 className="text-2xl font-bold text-red-400 mb-2">{t('connection.errorTitle')}</h2>
          <p className="mb-4">{dbConnectionState.message}</p>
          <p className="text-sm text-gray-400">{t('connection.errorInstructions')}</p>
        </div></div>
      );
    }

    if (currentSupplier !== undefined && supplierError) {
        return <div className="flex items-center justify-center min-h-screen"><div className="text-center text-red-300 bg-red-900/30 p-8 rounded-2xl border border-red-500/50"><h2 className="text-2xl font-bold text-red-400 mb-2">{t('connection.errorTitle')}</h2><p>{supplierError}</p></div></div>
    }

    if (selectedEvent && currentSupplier) {
      return renderSupplierView(currentSupplier);
    }
    
    if (selectedEvent) {
      return renderEventDashboard(selectedEvent);
    }

    return (
        <EventSelectionView
            events={events}
            onSelectEvent={setSelectedEvent}
            onCreateEvent={() => { setEventToEdit(null); setIsEventModalOpen(true); }}
            onEditEvent={(event) => { setEventToEdit(event); setIsEventModalOpen(true); }}
            onDeleteEvent={handleDeleteEvent}
        />
    );
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white font-sans bg-grid-pattern">
      <div className="absolute inset-0 bg-gradient-to-b from-gray-900 via-transparent to-gray-900"></div>
      <div className="relative z-10">
        {error && <div className="fixed top-5 left-1/2 -translate-x-1/2 bg-red-500 text-white py-2 px-4 rounded-lg shadow-lg animate-fade-in-out z-50">{error}</div>}
        {success && <div className="fixed top-5 left-1/2 -translate-x-1/2 bg-green-500 text-white py-2 px-4 rounded-lg shadow-lg animate-fade-in-out z-50">{success}</div>}
        
        <EventModal 
            isOpen={isEventModalOpen}
            onClose={() => setIsEventModalOpen(false)}
            onSave={handleSaveEvent}
            eventToEdit={eventToEdit}
        />
        
        {renderContent()}
      </div>
      <style>{`
        .bg-grid-pattern { background-image: linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px); background-size: 2rem 2rem; }
        @keyframes fade-in-out { 0%, 100% { opacity: 0; transform: translate(-50%, -20px); } 10%, 90% { opacity: 1; transform: translate(-50%, 0); } }
        .animate-fade-in-out { animation: fade-in-out 5s ease-in-out forwards; }
      `}</style>
    </div>
  );
};

export default App;