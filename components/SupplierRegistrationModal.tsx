import React, { useState, useMemo, useEffect } from 'react';
import { Attendee, Sector, Supplier, SubCompany } from '../types.ts';
import WebcamCapture from './WebcamCapture.tsx';
import { useTranslation } from '../hooks/useTranslation.tsx';
import * as api from '../firebase/service.ts';
import { XMarkIcon, SpinnerIcon, CheckCircleIcon, UsersIcon } from './icons.tsx';

interface SupplierRegistrationModalProps {
  eventId: string;
  supplier: Supplier;
  allowedSectors: Sector[];
  onClose: () => void;
  onSuccess: () => void;
}

const formatCPF = (value: string) => {
    return value
      .replace(/\D/g, '') // Remove all non-digit characters
      .slice(0, 11) // Limit to 11 digits
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
};

const SupplierRegistrationModal: React.FC<SupplierRegistrationModalProps> = ({ eventId, supplier, allowedSectors, onClose, onSuccess }) => {
  const { t } = useTranslation();
  
  const [name, setName] = useState('');
  const [cpf, setCpf] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [selectedSectors, setSelectedSectors] = useState<string[]>([]);
  const [subCompany, setSubCompany] = useState('');
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  
  const hasSubCompanies = Array.isArray(supplier.subCompanies) && supplier.subCompanies.length > 0;

  useEffect(() => {
    if (!hasSubCompanies) {
        // If there are no sub-companies, pre-select all allowed sectors
        setSelectedSectors(supplier.sectors || []);
    }
  }, [hasSubCompanies, supplier.sectors]);

  // Effect to auto-select sector when a sub-company is chosen
  useEffect(() => {
    if (subCompany && hasSubCompanies) {
        const selectedSubCompanyConfig = supplier.subCompanies?.find(sc => sc.name === subCompany);
        if (selectedSubCompanyConfig) {
            setSelectedSectors([selectedSubCompanyConfig.sector]);
        }
    }
  }, [subCompany, hasSubCompanies, supplier.subCompanies]);

  const handleSectorChange = (sectorId: string) => {
    setSelectedSectors(prev =>
      prev.includes(sectorId)
        ? prev.filter(id => id !== sectorId)
        : [...prev, sectorId]
    );
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const rawCpf = cpf.replace(/\D/g, '');

    if (!name.trim() || rawCpf.length !== 11 || !photo || selectedSectors.length === 0) {
      setError(t('register.errors.allFields'));
      return;
    }
     if (hasSubCompanies && !subCompany) {
      setError(t('register.errors.subCompanyRequired'));
      return;
    }
    
    // Check registration limit
    const currentCount = await api.getRegistrationsCountForSupplier(eventId, supplier.id);
    if (currentCount >= supplier.registrationLimit) {
        setError(t('errors.registrationLimitReached'));
        return;
    }

    setIsSubmitting(true);
    setError('');

    try {
        const attendeeData: Omit<Attendee, 'id' | 'status' | 'eventId' | 'createdAt'> = {
            name: name.trim(),
            cpf: rawCpf,
            photo,
            sectors: selectedSectors,
            ...(subCompany && { subCompany })
        };
      
      await api.requestNewRegistration(eventId, attendeeData, supplier.id);
      onSuccess();
      onClose();

    } catch (err) {
      console.error(err);
      setError("Falha ao enviar a solicitação de cadastro.");
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const renderSectorSelection = () => {
    if (hasSubCompanies) return null; // Sector is determined by sub-company

    return (
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">{t('register.form.sectorLabel')}</label>
          <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 p-2 bg-gray-900 rounded-md max-h-48 overflow-y-auto border border-gray-600">
            {allowedSectors.map(sector => (
                <div key={sector.id} className="flex items-center p-1 rounded-md hover:bg-gray-700/50">
                    <input
                        type="checkbox"
                        id={`reg-sector-${sector.id}`}
                        checked={selectedSectors.includes(sector.id)}
                        onChange={() => handleSectorChange(sector.id)}
                        className="h-4 w-4 rounded border-gray-500 bg-gray-700 text-indigo-600 focus:ring-indigo-500"
                        disabled={isSubmitting}
                    />
                    <label htmlFor={`reg-sector-${sector.id}`} className="ml-2 text-white cursor-pointer flex items-center gap-2">
                        <span className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: sector.color || '#4B5563' }}></span>
                        {sector.label}
                    </label>
                </div>
            ))}
          </div>
        </div>
    );
  };
  
  const renderSubCompanySelection = () => {
      if (!hasSubCompanies) return null;
      return (
           <div>
            <label htmlFor="subCompany" className="block text-sm font-medium text-gray-300 mb-1">{t('register.form.subCompanyLabel')}</label>
            <select
              id="subCompany" value={subCompany} onChange={(e) => setSubCompany(e.target.value)}
              className="w-full bg-gray-900 border border-gray-600 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
              disabled={isSubmitting}
              required
            >
              <option value="" disabled>{t('register.form.subCompanyPlaceholder')}</option>
              {supplier.subCompanies?.map(sc => 
                  <option key={sc.name} value={sc.name}>
                      {sc.name}
                  </option>
              )}
            </select>
          </div>
      );
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-gray-800 rounded-2xl shadow-2xl w-full max-w-4xl border border-gray-700 flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b border-gray-700 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-white flex items-center gap-3">
              <UsersIcon className="w-8 h-8"/>
              {t('supplierAdmin.modal.title')}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8 items-start max-h-[80vh] overflow-y-auto">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-1">{t('register.form.nameLabel')}</label>
              <input
                type="text" id="name" value={name} onChange={(e) => setName(e.target.value)}
                className="w-full bg-gray-900 border border-gray-600 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder={t('register.form.namePlaceholder')}
                disabled={isSubmitting}
              />
            </div>
             <div>
              <label htmlFor="cpf" className="block text-sm font-medium text-gray-300 mb-1">{t('register.form.cpfLabel')}</label>
              <input
                type="text" id="cpf" value={cpf} onChange={(e) => setCpf(formatCPF(e.target.value))}
                className="w-full bg-gray-900 border border-gray-600 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder={t('register.form.cpfPlaceholder')}
                disabled={isSubmitting}
              />
            </div>
            
            {renderSubCompanySelection()}
            {renderSectorSelection()}
            
            {error && <p className="text-red-400 text-sm">{error}</p>}

             <button
                type="submit"
                disabled={isSubmitting || !name || !cpf || !photo || selectedSectors.length === 0}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-lg transition-all duration-300 flex items-center justify-center gap-2 disabled:bg-gray-500 disabled:cursor-not-allowed"
              >
                {isSubmitting ? <SpinnerIcon className="w-5 h-5" /> : <CheckCircleIcon className="w-6 h-6" />}
                {isSubmitting ? "Enviando..." : t('supplierAdmin.modal.submitButton')}
              </button>
          </form>
          <div className="flex flex-col items-center">
            <WebcamCapture onCapture={setPhoto} capturedImage={photo} disabled={isSubmitting} allowUpload={true} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default SupplierRegistrationModal;