import React, { useState, useMemo } from 'react';
import { User, Event } from '../../types.ts';
import { useTranslation } from '../../hooks/useTranslation.tsx';
import { UsersIcon, PencilIcon, TrashIcon, CheckCircleIcon, NoSymbolIcon, LinkIcon, SpinnerIcon } from '../icons.tsx';
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
        let eventId = selectedEventForInvite;
        
        // If admin has only one event, auto-select it
        if (!eventId && currentUser.role !== 'superadmin' && currentUser.linkedEventIds.length === 1) {
            eventId = currentUser.linkedEventIds[0];
        }
        // If superadmin and only one event in system
        if (!eventId && currentUser.role === 'superadmin' && events.length === 1) {
            eventId = events[0].id;
        }

        if (!eventId) {
             setError("Selecione um evento para vincular ao convite.");
             return;
        }

        setIsGeneratingLink(true);
        try {
            const token = await api.generateUserInvite(eventId, currentUser.id);
            const url = `${window.location.origin}?mode=signup&token=${token}`;
            await navigator.clipboard.writeText(url);
            setLinkCopied(true);
            setTimeout(() => setLinkCopied(false), 3000);
            setSelectedEventForInvite(''); // Reset selection
        } catch (e: any) {
            setError("Erro ao gerar link de convite.");
            console.error(e);
        } finally {
            setIsGeneratingLink(false);
        }
    };
    
    // Events available for the current user to create invites for
    const availableEventsForInvite = useMemo(() => {
        if (currentUser.role === 'superadmin') return events;
        return events.filter(e => currentUser.linkedEventIds.includes(e.id));
    }, [events, currentUser]);


    const eventMap = useMemo(() => new Map(events.map(e => [e.id, e.name])), [events]);

    return (
        <div className="w-full max-w-5xl mx-auto">
            <div className="bg-gray-800/50 backdrop-blur-sm p-8 rounded-2xl shadow-2xl border border-gray-700">
                <h2 className="text-3xl font-bold text-white mb-2 flex items-center justify-center gap-3">
                    <UsersIcon className="w-8 h-8"/>
                    {t('users.title')}
                </h2>
                {currentUser.role === 'admin' && (
                    <p className="text-center text-gray-400 mb-6 text-sm" dangerouslySetInnerHTML={{ __html: t('users.admin.managementNotice') }} />
                )}
                
                <div className="mb-6 flex flex-col md:flex-row justify-end gap-3 items-end">
                     <div className="flex gap-2 items-center bg-gray-900/50 p-2 rounded-lg border border-gray-700">
                        {availableEventsForInvite.length > 1 && (
                             <select 
                                value={selectedEventForInvite}
                                onChange={(e) => setSelectedEventForInvite(e.target.value)}
                                className="bg-gray-800 text-white text-sm rounded p-2 border border-gray-600 focus:outline-none focus:border-indigo-500"
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
                            className="bg-indigo-600/80 hover:bg-indigo-600 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2 disabled:opacity-50 text-sm"
                            title={t('users.invite.tooltip')}
                        >
                            {isGeneratingLink ? <SpinnerIcon className="w-4 h-4" /> : (linkCopied ? <CheckCircleIcon className="w-4 h-4" /> : <LinkIcon className="w-4 h-4" />)}
                            {linkCopied ? t('users.invite.copied') : t('users.invite.generate')}
                        </button>
                     </div>

                    <button onClick={() => handleOpenModal(null)} className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg h-[42px]">
                        {t('users.createUserButton')}
                    </button>
                </div>
                {sortedUsers.length > 0 ? (
                     <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left text-gray-300">
                            <thead className="text-xs text-gray-400 uppercase bg-gray-900/50">
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
                    <p className="text-center text-gray-500">{t('users.noUsers')}</p>
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