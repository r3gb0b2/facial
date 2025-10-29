import React, { useState, useEffect, useMemo } from 'react';
import { Attendee, CheckinStatus, Sector, Supplier } from '../types.ts';
import { useTranslation } from '../hooks/useTranslation.tsx';
import { XMarkIcon, PencilIcon, TrashIcon, CheckCircleIcon } from './icons.tsx';

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
  setError: (message: string) => void;
  supplier?: Supplier;
}

// FIX: Changed to a named export to resolve module import issues.
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
      setError(t('attendeeDetail.formError') as string);
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

  const handleDelete = () => {
    // FIX: Cast result of t() to string to satisfy window.confirm which expects a string.
    if (window.confirm(t('attendeeDetail.deleteConfirm', attendee.name) as string)) {
      onDelete(attendee.id);
    }
  };
  
  // --- Wristband Validation and Saving ---

  const validateWristbands = (currentWristbands: { [key: string]: string }): boolean => {
    const numbers = Object.values(currentWristbands).filter(Boolean); // Get all non-empty wristband numbers
    const duplicates = new Set<string>();
    const errorSectors = new Set<string>();

    // Check for duplicates within this single attendee's wristbands
    const seen = new Set();
    for (const num of numbers) {
        if (seen.has(num)) duplicates.add(num);
        seen.add(num);
    }

    // Check for duplicates across all other attendees
    for (const otherAttendee of allAttendees) {
        if (otherAttendee.id === attendee.id) continue; // Skip self
        if (otherAttendee.wristbands) {
            for (const [sectorId, number] of Object.entries(otherAttendee.wristbands)) {
                if (number && numbers.includes(number)) {
                    duplicates.add(number);
                }
            }
        }
    }

    // Find which sectors have duplicate numbers
    for (const [sectorId, number] of Object.entries(currentWristbands)) {
        if (number && duplicates.has(number)) {
            errorSectors.add(sectorId);
        }
    }
    
    setWristbandErrorSectors(errorSectors);

    if (duplicates.size > 0) {
        // FIX: Cast result of t() to string to satisfy setError which expects a string.
        setError(t('attendeeDetail.wristbandsDuplicateError', Array.from(duplicates).join(', ')) as string);
        return false;
    }
    
    setError(''); // Clear previous errors
    return true;
  };


  const handleWristbandChange = (sectorId: string, value: string) => {
    setWristbands(prev => ({ ...prev, [sectorId]: value }));
  };
  
  const handleUpdateWristbands = async () => {
    if (!validateWristbands(wristbands)) return;

    try {
        await onUpdateDetails(attendee.id, { wristbands });
        setShowWristbandSuccess(true);
        setTimeout(() => setShowWristbandSuccess(false), 2000);
    } catch (e: any) {
        setError(e.message || "Failed to update wristbands.");
    }
  };

  // --- Edit Form Handlers ---

  const handleEditDataChange = (field: keyof typeof editData, value: any) => {
    setEditData(prev => {
        const newState = { ...prev, [field]: value };
        // Reset sub-company and sectors if the supplier is changed, to ensure data consistency
        if (field === 'supplierId') {
            newState.subCompany = '';
            const newSupplier = suppliers.find(s => s.id === value);
            // If new supplier doesn't have sub-companies, clear sectors for re-selection
            if (!newSupplier || !newSupplier.subCompanies || newSupplier.subCompanies.length === 0) {
                newState.sectors = [];
            }
        }
        return newState;
    });
  };

  const handleSectorSelection = (sectorId: string) => {
    setEditData(prev => {
      const newSectors = prev.sectors.includes(sectorId)
        ? prev.sectors.filter(id => id !== sectorId)
        : [...prev.sectors, sectorId];
      return { ...prev, sectors: newSectors };
    });
  };
  
  const handleSubCompanyChange = (subCompanyName: string) => {
    const selectedSupplier = suppliers.find(s => s.id === editData.supplierId);
    if (!selectedSupplier || !selectedSupplier.subCompanies) return;
    
    const selectedSubCompany = selectedSupplier.subCompanies.find(sc => sc.name === subCompanyName);
    if (selectedSubCompany) {
        setEditData(prev => ({
            ...prev,
            subCompany: subCompanyName,
            sectors: [selectedSubCompany.sector] // Set sector based on sub-company
        }));
    } else {
        setEditData(prev => ({...prev, subCompany: ''}));
    }
  };


  // --- Render Functions ---
  
  const renderStatusButton = (status: CheckinStatus, label: string, color: string) => (
    <button
      onClick={() => {
        if (status === CheckinStatus.CHECKED_IN) {
            if (validateWristbands(wristbands)) {
                onUpdateStatus(status, wristbands);
            }
        } else {
            onUpdateStatus(status);
        }
      }}
      className={`w-full text-white font-bold py-2 px-4 rounded transition-colors ${color}`}
    >
      {label}
    </button>
  );

  const renderStatusControls = () => {
    switch (attendee.status) {
      case CheckinStatus.PENDING:
        return renderStatusButton(CheckinStatus.CHECKED_IN, t('statusUpdateModal.confirmCheckin'), 'bg-green-600 hover:bg-green-700');
      case CheckinStatus.CHECKED_IN:
        return renderStatusButton(CheckinStatus.PENDING, t('statusUpdateModal.cancelCheckin'), 'bg-yellow-500 hover:bg-yellow-600');
      case CheckinStatus.CANCELLED:
      case CheckinStatus.MISSED:
        return renderStatusButton(CheckinStatus.PENDING, t('statusUpdateModal.reactivateRegistration'), 'bg-blue-500 hover:bg-blue-600');
      default:
        return null;
    }
  };
  
  const renderEditForm = () => {
    const selectedSupplier = suppliers.find(s => s.id === editData.supplierId);
    const supplierHasSubCompanies = !!(selectedSupplier?.subCompanies && selectedSupplier.subCompanies.length > 0);

    return (
        <>
            <div>
                <label className="block text-sm font-medium text-gray-400">Nome</label>
                <input type="text" value={editData.name} onChange={(e) => handleEditDataChange('name', e.target.value)} className="mt-1 w-full bg-gray-900 border border-gray-600 rounded-md py-2 px-3 text-white"/>
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-400">CPF</label>
                <input type="text" value={editData.cpf} onChange={(e) => handleEditDataChange('cpf', formatCPF(e.target.value))} className="mt-1 w-full bg-gray-900 border border-gray-600 rounded-md py-2 px-3 text-white"/>
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-400">Fornecedor (Opcional)</label>
                <select value={editData.supplierId} onChange={(e) => handleEditDataChange('supplierId', e.target.value)} className="mt-1 w-full bg-gray-900 border border-gray-600 rounded-md py-2 px-3 text-white">
                    <option value="">Nenhum / Manual</option>
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
            </div>

            {supplierHasSubCompanies && selectedSupplier ? (
                <div>
                    <label className="block text-sm font-medium text-gray-400">Empresa/Unidade</label>
                    <select value={editData.subCompany} onChange={(e) => handleSubCompanyChange(e.target.value)} className="mt-1 w-full bg-gray-900 border border-gray-600 rounded-md py-2 px-3 text-white">
                        <option value="">Selecione...</option>
                        {selectedSupplier.subCompanies?.map(sc => <option key={sc.name} value={sc.name}>{sc.name}</option>)}
                    </select>
                </div>
            ) : (
                <div>
                    <label className="block text-sm font-medium text-gray-400">Empresa/Unidade (Opcional)</label>
                    <input type="text" value={editData.subCompany} onChange={(e) => handleEditDataChange('subCompany', e.target.value)} className="mt-1 w-full bg-gray-900 border border-gray-600 rounded-md py-2 px-3 text-white"/>
                </div>
            )}
            
            {!supplierHasSubCompanies && (
                <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">Setores</label>
                    <div className="space-y-2">
                        {sectors.map(sector => (
                            <div key={sector.id} className="flex items-center">
                                <input type="checkbox" id={`edit-sector-${sector.id}`} checked={editData.sectors.includes(sector.id)} onChange={() => handleSectorSelection(sector.id)} className="h-4 w-4 rounded border-gray-500 bg-gray-700 text-indigo-600 focus:ring-indigo-500" />
                                <label htmlFor={`edit-sector-${sector.id}`} className="ml-3 text-white">{sector.label}</label>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </>
    );
  };

  const renderSubstitutionView = () => (
    <div className="space-y-6">
        <h3 className="text-xl font-bold text-center text-indigo-400">{t('attendeeDetail.substitutionRequestTitle')}</h3>
        <div className="grid grid-cols-2 gap-4 items-start text-sm">
            {/* Original Data */}
            <div className="bg-gray-900/50 p-4 rounded-lg space-y-3">
                <h4 className="font-semibold text-center text-gray-300 border-b border-gray-700 pb-2">{t('attendeeDetail.originalData')}</h4>
                <img src={attendee.photo} alt={attendee.name} className="rounded-lg w-full aspect-square object-contain bg-black"/>
                <p><span className="font-semibold text-gray-400">Nome:</span> {attendee.name}</p>
                <p><span className="font-semibold text-gray-400">CPF:</span> {formatCPF(attendee.cpf)}</p>
            </div>
            {/* New Data */}
            <div className="bg-gray-900/50 p-4 rounded-lg space-y-3">
                <h4 className="font-semibold text-center text-gray-300 border-b border-gray-700 pb-2">{t('attendeeDetail.newData')}</h4>
                <img src={attendee.substitutionData!.photo} alt={attendee.substitutionData!.name} className="rounded-lg w-full aspect-square object-contain bg-black"/>
                <p><span className="font-semibold text-gray-400">Nome:</span> {attendee.substitutionData!.name}</p>
                <p><span className="font-semibold text-gray-400">CPF:</span> {formatCPF(attendee.substitutionData!.cpf)}</p>
            </div>
        </div>
        <div className="flex gap-4">
            <button onClick={() => onRejectSubstitution(attendee.id)} className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg">{t('attendeeDetail.rejectButton')}</button>
            <button onClick={() => onApproveSubstitution(attendee.id)} className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg">{t('attendeeDetail.approveButton')}</button>
        </div>
    </div>
  );

  if (attendee.status === CheckinStatus.SUBSTITUTION_REQUEST && attendee.substitutionData) {
     return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl border border-gray-700 p-8" onClick={(e) => e.stopPropagation()}>
                {renderSubstitutionView()}
            </div>
        </div>
     )
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg border border-gray-700 flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b border-gray-700">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold text-white">{isEditing ? "Editando Registro" : t('attendeeDetail.title')}</h2>
              <div className={`mt-2 px-2 py-1 text-xs font-bold rounded inline-block ${statusInfo.bg} ${statusInfo.text}`}>
                {statusInfo.label}
              </div>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors"><XMarkIcon className="w-6 h-6" /></button>
          </div>
        </div>

        <div className="p-8 space-y-6 overflow-y-auto max-h-[70vh]">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
             <img src={attendee.photo} alt={attendee.name} className="rounded-lg w-full aspect-square object-contain bg-black" />
             <div className="space-y-4">
                {isEditing ? renderEditForm() : (
                    <>
                        <div>
                            <p className="text-3xl font-bold">{attendee.name}</p>
                            <p className="text-gray-400">{formatCPF(attendee.cpf)}</p>
                        </div>
                        <div>
                            <p className="font-semibold text-gray-300">Setores:</p>
                            <div className="flex flex-wrap gap-2 mt-1">
                                {attendeeSectors.length > 0 ? attendeeSectors.map(s => (
                                    <span key={s.id} className="text-sm font-medium px-2 py-1 rounded-full" style={{ backgroundColor: `${s.color}33`, color: s.color }}>{s.label}</span>
                                )) : <span className="text-sm text-gray-500">Nenhum</span>}
                            </div>
                        </div>
                         {supplier && (
                            <div>
                                <p className="font-semibold text-gray-300">Fornecedor:</p>
                                <p className="text-gray-400 text-sm">{supplier.name}</p>
                            </div>
                        )}
                        {attendee.subCompany && (
                            <div>
                                <p className="font-semibold text-gray-300">Empresa/Unidade:</p>
                                <p className="text-gray-400 text-sm">{attendee.subCompany}</p>
                            </div>
                        )}
                    </>
                )}
             </div>
          </div>
          
          {attendee.status !== CheckinStatus.CANCELLED && attendeeSectors.length > 0 && (
            <div className="space-y-3 pt-4 border-t border-gray-700">
                {attendeeSectors.map(sector => {
                    const hasError = wristbandErrorSectors.has(sector.id);
                    return (
                        <div key={sector.id}>
                            <label className="block text-sm font-medium text-gray-400 flex items-center gap-2">
                                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: sector.color || '#4B5563' }}></span>
                                {t('attendeeDetail.wristbandLabel')} ({sector.label})
                            </label>
                            <input
                                type="text"
                                value={wristbands[sector.id] || ''}
                                onChange={(e) => handleWristbandChange(sector.id, e.target.value)}
                                placeholder={t('attendeeDetail.wristbandPlaceholder')}
                                className={`mt-1 w-full bg-gray-900 border rounded-md py-2 px-3 text-white focus:outline-none focus:ring-2 ${hasError ? 'border-red-500 ring-red-500' : 'border-gray-600 focus:ring-indigo-500'}`}
                                disabled={isEditing || attendee.status === CheckinStatus.CHECKED_IN}
                            />
                        </div>
                    )
                })}
                 <div className="flex items-center gap-4 pt-2">
                    <button onClick={handleUpdateWristbands} disabled={attendee.status === CheckinStatus.CHECKED_IN} className="flex-1 bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded disabled:opacity-50 disabled:cursor-not-allowed">
                        {t('attendeeDetail.updateWristbandButton')}
                    </button>
                    {showWristbandSuccess && <span className="text-green-400 text-sm flex items-center gap-1"><CheckCircleIcon className="w-5 h-5"/> {t('attendeeDetail.wristbandUpdateSuccess')}</span>}
                 </div>
            </div>
          )}

        </div>

        <div className="p-6 bg-gray-900/50 rounded-b-2xl space-y-3">
          {isEditing ? (
            <div className="flex gap-4">
              <button onClick={() => setIsEditing(false)} className="w-full bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg">{t('attendeeDetail.cancelButton')}</button>
              <button onClick={handleSave} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg">{t('attendeeDetail.saveButton')}</button>
            </div>
          ) : (
            <>
              {renderStatusControls()}
              <div className="flex gap-4">
                <button onClick={() => setIsEditing(true)} className="w-full bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg flex items-center justify-center gap-2">
                  <PencilIcon className="w-4 h-4" />
                  Editar
                </button>
                <button onClick={handleDelete} className="w-full bg-red-800 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg flex items-center justify-center gap-2">
                  <TrashIcon className="w-4 h-4" />
                  {t('attendeeDetail.deleteButton')}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};