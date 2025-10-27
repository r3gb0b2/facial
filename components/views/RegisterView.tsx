import React, { useState, useEffect, useMemo } from 'react';
import { Attendee, Sector, Supplier } from '../../types';
import WebcamCapture from '../WebcamCapture';
import { useTranslation } from '../../hooks/useTranslation.tsx';
import { UsersIcon, CheckCircleIcon, SpinnerIcon } from '../icons';
import * as api from '../../firebase/service.ts';
import SpreadsheetUploadView from './SpreadsheetUploadView';
import { CategoryRegistrationInfo } from '../../App';

interface RegisterViewProps {
  onRegister: (newAttendee: Omit<Attendee, 'id' | 'status' | 'eventId' | 'createdAt'>) => Promise<void>;
  setError: (message: string) => void;
  // Admin-specific props
  onImportAttendees?: (data: any[]) => Promise<any>;
  sectors?: Sector[];
  // Supplier-specific props
  categoryRegistrationInfo?: CategoryRegistrationInfo;
}

const RegisterView: React.FC<RegisterViewProps> = (props) => {
  const { onRegister, setError, onImportAttendees, sectors: adminSectors, categoryRegistrationInfo } = props;
  const { t } = useTranslation();

  const isAdminView = !!adminSectors;

  // Form state
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [name, setName] = useState('');
  const [cpf, setCpf] = useState('');
  const [sector, setSector] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  
  // UI/Flow state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCheckingCpf, setIsCheckingCpf] = useState(false);
  const [cpfCheckMessage, setCpfCheckMessage] = useState('');
  const [existingAttendeeFound, setExistingAttendeeFound] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [formError, setFormError] = useState('');

  const selectedSupplier = useMemo(() => {
    if (!categoryRegistrationInfo || !selectedSupplierId) return null;
    return categoryRegistrationInfo.suppliers.find(s => s.id === selectedSupplierId);
  }, [categoryRegistrationInfo, selectedSupplierId]);
  
  const registrationCounts = useMemo(() => {
    const counts = new Map<string, number>();
    if (!categoryRegistrationInfo) return counts;
    for (const attendee of categoryRegistrationInfo.attendees) {
        if (attendee.supplierId) {
            counts.set(attendee.supplierId, (counts.get(attendee.supplierId) || 0) + 1);
        }
    }
    return counts;
  }, [categoryRegistrationInfo]);

  const availableSectors = useMemo(() => {
    if (isAdminView) return adminSectors || [];
    if (!categoryRegistrationInfo || !selectedSupplier) return [];
    return categoryRegistrationInfo.sectors.filter(s => selectedSupplier.sectors.includes(s.id));
  }, [isAdminView, adminSectors, categoryRegistrationInfo, selectedSupplier]);
  
  // Effect to reset sector when available sectors change
  useEffect(() => {
    if (availableSectors.length > 0) {
      // If the current sector is not in the new list, reset it
      if (!availableSectors.find(s => s.id === sector)) {
         setSector(availableSectors[0].id);
      }
    } else {
        setSector('');
    }
  }, [availableSectors, sector]);

  const clearForm = () => {
    setName('');
    setCpf('');
    setPhoto(null);
    setCpfCheckMessage('');
    setExistingAttendeeFound(false);
    if(isAdminView) {
        setSector('');
    } else {
        setSelectedSupplierId('');
        setSector('');
    }
  };

  const formatCPF = (value: string) => {
    return value
      .replace(/\D/g, '')
      .slice(0, 11)
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
        setError(t('register.errors.cpfCheckError'));
        setCpfCheckMessage('');
    } finally {
        setIsCheckingCpf(false);
    }
  };
  
  const handleSupplierChange = (supplierId: string) => {
    setSelectedSupplierId(supplierId);
    setFormError(''); // Clear previous errors
    
    // Check registration limit
    const supplier = categoryRegistrationInfo?.suppliers.find(s => s.id === supplierId);
    if (supplier) {
        const count = registrationCounts.get(supplierId) || 0;
        if (count >= supplier.registrationLimit) {
            setFormError(t('register.errors.limitReached'));
        }
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const rawCpf = cpf.replace(/\D/g, '');

    if (!isAdminView && !selectedSupplierId) { setError(t('register.errors.selectCompany')); return; }
    if (!name || !rawCpf || !photo || !sector) { setError(t('register.errors.allFields')); return; }
    if (rawCpf.length !== 11) { setError(t('register.errors.invalidCpf')); return; }
    if (formError) { setError(formError); return; }

    setIsSubmitting(true);
    setShowSuccess(false);
    try {
      const attendeeData = { name, cpf: rawCpf, photo, sector, supplierId: isAdminView ? undefined : selectedSupplierId };
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
  
  const isFormDisabled = isSubmitting || isCheckingCpf || !!formError;

  return (
    <div className="w-full max-w-4xl mx-auto space-y-10">
      <div className="bg-gray-800/50 backdrop-blur-sm p-8 rounded-2xl shadow-2xl border border-gray-700">
        <div className="text-center mb-6">
            <h2 className="text-3xl font-bold text-white flex items-center justify-center gap-3">
              <UsersIcon className="w-8 h-8"/>
              {isAdminView ? t('register.titleAdmin') : t('register.title')}
            </h2>
            {!isAdminView && categoryRegistrationInfo && <p className="text-lg font-medium text-gray-400 mt-1">{categoryRegistrationInfo.category.name}</p>}
        </div>

        <form onSubmit={handleRegisterSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
          <div className="space-y-6">
            {!isAdminView && categoryRegistrationInfo && (
                 <div>
                    <label htmlFor="company" className="block text-sm font-medium text-gray-300 mb-1">{t('register.form.companyLabel')}</label>
                    <select
                        id="company" value={selectedSupplierId} onChange={(e) => handleSupplierChange(e.target.value)}
                        className="w-full bg-gray-900 border border-gray-600 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        disabled={isSubmitting || isCheckingCpf}
                    >
                        <option value="" disabled>{t('register.form.companyPlaceholder')}</option>
                        {categoryRegistrationInfo.suppliers.map(s => {
                            const count = registrationCounts.get(s.id) || 0;
                            const isFull = count >= s.registrationLimit;
                            return <option key={s.id} value={s.id} disabled={isFull}>{s.name} {isFull ? '(Vagas Esgotadas)' : `(${count}/${s.registrationLimit})`}</option>
                        })}
                    </select>
                </div>
            )}
            <div>
              <label htmlFor="cpf" className="block text-sm font-medium text-gray-300 mb-1">{t('register.form.cpfLabel')}</label>
              <input
                type="text" id="cpf" value={cpf} onChange={(e) => setCpf(formatCPF(e.target.value))}
                onBlur={handleCpfBlur}
                className="w-full bg-gray-900 border border-gray-600 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
                placeholder={t('register.form.cpfPlaceholder')}
                disabled={isFormDisabled && !isCheckingCpf}
              />
              {cpfCheckMessage && <p className="text-sm mt-1 text-gray-400 flex items-center gap-2">{isCheckingCpf && <SpinnerIcon className="w-4 h-4" />}{cpfCheckMessage}</p>}
            </div>
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-1">{t('register.form.nameLabel')}</label>
              <input
                type="text" id="name" value={name} onChange={(e) => setName(e.target.value)}
                className="w-full bg-gray-900 border border-gray-600 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
                placeholder={t('register.form.namePlaceholder')}
                disabled={isFormDisabled}
              />
            </div>
             <div>
                <label htmlFor="sector" className="block text-sm font-medium text-gray-300 mb-1">{t('register.form.sectorLabel')}</label>
                <select
                    id="sector" value={sector} onChange={(e) => setSector(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-600 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
                    disabled={isFormDisabled || availableSectors.length === 0}
                >
                    <option value="" disabled>{t('register.form.sectorPlaceholder')}</option>
                    {availableSectors.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
            </div>
            <div className="space-y-4">
                <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-lg transition-all duration-300 flex items-center justify-center gap-2 disabled:bg-indigo-400 disabled:cursor-wait" disabled={!name || !cpf || !photo || !sector || isFormDisabled}>
                  {isSubmitting ? <><SpinnerIcon className="w-5 h-5" />Registrando...</> : <><CheckCircleIcon className="w-5 h-5"/>{t('register.form.button')}</>}
                </button>
                 {showSuccess && (
                    <div className="text-center p-3 rounded-lg bg-green-500/20 text-green-300 border border-green-500 flex items-center justify-center gap-2">
                        <CheckCircleIcon className="w-5 h-5" /><p className="text-sm font-medium">{t('register.successMessage')}</p>
                    </div>
                )}
                 {formError && <p className="text-red-400 text-sm text-center">{formError}</p>}
            </div>
          </div>
          <div className="flex flex-col items-center">
              <WebcamCapture onCapture={setPhoto} capturedImage={photo} disabled={isFormDisabled || existingAttendeeFound} allowUpload={isAdminView} />
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