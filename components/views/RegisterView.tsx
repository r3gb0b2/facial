import React, { useState } from 'react';
import { Attendee } from '../../types';
import WebcamCapture from '../WebcamCapture';
import { useTranslation } from '../../hooks/useTranslation';
import { UsersIcon, CheckCircleIcon } from '../icons';

interface RegisterViewProps {
  onRegister: (newAttendee: Omit<Attendee, 'id' | 'status'>) => void;
  setError: (message: string) => void;
}

const RegisterView: React.FC<RegisterViewProps> = ({ onRegister, setError }) => {
  const { t, sectors } = useTranslation();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [sector, setSector] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);

  const clearForm = () => {
    setName('');
    setEmail('');
    setSector('');
    setPhoto(null);
  };

  const handleRegisterSubmit = (e: React.FormEvent) => {
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
    onRegister({ name, email, photo, sector });
    clearForm();
  };

  return (
    <div className="w-full max-w-4xl mx-auto bg-gray-800/50 backdrop-blur-sm p-8 rounded-2xl shadow-2xl border border-gray-700">
      <h2 className="text-3xl font-bold text-center text-white mb-6 flex items-center justify-center gap-3">
        <UsersIcon className="w-8 h-8"/>
        {t('register.title')}
      </h2>
      <form onSubmit={handleRegisterSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
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
};

export default RegisterView;
