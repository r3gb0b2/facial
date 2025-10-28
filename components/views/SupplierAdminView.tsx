import React from 'react';
import { Attendee } from '../../types';
import { useTranslation } from '../../hooks/useTranslation';
import { EyeIcon } from '../icons';

interface SupplierAdminViewProps {
  supplierName: string;
  attendees: Attendee[];
}

const SupplierAdminView: React.FC<SupplierAdminViewProps> = ({ supplierName, attendees }) => {
  const { t } = useTranslation();

  return (
    <div className="w-full min-h-screen p-4 md:p-8">
      <div className="w-full max-w-7xl mx-auto">
        <header className="py-6 text-center">
            <EyeIcon className="w-12 h-12 mx-auto text-indigo-400 mb-2" />
            <h1 className="text-3xl md:text-4xl font-bold text-white">
            {t('supplierAdmin.title')}
            </h1>
            <p className="text-gray-400 mt-1 text-lg">{t('supplierAdmin.supplier')} <span className="font-semibold text-gray-300">{supplierName}</span></p>
        </header>

        <main className="mt-8">
            {attendees.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6">
                    {attendees.map((attendee) => (
                        <div key={attendee.id} className="bg-gray-800 rounded-lg shadow-lg overflow-hidden border border-gray-700 flex flex-col">
                            <img 
                                src={attendee.photo} 
                                alt={attendee.name} 
                                className="w-full aspect-square object-contain bg-black" 
                            />
                            <div className="p-3 text-center">
                                <h3 className="font-semibold text-base text-white truncate" title={attendee.name}>{attendee.name}</h3>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="text-center text-gray-500 py-16">
                    <p>{t('supplierAdmin.noAttendees')}</p>
                </div>
            )}
        </main>
      </div>
    </div>
  );
};

export default SupplierAdminView;
