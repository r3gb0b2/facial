import React, { useState, useEffect } from 'react';
import { Attendee, CheckinStatus, Sector } from '../types.ts';
import { useTranslation } from '../hooks/useTranslation.tsx';
import { XMarkIcon, PencilIcon, TrashIcon, CheckCircleIcon } from './icons.tsx';

interface AttendeeDetailModalProps {
  attendee: Attendee;
  sectors: Sector[];
  onClose: () => void;
  onUpdateStatus: (status: CheckinStatus, wristbandNumber?: string) => void;
  onUpdateDetails: (attendeeId: string, data: Partial<Pick<Attendee, 'name' | 'cpf' | 'sector' | 'wristbandNumber' | 'subCompany'>>) => Promise<void>;
  onDelete: (attendeeId: string) => Promise<void>;
  setError: (message: string) => void;
}

const AttendeeDetailModal: React.FC<AttendeeDetailModalProps> = ({
  attendee,
  sectors,
  onClose,
  onUpdateStatus,
  onUpdateDetails,
  onDelete,
  setError,
}) => {
  const { t } = useTranslation();
  const [isEditing, setIsEditing] = useState(false);
  const [wristbandNumber, setWristbandNumber] = useState(attendee.wristbandNumber || '');
  const [showWristbandSuccess, setShowWristbandSuccess] = useState(false);
  const [editData, setEditData] = useState({
    name: attendee.name,
    cpf: attendee.cpf,
    sector: attendee.sector,
    subCompany: attendee.subCompany || '',
  });

  useEffect(() => {
    setEditData({
      name: attendee.name,
      cpf: formatCPF(attendee.cpf),
      sector: attendee.sector,
      subCompany: attendee.subCompany || '',
    });
    setWristbandNumber(attendee.wristbandNumber || '');
    setIsEditing(false); // Reset editing state when attendee changes
    setShowWristbandSuccess(false);
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
    if (window.confirm(t('attendeeDetail.deleteConfirm', attendee.name))) {
      onDelete(attendee.id);
    }
  };
  
  const handleWristbandSave = async () => {
    await onUpdateDetails(attendee.id, { wristbandNumber });
    setShowWristbandSuccess(true);
    setTimeout(() => {
        setShowWristbandSuccess(false);
    }, 3000);
  };


  const renderStatusButtons = () => {
    const canBeCheckedIn = attendee.status === CheckinStatus.PENDING;
    const canBeCancelledOut = attendee.status === CheckinStatus.CHECKED_IN;
    const canBeMarkedMissed = attendee.status === CheckinStatus.PENDING;
    const canBeSubstituted = [CheckinStatus.PENDING, CheckinStatus.MISSED].includes(attendee.status);
    const canBeCancelled = [CheckinStatus.PENDING, CheckinStatus.MISSED, CheckinStatus.SUBSTITUTION].includes(attendee.status);
    const canBeReactivated = attendee.status === CheckinStatus.CANCELLED;

    return (
        <div className="grid grid-cols-1 gap-3 pt-4 border-t border-gray-700 mt-4">
            {canBeCheckedIn && (
                <div className="space-y-3">
                    <div>
                        <label htmlFor="wristband" className="block text-sm font-medium text-gray-300 mb-1">{t('attendeeDetail.wristbandLabel')}</label>
                        <input
                            type="text" id="wristband" value={wristbandNumber}
                            onChange={(e) => setWristbandNumber(e.target.value)}
                            className="w-full bg-gray-900 border border-gray-600 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            placeholder={t('attendeeDetail.wristbandPlaceholder')}
                        />
                    </div>
                    <button onClick={() => onUpdateStatus(CheckinStatus.CHECKED_IN, wristbandNumber)} className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-lg transition-colors">
                        {t('statusUpdateModal.confirmCheckin')}
                    </button>
                </div>
            )}
            {canBeCancelledOut && (
                 <div className="space-y-3">
                    <div>
                        <label htmlFor="wristbandEdit" className="block text-sm font-medium text-gray-300 mb-1">{t('attendeeDetail.wristbandLabel')}</label>
                        <div className="flex gap-2">
                            <input
                                type="text" id="wristbandEdit" value={wristbandNumber}
                                onChange={(e) => setWristbandNumber(e.target.value)}
                                className="w-full bg-gray-900 border border-gray-600 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                placeholder={t('attendeeDetail.wristbandPlaceholder')}
                            />
                            <button onClick={handleWristbandSave} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg transition-colors flex-shrink-0">
                                {t('attendeeDetail.updateWristbandButton')}
                            </button>
                        </div>
                        {showWristbandSuccess && (
                            <p className="text-sm text-green-400 text-center mt-2 animate-pulse">{t('attendeeDetail.wristbandUpdateSuccess')}</p>
                        )}
                    </div>
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
        
        <div className="p-8 space-y-4">
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
                <input type="text" value={editData.subCompany} onChange={(e) => setEditData({...editData, subCompany: e.target.value})} className="w-full bg-gray-900 border border-gray-600 rounded-md py-2 px-3 text-white"/>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">{t('register.form.sectorLabel')}</label>
                <select value={editData.sector} onChange={(e) => setEditData({...editData, sector: e.target.value})} className="w-full bg-gray-900 border border-gray-600 rounded-md py-2 px-3 text-white">
                  {sectors.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
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
