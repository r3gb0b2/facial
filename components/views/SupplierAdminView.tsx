import React, { useState } from 'react';
import { Attendee, CheckinStatus } from '../../types.ts';
import { useTranslation } from '../../hooks/useTranslation.tsx';
import { EyeIcon, RefreshIcon } from '../icons.tsx';
import SubstitutionRequestModal from '../SubstitutionRequestModal.tsx';

interface SupplierAdminViewProps {
  eventName: string;
  attendees: Attendee[];
  eventId: string;
}

const SupplierAdminView: React.FC<SupplierAdminViewProps> = ({ eventName, attendees, eventId }) => {
  const { t } = useTranslation();
  const [substitutingAttendee, setSubstitutingAttendee] = useState<Attendee | null>(null);
  const [submittedRequests, setSubmittedRequests] = useState<Set<string>>(new Set());

  const handleSuccess = (attendeeId: string) => {
    setSubmittedRequests(prev => new Set(prev).add(attendeeId));
  };

  return (
    <div className="w-full min-h-screen p-4 md:p-8">
      <div className="w-full max-w-7xl mx-auto">
        <header className="py-6 text-center">
            <EyeIcon className="w-12 h-12 mx-auto text-indigo-400 mb-2" />
            <h1 className="text-3xl md:text-4xl font-bold text-white">
            {t('supplierAdmin.title')}
            </h1>
            <p className="text-gray-400 mt-1 text-lg">{t('supplierAdmin.supplier')} <span className="font-semibold text-gray-300">{eventName}</span></p>
        </header>

        <main className="mt-8">
            {attendees.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6">
                    {attendees.map((attendee) => {
                      const isRequested = submittedRequests.has(attendee.id) || attendee.status === CheckinStatus.SUBSTITUTION_REQUEST;
                      const canSubstitute = attendee.status === CheckinStatus.PENDING;

                      return (
                        <div key={attendee.id} className="bg-gray-800 rounded-lg shadow-lg overflow-hidden border border-gray-700 flex flex-col">
                            <img 
                                src={attendee.photo} 
                                alt={attendee.name} 
                                className="w-full aspect-square object-contain bg-black" 
                            />
                            <div className="p-3 text-center flex-grow flex flex-col justify-between">
                                <h3 className="font-semibold text-base text-white truncate" title={attendee.name}>{attendee.name}</h3>
                                {canSubstitute && (
                                  <button
                                    onClick={() => setSubstitutingAttendee(attendee)}
                                    disabled={isRequested}
                                    className="mt-2 w-full text-sm font-semibold py-2 px-2 rounded-md transition-colors flex items-center justify-center gap-1.5 disabled:bg-gray-600 disabled:cursor-not-allowed bg-indigo-600 hover:bg-indigo-700 text-white"
                                  >
                                    <RefreshIcon className="w-4 h-4" />
                                    {isRequested ? t('supplierAdmin.substitutionRequested') : t('supplierAdmin.requestSubstitution')}
                                  </button>
                                )}
                            </div>
                        </div>
                      )
                    })}
                </div>
            ) : (
                <div className="text-center text-gray-500 py-16">
                    <p>{t('supplierAdmin.noAttendees')}</p>
                </div>
            )}
        </main>
      </div>
      {substitutingAttendee && (
        <SubstitutionRequestModal 
            attendee={substitutingAttendee}
            eventId={eventId}
            onClose={() => setSubstitutingAttendee(null)}
            onSuccess={handleSuccess}
        />
      )}
    </div>
  );
};

export default SupplierAdminView;