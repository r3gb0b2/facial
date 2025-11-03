import React, { useState, useEffect } from 'react';
import { User, UserRole, Event } from '../types.ts';
import { useTranslation } from '../hooks/useTranslation.tsx';
import { XMarkIcon } from './icons.tsx';

interface UserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Omit<User, 'id'>, userId?: string) => void;
  userToEdit?: User | null;
  allEvents: Event[];
  currentUser: User;
}

const UserModal: React.FC<UserModalProps> = ({ isOpen, onClose, onSave, userToEdit, allEvents, currentUser }) => {
  const { t } = useTranslation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('checkin');
  const [linkedEventIds, setLinkedEventIds] = useState<string[]>([]);
  const [error, setError] = useState('');
  
  const isEditing = !!userToEdit;
  const isAdminCreator = currentUser.role === 'admin';

  const availableEvents = isAdminCreator
    ? allEvents.filter(event => currentUser.linkedEventIds.includes(event.id))
    : allEvents;

  useEffect(() => {
    if (userToEdit) {
      setUsername(userToEdit.username);
      setPassword(''); // Password field is for changing, not displaying
      setRole(userToEdit.role);
      setLinkedEventIds(userToEdit.linkedEventIds || []);
    } else {
      setUsername('');
      setPassword('');
      // Admin can only create check-in users
      setRole(isAdminCreator ? 'checkin' : 'admin');
      setLinkedEventIds([]);
    }
    setError('');
  }, [userToEdit, isOpen, isAdminCreator]);

  if (!isOpen) return null;

  const handleEventLinkChange = (eventId: string) => {
    setLinkedEventIds(prev =>
      prev.includes(eventId)
        ? prev.filter(id => id !== eventId)
        : [...prev, eventId]
    );
  };

  const handleSave = () => {
    if (!username.trim()) {
      setError(t('users.modal.error.usernameRequired'));
      return;
    }
    if (!isEditing && !password.trim()) {
      setError(t('users.modal.error.passwordRequired'));
      return;
    }
    
    const data: Omit<User, 'id' | 'password'> & { password?: string, createdBy?: string } = {
        username,
        role,
        linkedEventIds: showEventLinker ? linkedEventIds : [],
    };

    if (password.trim()) {
        data.password = password.trim();
    }
    
    if (isAdminCreator && !isEditing) {
        data.createdBy = currentUser.id;
    }

    onSave(data, userToEdit?.id);
  };
  
  const showEventLinker = role === 'admin' || role === 'checkin';

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg border border-gray-700 flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b border-gray-700 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-white">
            {isEditing ? t('users.modal.editTitle') : t('users.modal.createTitle')}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>
        <div className="p-8 space-y-4 max-h-[70vh] overflow-y-auto">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">{t('users.modal.usernameLabel')}</label>
            <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} className="w-full bg-gray-900 border border-gray-600 rounded-md py-2 px-3 text-white" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">{t('users.modal.passwordLabel')}</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-gray-900 border border-gray-600 rounded-md py-2 px-3 text-white" placeholder={isEditing ? t('users.modal.passwordPlaceholderEdit') : ''} />
          </div>
           <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">{t('users.modal.roleLabel')}</label>
            <select value={role} onChange={(e) => setRole(e.target.value as UserRole)} className="w-full bg-gray-900 border border-gray-600 rounded-md py-2 px-3 text-white" disabled={isAdminCreator}>
                {!isAdminCreator && <option value="admin">Admin</option>}
                <option value="checkin">Check-in</option>
            </select>
            {isAdminCreator && !isEditing &&
                <p className="text-xs text-gray-400 mt-1" dangerouslySetInnerHTML={{ __html: t('users.admin.creationNotice') }} />
            }
          </div>
          {showEventLinker && (
             <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">{t('users.modal.eventsLabel')}</label>
                 <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 p-2 bg-gray-900 rounded-md max-h-48 overflow-y-auto border border-gray-600">
                    {availableEvents.map(event => (
                        <div key={event.id} className="flex items-center p-1 rounded-md hover:bg-gray-700/50">
                            <input type="checkbox" id={`event-link-${event.id}`} checked={linkedEventIds.includes(event.id)} onChange={() => handleEventLinkChange(event.id)} className="h-4 w-4 rounded border-gray-500 bg-gray-700 text-indigo-600 focus:ring-indigo-500" />
                            <label htmlFor={`event-link-${event.id}`} className="ml-2 text-white cursor-pointer">{event.name}</label>
                        </div>
                    ))}
                 </div>
                 <p className="text-xs text-gray-500 mt-1">{t('users.modal.eventsDescription')}</p>
             </div>
          )}
          {error && <p className="text-red-400 text-sm mt-1">{error}</p>}
        </div>
        <div className="p-6 bg-gray-900/50 rounded-b-2xl">
          <button onClick={handleSave} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-lg">
            {isEditing ? t('events.modal.saveButton') : t('users.createUserButton')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default UserModal;