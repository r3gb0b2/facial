import React, { useState } from 'react';
import { Attendee } from '../types';
import WebcamCapture from './WebcamCapture';
import { CheckCircleIcon, XMarkIcon } from './icons';
import { useTranslation } from '../hooks/useTranslation';

interface VerificationModalProps {
  attendee: Attendee;
  onClose: () => void;
  onConfirm: (attendeeId: string) => void;
}

const VerificationModal: React.FC<VerificationModalProps> = ({ attendee, onClose, onConfirm }) => {
  const { t } = useTranslation();
  const [verificationPhoto, setVerificationPhoto] = useState<string | null>(null);

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-gray-800 rounded-2xl shadow-2xl w-full max-w-4xl border border-gray-700" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b border-gray-700 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-white">{t('verificationModal.title')} <span className="text-indigo-400">{attendee.name}</span></h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>
        <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
          <div className="text-center">
            <h3 className="text-lg font-semibold text-gray-300 mb-2">{t('verificationModal.registeredPhoto')}</h3>
            <img src={attendee.photo} alt="Registered" className="rounded-lg w-full aspect-square object-cover border-2 border-gray-600" />
            <p className="text-gray-400 mt-2 text-sm">{attendee.email}</p>
          </div>
          <div className="text-center">
            <h3 className="text-lg font-semibold text-gray-300 mb-2">{t('verificationModal.liveVerification')}</h3>
            <WebcamCapture onCapture={setVerificationPhoto} capturedImage={verificationPhoto} />
          </div>
        </div>
        <div className="p-6 bg-gray-900/50 rounded-b-2xl">
            <button
                onClick={() => onConfirm(attendee.id)}
                disabled={!verificationPhoto}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-lg transition-all duration-300 flex items-center justify-center gap-2 disabled:bg-gray-600 disabled:cursor-not-allowed"
            >
                <CheckCircleIcon className="w-6 h-6"/>
                {t('verificationModal.confirmButton')}
            </button>
        </div>
      </div>
    </div>
  );
};

export default VerificationModal;
