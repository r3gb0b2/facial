import React, { useState, useEffect, useMemo } from 'react';
import { Attendee, Sector, SupplierCategory, Supplier } from '../../types';
import WebcamCapture from '../WebcamCapture';
import { useTranslation } from '../../hooks/useTranslation.tsx';
import { UsersIcon, CheckCircleIcon, SpinnerIcon } from '../icons';
import * as api from '../../firebase/service.ts';
import SpreadsheetUploadView from './SpreadsheetUploadView';
import RegistrationClosedView from './RegistrationClosedView.tsx';

interface RegisterViewProps {
  onRegister: (newAttendee: Omit<Attendee, 'id' | 'status' | 'eventId' | 'createdAt'>) => Promise<void>;
  setError: (message: string) => void;
  // Admin props
  onImportAttendees?: (data: any[]) => Promise<any>;
  sectors?: Sector[];
  // Category registration props
  categoryRegistrationInfo?: {
      category: SupplierCategory;
      suppliers: Supplier[];
      sectors: Sector[];
      attendees: Attendee[];
  };
}

const RegisterView: React.FC<RegisterViewProps> = (props) => {
  const { onRegister, setError, onImportAttendees, sectors: adminSectors, categoryRegistrationInfo } = props;
  const { t } = useTranslation();

  const [name, setName] = useState('');
  const [cpf, setCpf] = useState('');
  const [sector, setSector] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [selectedSupplierId, setSelectedSupplierId] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCheckingCpf, setIsCheckingCpf] = useState(false);
  const [cpfCheckMessage, setCpfCheckMessage] = useState('');
  const [existingAttendeeFound, setExistingAttendeeFound] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [limitError, setLimitError] = useState('');

  const isCategoryView = !!categoryRegistrationInfo;
  const isAdminView = !isCategoryView;

  const sectors = isCategoryView ? categoryRegistrationInfo.sectors : adminSectors || [];
  const suppliers = isCategoryView ? categoryRegistrationInfo.suppliers : [];
  
  const registrationCounts = useMemo(() => {
    if (!isCategoryView) return new Map();
    const counts = new Map<string, number>();
    for (const attendee of categoryRegistrationInfo.attendees) {
        if (attendee.supplierId) {
            counts.set(attendee.supplierId, (counts.get(attendee.supplierId) || 0) + 1);
        }
    }
    return counts;
  }, [categoryRegistrationInfo]);

  const availableSectors = useMemo(() => {
    if (isAdminView || !selectedSupplierId) {
        return sectors;
    }
    const selectedSupplier = suppliers.find(s => s.id === selectedSupplierId);
    if (!selectedSupplier) return [];
    return sectors.filter(s => selectedSupplier.sectors.includes(s.id));
  }, [isAdminView, selectedSupplierId, suppliers, sectors]);
  
  // Effect to reset sector if it becomes unavailable after supplier change
  useEffect(() => {
    if (isCategoryView && selectedSupplierId) {
        const isCurrentSectorValid = availableSectors.some(s => s.id === sector);
        if (!isCurrentSectorValid) {
            setSector(availableSectors.length > 0 ? availableSectors[0].id : '');
        }
    }
  }, [selectedSupplierId, availableSectors, sector, isCategoryView]);

  // Effect to check registration limit when supplier changes
  useEffect(() => {
    if (isCategoryView && selectedSupplierId) {
        const supplier = suppliers.find(s => s.id === selectedSupplierId);
        const count = registrationCounts.get(selectedSupplierId) || 0;
        if (supplier && count >= supplier.registrationLimit) {
            setLimitError(t('register.errors.limitReached'));
        } else {
            setLimitError('');
        }
    } else {
        setLimitError('');
    }
  }, [selectedSupplierId, suppliers, registrationCounts, t, isCategoryView]);
  
  // If the category link is valid but there are no active suppliers, show a specific message.
  if (isCategoryView && suppliers.length === 0) {
      return <RegistrationClosedView message={t('supplierRegistration.noActiveSuppliers')} />;
  }


  const clearForm = () => {
    setName('');
    setCpf('');
    setPhoto(null);
    setCpfCheckMessage('');
    setExistingAttendeeFound(false);
    setSector(isAdminView ? '' : (availableSectors.length > 0 ? availableSectors[0].id : ''));
    setSelectedSupplierId('');
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
        let errorMessage = t('register.errors.cpfCheckError');
        if (error.code === 'failed-precondition') errorMessage = t('register.errors.cpfCheckIndexError');
        setError(errorMessage);
        setCpfCheckMessage('');
    } finally {
        setIsCheckingCpf(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const rawCpf = cpf.replace(/\D/g, '');
    const supplierId = isCategoryView ? selectedSupplierId : undefined;

    if (!name || !rawCpf || !photo || !sector || (isCategoryView && !supplierId)) {
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

  const formIsDisabled = isSubmitting || isCheckingCpf || !!limitError;

  return (
    <div className="w-full max-w-4xl mx-auto space-y-10">
      <div className="bg-gray-800/50 backdrop-blur-sm p-8 rounded-2xl shadow-2xl border border-gray-700">
        <div className="text-center mb-6">
            <h2 className="text-3xl font-bold text-white flex items-center justify-center gap-3">
              <UsersIcon className="w-8 h-8"/>
              {isCategoryView ? t('register.title.supplier') : t('register.title')}
            </h2>
            {isCategoryView && <p className="text-lg font-medium text-gray-400 mt-1">{categoryRegistrationInfo.category.name}</p>}
        </div>

        <form onSubmit={handleRegisterSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
          <div className="space-y-6">
            {isCategoryView && (
                 <div>
                    <label htmlFor="supplier" className="block text-sm font-medium text-gray-300 mb-1">{t('register.form.supplierLabel')}</label>
                    <select
                        id="supplier" value={selectedSupplierId} onChange={(e) => setSelectedSupplierId(e.target.value)}
                        className="w-full bg-gray-900 border border-gray-600 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        disabled={isSubmitting || isCheckingCpf}
                    >
                        <option value="" disabled>{t('register.form.supplierPlaceholder')}</option>
                        {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                    {limitError && <p className="text-sm mt-1 text-red-400">{limitError}</p>}
                </div>
            )}
            
            <fieldset disabled={isCategoryView && !selectedSupplierId} className="space-y-6">
                 <div>
                    <label htmlFor="cpf" className="block text-sm font-medium text-gray-300 mb-1">{t('register.form.cpfLabel')}</label>
                    <input
                        type="text" id="cpf" value={cpf} onChange={(e) => setCpf(formatCPF(e.target.value))}
                        onBlur={handleCpfBlur}
                        className="w-full bg-gray-900 border border-gray-600 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
                        placeholder={t('register.form.cpfPlaceholder')}
                        disabled={formIsDisabled}
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
                        disabled={formIsDisabled}
                    />
                </div>
                <div>
                    <label htmlFor="sector" className="block text-sm font-medium text-gray-300 mb-1">{t('register.form.sectorLabel')}</label>
                    <select
                        id="sector" value={sector} onChange={(e) => setSector(e.target.value)}
                        className="w-full bg-gray-900 border border-gray-600 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
                        disabled={formIsDisabled || availableSectors.length <= 1}
                    >
                        {isAdminView && <option value="" disabled>{t('register.form.sectorPlaceholder')}</option>}
                        {availableSectors.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                    </select>
                </div>
                <div className="space-y-4">
                    <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-lg transition-all duration-300 flex items-center justify-center gap-2 disabled:bg-indigo-400 disabled:cursor-wait" disabled={!name || !cpf || !photo || !sector || (isCategoryView && !selectedSupplierId) || formIsDisabled}>
                    {isSubmitting ? (
                        <><SpinnerIcon className="w-5 h-5" /> Registrando...</>
                    ) : (
                        <><CheckCircleIcon className="w-5 h-5"/> {t('register.form.button')}</>
                    )}
                    </button>
                    {showSuccess && (
                        <div className="text-center p-3 rounded-lg bg-green-500/20 text-green-300 border border-green-500 flex items-center justify-center gap-2">
                            <CheckCircleIcon className="w-5 h-5" />
                            <p className="text-sm font-medium">{t('register.successMessage')}</p>
                        </div>
                    )}
                </div>
            </fieldset>
          </div>
          <div className="flex flex-col items-center">
              <WebcamCapture onCapture={setPhoto} capturedImage={photo} disabled={formIsDisabled || existingAttendeeFound} allowUpload={isAdminView} />
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