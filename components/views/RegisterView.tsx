import React, { useState, useEffect, useMemo } from 'react';
// FIX: Add .ts extension
import { Attendee, Sector, Supplier, SubCompany } from '../../types.ts';
// FIX: Add .tsx extension
import WebcamCapture from '../WebcamCapture.tsx';
// FIX: Added .tsx extension to module import.
import { useTranslation } from '../../hooks/useTranslation.tsx';
// FIX: Add .tsx extension
import { UsersIcon, CheckCircleIcon, SpinnerIcon } from '../icons.tsx';
// FIX: Added .ts extension to module import.
import * as api from '../../firebase/service.ts';

interface RegisterViewProps {
  onRegister: (newAttendee: Omit<Attendee, 'id' | 'status' | 'eventId' | 'createdAt'>, supplierId?: string) => Promise<void>;
  setError: (message: string) => void;
  sectors: Sector[];
  suppliers?: Supplier[];
  predefinedSector?: string | string[];
  eventName?: string;
  supplierName?: string;
  supplierInfo?: { data: Supplier };
}

const RegisterView: React.FC<RegisterViewProps> = ({ onRegister, setError, sectors, suppliers = [], predefinedSector, eventName, supplierName, supplierInfo }) => {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [cpf, setCpf] = useState('');
  const [sector, setSector] = useState('');
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [subCompany, setSubCompany] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCheckingCpf, setIsCheckingCpf] = useState(false);
  const [cpfCheckMessage, setCpfCheckMessage] = useState('');
  const [existingAttendeeFound, setExistingAttendeeFound] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  
  const isAdminView = !predefinedSector; // True if it's the main admin view, not a supplier link
  const hasSubCompanies = Array.isArray(supplierInfo?.data.subCompanies) && supplierInfo!.data.subCompanies!.length > 0;

  const selectedSupplier = useMemo(() => {
    if (!isAdminView || !selectedSupplierId) return null;
    return suppliers.find(s => s.id === selectedSupplierId);
  }, [isAdminView, selectedSupplierId, suppliers]);


  useEffect(() => {
    if (hasSubCompanies) {
      // If there are sub-companies, sector is determined by them.
      // Set to empty initially, will be set when a sub-company is chosen.
      setSector('');
      setSubCompany('');
    } else {
      const isSupplierReg = Array.isArray(predefinedSector);
      const isSingleSector = isSupplierReg && predefinedSector.length === 1;

      let initialSector = '';
      if (isSingleSector) {
        // If the supplier has only one sector, it's pre-selected.
        initialSector = predefinedSector[0];
      }
      // For multi-sector suppliers and the main admin, the sector starts empty, forcing a selection.
      setSector(initialSector);
    }
  }, [predefinedSector, hasSubCompanies]);

  // Effect to auto-select sector when a sub-company is chosen
  useEffect(() => {
    if (subCompany) {
      let selectedSubCompanyConfig: SubCompany | undefined;
      // Supplier link view logic
      if (hasSubCompanies) {
          selectedSubCompanyConfig = supplierInfo?.data.subCompanies?.find(sc => sc.name === subCompany);
      } 
      // Admin view logic
      else if (isAdminView) {
          const supplierHasSubCompanies = selectedSupplier?.subCompanies && selectedSupplier.subCompanies.length > 0;
          if (supplierHasSubCompanies) {
            selectedSubCompanyConfig = selectedSupplier?.subCompanies?.find(sc => sc.name === subCompany);
          }
      }
      
      if (selectedSubCompanyConfig) {
        setSector(selectedSubCompanyConfig.sector);
      }
    }
  }, [subCompany, hasSubCompanies, supplierInfo, isAdminView, selectedSupplier]);
  
  // Effect to reset sub-company and sector when the supplier is changed in the admin view
  useEffect(() => {
    if (isAdminView) {
      setSubCompany('');
      setSector('');
    }
  }, [selectedSupplierId, isAdminView]);


  const clearForm = () => {
    setName('');
    setCpf('');
    setPhoto(null);
    setCpfCheckMessage('');
    setExistingAttendeeFound(false);
    setSelectedSupplierId('');
    if (hasSubCompanies) {
      setSubCompany('');
      setSector('');
    }
    else if (!predefinedSector) { // Admin View
      setSector('');
      setSubCompany('');
    } else {
      const isSingleSector = Array.isArray(predefinedSector) && predefinedSector.length === 1;
      if (isSingleSector) {
          setSector(predefinedSector[0]);
      } else {
          setSector(''); // Reset for multi-sector
      }
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
        const eventId = isAdminView ? undefined : supplierInfo?.data.eventId;
        const existingAttendee = await api.findAttendeeByCpf(rawCpf, eventId);
        if (existingAttendee) {
            setName(existingAttendee.name);
            setPhoto(existingAttendee.photo);
            if (existingAttendee.eventId && (!isAdminView)) {
              setCpfCheckMessage(t('register.cpfAlreadyRegistered'));
              setExistingAttendeeFound(true);
            } else {
              setCpfCheckMessage(t('register.cpfFound'));
            }
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
    if ((hasSubCompanies || (selectedSupplier?.subCompanies && selectedSupplier.subCompanies.length > 0)) && !subCompany) {
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
          sectors: [sector],
          ...(subCompany && { subCompany })
      };
      await onRegister(attendeeData, isAdminView ? selectedSupplierId : undefined);
      clearForm();
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 4000);
    } catch (error: any) {
      console.error("Registration failed:", error);
      setError(error.message || "Falha ao registrar.");
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const renderSectorInput = () => {
    const adminHasSubCompanies = isAdminView && selectedSupplier?.subCompanies && selectedSupplier.subCompanies.length > 0;

    const isSupplierRegistration = Array.isArray(predefinedSector);
    const isSingleSectorSupplier = isSupplierRegistration && predefinedSector.length === 1;

    // The sector input should not be displayed if:
    // 1. The sector is determined by a selected sub-company.
    // 2. The supplier is configured for only one specific sector.
    if (hasSubCompanies || adminHasSubCompanies || isSingleSectorSupplier) {
      return null;
    }

    // Determine the list of sectors to show in the dropdown.
    let sectorOptions = sectors;
    if (isSupplierRegistration) {
      // For a multi-sector supplier, only show the sectors they are allowed to register for.
      sectorOptions = sectors.filter(s => predefinedSector.includes(s.id));
    }
    // For the admin view (without a supplier with sub-companies), show all event sectors.

    return (
        <div>
          <label htmlFor="sector" className="block text-sm font-medium text-gray-300 mb-1">{t('register.form.sectorLabel')}</label>
          <select
            id="sector" value={sector} onChange={(e) => setSector(e.target.value)}
            className="w-full bg-gray-900 border border-gray-600 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
            disabled={isSubmitting || isCheckingCpf || existingAttendeeFound}
            required
          >
            <option value="" disabled>{t('register.form.sectorPlaceholder')}</option>
            {sectorOptions.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </div>
    );
  };
  
  const renderSubCompanyInput = () => {
    // For supplier-specific registration pages
    if (hasSubCompanies) {
      return (
          <div>
            <label htmlFor="subCompany" className="block text-sm font-medium text-gray-300 mb-1">{t('register.form.subCompanyLabel')}</label>
            <select
              id="subCompany" value={subCompany} onChange={(e) => setSubCompany(e.target.value)}
              className="w-full bg-gray-900 border border-gray-600 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
              disabled={isSubmitting || isCheckingCpf || existingAttendeeFound}
              required
            >
              <option value="" disabled>{t('register.form.subCompanyPlaceholder')}</option>
              {supplierInfo?.data.subCompanies?.map(sc => 
                  <option key={sc.name} value={sc.name}>
                      {sc.name}
                  </option>
              )}
            </select>
          </div>
      );
    }

    // For the main admin registration tab
    if (isAdminView) {
      const adminHasSubCompanies = selectedSupplier?.subCompanies && selectedSupplier.subCompanies.length > 0;

      if (adminHasSubCompanies) {
        // Admin selected a supplier WITH sub-companies -> show dropdown
        return (
          <div>
            <label htmlFor="subCompany-admin" className="block text-sm font-medium text-gray-300 mb-1">{t('register.form.subCompanyLabel')}</label>
            <select
              id="subCompany-admin" value={subCompany} onChange={(e) => setSubCompany(e.target.value)}
              className="w-full bg-gray-900 border border-gray-600 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
              disabled={isSubmitting || isCheckingCpf || existingAttendeeFound}
              required
            >
              <option value="">{t('register.form.subCompanyPlaceholder')}</option>
              {selectedSupplier?.subCompanies?.map(sc => 
                  <option key={sc.name} value={sc.name}>
                      {sc.name}
                  </option>
              )}
            </select>
          </div>
        );
      } else {
        // Admin selected a supplier WITHOUT sub-companies (or no supplier) -> show text input
        return (
          <div>
            <label htmlFor="subCompany-admin-input" className="block text-sm font-medium text-gray-300 mb-1">{t('register.form.subCompanyLabelOptional')}</label>
            <input
              type="text"
              id="subCompany-admin-input"
              value={subCompany}
              onChange={(e) => setSubCompany(e.target.value)}
              className="w-full bg-gray-900 border border-gray-600 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
              placeholder={t('register.form.subCompanyInputPlaceholder')}
              disabled={isSubmitting || isCheckingCpf || existingAttendeeFound}
            />
          </div>
        );
      }
    }
    
    return null;
  };


  return (
    <div className="w-full max-w-4xl mx-auto space-y-10">
      <div className="bg-gray-800/50 backdrop-blur-sm p-8 rounded-2xl shadow-2xl border border-gray-700">
        <div className="text-center mb-6">
            <h2 className="text-3xl font-bold text-white flex items-center justify-center gap-3">
              <UsersIcon className="w-8 h-8"/>
              {t('register.title')}
            </h2>
            {eventName && <p className="text-lg font-medium text-gray-400 mt-1">{eventName}</p>}
            {supplierName && <p className="text-md font-medium text-gray-400">{t('supplierAdmin.supplier')} {supplierName}</p>}
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
                disabled={isSubmitting || isCheckingCpf || existingAttendeeFound}
              />
            </div>

            {isAdminView && (
              <div>
                <label htmlFor="supplier" className="block text-sm font-medium text-gray-300 mb-1">{t('register.form.supplierLabel')}</label>
                <select
                  id="supplier"
                  value={selectedSupplierId}
                  onChange={(e) => setSelectedSupplierId(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-600 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
                  disabled={isSubmitting || isCheckingCpf || existingAttendeeFound}
                >
                  <option value="">{t('register.form.supplierPlaceholder')}</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            )}
            
            {renderSubCompanyInput()}
            {renderSectorInput()}

            <div className="space-y-4">
                <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-lg transition-all duration-300 flex items-center justify-center gap-2 disabled:bg-gray-500 disabled:cursor-not-allowed" disabled={!name || !cpf || !photo || !sector || isSubmitting || isCheckingCpf || existingAttendeeFound}>
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
                 {existingAttendeeFound && (
                    <p className="text-sm text-yellow-400 text-center">
                        {t('register.cpfAlreadyRegistered')}
                    </p>
                 )}
            </div>
          </div>
          <div className="flex flex-col items-center">
              <WebcamCapture onCapture={setPhoto} capturedImage={photo} disabled={isSubmitting || isCheckingCpf || existingAttendeeFound} allowUpload={isAdminView} />
              {existingAttendeeFound && !isAdminView && (
                <p className="text-sm mt-2 text-yellow-400 text-center px-4">
                  {t('register.photoLocked')}
                </p>
              )}
          </div>
        </form>
      </div>
    </div>
  );
};

export default RegisterView;