import React, { useState } from 'react';
import { Attendee, CheckinStatus } from './types';
import WebcamCapture from './components/WebcamCapture';
import AttendeeCard from './components/AttendeeCard';
import VerificationModal from './components/VerificationModal';
import { CameraIcon, CheckCircleIcon, UsersIcon, FingerPrintIcon, SearchIcon } from './components/icons';
import { useTranslation } from './hooks/useTranslation';

type View = 'register' | 'checkin';

const App: React.FC = () => {
  const { t, sectors } = useTranslation();
  const [view, setView] = useState<View>('register');
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [sector, setSector] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [selectedAttendee, setSelectedAttendee] = useState<Attendee | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sectorFilter, setSectorFilter] = useState('');

  const clearForm = () => {
    setName('');
    setEmail('');
    setSector('');
    setPhoto(null);
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !photo || !sector) {
      setError(t('register.errors.allFields'));
      setTimeout(() => setError(''), 3000);
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setError(t('register.errors.invalidEmail'));
      setTimeout(() => setError(''), 3000);
      return;
    }

    const newAttendee: Attendee = {
      id: Date.now().toString(),
      name,
      email,
      photo,
      sector,
      status: CheckinStatus.REGISTERED,
    };

    setAttendees(prev => [newAttendee, ...prev]);
    setSuccess(t('register.success', { name }));
    clearForm();
    setTimeout(() => {
      setSuccess('');
      setView('checkin');
    }, 2000);
  };

  const handleSelectAttendee = (attendee: Attendee) => {
    if (attendee.status === CheckinStatus.CHECKED_IN) return;
    setSelectedAttendee(attendee);
  };

  const handleCloseModal = () => {
    setSelectedAttendee(null);
  };
  
  const handleCheckIn = (attendeeId: string) => {
    setAttendees(prevAttendees =>
      prevAttendees.map(att =>
        att.id === attendeeId
          ? { 
              ...att, 
              status: CheckinStatus.CHECKED_IN,
              checkinTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            }
          : att
      )
    );
    setSuccess(t('checkin.checkedInSuccess', { name: selectedAttendee?.name || '' }));
    handleCloseModal();
    setTimeout(() => setSuccess(''), 3000);
  };

  const renderRegisterView = () => (
    <div className="w-full max-w-4xl mx-auto bg-gray-800/50 backdrop-blur-sm p-8 rounded-2xl shadow-2xl border border-gray-700">
      <h2 className="text-3xl font-bold text-center text-white mb-6 flex items-center justify-center gap-3">
        <UsersIcon className="w-8 h-8"/>
        {t('register.title')}
      </h2>
      <form onSubmit={handleRegister} className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
        <div className="space-y-6">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-1">{t('register.form.nameLabel')}</label>
            <input
              type="text" id="name" value={name} onChange={(e) => setName(e.target.value)}
              className="w-full bg-gray-900 border border-gray-600 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder={t('register.form.namePlaceholder')}
            />
          </div>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-1">{t('register.form.emailLabel')}</label>
            <input
              type="email" id="email" value={email} onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-gray-900 border border-gray-600 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder={t('register.form.emailPlaceholder')}
            />
          </div>
          <div>
            <label htmlFor="sector" className="block text-sm font-medium text-gray-300 mb-1">{t('register.form.sectorLabel')}</label>
            <select
              id="sector" value={sector} onChange={(e) => setSector(e.target.value)}
              className="w-full bg-gray-900 border border-gray-600 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="" disabled>{t('register.form.sectorPlaceholder')}</option>
              {sectors.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-lg transition-all duration-300 flex items-center justify-center gap-2 disabled:bg-gray-500" disabled={!name || !email || !photo || !sector}>
            <CheckCircleIcon className="w-5 h-5"/>
            {t('register.form.button')}
          </button>
        </div>
        <div className="flex flex-col items-center">
            <WebcamCapture onCapture={setPhoto} capturedImage={photo} />
        </div>
      </form>
    </div>
  );

  const renderCheckinView = () => {
    const filteredAttendees = attendees.filter(attendee => {
        const nameMatch = attendee.name.toLowerCase().includes(searchTerm.toLowerCase());
        const sectorMatch = sectorFilter ? attendee.sector === sectorFilter : true;
        return nameMatch && sectorMatch;
    });

    return (
        <div className="w-full max-w-5xl mx-auto">
            <h2 className="text-3xl font-bold text-center text-white mb-8 flex items-center justify-center gap-3">
                <FingerPrintIcon className="w-8 h-8"/>
                {t('checkin.title')}
            </h2>
            <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="relative md:col-span-2">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3">
                  <SearchIcon className="w-5 h-5 text-gray-400" />
                </span>
                <input
                  type="text"
                  placeholder={t('checkin.searchPlaceholder')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-600 rounded-md py-2 pl-10 pr-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
                />
              </div>
               <select
                onChange={(e) => setSectorFilter(e.target.value)}
                value={sectorFilter}
                className="w-full bg-gray-800 border border-gray-600 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">{t('checkin.filterSectorPlaceholder')}</option>
                {sectors.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            {attendees.length === 0 ? (
                <div className="text-center text-gray-400 bg-gray-800/50 p-8 rounded-2xl border border-gray-700">
                    <p className="text-lg">{t('checkin.noAttendees')}</p>
                    <p>{t('checkin.noAttendeesSubtitle')}</p>
                </div>
            ) : filteredAttendees.length === 0 ? (
                <div className="text-center text-gray-400 bg-gray-800/50 p-8 rounded-2xl border border-gray-700">
                    <p className="text-lg">{t('checkin.noResults')}</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredAttendees.map(attendee => (
                        <AttendeeCard key={attendee.id} attendee={attendee} onSelect={handleSelectAttendee} />
                    ))}
                </div>
            )}
        </div>
    );
  }

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
          <div className="bg-gray-800 p-1 rounded-full border border-gray-700">
            <button
              onClick={() => setView('register')}
              className={`px-6 py-2 rounded-full text-sm font-semibold transition-all duration-300 ${view === 'register' ? 'bg-indigo-600 text-white' : 'text-gray-300 hover:bg-gray-700'}`}
            >
              {t('nav.register')}
            </button>
            <button
              onClick={() => setView('checkin')}
              className={`px-6 py-2 rounded-full text-sm font-semibold transition-all duration-300 ${view === 'checkin' ? 'bg-indigo-600 text-white' : 'text-gray-300 hover:bg-gray-700'}`}
            >
              {t('nav.checkin')}
            </button>
          </div>
        </nav>
        
        {error && <div className="fixed top-5 left-1/2 -translate-x-1/2 bg-red-500 text-white py-2 px-4 rounded-lg shadow-lg animate-fade-in-out z-50">{error}</div>}
        {success && <div className="fixed top-5 left-1/2 -translate-x-1/2 bg-green-500 text-white py-2 px-4 rounded-lg shadow-lg animate-fade-in-out z-50">{success}</div>}

        <main className="container mx-auto px-4 pb-12">
            {view === 'register' ? renderRegisterView() : renderCheckinView()}
        </main>
        
        {selectedAttendee && (
            <VerificationModal 
                attendee={selectedAttendee}
                onClose={handleCloseModal}
                onConfirm={handleCheckIn}
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
            animation: fade-in-out 3s ease-in-out forwards;
        }
      `}</style>
    </div>
  );
};

export default App;