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

// Helper to extract base64 data from a data URL
const getBase64 = (dataUrl: string) => dataUrl.split(',')[1];

// Helper to fetch a URL and convert it to a base64 string
const urlToBase64 = async (url: string): Promise<string> => {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            // result includes the "data:mime/type;base64," prefix, which we strip
            const dataUrl = reader.result as string;
            resolve(dataUrl.split(',')[1]);
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

  useEffect(() => {
    // Subscribe to real-time updates from Firestore
    const unsubscribe = onAttendeesUpdate(
      (newAttendees) => {
        // Sort attendees by name on the client side
        const sortedAttendees = newAttendees.sort((a, b) => a.name.localeCompare(b.name));
        setAttendees(sortedAttendees);
      },
      (err: any) => {
        console.error(`Firestore listener error: ${err.message}`);
        if (err.code === 'permission-denied') {
          setError(t('register.errors.dbPermissionDenied'));
        } else {
          setError(t('register.errors.dbConnection'));
        }
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
        console.error(`Failed to add attendee: ${e.message}`);
        setError("Failed to register attendee.");
        setTimeout(() => setError(''), 3000);
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
        console.error(`Failed to check in attendee: ${e.message}`);
        setError("Failed to check in attendee.");
        setTimeout(() => setError(''), 3000);
    }
  };

  const handleFacialSearch = async (livePhoto: string): Promise<void> => {
    const apiKey = typeof process !== 'undefined' && process.env && process.env.API_KEY
      ? process.env.API_KEY
      : undefined;

    if (!apiKey) {
      setError("Gemini API key is not configured.");
      setTimeout(() => setError(''), 4000);
      return;
    }
    
    const ai = new GoogleGenAI({ apiKey });

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
        try {
            // Fetch the registered photo URL and convert it to base64
            const registeredPhotoBase64 = await urlToBase64(attendee.photo);

            const registeredImagePart = {
                inlineData: {
                    mimeType: 'image/png', // This might need to be dynamic if other types are stored
                    data: registeredPhotoBase64,
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
                return; // Exit after finding the first match
            }
        } catch (apiError: any) {
            console.error(`Gemini API error: ${apiError.message}`);
            setError(t('fastCheckin.apiError'));
            setTimeout(() => setError(''), 4000);
            return;
        }
    }

    // If loop completes without a match
    setError(t('fastCheckin.noMatch'));
    setTimeout(() => setError(''), 3000);
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
        
        {error && <div className="fixed top-5 left-1/2 -translate-x-1/2 bg-red-500 text-white py-2 px-4 rounded-lg shadow-lg animate-fade-in-out z-50">{error}</div>}
        {success && <div className="fixed top-5 left-1/2 -translate-x-1/2 bg-green-500 text-white py-2 px-4 rounded-lg shadow-lg animate-fade-in-out z-50">{success}</div>}

        <main className="container mx-auto px-4 pb-12">
            {view === 'register' && <RegisterView onRegister={handleRegister} setError={setError} />}
            {view === 'checkin' && <CheckinView attendees={attendees} onSelectAttendee={handleSelectAttendee} />}
            {view === 'fast-checkin' && <FastCheckinView onVerify={handleFacialSearch} />}
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