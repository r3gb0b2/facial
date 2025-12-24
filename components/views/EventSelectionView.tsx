import React, { useState } from 'react';
import { Event, User, EventModules, EventType } from '../../types.ts';
import { useTranslation } from '../../hooks/useTranslation.tsx';
import EventModal from '../EventModal.tsx';
import { ArrowLeftOnRectangleIcon, CalendarIcon, PencilIcon, TrashIcon, FaceSmileIcon, UsersIcon } from '../icons.tsx';

interface EventSelectionViewProps {
  user: User;
  events: Event[];
  onSelectEvent: (eventId: string) => void;
  onCreateEvent: (name: string, type: EventType, modules?: EventModules, allowPhotoChange?: boolean, allowGuestUploads?: boolean) => void;
  onUpdateEvent: (id: string, name:string, type?: EventType, modules?: EventModules, allowPhotoChange?: boolean, allowGuestUploads?: boolean) => void;
  onDeleteEvent: (id: string) => void;
  onLogout: () => void;
}

const EventSelectionView: React.FC<EventSelectionViewProps> = ({ user, events, onSelectEvent, onCreateEvent, onUpdateEvent, onDeleteEvent, onLogout }) => {
  const { t } = useTranslation();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [eventToEdit, setEventToEdit] = useState<Event | null>(null);
  
  const handleOpenModal = (event: Event | null = null) => {
      setEventToEdit(event);
      setIsModalOpen(true);
  };
  
  const handleCloseModal = () => {
      setEventToEdit(null);
      setIsModalOpen(false);
  };
  
  const handleSaveEvent = (name: string, type: EventType, eventId?: string, modules?: EventModules, allowPhotoChange?: boolean, allowGuestUploads?: boolean) => {
      if (eventId) {
          onUpdateEvent(eventId, name, type, modules, allowPhotoChange, allowGuestUploads);
      } else {
          onCreateEvent(name, type, modules, allowPhotoChange, allowGuestUploads);
      }
      handleCloseModal();
  };
  
  const handleDelete = (event: Event, e: React.MouseEvent) => {
      e.stopPropagation();
      if (window.confirm(t('events.deleteConfirm', { eventName: event.name }))) {
          onDeleteEvent(event.id);
      }
  };

  return (
    <div className="w-full max-w-2xl mx-auto bg-gray-800/50 backdrop-blur-sm p-8 rounded-2xl shadow-2xl border border-gray-700">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-3xl font-bold text-white flex items-center gap-3">
            <CalendarIcon className="w-8 h-8"/>
            {t('events.title')}
          </h2>
          <p className="text-gray-400">Olá, {user.username}!</p>
        </div>
        <button onClick={onLogout} className="text-gray-400 hover:text-white transition-colors flex items-center gap-2 p-2 rounded-md hover:bg-gray-700">
            <ArrowLeftOnRectangleIcon className="w-5 h-5"/>
            Sair
        </button>
      </div>

      <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
        {events.map(event => (
          <div
            key={event.id}
            onClick={() => onSelectEvent(event.id)}
            className={`group bg-gray-900/70 p-4 rounded-lg flex items-center justify-between transition-all border border-transparent cursor-pointer hover:border-indigo-500 hover:bg-indigo-600/10`}
          >
            <div className="flex items-center gap-4">
                <div className={`p-2 rounded-lg ${event.type === 'VIP_LIST' ? 'bg-pink-600/20 text-pink-400' : 'bg-indigo-600/20 text-indigo-400'}`}>
                    {event.type === 'VIP_LIST' ? <FaceSmileIcon className="w-5 h-5" /> : <UsersIcon className="w-5 h-5" />}
                </div>
                <div>
                    <span className="font-semibold text-white text-lg block">{event.name}</span>
                    <span className="text-[10px] uppercase font-bold tracking-widest text-gray-500">
                        {event.type === 'VIP_LIST' ? 'Lista VIP' : 'Credenciamento'}
                    </span>
                </div>
            </div>
            {(user.role === 'superadmin' || user.role === 'admin') && (
              <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                 <button onClick={(e) => { e.stopPropagation(); handleOpenModal(event); }} className="p-2 text-gray-400 hover:text-yellow-400 transition-colors rounded-full hover:bg-gray-700">
                    <PencilIcon className="w-5 h-5" />
                </button>
                <button onClick={(e) => handleDelete(event, e)} className="p-2 text-gray-400 hover:text-red-400 transition-colors rounded-full hover:bg-gray-700">
                    <TrashIcon className="w-5 h-5" />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {(user.role === 'superadmin' || user.role === 'admin') && (
        <div className="mt-6 pt-6 border-t border-gray-700">
            <button
            onClick={() => handleOpenModal(null)}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-lg transition-all duration-300"
            >
            {t('events.createButton')}
            </button>
        </div>
      )}
      
      <EventModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSave={handleSaveEvent}
        eventToEdit={eventToEdit}
      />
    </div>
  );
};

export default EventSelectionView;