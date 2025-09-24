import React, { useState, useEffect } from 'react';
import { Attendee } from '../../types';
import WebcamCapture from '../WebcamCapture';
import { useTranslation } from '../../hooks/useTranslation';
import { UsersIcon, CheckCircleIcon, SpinnerIcon } from '../icons';

interface RegisterViewProps {
  onRegister: (newAttendee: Omit<Attendee, 'id' | 'status'>) => Promise<void>;
  setError: (message: string) => void;
  predefinedSector?: string | string[];
}

const RegisterView: React.FC<RegisterViewProps> = ({ onRegister, setError, predefinedSector }) => {
  const { t, sectors } = useTranslation();
  const [name, setName] = useState('');
  const [cpf, setCpf] = useState('');
  const [sector, setSector] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const isSupplierWithMultipleSectors = Array.isArray(predefinedSector);
  const isSupplierWithSingleSector = typeof predefinedSector === 'string';

  useEffect(() => {
    let initialSector = '';
    if (isSupplierWithSingleSector) {
      initialSector = predefinedSector as string;
    } else if (isSupplierWithMultipleSectors) {
      initialSector = (predefinedSector as string[])[0] || '';
    }
    setSector(initialSector);
  }, [predefinedSector, isSupplierWithSingleSector, isSupplierWithMultipleSectors]);
  

  const clearForm = () => {
    setName('');
    setCpf('');
    setPhoto(null);
    if (!predefinedSector) {
      setSector('');
    } else if (isSupplierWithMultipleSectors) {
      setSector((predefinedSector as string[])[0] || '');
    }
  };

  const formatCPF = (value: string) => {
    return value
      .replace(/\D/g, '') // Remove all non-digit characters
      .slice(0, 11) // Limit to 11 digits
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const rawCpf = cpf.replace(/\D/g, '');

    if (!name || !rawCpf || !photo || !sector) {
      setError(t('register.errors.allFields'));
      setTimeout(() => setError(''), 3000);
      return;
    }
    if (rawCpf.length !== 11) {
      setError(t('register.errors.invalidCpf'));
      setTimeout(() => setError(''), 3000);
      return;
    }

    setIsSubmitting(true);
    try {
      await onRegister({ name, cpf: rawCpf, photo, sector });
      clearForm();
    } catch (error) {
      console.error("Registration failed:", error);
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const renderSectorInput = () => {
    if (isSupplierWithSingleSector) {
      return null; // Sector is predefined and hidden
    }

    let sectorOptions = sectors;
    if (isSupplierWithMultipleSectors) {
        sectorOptions = sectors.filter(s => (predefinedSector as string[]).includes(s.value));
    }

    return (
        <div>
          <label htmlFor="sector" className="block text-sm font-medium text-gray-300 mb-1">{t('register.form.sectorLabel')}</label>
          <select
            id="sector" value={sector} onChange={(e) => setSector(e.target.value)}
            className="w-full bg-gray-900 border border-gray-600 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
            disabled={isSubmitting}
          >
            {isSupplierWithMultipleSectors ? null : <option value="" disabled>{t('register.form.sectorPlaceholder')}</option>}
            {sectorOptions.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
    );
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
              className="w-full bg-gray-900 border border-gray-600 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
              placeholder={t('register.form.namePlaceholder')}
              disabled={isSubmitting}
            />
          </div>
          <div>
            <label htmlFor="cpf" className="block text-sm font-medium text-gray-300 mb-1">{t('register.form.cpfLabel')}</label>
            <input
              type="text" id="cpf" value={cpf} onChange={(e) => setCpf(formatCPF(e.target.value))}
              className="w-full bg-gray-900 border border-gray-600 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
              placeholder={t('register.form.cpfPlaceholder')}
              disabled={isSubmitting}
            />
          </div>
          {renderSectorInput()}
          <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-lg transition-all duration-300 flex items-center justify-center gap-2 disabled:bg-indigo-400 disabled:cursor-wait" disabled={!name || !cpf || !photo || !sector || isSubmitting}>
            {isSubmitting ? (
              <>
                <SpinnerIcon className="w-5 h-5" />
                Registrando...
              </>
            ) : (
              <>
                <CheckCircleIcon className="w-5 h-5"/>
                {t('register.form.button')}
              </>
            )}
          </button>
        </div>
        <div className="flex flex-col items-center">
            <WebcamCapture onCapture={setPhoto} capturedImage={photo} disabled={isSubmitting} />
        </div>
      </form>
    </div>
  );
};

export default RegisterView;