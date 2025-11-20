
import React, { useState, useMemo, useEffect } from 'react';
import { User, Event } from '../../types.ts';
import { useTranslation } from '../../hooks/useTranslation.tsx';
import { UsersIcon, PencilIcon, TrashIcon, CheckCircleIcon, NoSymbolIcon, LinkIcon, SpinnerIcon, ClipboardDocumentIcon } from '../icons.tsx';
import UserModal from '../UserModal.tsx';
import * as api from '../../firebase/service.ts';

interface UserManagementViewProps {
    currentUser: User;
    users: User[];
    events: Event[];
    onCreateUser: (userData: Omit<User, 'id'>) => Promise<void>;
    onUpdateUser: (userId: string, data: Partial<User>) => Promise<void>;
    onDeleteUser: (userId: string) => Promise<void>;
    setError: (message: string) => void;
}

const UserManagementView: React.FC<UserManagementViewProps> = ({ currentUser, users, events, onCreateUser, onUpdateUser, onDeleteUser, setError }) => {
    const { t } = useTranslation();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [userToEdit, setUserToEdit] = useState<User | null>(null);
    
    // Invite Generation State
    const [isGeneratingLink, setIsGeneratingLink] = useState(false);
    const [linkCopied, setLinkCopied] = useState(false);
    const [selectedEventForInvite, setSelectedEventForInvite] = useState('');
    const [generatedLink, setGeneratedLink] = useState<string | null>(null);

    const managedUsers = useMemo(() => {
        if (currentUser.role === 'superadmin') {
            return users;
        }
        // Admins can only see users they created
        return users.filter(user => user.createdBy === currentUser.id);
    }, [users, currentUser]);

    const sortedUsers = useMemo(() => 
        [...managedUsers].sort((a, b) => a.username.localeCompare(b.username)), 
    [managedUsers]);

    // Events available for the current user to create invites for
    const availableEventsForInvite = useMemo(() => {
        if (currentUser.role === 'superadmin') return events;
        return events.filter(e => currentUser.linkedEventIds.includes(e.id));
    }, [events, currentUser]);

    // Auto-select event if there's only one option
    useEffect(() => {
        if (availableEventsForInvite.length === 1 && !selectedEventForInvite) {
            setSelectedEventForInvite(availableEventsForInvite[0].id);
        }
    }, [availableEventsForInvite, selectedEventForInvite]);

    const handleOpenModal = (user: User | null) => {
        setUserToEdit(user);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setUserToEdit(null);
        setIsModalOpen(false);
    };

    const handleSave = async (data: Omit<User, 'id'>, userId?: string) => {
        try {
            if (userId) {
                await onUpdateUser(userId, data);
            } else {
                await onCreateUser(data);
            }
            handleCloseModal();
        } catch (error: any) {
            setError(error.message || "Failed to save user.");
        }
    };
    
    const handleDelete = async (user: User) => {
        if (window.confirm(t('users.deleteConfirm', { username: user.username }))) {
            try {
                await onDeleteUser(user.id);
            } catch (e: any) {
                setError(e.message || 'Failed to delete user.');
            }
        }
    };

    const handleToggleStatus = async (user: User) => {
        try {
            await onUpdateUser(user.id, { active: !user.active });
        } catch (e: any) {
            setError(e.message || 'Failed to update user status.');
        }
    };

    const handleGenerateInviteLink = async () => {
        if (!selectedEventForInvite) {
             setError("Selecione um evento para vincular ao convite.");
             return;
        }

        setIsGeneratingLink(true);
        setGeneratedLink(null); // Reset previous link
        try {
            const token = await api.generateUserInvite(selectedEventForInvite, currentUser.id);
            const baseUrl = window.location.href.split('?')[0];
            const url = `${baseUrl}?mode=signup&token=${token}`;
            
            setGeneratedLink(url);
            // Removed auto-copy to prevent permissions issues, users can copy manually from the display
            
        } catch (e: any) {
            console.error(e);
            setError(`Erro ao gerar link: ${e.message}`);
        } finally {
            setIsGeneratingLink(false);
        }
    };

    const handleCopyLink = () => {
        if (generatedLink) {
            navigator.clipboard.writeText(generatedLink).then(() => {
                setLinkCopied(true);
                setTimeout(() => setLinkCopied(false), 3000);
            }).catch(() => {
                 window.prompt("Copie o link abaixo:", generatedLink);
            });
        }
    };

    const eventMap = useMemo(() => new Map(events.map(e => [e.id, e.name])), [events]);

    return (
        <div className="w-full max-w-5xl mx-auto">
            <div className="bg-gray-800/50 backdrop-blur-sm p-8 rounded-2xl shadow-2xl border border-gray-700">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                    <h2 className="text-3xl font-bold text-white flex items-center gap-3">
                        <UsersIcon className="w-8 h-8"/>
                        {t('users.title')}
                    </h2>
                     <button onClick={() => handleOpenModal(null)} className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg whitespace-nowrap">
                        {t('users.createUserButton')}
                    </button>
                </div>

                {currentUser.role === 'admin' && (
                    <p className="text-gray-400 mb-6 text-sm" dangerouslySetInnerHTML={{ __html: t('users.admin.managementNotice') }} />
                )}
                
                {/* Invite Generator Section */}
                <div className="mb-8 p-4 bg-gray-900/60 rounded-xl border border-gray-700">
                     <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                        <LinkIcon className="w-5 h-5 text-indigo-400" />
                        {t('users.invite.generate')}
                     </h3>
                     <div className="flex flex-col md:flex-row gap-3 items-start md:items-center">
                        {availableEventsForInvite.length > 0 && (
                             <select 
                                value={selectedEventForInvite}
                                onChange={(e) => setSelectedEventForInvite(e.target.value)}
                                className="bg-gray-800 text-white text-sm rounded-lg p-2.5 border border-gray-600 focus:outline-none focus:border-indigo-500 w-full md:w-auto min-w-[200px]"
                            >
                                <option value="">{t('users.invite.selectEvent')}</option>
                                {availableEventsForInvite.map(e => (
                                    <option key={e.id} value={e.id}>{e.name}</option>
                                ))}
                            </select>
                        )}
                        
                        <button 
                            onClick={handleGenerateInviteLink} 
                            disabled={isGeneratingLink}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg flex items-center justify-center gap-2 disabled:opacity-50 text-sm w-full md:w-auto"
                            title={t('users.invite.tooltip')}
                        >
                            {isGeneratingLink ? <SpinnerIcon className="w-4 h-4" /> : <LinkIcon className="w-4 h-4" />}
                            {t('users.invite.generate')}
                        </button>
                     </div>

                     {generatedLink && (
                        <div className="mt-4 p-3 bg-gray-800 rounded-lg border border-green-500/30 flex flex-col sm:flex-row items-center gap-3 animate-fade-in-down">
                            <span className="text-sm text-gray-400 whitespace-nowrap">{t('users.invite.linkLabel')}</span>
                            <input 
                                type="text" 
                                readOnly 
                                value={generatedLink} 
                                className="flex-grow bg-gray-900 border border-gray-700 rounded px-3 py-1.5 text-green-400 text-sm font-mono focus:outline-none"
                            />
                            <button 
                                onClick={handleCopyLink}
                                className="text-white hover:text-indigo-300 bg-gray-700 hover:bg-gray-600 p-2 rounded-md transition-colors flex items-center gap-2"
                                title="Copiar"
                            >
                                {linkCopied ? <CheckCircleIcon className="w-5 h-5 text-green-400" /> : <ClipboardDocumentIcon className="w-5 h-5" />}
                                <span className="text-sm font-medium hidden sm:inline">{linkCopied ? t('users.invite.copied') : t('users.invite.copyButton')}</span>
                            </button>
                        </div>
                     )}
                </div>

                {sortedUsers.length > 0 ? (
                     <div className="overflow-x-auto rounded-lg border border-gray-700">
                        <table className="w-full text-sm text-left text-gray-300">
                            <thead className="text-xs text-gray-400 uppercase bg-gray-900">
                                <tr>
                                    <th scope="col" className="px-6 py-3">{t('users.table.username')}</th>
                                    <th scope="col" className="px-6 py-3">{t('users.table.role')}</th>
                                    <th scope="col" className="px-6 py-3">{t('users.table.status')}</th>
                                    <th scope="col" className="px-6 py-3">{t('users.table.events')}</th>
                                    <th scope="col" className="px-6 py-3 text-right">{t('users.table.actions')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sortedUsers.map(user => (
                                    <tr key={user.id} className="bg-gray-800/60 border-b border-gray-700 hover:bg-gray-700/60">
                                        <td className="px-6 py-4 font-medium text-white">{user.username}</td>
                                        <td className="px-6 py-4 capitalize">{user.role}</td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${user.active !== false ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}`}>
                                                {user.active !== false ? t('users.status.active') : t('users.status.inactive')}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-xs">
                                            {(user.linkedEventIds || []).length > 0 
                                                ? user.linkedEventIds.map(id => eventMap.get(id) || 'Evento Removido').join(', ') 
                                                : (user.role === 'admin' || user.role === 'checkin' ? 'Nenhum' : 'Todos os eventos')
                                            }
                                        </td>
                                        <td className="px-6 py-4 text-right flex items-center justify-end gap-2">
                                            <button 
                                                onClick={() => handleToggleStatus(user)} 
                                                className={`p-2 rounded transition-colors ${user.active !== false ? 'text-red-400 hover:bg-red-900/20' : 'text-green-400 hover:bg-green-900/20'}`}
                                                title={user.active !== false ? t('users.actions.deactivate') : t('users.actions.activate')}
                                            >
                                                {user.active !== false ? <NoSymbolIcon className="w-5 h-5"/> : <CheckCircleIcon className="w-5 h-5"/>}
                                            </button>
                                             <button onClick={() => handleOpenModal(user)} className="p-2 text-gray-400 hover:text-yellow-400">
                                                <PencilIcon className="w-5 h-5" />
                                            </button>
                                            <button onClick={() => handleDelete(user)} className="p-2 text-gray-400 hover:text-red-400">
                                                <TrashIcon className="w-5 h-5" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                     </div>
                ) : (
                    <p className="text-center text-gray-500 py-8">{t('users.noUsers')}</p>
                )}
            </div>
            {isModalOpen && (
                <UserModal
                    isOpen={isModalOpen}
                    onClose={handleCloseModal}
                    onSave={handleSave}
                    userToEdit={userToEdit}
                    allEvents={events}
                    currentUser={currentUser}
                />
            )}
        </div>
    );
};

export default UserManagementView;
