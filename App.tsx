import React, { useState, useEffect } from 'react';
import { GoogleGenAI } from "@google/genai";
import { Attendee, CheckinStatus } from './types';
import VerificationModal from './components/VerificationModal';
import { UsersIcon, FingerPrintIcon, SparklesIcon } from './components/icons';
import { useTranslation } from './hooks/useTranslation';
import RegisterView from './components/views/RegisterView';
import CheckinView from './components/views/CheckinView';
import FastCheckinView from './components/views/FastCheckinView';
import { onAttendeesUpdate, addAttendee, updateAttendee } from './firebase/service';


type View = 'register' | 'checkin' | 'fast-checkin';
type DbConnectionStatus = 'connecting' | 'connected' | 'error';

// Helper to extract base64 data from a data URL
const getBase64 = (dataUrl: string) => dataUrl.split(',')[1];

// Helper to fetch a URL and convert it to a base64 string with its mime type
const urlToInfo = async (url: string): Promise<{ data: string; mimeType: string }> => {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const dataUrl = reader.result as string;
            resolve({
                data: dataUrl.split(',')[1],
                // Use the blob's type, with a fallback for safety
                mimeType: blob.type || 'image/png',
            });
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
};


const App: React.FC = () => {
  const { t } = useTranslation();
  const [view, setView] = useState<View>('register');
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [selectedAttendee, setSelectedAttendee] = useState<Attendee | null>(null);
  const [dbConnectionState, setDbConnectionState] = useState<{ status: DbConnectionStatus; message: string | null }>({ status: 'connecting', message: null });


  useEffect(() => {
    // Subscribe to real-time updates from Firestore
    const unsubscribe = onAttendeesUpdate(
      (newAttendees) => {
        // Sort attendees by name on the client side
        const sortedAttendees = newAttendees.sort((a, b) => a.name.localeCompare(b.name));
        setAttendees(sortedAttendees);
        setDbConnectionState({ status: 'connected', message: null });
      },
      (err: any) => {
        console.error('Firestore listener error:', err.message);
        let errorMessage = t('register.errors.dbConnection');
        if (err.code === 'permission-denied') {
          errorMessage = t('register.errors.dbPermissionDenied');
        }
        setDbConnectionState({ status: 'error', message: errorMessage });
      }
    );

    // Clean up the subscription on component unmount
    return () => unsubscribe();
  }, [t]);


  const handleRegister = async (newAttendee: Omit<Attendee, 'id' | 'status'>) => {
    try {
      const attendee: Omit<Attendee, 'id'> = {
        ...newAttendee,
        status: CheckinStatus.REGISTERED,
      };
      await addAttendee(attendee);
      setSuccess(t('register.success', { name: attendee.name }));
      setTimeout(() => {
        setSuccess('');
        setView('checkin');
      }, 2000);
    } catch (e: any) {
        console.error('Failed to add attendee:', e.message);
        if (e.code === 'permission-denied') {
            setError(t('register.errors.dbPermissionDenied'));
        } else if (e.code === 'duplicate-cpf') {
            setError(t('register.errors.duplicateCpf'));
        } else {
            setError(t('register.errors.dbConnection'));
        }
        setTimeout(() => setError(''), 5000);
        throw e; // Re-throw the error so the calling component knows about it
    }
  };

  const handleSelectAttendee = (attendee: Attendee) => {
    if (attendee.status === CheckinStatus.CHECKED_IN) return;
    setSelectedAttendee(attendee);
  };

  const handleCloseModal = () => {
    setSelectedAttendee(null);
  };
  
  const handleCheckIn = async (attendeeId: string) => {
    const attendee = attendees.find(att => att.id === attendeeId);
    if (!attendee) return;

    try {
        await updateAttendee(attendeeId, {
            status: CheckinStatus.CHECKED_IN,
            checkinTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        });
        setSuccess(t('checkin.checkedInSuccess', { name: attendee.name }));
        handleCloseModal();
        setTimeout(() => setSuccess(''), 3000);
    } catch (e: any) {
        console.error('Failed to check in attendee:', e.message);
        setError("Failed to check in attendee.");
        setTimeout(() => setError(''), 3000);
    }
  };

  const handleFacialSearch = async (livePhoto: string): Promise<void> => {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

      const unCheckedInAttendees = attendees.filter(a => a.status === CheckinStatus.REGISTERED);
      if (unCheckedInAttendees.length === 0) {
        setError(t('fastCheckin.noOneToScan'));
        setTimeout(() => setError(''), 3000);
        return;
      }

      const liveImagePart = {
        inlineData: {
          mimeType: 'image/png',
          data: getBase64(livePhoto),
        },
      };

      for (const attendee of unCheckedInAttendees) {
        if (!attendee.id) continue;
        
        const registeredPhotoInfo = await urlToInfo(attendee.photo);
        const registeredImagePart = {
          inlineData: {
            mimeType: registeredPhotoInfo.mimeType,
            data: registeredPhotoInfo.data,
          },
        };

        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: {
            parts: [
              { text: t('fastCheckin.apiPrompt') },
              registeredImagePart,
              liveImagePart,
            ],
          },
        });

        const textResponse = response.text.toLowerCase().trim();
        if (textResponse.includes(t('fastCheckin.apiYes'))) {
          await handleCheckIn(attendee.id);
          return;
        }
      }

      setError(t('fastCheckin.noMatch'));
      setTimeout(() => setError(''), 3000);
    } catch (e: any) {
      console.error('Gemini API Error:', e.message);
      let errorMessage = t('fastCheckin.apiError');
      if (e.message && (e.message.includes('API key not valid') || e.message.includes('API key is missing'))) {
        errorMessage = t('fastCheckin.apiKeyError');
      }
      setError(errorMessage);
      setTimeout(() => setError(''), 5000);
    }
  };

  const renderMainContent = () => {
    switch (dbConnectionState.status) {
      case 'connecting':
        return (
          <div className="text-center text-gray-400 bg-gray-800/50 p-8 rounded-2xl border border-gray-700">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-400 mx-auto mb-4"></div>
            <p className="text-lg">{t('connection.connecting')}</p>
          </div>
        );
      case 'error':
        return (
          <div className="text-center text-red-300 bg-red-900/30 p-8 rounded-2xl border border-red-500/50">
            <h2 className="text-2xl font-bold text-red-400 mb-2">{t('connection.errorTitle')}</h2>
            <p className="mb-4">{dbConnectionState.message}</p>
            <p className="text-sm text-gray-400">{t('connection.errorInstructions')}</p>
          </div>
        );
      case 'connected':
        return (
          <>
            {view === 'register' && <RegisterView onRegister={handleRegister} setError={setError} />}
            {view === 'checkin' && <CheckinView attendees={attendees} onSelectAttendee={handleSelectAttendee} />}
            {view === 'fast-checkin' && <FastCheckinView onVerify={handleFacialSearch} />}
          </>
        );
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white font-sans bg-grid-pattern">
      <div className="absolute inset-0 bg-gradient-to-b from-gray-900 via-transparent to-gray-900"></div>
      <div className="relative z-10">
        <header className="py-6 text-center">
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-500">
            {t('header.title')}
          </h1>
          <p className="text-gray-400 mt-2">{t('header.subtitle')}</p>
        </header>

        {dbConnectionState.status === 'connected' && (
            <nav className="flex justify-center mb-8">
            <div className="bg-gray-800 p-1 rounded-full border border-gray-700 flex flex-wrap justify-center">
                <button
                onClick={() => setView('register')}
                className={`px-4 py-2 rounded-full text-sm font-semibold transition-all duration-300 ${view === 'register' ? 'bg-indigo-600 text-white' : 'text-gray-300 hover:bg-gray-700'}`}
                >
                <UsersIcon className="w-5 h-5 inline-block mr-2" />
                {t('nav.register')}
                </button>
                <button
                onClick={() => setView('checkin')}
                className={`px-4 py-2 rounded-full text-sm font-semibold transition-all duration-300 ${view === 'checkin' ? 'bg-indigo-600 text-white' : 'text-gray-300 hover:bg-gray-700'}`}
                >
                <FingerPrintIcon className="w-5 h-5 inline-block mr-2" />
                {t('nav.checkin')}
                </button>
                <button
                onClick={() => setView('fast-checkin')}
                className={`px-4 py-2 rounded-full text-sm font-semibold transition-all duration-300 ${view === 'fast-checkin' ? 'bg-indigo-600 text-white' : 'text-gray-300 hover:bg-gray-700'}`}
                >
                <SparklesIcon className="w-5 h-5 inline-block mr-2" />
                {t('nav.fastCheckin')}
                </button>
            </div>
            </nav>
        )}
        
        {error && <div className="fixed top-5 left-1/2 -translate-x-1/2 bg-red-500 text-white py-2 px-4 rounded-lg shadow-lg animate-fade-in-out z-50">{error}</div>}
        {success && <div className="fixed top-5 left-1/2 -translate-x-1/2 bg-green-500 text-white py-2 px-4 rounded-lg shadow-lg animate-fade-in-out z-50">{success}</div>}

        <main className="container mx-auto px-4 pb-12">
            {renderMainContent()}
        </main>
        
        {selectedAttendee && selectedAttendee.id && (
            <VerificationModal 
                attendee={selectedAttendee}
                onClose={handleCloseModal}
                onConfirm={() => handleCheckIn(selectedAttendee.id!)}
            />
        )}
      </div>
      <style>{`
        .bg-grid-pattern {
            background-image: linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px);
            background-size: 2rem 2rem;
        }
        @keyframes fade-in-out {
            0% { opacity: 0; transform: translate(-50%, -20px); }
            10% { opacity: 1; transform: translate(-50%, 0); }
            90% { opacity: 1; transform: translate(-50%, 0); }
            100% { opacity: 0; transform: translate(-50%, -20px); }
        }
        .animate-fade-in-out {
            animation: fade-in-out 4s ease-in-out forwards;
        }
      `}</style>
    </div>
  );
};

export default App;