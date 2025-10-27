import React, { useState, useEffect, useMemo } from 'react';
import { Attendee, Sector, Supplier, SupplierCategory } from '../../types';
import WebcamCapture from '../WebcamCapture';
import { useTranslation } from '../../hooks/useTranslation.tsx';
import { UsersIcon, CheckCircleIcon, SpinnerIcon } from '../icons.tsx';
import * as api from '../../firebase/service.ts';
import SpreadsheetUploadView from './SpreadsheetUploadView.tsx';

interface RegisterViewProps {
  onRegister: (newAttendee: Omit<Attendee, 'id' | 'status' | 'eventId' | 'createdAt'>) => Promise<void>;
  onImportAttendees?: (data: any[]) => Promise<any>;
  setError: (message: string) => void;
  sectors?: Sector[]; // For admin view
  categoryRegistrationInfo?: { // For supplier view
    category: SupplierCategory;
    suppliers: Supplier[];
    sectors: Sector[];
    attendees: Attendee[];
  }
}

const RegisterView: React.FC<RegisterViewProps> = ({ onRegister, onImportAttendees, setError, sectors = [], categoryRegistrationInfo }) => {
  const { t } = useTranslation();
  
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [name, setName] = useState('');
  const [cpf, setCpf] = useState('');
  const [sector, setSector] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCheckingCpf, setIsCheckingCpf] = useState(false);
  const [cpfCheckMessage, setCpfCheckMessage] = useState('');
  const [existingAttendeeFound, setExistingAttendeeFound] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  
  const isAdminView = !categoryRegistrationInfo;

  const registrationCounts = useMemo(() => {
    if (isAdminView) return new Map();
    const counts = new Map<string, number>();
    categoryRegistrationInfo.attendees.forEach(att => {
        if(att.supplierId) {
            counts.set(att.supplierId, (counts.get(att.supplierId) || 0) + 1);
        }
    });
    return counts;
  }, [categoryRegistrationInfo, isAdminView]);

  const selectedSupplier = useMemo(() => {
    if (isAdminView || !selectedSupplierId) return null;
    return categoryRegistrationInfo.suppliers.find(s => s.id === selectedSupplierId);
  }, [isAdminView, selectedSupplierId, categoryRegistrationInfo]);

  // Handle supplier selection and its side effects
  useEffect(() => {
    if (selectedSupplier) {
      const availableSectors = categoryRegistrationInfo!.sectors.filter(s => selectedSupplier.sectors.includes(s.id));
      setSector(availableSectors.length > 0 ? availableSectors[0].id : ''); // Auto-select first available sector
    } else {
      setSector('');
    }
  }, [selectedSupplier, categoryRegistrationInfo]);

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
        const attendeesToCheck = isAdminView ? [] : categoryRegistrationInfo.attendees;
        const existingAttendee = attendeesToCheck.find(a => a.cpf === rawCpf) || await api.findAttendeeByCpf(rawCpf);

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

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const rawCpf = cpf.replace(/\D/g, '');
    const supplierId = isAdminView ? undefined : selectedSupplierId;

    if (!isAdminView && !supplierId) {
        setError(t('register.errors.noCompanySelected'));
        return;
    }
    if (!name || !rawCpf || !photo || !sector) {
      setError(t('register.errors.allFields'));
      return;
    }
    if (rawCpf.length !== 11) {
      setError(t('register.errors.invalidCpf'));
      return;
    }

    setIsSubmitting(true);
    setShowSuccess(false);
    try {
      await onRegister({ name, cpf: rawCpf, photo, sector, supplierId });
      clearForm();
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 4000);
    } catch (error) {
      console.error("Registration failed:", error);
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const renderFormFields = () => {
    const isSupplierFormDisabled = !isAdminView && !selectedSupplierId;
    const allDisabled = isSubmitting || isCheckingCpf || isSupplierFormDisabled;

    let sectorOptions = isAdminView ? sectors : [];
    if (selectedSupplier) {
        sectorOptions = categoryRegistrationInfo!.sectors.filter(s => selectedSupplier.sectors.includes(s.id));
    }
    
    return (
        <>
            {!isAdminView && (
                <div>
                    <label htmlFor="supplier" className="block text-sm font-medium text-gray-300 mb-1">{t('register.form.selectCompanyLabel')}</label>
                    <select
                        id="supplier" value={selectedSupplierId} onChange={(e) => setSelectedSupplierId(e.target.value)}
                        className="w-full bg-gray-900 border border-gray-600 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        disabled={isSubmitting || isCheckingCpf}
                    >
                        <option value="" disabled>{t('register.form.selectCompanyPlaceholder')}</option>
                        {categoryRegistrationInfo.suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
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
                disabled={allDisabled}
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
                disabled={allDisabled}
              />
            </div>
            <div>
              <label htmlFor="sector" className="block text-sm font-medium text-gray-300 mb-1">{t('register.form.sectorLabel')}</label>
              <select
                id="sector" value={sector} onChange={(e) => setSector(e.target.value)}
                className="w-full bg-gray-900 border border-gray-600 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
                disabled={allDisabled || sectorOptions.length <= 1}
              >
                {isAdminView && <option value="" disabled>{t('register.form.sectorPlaceholder')}</option>}
                {sectorOptions.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </div>
        </>
    );
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-10">
      <div className="bg-gray-800/50 backdrop-blur-sm p-8 rounded-2xl shadow-2xl border border-gray-700">
        <div className="text-center mb-6">
            <h2 className="text-3xl font-bold text-white flex items-center justify-center gap-3">
              <UsersIcon className="w-8 h-8"/>
              {isAdminView ? t('register.title') : t('register.titleSupplier', categoryRegistrationInfo.category.name)}
            </h2>
        </div>

        <form onSubmit={handleRegisterSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
          <div className="space-y-6">
            {renderFormFields()}
            <div className="space-y-4 pt-2">
                <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-lg transition-all duration-300 flex items-center justify-center gap-2 disabled:bg-indigo-400 disabled:cursor-wait" disabled={!name || !cpf || !photo || !sector || isSubmitting || isCheckingCpf || (!isAdminView && !selectedSupplierId)}>
                  {isSubmitting ? <SpinnerIcon className="w-5 h-5" /> : <CheckCircleIcon className="w-5 h-5"/>}
                  {isSubmitting ? 'Registrando...' : t('register.form.button')}
                </button>
                 {showSuccess && (
                    <div className="text-center p-3 rounded-lg bg-green-500/20 text-green-300 border border-green-500">
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
