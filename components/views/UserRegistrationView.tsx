import React, { useState, useEffect } from 'react';
import { useTranslation } from '../../hooks/useTranslation.tsx';
import { UsersIcon, CheckCircleIcon, SpinnerIcon } from '../icons.tsx';
import * as api from '../../firebase/service.ts';

interface UserRegistrationViewProps {
    onBack: () => void;
    token?: string | null;
}

const UserRegistrationView: React.FC<UserRegistrationViewProps> = ({ onBack, token }) => {
    const { t } = useTranslation();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isValidatingToken, setIsValidatingToken] = useState(true);
    const [inviteData, setInviteData] = useState<{ eventId: string } | null>(null);

    useEffect(() => {
        const validateToken = async () => {
            if (!token) {
                setError("Link de convite inválido (token ausente).");
                setIsValidatingToken(false);
                return;
            }
            try {
                const data = await api.validateUserInvite(token);
                setInviteData(data);
            } catch (err: any) {
                setError(err.message || "Este link de convite é inválido ou já foi utilizado.");
            } finally {
                setIsValidatingToken(false);
            }
        };
        validateToken();
    }, [token]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!token) {
            setError("Token ausente.");
            return;
        }

        if (!username || !password || !confirmPassword) {
            setError("Todos os campos são obrigatórios.");
            return;
        }

        if (password !== confirmPassword) {
            setError(t('userRegistration.passMismatch'));
            return;
        }

        setIsSubmitting(true);
        try {
            await api.registerUserWithInvite(token, { username, password });
            setSuccess(true);
        } catch (err: any) {
            setError(err.message || "Erro ao solicitar cadastro.");
        } finally {
            setIsSubmitting(false);
        }
    };
    
    if (isValidatingToken) {
         return (
            <div className="min-h-screen flex items-center justify-center">
                 <div className="text-center text-white">
                    <SpinnerIcon className="w-12 h-12 mx-auto mb-4 text-indigo-500" />
                    <p>Validando convite...</p>
                 </div>
            </div>
        )
    }

    if (success) {
        return (
             <div className="w-full max-w-sm mx-auto bg-gray-800/50 backdrop-blur-sm p-8 rounded-2xl shadow-2xl border border-gray-700 text-center">
                 <CheckCircleIcon className="w-16 h-16 text-green-500 mx-auto mb-4" />
                 <h2 className="text-2xl font-bold text-white mb-2">{t('userRegistration.success')}</h2>
                 <p className="text-gray-400 mb-6">Entre em contato com o administrador para liberar seu acesso.</p>
                 <button
                    onClick={onBack}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-lg transition-all duration-300"
                >
                    {t('userRegistration.backToLogin')}
                </button>
             </div>
        );
    }

    return (
        <div className="w-full max-w-sm mx-auto bg-gray-800/50 backdrop-blur-sm p-8 rounded-2xl shadow-2xl border border-gray-700">
            <h2 className="text-3xl font-bold text-center text-white mb-6 flex items-center justify-center gap-3">
                <UsersIcon className="w-8 h-8" />
                {t('userRegistration.title')}
            </h2>
            
            {inviteData ? (
                 <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label htmlFor="username" className="block text-sm font-medium text-gray-300 mb-1">
                            {t('login.usernameLabel')}
                        </label>
                        <input
                            type="text"
                            id="username"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="w-full bg-gray-900 border border-gray-600 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            placeholder={t('login.usernamePlaceholder')}
                            autoFocus
                        />
                    </div>
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
                        />
                    </div>
                     <div>
                        <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-300 mb-1">
                            {t('userRegistration.confirmPasswordLabel')}
                        </label>
                        <input
                            type="password"
                            id="confirmPassword"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className="w-full bg-gray-900 border border-gray-600 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            placeholder={t('login.passwordPlaceholder')}
                        />
                    </div>
                    {error && <p className="text-red-400 text-sm">{error}</p>}
                    <button
                        type="submit"
                        className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-lg transition-all duration-300 disabled:bg-gray-500"
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? "Enviando..." : t('userRegistration.button')}
                    </button>
                </form>
            ) : (
                <div className="text-center space-y-4">
                    <p className="text-red-400">{error}</p>
                    <button
                        type="button"
                        onClick={onBack}
                        className="w-full bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg"
                    >
                        {t('userRegistration.backToLogin')}
                    </button>
                </div>
            )}
           
             {!inviteData && !error && (
                 <button
                    type="button"
                    onClick={onBack}
                    className="w-full text-gray-400 hover:text-white text-sm font-medium transition-colors mt-4"
                >
                    {t('userRegistration.backToLogin')}
                </button>
             )}
        </div>
    );
};

export default UserRegistrationView;