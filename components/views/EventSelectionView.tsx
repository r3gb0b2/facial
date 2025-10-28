import React from 'react';
// FIX: Add .ts extension to types import.
import { Event } from '../../types.ts';
// FIX: Added .tsx extension to module import.
import { useTranslation } from '../../hooks/useTranslation.tsx';
// FIX: Add .tsx extension to icons import.
import { CalendarIcon, PencilIcon, TrashIcon } from '../icons.tsx';

interface EventSelectionViewProps {
  events: Event[];
  onSelectEvent: (event: Event) => void;
  onCreateEvent: () => void;
  onEditEvent: (event: Event) => void;
  onDeleteEvent: (event: Event) => void;
}

const EventSelectionView: React.FC<EventSelectionViewProps> = ({
  events,
  onSelectEvent,
  onCreateEvent,
  onEditEvent,
  onDeleteEvent,
}) => {
  const { t } = useTranslation();

  const formatDate = (timestamp: any) => {
    if (!timestamp || !timestamp.seconds) return '...';
    return new Date(timestamp.seconds * 1000).toLocaleDateString();
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center p-4">
      <header className="py-6 text-center">
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-500">
          {t('events.title')}
        </h1>
        <p className="text-gray-400 mt-2">{t('header.subtitle')}</p>
      </header>
      <main className="w-full max-w-3xl mx-auto">
        <div className="bg-gray-800/50 backdrop-blur-sm p-8 rounded-2xl shadow-2xl border border-gray-700">
          {events.length === 0 ? (
            <div className="text-center text-gray-400 py-8">
              <CalendarIcon className="w-16 h-16 mx-auto text-gray-500 mb-4" />
              <p className="text-lg mb-2">{t('events.noEvents')}</p>
              <p className="text-sm">{t('events.noEventsSubtitle')}</p>
            </div>
          ) : (
            <ul className="space-y-4">
              {events.map((event) => (
                <li key={event.id} className="bg-gray-900/70 p-4 rounded-lg flex items-center justify-between transition-all hover:bg-gray-800">
                  <div onClick={() => onSelectEvent(event)} className="flex-grow cursor-pointer">
                    <p className="font-semibold text-white text-lg">{event.name}</p>
                    <p className="text-sm text-gray-400">Criado em: {formatDate(event.createdAt)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => onEditEvent(event)} className="p-2 text-gray-400 hover:text-yellow-400 transition-colors rounded-full hover:bg-gray-700">
                      <PencilIcon className="w-5 h-5" />
                    </button>
                    <button onClick={() => onDeleteEvent(event)} className="p-2 text-gray-400 hover:text-red-400 transition-colors rounded-full hover:bg-gray-700">
                      <TrashIcon className="w-5 h-5" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-8">
            <button onClick={onCreateEvent} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-lg transition-all duration-300">
              {t('events.createButton')}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default EventSelectionView;
