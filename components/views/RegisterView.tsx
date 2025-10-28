import React, { useState, useEffect } from 'react';
import { Attendee, Sector, Supplier } from '../../types';
import WebcamCapture from '../WebcamCapture';
// FIX: Added .tsx extension to module import.
import { useTranslation } from '../../hooks/useTranslation.tsx';
import { UsersIcon, CheckCircleIcon, SpinnerIcon } from '../icons';
// FIX: Added .ts extension to module import.
import * as api from '../../firebase/service.ts';
import SpreadsheetUploadView from './SpreadsheetUploadView';

interface RegisterViewProps {
  onRegister: (newAttendee: Omit<Attendee, 'id' | 'status' | 'eventId' | 'createdAt'>) => Promise<void>;
  onImportAttendees?: (data: any[]) => Promise<any>;
  setError: (message: string) => void;
  sectors: Sector[];
  predefinedSector?: string | string[];
  supplierName?: string;
  supplierInfo?: { data: Supplier };
}

const RegisterView: React.FC<RegisterViewProps> = ({ onRegister, onImportAttendees, setError, sectors, predefinedSector, supplierName, supplierInfo }) => {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [cpf, setCpf] = useState('');
  const [sector, setSector] = useState('');
  const [subCompany, setSubCompany] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCheckingCpf, setIsCheckingCpf] = useState(false);
  const [cpfCheckMessage, setCpfCheckMessage] = useState('');
  const [existingAttendeeFound, setExistingAttendeeFound] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  
  const isSupplierWithMultipleSectors = Array.isArray(predefinedSector);
  const isSupplierWithSingleSector = typeof predefinedSector === 'string';
  const isAdminView = !predefinedSector; // True if it's the main admin view, not a supplier link
  const hasSubCompanies = !!(supplierInfo?.data.subCompanies && supplierInfo.data.subCompanies.length > 0);

  useEffect(() => {
    let initialSector = '';
    if (isSupplierWithSingleSector) {
      initialSector = predefinedSector as string;
    } else if (isSupplierWithMultipleSectors) {
       // Find the full sector object from the list of available sectors
      const availableSectors = sectors.filter(s => (predefinedSector as string[]).includes(s.id));
      initialSector = availableSectors.length > 0 ? availableSectors[0].id : '';
    }
    setSector(initialSector);

    if (hasSubCompanies) {
      setSubCompany(''); // Reset to default/placeholder
    }

  }, [predefinedSector, isSupplierWithSingleSector, isSupplierWithMultipleSectors, sectors, hasSubCompanies]);
  

  const clearForm = () => {
    setName('');
    setCpf('');
    setPhoto(null);
    setCpfCheckMessage('');
    setExistingAttendeeFound(false);
    if (hasSubCompanies) {
      setSubCompany('');
    }
    if (!predefinedSector) {
      setSector('');
    } else if (isSupplierWithMultipleSectors) {
      const availableSectors = sectors.filter(s => (predefinedSector as string[]).includes(s.id));
      setSector(availableSectors.length > 0 ? availableSectors[0].id : '');
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

  const handleCpfBlur = async () => {
    const rawCpf = cpf.replace(/\D/g, '');
    if (rawCpf.length !== 11) {
        setCpfCheckMessage('');
        return;
    }

    setIsCheckingCpf(true);
    setCpfCheckMessage(t('register.checkingCpf'));
    setPhoto(null);
    setName('');
    setExistingAttendeeFound(false);

    try {
        const existingAttendee = await api.findAttendeeByCpf(rawCpf);
        if (existingAttendee) {
            setName(existingAttendee.name);
            setPhoto(existingAttendee.photo);
            setCpfCheckMessage(t('register.cpfFound'));
            setExistingAttendeeFound(true);
        } else {
            setCpfCheckMessage(t('register.cpfNotFound'));
        }
    } catch (error: any) {
        console.error("Error checking CPF:", error);
        let errorMessage = t('register.errors.cpfCheckError');
        if (error.code === 'failed-precondition') {
            errorMessage = t('register.errors.cpfCheckIndexError');
            console.error("Firestore index missing for CPF lookup. Please create a composite index on the 'attendees' collection group for the 'cpf' field.");
        }
        setError(errorMessage);
        setCpfCheckMessage('');
    } finally {
        setIsCheckingCpf(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const rawCpf = cpf.replace(/\D/g, '');

    if (!name || !rawCpf || !photo || !sector) {
      setError(t('register.errors.allFields'));
      return;
    }
    if (rawCpf.length !== 11) {
      setError(t('register.errors.invalidCpf'));
      return;
    }
    if (hasSubCompanies && !subCompany) {
      setError(t('register.errors.subCompanyRequired'));
      return;
    }

    setIsSubmitting(true);
    setShowSuccess(false);
    try {
      const attendeeData: Omit<Attendee, 'id' | 'status' | 'eventId' | 'createdAt'> = { 
          name, 
          cpf: rawCpf, 
          photo, 
          sector,
          ...(hasSubCompanies && { subCompany })
      };
      await onRegister(attendeeData);
      clearForm();
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 4000);
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
        sectorOptions = sectors.filter(s => (predefinedSector as string[]).includes(s.id));
    }

    return (
        <div>
          <label htmlFor="sector" className="block text-sm font-medium text-gray-300 mb-1">{t('register.form.sectorLabel')}</label>
          <select
            id="sector" value={sector} onChange={(e) => setSector(e.target.value)}
            className="w-full bg-gray-900 border border-gray-600 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
            disabled={isSubmitting || isCheckingCpf}
          >
            {isSupplierWithMultipleSectors ? null : <option value="" disabled>{t('register.form.sectorPlaceholder')}</option>}
            {sectorOptions.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </div>
    );
  };
  
  const renderSubCompanyInput = () => {
    if (!hasSubCompanies) return null;
    
    return (
        <div>
          <label htmlFor="subCompany" className="block text-sm font-medium text-gray-300 mb-1">{t('register.form.subCompanyLabel')}</label>
          <select
            id="subCompany" value={subCompany} onChange={(e) => setSubCompany(e.target.value)}
            className="w-full bg-gray-900 border border-gray-600 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
            disabled={isSubmitting || isCheckingCpf}
            required
          >
            <option value="" disabled>{t('register.form.subCompanyPlaceholder')}</option>
            {supplierInfo?.data.subCompanies?.map(sc => 
                <option key={sc.name} value={sc.name}>
                    {`\u25CF ${sc.name}`}
                </option>
            )}
          </select>
        </div>
    );
  };


  return (
    <div className="w-full max-w-4xl mx-auto space-y-10">
      <div className="bg-gray-800/50 backdrop-blur-sm p-8 rounded-2xl shadow-2xl border border-gray-700">
        <div className="text-center mb-6">
            <h2 className="text-3xl font-bold text-white flex items-center justify-center gap-3">
              <UsersIcon className="w-8 h-8"/>
              {t('register.title')}
            </h2>
            {supplierName && <p className="text-lg font-medium text-gray-400 mt-1">{supplierName}</p>}
        </div>

        <form onSubmit={handleRegisterSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
          <div className="space-y-6">
            <div>
              <label htmlFor="cpf" className="block text-sm font-medium text-gray-300 mb-1">{t('register.form.cpfLabel')}</label>
              <input
                type="text" id="cpf" value={cpf} onChange={(e) => setCpf(formatCPF(e.target.value))}
                onBlur={handleCpfBlur}
                className="w-full bg-gray-900 border border-gray-600 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
                placeholder={t('register.form.cpfPlaceholder')}
                disabled={isSubmitting || isCheckingCpf}
              />
              {cpfCheckMessage && (
                  <p className="text-sm mt-1 text-gray-400 flex items-center gap-2">
                      {isCheckingCpf && <SpinnerIcon className="w-4 h-4" />}
                      {cpfCheckMessage}
                  </p>
              )}
            </div>
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-1">{t('register.form.nameLabel')}</label>
              <input
                type="text" id="name" value={name} onChange={(e) => setName(e.target.value)}
                className="w-full bg-gray-900 border border-gray-600 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
                placeholder={t('register.form.namePlaceholder')}
                disabled={isSubmitting || isCheckingCpf}
              />
            </div>
            {renderSubCompanyInput()}
            {renderSectorInput()}
            <div className="space-y-4">
                <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-lg transition-all duration-300 flex items-center justify-center gap-2 disabled:bg-indigo-400 disabled:cursor-wait" disabled={!name || !cpf || !photo || !sector || isSubmitting || isCheckingCpf}>
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
                 {showSuccess && (
                    <div className="text-center p-3 rounded-lg bg-green-500/20 text-green-300 border border-green-500 flex items-center justify-center gap-2">
                        <CheckCircleIcon className="w-5 h-5" />
                        <p className="text-sm font-medium">{t('register.successMessage')}</p>
                    </div>
                )}
            </div>
          </div>
          <div className="flex flex-col items-center">
              <WebcamCapture onCapture={setPhoto} capturedImage={photo} disabled={isSubmitting || isCheckingCpf || existingAttendeeFound} allowUpload={isAdminView} />
          </div>
        </form>
      </div>
      
      {isAdminView && onImportAttendees && (
        <SpreadsheetUploadView onImport={onImportAttendees} setError={setError} />
      )}
    </div>
  );
};

export default RegisterView;