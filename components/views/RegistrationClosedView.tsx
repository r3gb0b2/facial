import React from 'react';
// FIX: Added .tsx extension to module import.
import { useTranslation } from '../../hooks/useTranslation.tsx';
import { NoSymbolIcon } from '../icons';

interface RegistrationClosedViewProps {
  message?: string;
}

const RegistrationClosedView: React.FC<RegistrationClosedViewProps> = ({ message }) => {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-lg mx-auto bg-gray-800/50 backdrop-blur-sm p-8 rounded-2xl shadow-2xl border border-gray-700 text-center">
            <NoSymbolIcon className="w-16 h-16 mx-auto text-red-400 mb-4" />
            <h2 className="text-2xl font-bold text-white">{t('supplierRegistration.closedTitle')}</h2>
            <p className="text-gray-400 mt-2">{message || t('supplierRegistration.closedMessage')}</p>
        </div>
    </div>
  );
};

export default RegistrationClosedView;