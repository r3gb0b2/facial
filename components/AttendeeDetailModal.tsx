import React, { useState, useEffect, useMemo } from 'react';
import { Attendee, CheckinStatus, Sector, Supplier } from '../types.ts';
import { useTranslation } from '../hooks/useTranslation.tsx';
import { XMarkIcon, PencilIcon, TrashIcon, CheckCircleIcon, SpinnerIcon } from './icons.tsx';

interface AttendeeDetailModalProps {
  attendee: Attendee;
  sectors: Sector[];
  suppliers: Supplier[];
  allAttendees: Attendee[];
  onClose: () => void;
  onUpdateStatus: (status: CheckinStatus, wristbands?: { [sectorId: string]: string }) => void;
  onUpdateDetails: (attendeeId: string, data: Partial<Pick<Attendee, 'name' | 'cpf' | 'sectors' | 'subCompany' | 'wristbands' | 'supplierId'>>) => Promise<void>;
  onDelete: (attendeeId: string) => Promise<void>;
  onApproveSubstitution: (attendeeId: string) => Promise<void>;
  onRejectSubstitution: (attendeeId: string) => Promise<void>;
  onApproveSectorChange: (attendeeId: string) => Promise<void>;
  onRejectSectorChange: (attendeeId: string) => Promise<void>;
  onApproveNewRegistration: (attendeeId: string) => Promise<void>;
  onRejectNewRegistration: (attendeeId: string) => Promise<void>;
  setError: (message: string) => void;
  supplier?: Supplier;
}

