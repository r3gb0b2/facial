import React, { useState, useEffect, useMemo } from 'react';
import { Attendee, Sector, Supplier, SubCompany } from '../../types.ts';
import WebcamCapture from '../WebcamCapture.tsx';
import { useTranslation } from '../../hooks/useTranslation.tsx';
import { UsersIcon, CheckCircleIcon, SpinnerIcon, NoSymbolIcon } from '../icons.tsx';
import * as api from '../../firebase/service.ts';

interface RegisterViewProps {
  onRegister: (newAttendee: Omit<Attendee, 'id' | 'status' | 'eventId' | 'createdAt'>, supplierId?: string) => Promise<void>;
  setError: (message: string) => void;
  sectors: Sector[];
  suppliers?: Supplier[];
  predefinedSector?: string | string[];
  eventName?: string;
  supplierName?: string;
  supplierInfo?: { data: Supplier & { eventId: string } };
  currentEventId?: string;
  allowPhotoChange?: boolean;
  allowGuestUploads?: boolean;
}

const RegisterView: React.FC<RegisterViewProps> = ({ onRegister, setError, sectors, suppliers = [], predefinedSector, eventName, supplierName, supplierInfo, currentEventId, allowPhotoChange = true, allowGuestUploads = false }) => {
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
  const [isPhotoLocked, setIsPhotoLocked] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [blockedWarning, setBlockedWarning] = useState<string | null>(null);
  const [blockedInfo, setBlockedInfo] = useState<{ reason: string, eventName: string } | null>(null);
  
  const isSupplierWithMultipleSectors = Array.isArray(predefinedSector);
  const isSupplierWithSingleSector = typeof predefinedSector === 'string';
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
      setSubCompany(''); // Reset to default/placeholder
    } else {
      // Standard behavior without sub-companies
      let initialSector = '';
      if (isSupplierWithSingleSector) {
        initialSector = predefinedSector as string;
      } else if (isSupplierWithMultipleSectors) {
        const availableSectors = sectors.filter(s => (predefinedSector as string[]).includes(s.id));
        initialSector = availableSectors.length > 0 ? availableSectors[0].id : '';
      }
      setSector(initialSector);
    }
  }, [predefinedSector, isSupplierWithSingleSector, isSupplierWithMultipleSectors, sectors, hasSubCompanies]);

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
    setIsPhotoLocked(false);
    setBlockedWarning(null);
    setBlockedInfo(null);
    // Do not clear supplier selection in admin view to make bulk registration easier
    // setSelectedSupplierId(''); 
    if (hasSubCompanies) {
      setSubCompany('');
      setSector('');
    }
    else if (!predefinedSector) { // Admin View
      setSector('');
      setSubCompany('');
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
    setIsPhotoLocked(false);
    setBlockedWarning(null);
    setBlockedInfo(null);

    try {
        // Check global block status first
        const blockInfo = await api.checkBlockedStatus(rawCpf);
        if (blockInfo) {
           setBlockedInfo(blockInfo);
           // Only show warning if it's the admin view. 
           // Public view should silently allow registration but flag it for approval.
           if (isAdminView) {
               setBlockedWarning(`⚠️ ATENÇÃO: Este CPF consta como BLOQUEADO no evento "${blockInfo.eventName}". Motivo: ${blockInfo.reason || 'Não informado'}.`);
           }
        }

        // Determine the event ID to check against.
        // For admin view, we use the currentEventId passed via props.
        // For supplier link, we use the eventId from the supplier info.
        const activeEventId = isAdminView ? currentEventId : supplierInfo?.data.eventId;
        
        const existingAttendee = await api.findAttendeeByCpf(rawCpf, activeEventId);
        
        if (existingAttendee) {
            setName(existingAttendee.name);
            setPhoto(existingAttendee.photo);
            
            // Check if the user is already registered in the ACTIVE event.
            const isRegisteredInCurrentEvent = activeEventId && existingAttendee.eventId === activeEventId;

            if (isRegisteredInCurrentEvent) {
              // Strictly block registration only if the user is already in THIS event
              setCpfCheckMessage(t('register.cpfAlreadyRegistered'));
              setExistingAttendeeFound(true);
              setIsPhotoLocked(true); // Always lock if already registered
            } else {
              // User found in another event - allow registration, but pre-fill data
              // Do NOT set existingAttendeeFound to true (which blocks form), just show a message
              setCpfCheckMessage(t('register.cpfFound'));
              setExistingAttendeeFound(false); 
              
              // If changing photo is NOT allowed, lock the photo component
              if (!allowPhotoChange) {
                 setIsPhotoLocked(true);
              }
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
    if (isAdminView && !selectedSupplierId) {
        setError("Selecione um fornecedor para continuar.");
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

      // If blocked in another event and this is a public registration, attach the block reason.
      // This will trigger the backend to set status to PENDING_APPROVAL instead of PENDING.
      // If it is admin view, we assume the admin saw the warning and is overriding it, so we don't send the block reason (allowing PENDING status).
      if (!isAdminView && blockedInfo) {
          attendeeData.blockReason = `⚠️ Bloqueio Prévio [${blockedInfo.eventName}]: ${blockedInfo.reason}`;
      }

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
    
    // If supplier has sub-companies (either from supplier link or admin selection), sector is derived, so hide this input.
    if (hasSubCompanies || adminHasSubCompanies) return null;
    
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
            disabled={isSubmitting || isCheckingCpf || existingAttendeeFound}
          >
            {isSupplierWithMultipleSectors ? null : <option value="" disabled>{t('register.form.sectorPlaceholder')}</option>}
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
                  <p className={`text-sm mt-1 flex items-center gap-2 ${existingAttendeeFound ? 'text-yellow-400' : 'text-green-400'}`}>
                      {isCheckingCpf && <SpinnerIcon className="w-4 h-4" />}
                      {cpfCheckMessage}
                  </p>
              )}
               {blockedWarning && (
                  <div className="mt-2 p-3 bg-red-900/50 border border-red-500 rounded-md flex items-start gap-2 text-red-200 text-sm">
                      <NoSymbolIcon className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-500" />
                      <span>{blockedWarning}</span>
                  </div>
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
                <label htmlFor="supplier" className="block text-sm font-medium text-gray-300 mb-1">{t('register.form.supplierLabel')} <span className="text-red-500">*</span></label>
                <select
                  id="supplier"
                  value={selectedSupplierId}
                  onChange={(e) => setSelectedSupplierId(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-600 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
                  disabled={isSubmitting || isCheckingCpf || existingAttendeeFound}
                  required
                >
                  <option value="">{t('register.form.supplierPlaceholder')}</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            )}
            
            {renderSubCompanyInput()}
            {renderSectorInput()}

            <div className="space-y-4">
                <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-lg transition-all duration-300 flex items-center justify-center gap-2 disabled:bg-gray-500 disabled:cursor-not-allowed" disabled={!name || !cpf || !photo || (!sector && !subCompany && !isAdminView) || isSubmitting || isCheckingCpf || existingAttendeeFound}>
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
              <WebcamCapture 
                onCapture={setPhoto} 
                capturedImage={photo} 
                disabled={isSubmitting || isCheckingCpf || isPhotoLocked} 
                allowUpload={isAdminView || allowGuestUploads} 
              />
              {isPhotoLocked && (
                <p className="text-sm mt-2 text-yellow-400 text-center px-4">
                  {existingAttendeeFound ? t('register.photoLocked') : t('register.photoLockedPolicy')}
                </p>
              )}
          </div>
        </form>
      </div>
    </div>
  );
};

export default RegisterView;