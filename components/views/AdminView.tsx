import React, { useState } from 'react';
import { Attendee, Event, Sector, Supplier } from '../../types.ts';
import { useTranslation } from '../../hooks/useTranslation.tsx';
import CheckinView from './CheckinView.tsx';
import RegisterView from './RegisterView.tsx';
import SectorManagementView from './SectorManagementView.tsx';
import SupplierManagementView from './SupplierManagementView.tsx';
import WristbandReportView from './WristbandReportView.tsx';
import { ArrowLeftOnRectangleIcon, CalendarIcon } from '../icons.tsx';

interface AdminViewProps {
    currentEvent: Event;
    attendees: Attendee[];
    sectors: Sector[];
    suppliers: Supplier[];
    onRegister: (newAttendee: Omit<Attendee, 'id' | 'status' | 'eventId' | 'createdAt'>) => Promise<void>;
    onUpdateAttendeeDetails: (attendeeId: string, data: Partial<Pick<Attendee, 'name' | 'cpf' | 'sector' | 'wristbandNumber' | 'subCompany'>>) => Promise<void>;
    onDeleteAttendee: (attendeeId: string) => Promise<void>;
    onAddSector: (label: string, color: string) => Promise<void>;
    onUpdateSector: (sectorId: string, data: { label: string; color: string; }) => Promise<void>;
    onDeleteSector: (sector: Sector) => Promise<void>;
    onAddSupplier: (name: string, sectorIds: string[]) => Promise<void>;
    onUpdateSupplier: (supplierId: string, data: Partial<Supplier>) => Promise<void>;
    onDeleteSupplier: (supplier: Supplier) => Promise<void>;
    onToggleSupplierRegistration: (supplierId: string, isOpen: boolean) => Promise<void>;
    onLogout: () => void;
    setError: (message: string) => void;
}

type AdminTab = 'checkin' | 'register' | 'sectors' | 'suppliers' | 'report';

const AdminView: React.FC<AdminViewProps> = (props) => {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState<AdminTab>('checkin');

    const renderActiveTab = () => {
        switch (activeTab) {
            case 'register':
                return (
                    <RegisterView
                        onRegister={props.onRegister}
                        setError={props.setError}
                        sectors={props.sectors}
                    />
                );
            case 'sectors':
                return (
                    <SectorManagementView
                        sectors={props.sectors}
                        onAddSector={props.onAddSector}
                        onUpdateSector={props.onUpdateSector}
                        onDeleteSector={props.onDeleteSector}
                        setError={props.setError}
                    />
                );
            case 'suppliers':
                return (
                    <SupplierManagementView
                        suppliers={props.suppliers}
                        sectors={props.sectors}
                        onAddSupplier={props.onAddSupplier}
                        onUpdateSupplier={props.onUpdateSupplier}
                        onDeleteSupplier={props.onDeleteSupplier}
                        onToggleRegistration={props.onToggleSupplierRegistration}
                        setError={props.setError}
                    />
                );
            case 'report':
                return (
                    <WristbandReportView
                        attendees={props.attendees}
                        sectors={props.sectors}
                    />
                );
            case 'checkin':
            default:
                return (
                    <CheckinView
                        attendees={props.attendees}
                        suppliers={props.suppliers}
                        sectors={props.sectors}
                        currentEventId={props.currentEvent.id}
                        onUpdateAttendeeDetails={props.onUpdateAttendeeDetails}
                        onDeleteAttendee={props.onDeleteAttendee}
                        setError={props.setError}
                    />
                );
        }
    };
    
    const TabButton: React.FC<{tab: AdminTab, label: string}> = ({tab, label}) => {
        const isActive = activeTab === tab;
        return (
            <button
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${isActive ? 'bg-indigo-600 text-white' : 'text-gray-300 hover:bg-gray-700'}`}
            >
                {label}
            </button>
        )
    }

    return (
        <div className="min-h-screen p-4 md:p-8">
            <header className="w-full max-w-7xl mx-auto mb-8 flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="text-center md:text-left">
                    <p className="text-gray-400 text-sm flex items-center gap-2"><CalendarIcon className="w-4 h-4" /> Evento Ativo</p>
                    <h1 className="text-3xl font-bold text-white">{props.currentEvent.name}</h1>
                </div>
                <nav className="bg-gray-800 p-2 rounded-lg flex flex-wrap justify-center gap-2">
                    <TabButton tab="checkin" label="Check-in" />
                    <TabButton tab="register" label="Cadastro Manual" />
                    <TabButton tab="report" label="Relatório" />
                    <TabButton tab="sectors" label="Setores" />
                    <TabButton tab="suppliers" label="Fornecedores" />
                </nav>
                <div>
                     <button onClick={props.onLogout} className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors text-sm font-medium p-2 rounded-md hover:bg-gray-700">
                        <ArrowLeftOnRectangleIcon className="w-5 h-5"/>
                        Sair do Evento
                    </button>
                </div>
            </header>
            <main>
                {renderActiveTab()}
            </main>
        </div>
    );
};

export default AdminView;