export const AttendeeDetailModal: React.FC<AttendeeDetailModalProps> = ({
  attendee,
  sectors,
  suppliers,
  allAttendees,
  onClose,
  onUpdateStatus,
  onUpdateDetails,
  onDelete,
  onApproveSubstitution,
  onRejectSubstitution,
  onApproveSectorChange,
  onRejectSectorChange,
  onApproveNewRegistration,
  onRejectNewRegistration,
  setError,
  supplier,
}) => {
  const { t } = useTranslation();
  const [isEditing, setIsEditing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [wristbands, setWristbands] = useState(attendee.wristbands || {});
  const [wristbandErrorSectors, setWristbandErrorSectors] = useState<Set<string>>(new Set());
  const [showWristbandSuccess, setShowWristbandSuccess] = useState(false);
  const [editData, setEditData] = useState({
    name: attendee.name,
    cpf: attendee.cpf,
    sectors: attendee.sectors,
    subCompany: attendee.subCompany || '',
    supplierId: attendee.supplierId || '',
  });
  
  const attendeeSectors = useMemo(() => {
    return (attendee.sectors || []).map(id => sectors.find(s => s.id === id)).filter(Boolean) as Sector[];
  }, [attendee.sectors, sectors]);


  useEffect(() => {
    const availableSectorIds = new Set(sectors.map(s => s.id));
    const validAttendeeSectors = (attendee.sectors || []).filter(id => availableSectorIds.has(id));

    setEditData({
      name: attendee.name,
      cpf: formatCPF(attendee.cpf),
      sectors: validAttendeeSectors,
      subCompany: attendee.subCompany || '',
      supplierId: attendee.supplierId || '',
    });
    setWristbands(attendee.wristbands || {});
    setIsEditing(false); // Reset editing state when attendee changes
    setShowWristbandSuccess(false);
    setWristbandErrorSectors(new Set());
  }, [attendee, sectors]);

  const statusInfo = {
    [CheckinStatus.PENDING]: { bg: 'bg-gray-600', text: 'text-gray-200', label: t('status.pending') },
    [CheckinStatus.CHECKED_IN]: { bg: 'bg-green-600', text: 'text-white', label: t('status.checked_in') },
    [CheckinStatus.CANCELLED]: { bg: 'bg-red-600', text: 'text-white', label: t('status.cancelled') },
    [CheckinStatus.SUBSTITUTION]: { bg: 'bg-yellow-500', text: 'text-black', label: t('status.substitution') },
    [CheckinStatus.SUBSTITUTION_REQUEST]: { bg: 'bg-blue-500', text: 'text-white', label: t('status.substitution_request') },
    [CheckinStatus.SECTOR_CHANGE_REQUEST]: { bg: 'bg-purple-500', text: 'text-white', label: t('status.sector_change_request') },
    [CheckinStatus.PENDING_APPROVAL]: { bg: 'bg-yellow-500', text: 'text-black', label: t('status.pending_approval') },
    [CheckinStatus.MISSED]: { bg: 'bg-gray-800', text: 'text-gray-400', label: t('status.missed') },
  }[attendee.status] || { bg: 'bg-gray-600', text: 'text-gray-200', label: attendee.status };
  
  const formatCPF = (cpf: string) => {
    if (!cpf) return '';
    return cpf
      .replace(/\D/g, '')
      .slice(0, 11)
      .replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  };

  const handleSave = async () => {
    const rawCpf = editData.cpf.replace(/\D/g, '');
    if (!editData.name.trim() || !rawCpf.trim() || editData.sectors.length === 0) {
      setError(t('attendeeDetail.formError'));
      return;
    }
    await onUpdateDetails(attendee.id, { 
        name: editData.name,
        cpf: rawCpf,
        sectors: editData.sectors,
        subCompany: editData.subCompany,
        supplierId: editData.supplierId || undefined
    });
    setIsEditing(false);
  };
  
  const handleEditSectorChange = (sectorId: string) => {
    setEditData(prev => {
        const newSectors = prev.sectors.includes(sectorId)
            ? prev.sectors.filter(id => id !== sectorId)
            : [...prev.sectors, sectorId];
        return { ...prev, sectors: newSectors };
    });
  };

  const handleDelete = () => {
    if (window.confirm(t('attendeeDetail.deleteConfirm', attendee.name))) {
      onDelete(attendee.id);
    }
  };

  const handleUpdateWristbands = async () => {
    setShowWristbandSuccess(false);
    setWristbandErrorSectors(new Set());
    const errors = new Set<string>();
    const duplicateNumbers: string[] = [];

    const otherAttendees = allAttendees.filter(a => a.id !== attendee.id);
    
    // Check for duplicates
    for (const sectorId of attendeeSectors.map(s => s.id)) {
      const number = wristbands[sectorId];
      if (number) {
        const isDuplicate = otherAttendees.some(other => 
          other.wristbands && Object.values(other.wristbands).includes(number)
        );
        if (isDuplicate) {
          errors.add(sectorId);
          duplicateNumbers.push(number);
        }
      }
    }

    setWristbandErrorSectors(errors);
    if (errors.size > 0) {
      setError(t('attendeeDetail.wristbandsDuplicateError', duplicateNumbers.join(', ')));
      return;
    }
    
    // If no errors, update status and wristbands
    await onUpdateStatus(CheckinStatus.CHECKED_IN, wristbands);
    setShowWristbandSuccess(true);
    setTimeout(() => setShowWristbandSuccess(false), 3000);
  };

  const handleWristbandChange = (sectorId: string, value: string) => {
    setWristbands(prev => ({ ...prev, [sectorId]: value }));
    // Clear error for this field as user types
    if (wristbandErrorSectors.has(sectorId)) {
        setWristbandErrorSectors(prev => {
            const newErrors = new Set(prev);
            newErrors.delete(sectorId);
            return newErrors;
        });
    }
  };
  
  const handleApprove = async () => {
    setIsSubmitting(true);
    try {
        await onApproveSubstitution(attendee.id);
        onClose();
    } catch (e) {
        setError("Falha ao aprovar substituição.");
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleReject = async () => {
      setIsSubmitting(true);
      try {
          await onRejectSubstitution(attendee.id);
          onClose();
      } catch (e) {
          setError("Falha ao rejeitar substituição.");
      } finally {
          setIsSubmitting(false);
      }
  };

  const handleApproveSectorChange = async () => {
    setIsSubmitting(true);
    try {
        await onApproveSectorChange(attendee.id);
        onClose();
    } catch (e) {
        setError("Falha ao aprovar troca de setor.");
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleRejectSectorChange = async () => {
      setIsSubmitting(true);
      try {
          await onRejectSectorChange(attendee.id);
          onClose();
      } catch (e) {
          setError("Falha ao rejeitar troca de setor.");
      } finally {
          setIsSubmitting(false);
      }
  };

  const handleApproveRegistration = async () => {
    setIsSubmitting(true);
    try {
        await onApproveNewRegistration(attendee.id);
        onClose();
    } catch (e) {
        setError("Falha ao aprovar novo cadastro.");
    } finally {
        setIsSubmitting(false);
    }
  };
  
  const handleRejectRegistration = async () => {
      setIsSubmitting(true);
      try {
          await onRejectNewRegistration(attendee.id);
          onClose();
      } catch (e) {
          setError("Falha ao rejeitar novo cadastro.");
      } finally {
          setIsSubmitting(false);
      }
  };

  const selectedSupplierData = useMemo(() => {
    return suppliers.find(s => s.id === editData.supplierId);
  }, [editData.supplierId, suppliers]);

  const subCompanyOptions = useMemo(() => {
    return selectedSupplierData?.subCompanies?.map(sc => sc.name) || [];
  }, [selectedSupplierData]);

  // Effect to auto-select sector when a sub-company is chosen during edit
  useEffect(() => {
    if (isEditing && selectedSupplierData?.subCompanies && editData.subCompany) {
        const selected = selectedSupplierData.subCompanies.find(sc => sc.name === editData.subCompany);
        if (selected) {
            setEditData(prev => ({...prev, sectors: [selected.sector]}));
        }
    }
  }, [editData.subCompany, selectedSupplierData, isEditing]);
  
  const renderStatusButton = (status: CheckinStatus, label: string) => (
    <button
      onClick={() => {
        onUpdateStatus(status);
        onClose();
      }}
      className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg transition-colors w-full"
    >
      {label}
    </button>
  );

  const renderContent = () => {
    if (isEditing) {
      return (
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-400">Nome</label>
            <input type="text" value={editData.name} onChange={e => setEditData({ ...editData, name: e.target.value })} className="w-full bg-gray-900 border border-gray-600 rounded-md py-2 px-3 text-white" />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-400">CPF</label>
            <input type="text" value={editData.cpf} onChange={e => setEditData({ ...editData, cpf: formatCPF(e.target.value) })} className="w-full bg-gray-900 border border-gray-600 rounded-md py-2 px-3 text-white" />
          </div>
           <div>
            <label className="text-sm font-medium text-gray-400">Fornecedor</label>
            <select
                value={editData.supplierId}
                onChange={e => {
                    const newSupplierId = e.target.value;
                    const newSupplier = suppliers.find(s => s.id === newSupplierId);
                    const hasSubCompanies = !!(newSupplier?.subCompanies && newSupplier.subCompanies.length > 0);
                    
                    setEditData({ 
                        ...editData, 
                        supplierId: newSupplierId,
                        // Reset sub-company and sectors when supplier changes
                        subCompany: '',
                        sectors: hasSubCompanies ? [] : (newSupplier?.sectors || [])
                    });
                }}
                className="w-full bg-gray-900 border border-gray-600 rounded-md py-2 px-3 text-white"
            >
                <option value="">Nenhum / Manual</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          {selectedSupplierData?.subCompanies && selectedSupplierData.subCompanies.length > 0 ? (
            <div>
              <label className="text-sm font-medium text-gray-400">Empresa/Unidade</label>
              <select
                  value={editData.subCompany}
                  onChange={e => setEditData({...editData, subCompany: e.target.value})}
                  className="w-full bg-gray-900 border border-gray-600 rounded-md py-2 px-3 text-white"
              >
                  <option value="">Selecione...</option>
                  {subCompanyOptions.map(sc => <option key={sc} value={sc}>{sc}</option>)}
              </select>
            </div>
          ) : (
             <div>
              <label className="text-sm font-medium text-gray-400">Empresa/Unidade (Opcional)</label>
              <input type="text" value={editData.subCompany} onChange={e => setEditData({ ...editData, subCompany: e.target.value })} className="w-full bg-gray-900 border border-gray-600 rounded-md py-2 px-3 text-white" />
            </div>
          )}
          <div>
            <label className="text-sm font-medium text-gray-400">Setores</label>
            <div className="mt-2 grid grid-cols-2 gap-2 p-2 bg-gray-900 rounded-md max-h-32 overflow-y-auto border border-gray-600">
                {sectors.map(sector => (
                    <div key={sector.id} className="flex items-center">
                        <input
                            type="checkbox"
                            id={`edit-sector-${sector.id}`}
                            checked={editData.sectors.includes(sector.id)}
                            onChange={() => handleEditSectorChange(sector.id)}
                            className="h-4 w-4 rounded border-gray-500 bg-gray-700 text-indigo-600 focus:ring-indigo-500"
                            disabled={!!(selectedSupplierData?.subCompanies && selectedSupplierData.subCompanies.length > 0)}
                        />
                        <label htmlFor={`edit-sector-${sector.id}`} className="ml-2 text-white cursor-pointer">{sector.label}</label>
                    </div>
                ))}
            </div>
             {!!(selectedSupplierData?.subCompanies && selectedSupplierData.subCompanies.length > 0) &&
                <p className="text-xs text-gray-500 mt-1">O setor é definido pela Empresa/Unidade selecionada.</p>
             }
          </div>
        </div>
      );
    }
    
    if (attendee.status === CheckinStatus.PENDING_APPROVAL) {
        return (
            <div className="space-y-4 text-center">
                <div className="space-y-3 p-4 bg-gray-900/50 rounded-lg text-left">
                  <div>
                    <span className="text-sm font-medium text-gray-400">CPF</span>
                    <p className="text-white text-lg">{formatCPF(attendee.cpf)}</p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-400">Setores</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                        {attendeeSectors.map(sector => (
                            <span key={sector.id} className="text-xs font-medium px-2 py-1 rounded-full" style={{ backgroundColor: `${sector.color}33`, color: sector.color }}>
                                {sector.label}
                            </span>
                        ))}
                    </div>
                  </div>
                  {supplier && (
                    <div>
                      <span className="text-sm font-medium text-gray-400">Fornecedor</span>
                      <p className="text-white">{supplier.name}</p>
                    </div>
                  )}
                   {attendee.subCompany && (
                      <div>
                          <span className="text-sm font-medium text-gray-400">Empresa / Unidade</span>
                          <p className="text-white">{attendee.subCompany}</p>
                      </div>
                  )}
                </div>
                <div className="flex gap-4 mt-4">
                     <button onClick={handleRejectRegistration} disabled={isSubmitting} className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg flex items-center justify-center gap-2 disabled:opacity-50">
                        {isSubmitting && <SpinnerIcon className="w-5 h-5"/>}
                        {t('attendeeDetail.rejectRegistrationButton')}
                    </button>
                     <button onClick={handleApproveRegistration} disabled={isSubmitting} className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg flex items-center justify-center gap-2 disabled:opacity-50">
                        {isSubmitting && <SpinnerIcon className="w-5 h-5"/>}
                        {t('attendeeDetail.approveRegistrationButton')}
                    </button>
                </div>
            </div>
        );
    }

    if (attendee.status === CheckinStatus.SUBSTITUTION_REQUEST && attendee.substitutionData) {
        const { substitutionData } = attendee;
        const requestedSectors = (substitutionData.newSectorIds || []).map(id => sectors.find(s => s.id === id)).filter(Boolean) as Sector[];

        return (
            <div>
                <h3 className="text-xl font-bold text-center text-yellow-300 mb-4">{t('attendeeDetail.substitutionRequestTitle')}</h3>
                <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-4 bg-gray-900/50 rounded-lg">
                        <h4 className="font-semibold text-gray-400 mb-2">{t('attendeeDetail.originalData')}</h4>
                        <img src={attendee.photo} alt={attendee.name} className="w-32 h-32 object-contain rounded-full mx-auto mb-2 border-2 border-gray-600"/>
                        <p className="font-bold text-white">{attendee.name}</p>
                        <p className="text-sm text-gray-300">{formatCPF(attendee.cpf)}</p>
                    </div>
                     <div className="text-center p-4 bg-gray-900/50 rounded-lg">
                        <h4 className="font-semibold text-gray-400 mb-2">{t('attendeeDetail.newData')}</h4>
                        <img src={substitutionData.photo} alt={substitutionData.name} className="w-32 h-32 object-contain rounded-full mx-auto mb-2 border-2 border-blue-500"/>
                        <p className="font-bold text-white">{substitutionData.name}</p>
                        <p className="text-sm text-gray-300">{formatCPF(substitutionData.cpf)}</p>
                    </div>
                </div>
                 {requestedSectors.length > 0 && (
                    <div className="mt-4 p-3 bg-gray-900/50 rounded-lg">
                        <span className="text-sm font-medium text-gray-400">{t('attendeeDetail.requestedSector')}</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                            {requestedSectors.map(sector => (
                                <span key={sector.id} className="text-xs font-medium px-2 py-1 rounded-full" style={{ backgroundColor: `${sector.color}33`, color: sector.color }}>
                                    {sector.label}
                                </span>
                            ))}
                        </div>
                    </div>
                )}
                <div className="flex gap-4 mt-4">
                     <button onClick={handleReject} disabled={isSubmitting} className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg flex items-center justify-center gap-2 disabled:opacity-50">
                        {isSubmitting && <SpinnerIcon className="w-5 h-5"/>}
                        {t('attendeeDetail.rejectButton')}
                    </button>
                     <button onClick={handleApprove} disabled={isSubmitting} className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg flex items-center justify-center gap-2 disabled:opacity-50">
                        {isSubmitting && <SpinnerIcon className="w-5 h-5"/>}
                        {t('attendeeDetail.approveButton')}
                    </button>
                </div>
            </div>
        );
    }
    
    if (attendee.status === CheckinStatus.SECTOR_CHANGE_REQUEST && attendee.sectorChangeData) {
        const { sectorChangeData } = attendee;
        const currentSector = sectors.find(s => s.id === attendee.sectors[0]);
        const requestedSector = sectors.find(s => s.id === sectorChangeData.newSectorId);

        return (
            <div>
                <h3 className="text-xl font-bold text-center text-purple-300 mb-4">{t('attendeeDetail.sectorChangeRequestTitle')}</h3>
                <div className="space-y-3 p-4 bg-gray-900/50 rounded-lg">
                    <div>
                        <span className="text-sm font-medium text-gray-400">{t('attendeeDetail.currentSector')}</span>
                        <p className="text-white">{currentSector?.label || 'N/A'}</p>
                    </div>
                    <div>
                        <span className="text-sm font-medium text-gray-400">{t('attendeeDetail.requestedSector')}</span>
                        <p className="text-lg font-semibold text-purple-300">{requestedSector?.label || 'N/A'}</p>
                    </div>
                    {sectorChangeData.justification && (
                        <div>
                            <span className="text-sm font-medium text-gray-400">{t('attendeeDetail.justification')}</span>
                            <p className="text-white italic bg-gray-700/50 p-2 rounded-md">{sectorChangeData.justification}</p>
                        </div>
                    )}
                </div>
                <div className="flex gap-4 mt-4">
                     <button onClick={handleRejectSectorChange} disabled={isSubmitting} className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg flex items-center justify-center gap-2 disabled:opacity-50">
                        {isSubmitting && <SpinnerIcon className="w-5 h-5"/>}
                        {t('attendeeDetail.rejectSectorChangeButton')}
                    </button>
                     <button onClick={handleApproveSectorChange} disabled={isSubmitting} className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg flex items-center justify-center gap-2 disabled:opacity-50">
                        {isSubmitting && <SpinnerIcon className="w-5 h-5"/>}
                        {t('attendeeDetail.approveSectorChangeButton')}
                    </button>
                </div>
            </div>
        );
    }
    
    // Default display view
    return (
      <div className="space-y-3">
        <div>
          <span className="text-sm font-medium text-gray-400">CPF</span>
          <p className="text-white text-lg">{formatCPF(attendee.cpf)}</p>
        </div>
        <div>
          <span className="text-sm font-medium text-gray-400">Setores</span>
          <div className="flex flex-wrap gap-1 mt-1">
              {attendeeSectors.map(sector => (
                  <span key={sector.id} className="text-xs font-medium px-2 py-1 rounded-full" style={{ backgroundColor: `${sector.color}33`, color: sector.color }}>
                      {sector.label}
                  </span>
              ))}
          </div>
        </div>
        {supplier && (
          <div>
            <span className="text-sm font-medium text-gray-400">Fornecedor</span>
            <p className="text-white">{supplier.name}</p>
          </div>
        )}
         {attendee.subCompany && (
            <div>
                <span className="text-sm font-medium text-gray-400">Empresa / Unidade</span>
                <p className="text-white">{attendee.subCompany}</p>
            </div>
        )}
      </div>
    );
  };
  
  const renderCheckinSection = () => {
    if (isEditing || attendee.status === CheckinStatus.SUBSTITUTION_REQUEST || attendee.status === CheckinStatus.SECTOR_CHANGE_REQUEST || attendee.status === CheckinStatus.PENDING_APPROVAL) return null;

    if (attendee.status === CheckinStatus.PENDING) {
      return (
        <div className="space-y-4">
          {attendeeSectors.map(sector => (
            <div key={sector.id}>
              <label htmlFor={`wristband-${sector.id}`} className="block text-sm font-medium text-gray-300 mb-1">
                {t('attendeeDetail.wristbandLabel')} ({sector.label})
              </label>
              <input
                type="text"
                id={`wristband-${sector.id}`}
                value={wristbands[sector.id] || ''}
                onChange={(e) => handleWristbandChange(sector.id, e.target.value)}
                className={`w-full bg-gray-900 border rounded-md py-2 px-3 text-white focus:outline-none focus:ring-2 ${wristbandErrorSectors.has(sector.id) ? 'border-red-500 ring-red-500' : 'border-gray-600 focus:ring-indigo-500'}`}
                placeholder={t('attendeeDetail.wristbandPlaceholder')}
              />
            </div>
          ))}
          <button onClick={handleUpdateWristbands} className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center gap-2">
            <CheckCircleIcon className="w-5 h-5"/>
            {t('statusUpdateModal.confirmCheckin')}
          </button>
           {showWristbandSuccess && (
                <p className="text-sm text-center text-green-400">{t('attendeeDetail.wristbandUpdateSuccess')}</p>
           )}
        </div>
      );
    }
    
    if (attendee.status === CheckinStatus.CHECKED_IN) {
      return (
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-400">Pulseiras Entregues:</p>
           {attendeeSectors.map(sector => (
                <div key={sector.id} className="flex justify-between items-center bg-gray-900/50 p-2 rounded-md">
                    <span className="font-semibold" style={{ color: sector.color || 'inherit' }}>{sector.label}:</span>
                    <span className="font-mono text-lg text-white">{attendee.wristbands?.[sector.id] || 'N/A'}</span>
                </div>
           ))}
        </div>
      );
    }

    return null; // Don't show checkin for CANCELLED, etc.
  };
  
  const renderFooter = () => {
    if (isEditing) {
      return (
        <div className="flex gap-4">
          <button onClick={() => setIsEditing(false)} className="w-full bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg">{t('attendeeDetail.cancelButton')}</button>
          <button onClick={handleSave} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg">{t('attendeeDetail.saveButton')}</button>
        </div>
      );
    }

    // Buttons for different statuses
    const statusActions = {
      [CheckinStatus.PENDING]: [
        renderStatusButton(CheckinStatus.CANCELLED, t('statusUpdateModal.cancelRegistration')),
        renderStatusButton(CheckinStatus.MISSED, t('statusUpdateModal.markAsMissed')),
      ],
      [CheckinStatus.CHECKED_IN]: [
        renderStatusButton(CheckinStatus.PENDING, t('statusUpdateModal.cancelCheckin')),
      ],
      [CheckinStatus.CANCELLED]: [
        renderStatusButton(CheckinStatus.PENDING, t('statusUpdateModal.reactivateRegistration')),
      ],
      [CheckinStatus.MISSED]: [
        renderStatusButton(CheckinStatus.PENDING, t('statusUpdateModal.reactivateRegistration')),
      ],
       [CheckinStatus.SUBSTITUTION_REQUEST]: [],
       [CheckinStatus.SECTOR_CHANGE_REQUEST]: [],
       [CheckinStatus.PENDING_APPROVAL]: [],
       [CheckinStatus.SUBSTITUTION]: [],
    }[attendee.status];

    return (
      <div className="space-y-2">
        {statusActions.map((button, index) => <div key={index}>{button}</div>)}
        <button
          onClick={handleDelete}
          className="w-full text-red-400 hover:bg-red-500/10 font-semibold py-2 rounded-lg transition-colors mt-2"
        >
          {t('attendeeDetail.deleteButton')}
        </button>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg border border-gray-700" onClick={(e) => e.stopPropagation()}>
        <div className="p-6">
          <div className="flex justify-between items-start">
            <div className="flex items-start gap-4">
              <img src={attendee.photo} alt={attendee.name} className="w-24 h-24 object-contain rounded-lg bg-black border-2 border-gray-600" />
              <div>
                <h2 className="text-2xl font-bold text-white">{isEditing ? editData.name : attendee.name}</h2>
                <div className={`mt-1 inline-flex px-2 py-1 text-xs font-bold rounded ${statusInfo.bg} ${statusInfo.text}`}>
                  {statusInfo.label}
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              {!isEditing && attendee.status !== CheckinStatus.SUBSTITUTION_REQUEST && attendee.status !== CheckinStatus.SECTOR_CHANGE_REQUEST && attendee.status !== CheckinStatus.PENDING_APPROVAL &&(
                <button onClick={() => setIsEditing(true)} className="p-2 text-gray-400 hover:text-white transition-colors rounded-full hover:bg-gray-700">
                  <PencilIcon className="w-5 h-5" />
                </button>
              )}
              <button onClick={onClose} className="p-2 text-gray-400 hover:text-white transition-colors rounded-full hover:bg-gray-700">
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
          </div>
          <div className="mt-6">
            {renderContent()}
          </div>
        </div>

        <div className="p-6 bg-gray-900/50 rounded-b-2xl space-y-4">
          {renderCheckinSection()}
          {renderFooter()}
        </div>
      </div>
    </div>
  );
};