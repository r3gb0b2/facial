import React, { useState, useEffect, useMemo } from 'react';
import { Attendee, CheckinStatus, Sector, Supplier } from '../types.ts';
import { useTranslation } from '../hooks/useTranslation.tsx';
import { XMarkIcon, PencilIcon, TrashIcon, CheckCircleIcon } from './icons.tsx';

interface AttendeeDetailModalProps {
  attendee: Attendee;
  sectors: Sector[];
  allAttendees: Attendee[];
  onClose: () => void;
  onUpdateStatus: (status: CheckinStatus, wristbands?: { [sectorId: string]: string }) => void;
  onUpdateDetails: (attendeeId: string, data: Partial<Pick<Attendee, 'name' | 'cpf' | 'sectors' | 'wristbands' | 'subCompany'>>) => Promise<void>;
  onDelete: (attendeeId: string) => Promise<void>;
  setError: (message: string) => void;
  supplier?: Supplier;
}

const AttendeeDetailModal: React.FC<AttendeeDetailModalProps> = ({
  attendee,
  sectors,
  allAttendees,
  onClose,
  onUpdateStatus,
  onUpdateDetails,
  onDelete,
  setError,
  supplier,
}) => {
  const { t } = useTranslation();
  const [isEditing, setIsEditing] = useState(false);
  const [wristbands, setWristbands] = useState(attendee.wristbands || {});
  const [wristbandErrorSectors, setWristbandErrorSectors] = useState<Set<string>>(new Set());
  const [showWristbandSuccess, setShowWristbandSuccess] = useState(false);
  const [editData, setEditData] = useState({
    name: attendee.name,
    cpf: attendee.cpf,
    sectors: attendee.sectors,
    subCompany: attendee.subCompany || '',
  });
  
  const hasSubCompanies = !!(supplier?.subCompanies && supplier.subCompanies.length > 0);
  
  const attendeeSectors = useMemo(() => {
    return (attendee.sectors || []).map(id => sectors.find(s => s.id === id)).filter(Boolean) as Sector[];
  }, [attendee.sectors, sectors]);


  useEffect(() => {
    setEditData({
      name: attendee.name,
      cpf: formatCPF(attendee.cpf),
      sectors: attendee.sectors || [],
      subCompany: attendee.subCompany || '',
    });
    setWristbands(attendee.wristbands || {});
    setIsEditing(false); // Reset editing state when attendee changes
    setShowWristbandSuccess(false);
    setWristbandErrorSectors(new Set());
  }, [attendee]);

  const statusInfo = {
    [CheckinStatus.PENDING]: { bg: 'bg-gray-600', text: 'text-gray-200', label: t('status.pending') },
    [CheckinStatus.CHECKED_IN]: { bg: 'bg-green-600', text: 'text-white', label: t('status.checked_in') },
    [CheckinStatus.CANCELLED]: { bg: 'bg-red-600', text: 'text-white', label: t('status.cancelled') },
    [CheckinStatus.SUBSTITUTION]: { bg: 'bg-yellow-500', text: 'text-black', label: t('status.substitution') },
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
    if (!editData.name.trim() || !rawCpf.trim()) {
      setError(t('attendeeDetail.formError'));
      return;
    }
    await onUpdateDetails(attendee.id, { ...editData, cpf: rawCpf });
    setIsEditing(false);
  };

  const handleDelete = () => {
    // FIX: Explicitly cast attendee.name to string to ensure type compatibility with the translation function.
    if (window.confirm(t('attendeeDetail.deleteConfirm', attendee.name as string))) {
      onDelete(attendee.id);
    }
  };
  
  // --- Wristband Validation and Saving ---

  const validateWristbands = (currentWristbands: { [sectorId: string]: string }): string[] => {
    const newErrorSectors = new Set<string>();
    const duplicatedNumbers: string[] = [];
    const numbersUsedBySector: { [sectorId: string]: Set<string> } = {};

    // 1. Collect all used wristband numbers from OTHER attendees, organized by sector.
    for (const otherAttendee of allAttendees) {
        if (otherAttendee.id === attendee.id) continue; // Skip self
        if (otherAttendee.wristbands) {
            for (const [sectorId, number] of Object.entries(otherAttendee.wristbands)) {
                if (number) {
                    if (!numbersUsedBySector[sectorId]) {
                        numbersUsedBySector[sectorId] = new Set();
                    }
                    numbersUsedBySector[sectorId].add(number);
                }
            }
        }
    }

    // 2. Check current attendee's inputs against the collected used numbers.
    for (const [sectorId, number] of Object.entries(currentWristbands)) {
        if (number && numbersUsedBySector[sectorId]?.has(number)) {
            newErrorSectors.add(sectorId);
            if (!duplicatedNumbers.includes(number)) {
                duplicatedNumbers.push(number);
            }
        }
    }

    setWristbandErrorSectors(newErrorSectors);
    return duplicatedNumbers;
  };

  const handleWristbandSave = async () => {
    const duplicates = validateWristbands(wristbands);
    if (duplicates.length > 0) {
      setError(t('attendeeDetail.wristbandsDuplicateError', duplicates.join(', ')));
      return;
    }
    
    await onUpdateDetails(attendee.id, { wristbands });
    setShowWristbandSuccess(true);
    setTimeout(() => {
        setShowWristbandSuccess(false);
    }, 3000);
  };
  
  const handleConfirmCheckin = () => {
      const duplicates = validateWristbands(wristbands);
      if (duplicates.length > 0) {
        setError(t('attendeeDetail.wristbandsDuplicateError', duplicates.join(', ')));
        return;
      }
      onUpdateStatus(CheckinStatus.CHECKED_IN, wristbands);
  };

  const handleSubCompanyChange = (subCompanyName: string) => {
    const subCompany = supplier?.subCompanies?.find(sc => sc.name === subCompanyName);
    setEditData({
      ...editData,
      subCompany: subCompanyName,
      sectors: subCompany ? [subCompany.sector] : [] // Reset sectors based on sub-company
    });
  };
  
  const handleWristbandChange = (sectorId: string, value: string) => {
    setWristbands(prev => ({...prev, [sectorId]: value }));
    // Clear errors on change to allow user to correct mistakes
    if (wristbandErrorSectors.size > 0) {
      setWristbandErrorSectors(new Set());
    }
  };


  const renderStatusButtons = () => {
    const canBeCheckedIn = attendee.status === CheckinStatus.PENDING;
    const canBeCancelledOut = attendee.status === CheckinStatus.CHECKED_IN;
    const canBeMarkedMissed = attendee.status === CheckinStatus.PENDING;
    const canBeSubstituted = [CheckinStatus.PENDING, CheckinStatus.MISSED].includes(attendee.status);
    const canBeCancelled = [CheckinStatus.PENDING, CheckinStatus.MISSED, CheckinStatus.SUBSTITUTION].includes(attendee.status);
    const canBeReactivated = attendee.status === CheckinStatus.CANCELLED;

    const renderWristbandInputs = () => (
        <div className="space-y-3">
            {attendeeSectors.map(sector => {
                const numberValue = wristbands[sector.id] || '';
                const hasError = wristbandErrorSectors.has(sector.id);
                return (
                    <div key={sector.id}>
                        <label htmlFor={`wristband-${sector.id}`} className="block text-sm font-medium text-gray-300 mb-1 flex items-center gap-2">
                             <span className="w-3 h-3 rounded-full" style={{ backgroundColor: sector.color }}></span>
                             {t('attendeeDetail.wristbandLabel')} ({sector.label})
                        </label>
                        <input
                            type="text" id={`wristband-${sector.id}`} value={numberValue}
                            onChange={(e) => handleWristbandChange(sector.id, e.target.value)}
                            className={`w-full bg-gray-900 border rounded-md py-2 px-3 text-white focus:outline-none focus:ring-2  ${hasError ? 'border-red-500 focus:ring-red-500' : 'border-gray-600 focus:ring-indigo-500'}`}
                            placeholder={t('attendeeDetail.wristbandPlaceholder')}
                        />
                    </div>
                );
            })}
        </div>
    );

    return (
        <div className="grid grid-cols-1 gap-3 pt-4 border-t border-gray-700 mt-4">
            {canBeCheckedIn && (
                <div className="space-y-3">
                    {renderWristbandInputs()}
                    <button onClick={handleConfirmCheckin} className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-lg transition-colors">
                        {t('statusUpdateModal.confirmCheckin')}
                    </button>
                </div>
            )}
            {canBeCancelledOut && (
                 <div className="space-y-3">
                     <div className="flex items-end gap-2">
                        <div className="flex-grow">
                            {renderWristbandInputs()}
                        </div>
                        <button onClick={handleWristbandSave} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg transition-colors flex-shrink-0 self-stretch flex items-center">
                            {t('attendeeDetail.updateWristbandButton')}
                        </button>
                    </div>
                     {showWristbandSuccess && (
                        <p className="text-sm text-green-400 text-center mt-2 animate-pulse">{t('attendeeDetail.wristbandUpdateSuccess')}</p>
                    )}
                    <button onClick={() => onUpdateStatus(CheckinStatus.PENDING)} className="w-full bg-yellow-600 hover:bg-yellow-700 text-white font-bold py-3 px-4 rounded-lg transition-colors">
                        {t('statusUpdateModal.cancelCheckin')}
                    </button>
                </div>
            )}
            {canBeReactivated && (
                <button onClick={() => onUpdateStatus(CheckinStatus.PENDING)} className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-lg transition-colors">
                    {t('statusUpdateModal.reactivateRegistration')}
                </button>
            )}
            {canBeMarkedMissed && (
                <button onClick={() => onUpdateStatus(CheckinStatus.MISSED)} className="w-full bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 px-4 rounded-lg transition-colors">
                    {t('statusUpdateModal.markAsMissed')}
                </button>
            )}
            {canBeSubstituted && (
                <button onClick={() => onUpdateStatus(CheckinStatus.SUBSTITUTION)} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg transition-colors">
                    {t('statusUpdateModal.allowSubstitution')}
                </button>
            )}
            {canBeCancelled && (
                <button onClick={() => onUpdateStatus(CheckinStatus.CANCELLED)} className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-4 rounded-lg transition-colors">
                    {t('statusUpdateModal.cancelRegistration')}
                </button>
            )}
        </div>
    );
  };


  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md border border-gray-700 flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b border-gray-700 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-white">{t('attendeeDetail.title')}</h2>
            {!isEditing && <p className="text-indigo-400">{attendee.name}</p>}
          </div>
          <div className="flex items-center gap-2">
            {!isEditing && (
                 <button onClick={() => setIsEditing(true)} className="p-2 text-gray-400 hover:text-yellow-400 transition-colors rounded-full hover:bg-gray-700">
                    <PencilIcon className="w-5 h-5" />
                 </button>
            )}
            <button onClick={onClose} className="p-2 text-gray-400 hover:text-white transition-colors rounded-full hover:bg-gray-700">
              <XMarkIcon className="w-6 h-6" />
            </button>
          </div>
        </div>
        
        <div className="p-8 space-y-4 max-h-[60vh] overflow-y-auto">
          {isEditing ? (
            // EDITING VIEW
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">{t('register.form.nameLabel')}</label>
                <input type="text" value={editData.name} onChange={(e) => setEditData({...editData, name: e.target.value})} className="w-full bg-gray-900 border border-gray-600 rounded-md py-2 px-3 text-white"/>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">{t('register.form.cpfLabel')}</label>
                <input type="text" value={editData.cpf} onChange={(e) => setEditData({...editData, cpf: formatCPF(e.target.value)})} className="w-full bg-gray-900 border border-gray-600 rounded-md py-2 px-3 text-white"/>
              </div>
              <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">{t('attendeeCard.subCompanyLabel')}</label>
                  {hasSubCompanies ? (
                      <select value={editData.subCompany} onChange={(e) => handleSubCompanyChange(e.target.value)} className="w-full bg-gray-900 border border-gray-600 rounded-md py-2 px-3 text-white">
                          <option value="">Nenhuma</option>
                          {supplier.subCompanies?.map(sc => <option key={sc.name} value={sc.name}>{sc.name}</option>)}
                      </select>
                  ) : (
                      <input type="text" value={editData.subCompany} onChange={(e) => setEditData({...editData, subCompany: e.target.value})} className="w-full bg-gray-900 border border-gray-600 rounded-md py-2 px-3 text-white"/>
                  )}
              </div>
               <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">{t('register.form.sectorLabel')}</label>
                <div className="space-y-2 bg-gray-900 border border-gray-600 rounded-md p-3 max-h-40 overflow-y-auto">
                    {sectors.map(s => {
                        const isSubCompanySector = hasSubCompanies && s.id === supplier?.subCompanies?.find(sc => sc.name === editData.subCompany)?.sector;
                        return (
                            <div key={s.id} className="flex items-center">
                                <input
                                    type="checkbox"
                                    id={`sector-edit-${s.id}`}
                                    checked={editData.sectors.includes(s.id)}
                                    onChange={(e) => {
                                        const newSectors = e.target.checked
                                            ? [...editData.sectors, s.id]
                                            : editData.sectors.filter(id => id !== s.id);
                                        setEditData({ ...editData, sectors: newSectors });
                                    }}
                                    className="h-4 w-4 rounded border-gray-500 bg-gray-700 text-indigo-600 focus:ring-indigo-500 disabled:opacity-50"
                                    disabled={isSubCompanySector}
                                />
                                <label htmlFor={`sector-edit-${s.id}`} className={`ml-2 text-sm ${isSubCompanySector ? 'text-gray-500' : 'text-gray-300'}`}>{s.label}</label>
                            </div>
                        )
                    })}
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => setIsEditing(false)} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg">{t('attendeeDetail.cancelButton')}</button>
                <button onClick={handleSave} className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2">
                    <CheckCircleIcon className="w-5 h-5"/>
                    {t('attendeeDetail.saveButton')}
                </button>
              </div>
            </div>
          ) : (
            // DISPLAY VIEW
            <>
                <div className="text-center">
                    <p className="text-sm text-gray-400">{t('statusUpdateModal.currentStatus')}</p>
                    <span className={`px-3 py-1 text-sm font-bold rounded-full ${statusInfo.bg} ${statusInfo.text}`}>
                    {statusInfo.label}
                    </span>
                </div>
                {renderStatusButtons()}
            </>
          )}
        </div>

        <div className="p-6 bg-gray-900/50 rounded-b-2xl flex justify-between items-center">
          <button onClick={handleDelete} className="text-red-400 hover:text-red-300 font-semibold py-2 px-4 rounded-lg transition-colors flex items-center gap-2 hover:bg-red-500/10">
            <TrashIcon className="w-5 h-5"/>
            {t('attendeeDetail.deleteButton')}
          </button>
          <button onClick={onClose} className="bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg transition-colors">
            {t('statusUpdateModal.closeButton')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AttendeeDetailModal;