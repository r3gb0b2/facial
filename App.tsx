import React, { useState } from 'react';
import { Attendee, CheckinStatus } from './types';
import WebcamCapture from './components/WebcamCapture';
import AttendeeCard from './components/AttendeeCard';
import VerificationModal from './components/VerificationModal';
import { CameraIcon, CheckCircleIcon, UsersIcon, FingerPrintIcon, SearchIcon } from './components/icons';

type View = 'register' | 'checkin';

const App: React.FC = () => {
  const [view, setView] = useState<View>('register');
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [selectedAttendee, setSelectedAttendee] = useState<Attendee | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const clearForm = () => {
    setName('');
    setEmail('');
    setPhoto(null);
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !photo) {
      setError('All fields, including a photo, are required.');
      setTimeout(() => setError(''), 3000);
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setError('Please enter a valid email address.');
      setTimeout(() => setError(''), 3000);
      return;
    }

    const newAttendee: Attendee = {
      id: Date.now().toString(),
      name,
      email,
      photo,
      status: CheckinStatus.REGISTERED,
    };

    setAttendees(prev => [newAttendee, ...prev]);
    setSuccess(`Successfully registered ${name}!`);
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
    setSuccess(`${selectedAttendee?.name} has been checked in!`);
    handleCloseModal();
    setTimeout(() => setSuccess(''), 3000);
  };

  const renderRegisterView = () => (
    <div className="w-full max-w-4xl mx-auto bg-gray-800/50 backdrop-blur-sm p-8 rounded-2xl shadow-2xl border border-gray-700">
      <h2 className="text-3xl font-bold text-center text-white mb-6 flex items-center justify-center gap-3">
        <UsersIcon className="w-8 h-8"/>
        Attendee Registration
      </h2>
      <form onSubmit={handleRegister} className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
        <div className="space-y-6">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-1">Full Name</label>
            <input
              type="text"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-gray-900 border border-gray-600 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="e.g., Jane Doe"
            />
          </div>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-1">Email Address</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-gray-900 border border-gray-600 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="e.g., jane.doe@example.com"
            />
          </div>
          <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-lg transition-all duration-300 flex items-center justify-center gap-2 disabled:bg-gray-500" disabled={!name || !email || !photo}>
            <CheckCircleIcon className="w-5 h-5"/>
            Complete Registration
          </button>
        </div>
        <div className="flex flex-col items-center">
            <WebcamCapture onCapture={setPhoto} capturedImage={photo} />
        </div>
      </form>
    </div>
  );

  const renderCheckinView = () => {
    const filteredAttendees = attendees.filter(attendee =>
        attendee.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="w-full max-w-5xl mx-auto">
            <h2 className="text-3xl font-bold text-center text-white mb-8 flex items-center justify-center gap-3">
                <FingerPrintIcon className="w-8 h-8"/>
                Event Check-in
            </h2>
            <div className="mb-6 relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3">
                <SearchIcon className="w-5 h-5 text-gray-400" />
              </span>
              <input
                type="text"
                placeholder="Search by name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-gray-800 border border-gray-600 rounded-md py-2 pl-10 pr-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
              />
            </div>
            {attendees.length === 0 ? (
                <div className="text-center text-gray-400 bg-gray-800/50 p-8 rounded-2xl border border-gray-700">
                    <p className="text-lg">No attendees registered yet.</p>
                    <p>Go to the "Register" tab to add the first attendee.</p>
                </div>
            ) : filteredAttendees.length === 0 ? (
                <div className="text-center text-gray-400 bg-gray-800/50 p-8 rounded-2xl border border-gray-700">
                    <p className="text-lg">No attendees found for "{searchTerm}"</p>
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
            Facial Credentialing System
          </h1>
          <p className="text-gray-400 mt-2">Seamless & Secure Event Access</p>
        </header>

        <nav className="flex justify-center mb-8">
          <div className="bg-gray-800 p-1 rounded-full border border-gray-700">
            <button
              onClick={() => setView('register')}
              className={`px-6 py-2 rounded-full text-sm font-semibold transition-all duration-300 ${view === 'register' ? 'bg-indigo-600 text-white' : 'text-gray-300 hover:bg-gray-700'}`}
            >
              Register
            </button>
            <button
              onClick={() => setView('checkin')}
              className={`px-6 py-2 rounded-full text-sm font-semibold transition-all duration-300 ${view === 'checkin' ? 'bg-indigo-600 text-white' : 'text-gray-300 hover:bg-gray-700'}`}
            >
              Check-in
            </button>
          </div>
        </nav>
        
        {/* Notifications */}
        {error && <div className="fixed top-5 right-5 bg-red-500 text-white py-2 px-4 rounded-lg shadow-lg animate-fade-in-out">{error}</div>}
        {success && <div className="fixed top-5 right-5 bg-green-500 text-white py-2 px-4 rounded-lg shadow-lg animate-fade-in-out">{success}</div>}

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
            0% { opacity: 0; transform: translateY(-20px); }
            10% { opacity: 1; transform: translateY(0); }
            90% { opacity: 1; transform: translateY(0); }
            100% { opacity: 0; transform: translateY(-20px); }
        }
        .animate-fade-in-out {
            animation: fade-in-out 3s ease-in-out forwards;
        }
      `}</style>
    </div>
  );
};

export default App;
