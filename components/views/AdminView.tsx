import React, { useState } from 'react';
import { Attendee, CheckinStatus, Supplier, Sector } from '../../types';
import RegisterView from './RegisterView';
import CheckinView from './CheckinView';
import SupplierManagementView from './SupplierManagementView';
import SectorManagementView from './SectorManagementView';
import { UsersIcon, FingerPrintIcon, ArrowLeftOnRectangleIcon, LinkIcon, TagIcon } from '../icons';

interface AdminViewProps {
  currentEventId: string;
  eventName: string;
  attendees: Attendee[];
  suppliers: Supplier[];
  sectors: Sector[];
  onRegister: (newAttendee: Omit<Attendee, 'id' | 'status' | 'eventId' | 'createdAt'>) => Promise<void>;
  onStatusUpdate: (attendee: Attendee, newStatus: CheckinStatus) => void;
  onAddSupplier: (name: string, sectors: string[], registrationLimit: number) => Promise<void>;
  onUpdateSupplier: (supplierId: string, data: Partial<Supplier>) => Promise<void>;
  onSupplierStatusUpdate: (supplierId: string, active: boolean) => Promise<void>;
  onAddSector: (label: string) => Promise<void>;
  onUpdateSector: (sectorId: string, label: string) => Promise<void>;
  onDeleteSector: (sector: Sector) => Promise<void>;
  onBack: () => void;
  setError: (message: string) => void;
}

type Tab = 'register' | 'checkin' | 'suppliers' | 'sectors';

const AdminView: React.FC<AdminViewProps> = ({
  currentEventId,
  eventName,
  attendees,
  suppliers,
  sectors,
  onRegister,
  onStatusUpdate,
  onAddSupplier,
  onUpdateSupplier,
  onSupplierStatusUpdate,
  onAddSector,
  onUpdateSector,
  onDeleteSector,
  onBack,
  setError,
}) => {
  const [activeTab, setActiveTab] = useState<Tab>('register');

  const tabs: { id: Tab; label: string; icon: React.FC<any> }[] = [
    { id: 'register', label: 'Registrar', icon: UsersIcon },
    { id: 'checkin', label: 'Check-in', icon: FingerPrintIcon },
    { id: 'suppliers', label: 'Fornecedores', icon: LinkIcon },
    { id: 'sectors', label: 'Setores', icon: TagIcon },
  ];

  return (
    <div className="space-y-8">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-500">
            {eventName}
          </h1>
          <p className="text-gray-400">Gerenciando {attendees.length} participante(s)</p>
        </div>
        <button onClick={onBack} className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg transition-colors">
          <ArrowLeftOnRectangleIcon className="w-5 h-5"/>
          Trocar Evento
        </button>
      </header>

      <div className="border-b border-gray-700">
        <nav className="-mb-px flex space-x-6" aria-label="Tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`${
                activeTab === tab.id
                  ? 'border-indigo-500 text-indigo-400'
                  : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-500'
              } group inline-flex items-center py-4 px-1 border-b-2 font-medium text-sm transition-colors`}
            >
              <tab.icon className="-ml-0.5 mr-2 h-5 w-5" />
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>
      </div>

      <main>
        {activeTab === 'register' && (
          <RegisterView onRegister={onRegister} setError={setError} sectors={sectors} />
        )}
        {activeTab === 'checkin' && (
          <CheckinView attendees={attendees} onStatusUpdate={onStatusUpdate} sectors={sectors} />
        )}
        {activeTab === 'suppliers' && (
            <SupplierManagementView
                currentEventId={currentEventId}
                suppliers={suppliers}
                attendees={attendees}
                sectors={sectors}
                onAddSupplier={onAddSupplier}
                onUpdateSupplier={onUpdateSupplier}
                onSupplierStatusUpdate={onSupplierStatusUpdate}
                setError={setError}
            />
        )}
        {activeTab === 'sectors' && (
            <SectorManagementView
                sectors={sectors}
                onAddSector={onAddSector}
                onUpdateSector={onUpdateSector}
                onDeleteSector={onDeleteSector}
                setError={setError}
            />
        )}
      </main>
    </div>
  );
};

export default AdminView;
