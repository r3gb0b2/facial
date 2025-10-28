import React, { useState } from 'react';
// FIX: Added .tsx extension to module import.
import { useTranslation } from '../../hooks/useTranslation.tsx';
// FIX: Add .tsx extension
import { FingerPrintIcon } from '../icons.tsx';

interface LoginViewProps {
  onLogin: (password: string) => void;
  error: string | null;
}

const LoginView: React.FC<LoginViewProps> = ({ onLogin, error }) => {
  const { t } = useTranslation();
  const [password, setPassword] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onLogin(password);
  };

  return (
    <div className="w-full max-w-sm mx-auto bg-gray-800/50 backdrop-blur-sm p-8 rounded-2xl shadow-2xl border border-gray-700">
      <h2 className="text-3xl font-bold text-center text-white mb-6 flex items-center justify-center gap-3">
        <FingerPrintIcon className="w-8 h-8" />
        {t('login.title')}
      </h2>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-1">
            {t('login.passwordLabel')}
          </label>
          <input
            type="password"
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-gray-900 border border-gray-600 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder={t('login.passwordPlaceholder')}
            autoFocus
          />
        </div>
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <button
          type="submit"
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-lg transition-all duration-300 disabled:bg-indigo-400"
          disabled={!password}
        >
          {t('login.button')}
        </button>
      </form>
    </div>
  );
};

export default LoginView;