import React, { useState } from 'react';
import { Event, Attendee, Supplier, Sector } from '../../types.ts';
import { useTranslation } from '../../hooks/useTranslation.tsx';
import CheckinView from './CheckinView.tsx';
import RegisterView from './RegisterView.tsx';
import SupplierManagementView from './SupplierManagementView.tsx';
import SectorManagementView from './SectorManagementView.tsx';
import WristbandReportView from './WristbandReportView.tsx';
import SpreadsheetUploadView from './SpreadsheetUploadView.tsx';
import { ArrowLeftOnRectangleIcon, UsersIcon, FingerPrintIcon, LinkIcon, TagIcon } from '../icons.tsx';
import * as api from '../../firebase/service.ts';


interface AdminViewProps {
  event: Event;
  attendees: Attendee[];
  suppliers: Supplier[];
  sectors: Sector[];
  onBack: () => void;
  onRegister: (newAttendee: Omit<Attendee, 'id' | 'status' | 'eventId' | 'createdAt'>, supplierId?: string) => Promise<void>;
  setError: (message: string) => void;
}

type Tab = 'checkin' | 'register' | 'suppliers' | 'sectors' | 'wristbands';

const AdminView: React.FC<AdminViewProps> = ({ event, attendees, suppliers, sectors, onBack, onRegister, setError }) => {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState<Tab>('checkin');

    const handleAddSupplier = async (name: string, supplierSectors: string[], registrationLimit: number, subCompanies: any[]) => {
        await api.addSupplier(event.id, name, supplierSectors, registrationLimit, subCompanies);
    };

    const handleUpdateSupplier = async (supplierId: string, data: Partial<Supplier>) => {
        await api.updateSupplier(event.id, supplierId, data);
    };

    const handleDeleteSupplier = async (supplier: Supplier) => {
        await api.deleteSupplier(event.id, supplier.id);
    };
    
    const handleSupplierStatusUpdate = async (supplierId: string, active: boolean) => {
        await api.updateSupplierStatus(event.id, supplierId, active);
    };
    
    const handleRegenerateAdminToken = async (supplierId: string) => {
        return await api.regenerateSupplierAdminToken(event.id, supplierId);
    };

    const handleAddSector = async (label: string, color: string) => {
        await api.addSector(event.id, label, color);
    };
    
    const handleUpdateSector = async (sectorId: string, data: { label: string, color: string }) => {
        await api.updateSector(event.id, sectorId, data);
    };

    const handleDeleteSector = async (sector: Sector) => {
        await api.deleteSector(event.id, sector.id);
    };

    const handleSpreadsheetImport = async (data: any[]) => {
        for (const row of data) {
            // Basic validation
            if (!row.name || !row.cpf || !row.sector || !row.photoUrl) {
                console.warn("Skipping invalid row:", row);
                continue;
            }

            const rawCpf = String(row.cpf).replace(/\D/g, '');
            if (rawCpf.length !== 11) {
                console.warn("Skipping row with invalid CPF:", row);
                continue;
            }
            
            // Find sector id from label
            const sector = sectors.find(s => s.label.toLowerCase() === String(row.sector).toLowerCase());
            if (!sector) {
                 console.warn(`Sector "${row.sector}" not found. Skipping row:`, row);
                 continue;
            }

            // Find supplier id from name
            let supplierId: string | undefined = undefined;
            if (row.fornecedor) {
                const supplier = suppliers.find(s => s.name.toLowerCase() === String(row.fornecedor).toLowerCase());
                if (supplier) {
                    supplierId = supplier.id;
                } else {
                     console.warn(`Supplier "${row.fornecedor}" not found. Registering without supplier. Row:`, row);
                }
            }

            const newAttendee: Omit<Attendee, 'id' | 'status' | 'eventId' | 'createdAt'> = {
                name: row.name,
                cpf: rawCpf,
                photo: row.photoUrl,
                sectors: [sector.id],
                subCompany: row.empresa || undefined,
            };

            await onRegister(newAttendee, supplierId);
        }
    };


    const renderContent = () => {
        switch (activeTab) {
            case 'checkin':
                return <CheckinView attendees={attendees} suppliers={suppliers} sectors={sectors} eventId={event.id} allAttendees={attendees} setError={setError} />;
            case 'register':
                return (
                    <div className="space-y-8">
                        <RegisterView onRegister={onRegister} setError={setError} sectors={sectors} suppliers={suppliers} />
                        <SpreadsheetUploadView onImport={handleSpreadsheetImport} setError={setError} />
                    </div>
                );
            case 'suppliers':
                return <SupplierManagementView 
                            currentEventId={event.id}
                            suppliers={suppliers}
                            attendees={attendees}
                            sectors={sectors}
                            onAddSupplier={handleAddSupplier}
                            onUpdateSupplier={handleUpdateSupplier}
                            onDeleteSupplier={handleDeleteSupplier}
                            onSupplierStatusUpdate={handleSupplierStatusUpdate}
                            onRegenerateAdminToken={handleRegenerateAdminToken}
                            setError={setError}
                        />;
            case 'sectors':
                return <SectorManagementView 
                            sectors={sectors}
                            onAddSector={handleAddSector}
                            onUpdateSector={handleUpdateSector}
                            onDeleteSector={handleDeleteSector}
                            setError={setError}
                        />;
            case 'wristbands':
                return <WristbandReportView attendees={attendees} sectors={sectors} />;
            default:
                return null;
        }
    };

    const tabs: { id: Tab, label: string, icon: React.FC<any> }[] = [
        { id: 'checkin', label: t('admin.tabs.checkin'), icon: FingerPrintIcon },
        { id: 'register', label: t('admin.tabs.register'), icon: UsersIcon },
        { id: 'suppliers', label: t('admin.tabs.suppliers'), icon: LinkIcon },
        { id: 'sectors', label: t('admin.tabs.sectors'), icon: TagIcon },
        { id: 'wristbands', label: t('admin.tabs.wristbands'), icon: TagIcon },
    ];

    return (
        <div className="w-full">
            <header className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white">{event.name}</h1>
                    <p className="text-gray-400">{t('header.subtitle')}</p>
                </div>
                <button
                    onClick={onBack}
                    className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
                >
                    <ArrowLeftOnRectangleIcon className="w-5 h-5" />
                    {t('admin.backButton')}
                </button>
            </header>

            <div className="mb-6 border-b border-gray-700">
                <nav className="flex flex-wrap -mb-px" aria-label="Tabs">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`
                                ${activeTab === tab.id
                                    ? 'border-indigo-500 text-indigo-400'
                                    : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-500'
                                }
                                group inline-flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors
                            `}
                        >
                           <tab.icon className="w-5 h-5"/>
                           {tab.label}
                        </button>
                    ))}
                </nav>
            </div>

            <main>
                {renderContent()}
            </main>
        </div>
    );
};

export default AdminView;
