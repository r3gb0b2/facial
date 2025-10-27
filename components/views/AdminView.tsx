// FIX: Implemented the AdminView component to resolve the module not found error.
import React, { useState } from 'react';
import { Attendee, Event, Sector, Supplier, SupplierCategory } from '../../types';
import CheckinView from './CheckinView';
import RegisterView from './RegisterView';
import SupplierManagementView from './SupplierManagementView';
import SectorManagementView from './SectorManagementView';
import SupplierCategoryManagementView from './SupplierCategoryManagementView';
import WristbandReportView from './WristbandReportView';
import { ArrowLeftOnRectangleIcon } from '../icons';

type AdminViewTab = 'checkin' | 'register' | 'suppliers' | 'categories' | 'sectors' | 'report';

interface AdminViewProps {
    currentEvent: Event;
    attendees: Attendee[];
    suppliers: Supplier[];
    supplierCategories: SupplierCategory[];
    sectors: Sector[];
    onRegister: (newAttendee: Omit<Attendee, 'id' | 'status' | 'eventId' | 'createdAt'>) => Promise<void>;
    onImportAttendees: (data: any[]) => Promise<any>;
    onAddSupplier: (name: string, categoryId: string, sectors: string[], registrationLimit: number) => Promise<void>;
    onUpdateSupplier: (supplierId: string, data: Partial<Supplier>) => Promise<void>;
    onDeleteSupplier: (supplier: Supplier) => Promise<void>;
    onSupplierStatusUpdate: (supplierId: string, active: boolean) => Promise<void>;
    onAddSupplierCategory: (name: string) => Promise<string>;
    onUpdateSupplierCategory: (categoryId: string, name: string) => Promise<void>;
    onDeleteSupplierCategory: (categoryId: string) => Promise<void>;
    onAddSector: (label: string, color: string) => Promise<void>;
    onUpdateSector: (sectorId: string, data: { label: string; color: string; }) => Promise<void>;
    onDeleteSector: (sector: Sector) => Promise<void>;
    onAttendeeDetailsUpdate: (attendeeId: string, data: Partial<Pick<Attendee, 'name' | 'cpf' | 'sector' | 'wristbandNumber'>>) => Promise<void>;
    onDeleteAttendee: (attendeeId: string) => Promise<void>;
    onBack: () => void;
    setError: (message: string) => void;
}

const AdminView: React.FC<AdminViewProps> = (props) => {
    const [activeTab, setActiveTab] = useState<AdminViewTab>('checkin');

    const tabs: { id: AdminViewTab; label: string }[] = [
        { id: 'checkin', label: 'Check-in' },
        { id: 'register', label: 'Registrar' },
        { id: 'suppliers', label: 'Fornecedores' },
        { id: 'categories', label: 'Categorias' },
        { id: 'sectors', label: 'Setores' },
        { id: 'report', label: 'Relatório Pulseiras' },
    ];
    
    const renderContent = () => {
        switch (activeTab) {
            case 'checkin':
                return <CheckinView 
                    attendees={props.attendees} 
                    suppliers={props.suppliers} 
                    supplierCategories={props.supplierCategories} 
                    sectors={props.sectors}
                    currentEventId={props.currentEvent.id}
                    onUpdateAttendeeDetails={props.onAttendeeDetailsUpdate}
                    onDeleteAttendee={props.onDeleteAttendee}
                    setError={props.setError}
                />;
            case 'register':
                return <RegisterView 
                    onRegister={props.onRegister}
                    onImportAttendees={props.onImportAttendees}
                    setError={props.setError}
                    sectors={props.sectors}
                />;
            case 'suppliers':
                return <SupplierManagementView
                    currentEventId={props.currentEvent.id}
                    suppliers={props.suppliers}
                    attendees={props.attendees}
                    sectors={props.sectors}
                    categories={props.supplierCategories}
                    onAddSupplier={props.onAddSupplier}
                    onUpdateSupplier={props.onUpdateSupplier}
                    onDeleteSupplier={props.onDeleteSupplier}
                    onSupplierStatusUpdate={props.onSupplierStatusUpdate}
                    setError={props.setError}
                />;
            case 'categories':
                return <SupplierCategoryManagementView
                    categories={props.supplierCategories}
                    suppliers={props.suppliers}
                    onAddCategory={props.onAddSupplierCategory}
                    onUpdateCategory={props.onUpdateSupplierCategory}
                    onDeleteCategory={props.onDeleteSupplierCategory}
                    setError={props.setError}
                />
            case 'sectors':
                return <SectorManagementView
                    sectors={props.sectors}
                    onAddSector={props.onAddSector}
                    onUpdateSector={props.onUpdateSector}
                    onDeleteSector={props.onDeleteSector}
                    setError={props.setError}
                />;
            case 'report':
                return <WristbandReportView attendees={props.attendees} sectors={props.sectors} />;
            default:
                return null;
        }
    };
    
    return (
        <div className="w-full min-h-screen p-4 sm:p-6 lg:p-8">
            <header className="mb-6 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white">{props.currentEvent.name}</h1>
                    <p className="text-indigo-400">Painel Administrativo</p>
                </div>
                <button
                    onClick={props.onBack}
                    className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg transition-colors flex items-center justify-center sm:justify-start gap-2"
                >
                    <ArrowLeftOnRectangleIcon className="w-5 h-5" />
                    Voltar para Eventos
                </button>
            </header>

            <nav className="mb-6">
                <div className="border-b border-gray-700">
                    <div className="flex space-x-2 sm:space-x-4 -mb-px overflow-x-auto">
                        {tabs.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`whitespace-nowrap py-3 px-2 sm:px-4 border-b-2 font-medium text-sm transition-colors
                                    ${activeTab === tab.id
                                        ? 'border-indigo-500 text-indigo-400'
                                        : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-500'
                                    }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>
            </nav>

            <main>
                {renderContent()}
            </main>
        </div>
    );
};

export default AdminView;
