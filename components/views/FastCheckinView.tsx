import React, { useState } from 'react';
import WebcamCapture from '../WebcamCapture';
import { SparklesIcon } from '../icons';
import { useTranslation } from '../../hooks/useTranslation';

interface FastCheckinViewProps {
  onVerify: (photo: string) => Promise<void>;
}

const FastCheckinView: React.FC<FastCheckinViewProps> = ({ onVerify }) => {
  const { t } = useTranslation();
  const [livePhoto, setLivePhoto] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  const handleVerification = async () => {
    if (!livePhoto) return;
    setIsVerifying(true);
    await onVerify(livePhoto);
    setIsVerifying(false);
    setLivePhoto(null); // Reset after verification attempt
  };

  return (
    <div className="w-full max-w-xl mx-auto bg-gray-800/50 backdrop-blur-sm p-8 rounded-2xl shadow-2xl border border-gray-700 flex flex-col items-center">
      <h2 className="text-3xl font-bold text-center text-white mb-6 flex items-center justify-center gap-3">
        <SparklesIcon className="w-8 h-8"/>
        {t('fastCheckin.title')}
      </h2>
      <div className="w-full max-w-sm mb-6">
        <WebcamCapture onCapture={setLivePhoto} capturedImage={livePhoto} />
      </div>
      {isVerifying ? (
        <div className="text-center text-indigo-300">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-300 mx-auto mb-2"></div>
            {t('fastCheckin.verifying')}
        </div>
      ) : (
        <button
            onClick={handleVerification}
            disabled={!livePhoto || isVerifying}
            className="w-full max-w-sm bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-lg transition-all duration-300 flex items-center justify-center gap-2 disabled:bg-gray-500 disabled:cursor-not-allowed"
        >
            <FingerPrintIcon className="w-6 h-6"/>
            {t('fastCheckin.button')}
        </button>
      )}
    </div>
  );
};

// Add FingerPrintIcon here to avoid circular dependencies if it were in the main icons file
const FingerPrintIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.864 4.243A7.5 7.5 0 0 1 19.5 12c0 2.085-.85 3.978-2.243 5.392m-1.42-1.42A5.964 5.964 0 0 0 18 12c0-1.631-.63-3.138-1.687-4.243M14.25 10.5a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6.375 6.375 0 0 1-6.375-6.375 6.375 6.375 0 0 1 6.375-6.375 6.375 6.375 0 0 1 6.375 6.375a6.375 6.375 0 0 1-6.375 6.375Z" />
    </svg>
);


export default FastCheckinView;
