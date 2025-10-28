import React, { useState } from 'react';
import { Attendee, Sector, Supplier, Event, SubCompany } from '../../types.ts';
import { useTranslation } from '../../hooks/useTranslation.tsx';
import CheckinView from './CheckinView.tsx';
import RegisterView from './RegisterView.tsx';
import SupplierManagementView from './SupplierManagementView.tsx';
import SectorManagementView from './SectorManagementView.tsx';
import WristbandReportView from './WristbandReportView.tsx';
import { ArrowLeftOnRectangleIcon, SpinnerIcon } from '../icons.tsx';

type AdminTab = 'checkin' | 'register' | 'suppliers' | 'sectors' | 'wristbands';

interface AdminViewProps {
    isLoading: boolean;
    currentEvent: Event;
    attendees: Attendee[];
    suppliers: Supplier[];
    sectors: Sector[];
    onRegister: (newAttendee: Omit<Attendee, 'id' | 'status' | 'eventId' | 'createdAt'>) => Promise<void>;
    onImportAttendees: (data: any[]) => Promise<any>;
    onAddSupplier: (name: string, sectors: string[], registrationLimit: number, subCompanies: SubCompany[]) => Promise<void>;
    onUpdateSupplier: (supplierId: string, data: Partial<Supplier>) => Promise<void>;
    onDeleteSupplier: (supplier: Supplier) => Promise<void>;
    onSupplierStatusUpdate: (supplierId: string, active: boolean) => Promise<void>;
    onRegenerateAdminToken: (supplierId: string) => Promise<string>;
    onAddSector: (label: string, color: string) => Promise<void>;
    onUpdateSector: (sectorId: string, data: { label: string; color: string; }) => Promise<void>;
    onDeleteSector: (sector: Sector) => Promise<void>;
    onAttendeeDetailsUpdate: (attendeeId: string, data: Partial<Pick<Attendee, 'name' | 'cpf' | 'sectors' | 'wristbands' | 'subCompany'>>) => Promise<void>;
    onDeleteAttendee: (attendeeId: string) => Promise<void>;
    onBack: () => void;
    setError: (message: string) => void;
}

const AdminView: React.FC<AdminViewProps> = (props) => {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState<AdminTab>('checkin');

    const tabs: { id: AdminTab; label: string }[] = [
        { id: 'checkin', label: t('admin.tabs.checkin') },
        { id: 'register', label: t('admin.tabs.register') },
        { id: 'suppliers', label: t('admin.tabs.suppliers') },
        { id: 'sectors', label: t('admin.tabs.sectors') },
        { id: 'wristbands', label: t('admin.tabs.wristbands') },
    ];
    
    const renderContent = () => {
        if (props.isLoading) {
            return (
                <div className="flex items-center justify-center h-64">
                    <SpinnerIcon className="w-12 h-12 text-white" />
                </div>
            );
        }

        switch(activeTab) {
            case 'checkin':
                return <CheckinView 
                    attendees={props.attendees} 
                    suppliers={props.suppliers} 
                    sectors={props.sectors}
                    currentEventId={props.currentEvent.id}
                    onUpdateAttendeeDetails={props.onAttendeeDetailsUpdate}
                    onDeleteAttendee={props.onDeleteAttendee}
                    setError={props.setError}
                />;
            case 'register':
                return <RegisterView onRegister={props.onRegister} onImportAttendees={props.onImportAttendees} setError={props.setError} sectors={props.sectors} />;
            case 'suppliers':
                return <SupplierManagementView 
                    currentEventId={props.currentEvent.id} 
                    suppliers={props.suppliers} 
                    attendees={props.attendees} 
                    sectors={props.sectors} 
                    onAddSupplier={props.onAddSupplier} 
                    onUpdateSupplier={props.onUpdateSupplier} 
                    onDeleteSupplier={props.onDeleteSupplier} 
                    onSupplierStatusUpdate={props.onSupplierStatusUpdate}
                    onRegenerateAdminToken={props.onRegenerateAdminToken}
                    setError={props.setError} 
                />;
            case 'sectors':
                return <SectorManagementView sectors={props.sectors} onAddSector={props.onAddSector} onUpdateSector={props.onUpdateSector} onDeleteSector={props.onDeleteSector} setError={props.setError} />;
            case 'wristbands':
                return <WristbandReportView attendees={props.attendees} sectors={props.sectors} />;
            default:
                return null;
        }
    };

    return (
        <div className="w-full min-h-screen p-4 md:p-8">
            <header className="flex flex-col md:flex-row justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl md:text-4xl font-bold text-white">{props.currentEvent.name}</h1>
                    <p className="text-gray-400">{t('header.subtitle')}</p>
                </div>
                <button
                    onClick={props.onBack}
                    className="mt-4 md:mt-0 bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg transition-colors flex items-center gap-2"
                >
                    <ArrowLeftOnRectangleIcon className="w-5 h-5" />
                    {t('admin.backButton')}
                </button>
            </header>

            <nav className="mb-8">
                <ul className="flex items-center justify-center gap-2 md:gap-4 p-2 bg-gray-900/50 rounded-lg">
                    {tabs.map(tab => (
                        <li key={tab.id} className="flex-1">
                            <button
                                onClick={() => setActiveTab(tab.id)}
                                className={`w-full font-semibold text-sm md:text-base py-2 px-4 rounded-md transition-colors ${activeTab === tab.id ? 'bg-indigo-600 text-white' : 'text-gray-300 hover:bg-gray-700'}`}
                            >
                                {tab.label}
                            </button>
                        </li>
                    ))}
                </ul>
            </nav>

            <main>
                {renderContent()}
            </main>
        </div>
    );
};

export default AdminView;