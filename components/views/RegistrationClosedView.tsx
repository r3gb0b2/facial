// FIX: Provided full content for `RegistrationClosedView.tsx`.
import React from 'react';
import { NoSymbolIcon } from '../icons';

const RegistrationClosedView: React.FC = () => {
    return (
        <div className="w-full max-w-md mx-auto bg-gray-800/50 backdrop-blur-sm p-8 rounded-2xl shadow-2xl border border-gray-700 text-center">
            <NoSymbolIcon className="w-20 h-20 mx-auto text-red-500 mb-4" />
            <h2 className="text-3xl font-bold text-white mb-2">
                Registros Encerrados
            </h2>
            <p className="text-gray-400">
                O período de registro para este evento foi encerrado. Por favor, contate a organização para mais informações.
            </p>
        </div>
    );
};

export default RegistrationClosedView;
