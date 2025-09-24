// FIX: Provided full content for `UserSelectionView.tsx`.
import React from 'react';
import { UsersIcon, FingerPrintIcon, SparklesIcon } from '../icons';

interface UserSelectionViewProps {
  onSelectRegister: () => void;
  onSelectCheckin: () => void;
  onSelectFastCheckin: () => void;
}

const UserSelectionView: React.FC<UserSelectionViewProps> = ({ onSelectRegister, onSelectCheckin, onSelectFastCheckin }) => {
  return (
    <div className="w-full max-w-lg mx-auto bg-gray-800/50 backdrop-blur-sm p-8 rounded-2xl shadow-2xl border border-gray-700">
      <h2 className="text-3xl font-bold text-center text-white mb-8">
        Selecione uma Ação
      </h2>
      <div className="space-y-4">
        <button
          onClick={onSelectRegister}
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 px-4 rounded-lg transition-all duration-300 flex items-center justify-center gap-3 text-lg"
        >
          <UsersIcon className="w-6 h-6" />
          Registrar Novo Participante
        </button>
        <button
          onClick={onSelectCheckin}
          className="w-full bg-gray-700 hover:bg-gray-600 text-white font-bold py-4 px-4 rounded-lg transition-all duration-300 flex items-center justify-center gap-3 text-lg"
        >
          <FingerPrintIcon className="w-6 h-6" />
          Realizar Check-in (Busca)
        </button>
        <button
          onClick={onSelectFastCheckin}
          className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-4 px-4 rounded-lg transition-all duration-300 flex items-center justify-center gap-3 text-lg"
        >
          <SparklesIcon className="w-6 h-6" />
          Check-in Rápido (Facial)
        </button>
      </div>
    </div>
  );
};

export default UserSelectionView;
