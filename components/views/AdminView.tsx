import React, { useState, useEffect, useMemo } from 'react';
import { Attendee, Sector, Supplier, Event, SubCompany, CheckinStatus, User } from '../../types.ts';
import { useTranslation } from '../../hooks/useTranslation.tsx';
import CheckinView from './CheckinView.tsx';
import RegisterView from './RegisterView.tsx';
import SupplierManagementView from './SupplierManagementView.tsx';
import SectorManagementView from './SectorManagementView.tsx';
import WristbandReportView from './WristbandReportView.tsx';
import SpreadsheetUploadView from './SpreadsheetUploadView.tsx';
import CompanyManagementView from './CompanyManagementView.tsx';
import QRCodeScannerView from './QRCodeScannerView.tsx';
import CheckinLogView from './CheckinLogView.tsx';
import UserManagementView from './UserManagementView.tsx';
import { ArrowLeftOnRectangleIcon, SpinnerIcon } from '../icons.tsx';

type AdminTab = 'checkin' | 'checkinLog' | 'qrValidation' | 'register' | 'suppliers' | 'sectors' | 'wristbands' | 'companies' | 'users';

interface AdminViewProps {
    currentUser: User;
    isLoading: boolean;
    currentEvent: Event;
    attendees: Attendee[];
    suppliers: Supplier[];
    sectors: Sector[];
    users: User[];
    allEvents: Event[];
    onRegister: (newAttendee: Omit<Attendee, 'id' | 'status' | 'eventId' | 'createdAt'>, supplierId?: string) => Promise<void>;
    onImportAttendees: (data: any[]) => Promise<void>;
    onAddSupplier: (name: string, sectors: string[], registrationLimit: number, subCompanies: SubCompany[]) => Promise<void>;
    onUpdateSupplier: (supplierId: string, data: Partial<Supplier>) => Promise<void>;
    onDeleteSupplier: (supplier: Supplier) => Promise<void>;
    onSupplierStatusUpdate: (supplierId: string, active: boolean) => Promise<void>;
    onRegenerateAdminToken: (supplierId: string) => Promise<string>;
    onAddSector: (label: string, color: string) => Promise<void>;
    onUpdateSector: (sectorId: string, data: { label: string; color: string; }) => Promise<void>;
    onDeleteSector: (sector: Sector) => Promise<void>;
    onAttendeeDetailsUpdate: (attendeeId: string, data: Partial<Pick<Attendee, 'name' | 'cpf' | 'sectors' | 'wristbands' | 'subCompany' | 'supplierId'>>) => Promise<void>;
    onAttendeeStatusUpdate: (attendeeId: string, status: CheckinStatus, wristbands?: { [sectorId: string]: string }) => Promise<void>;
    onDeleteAttendee: (attendeeId: string) => Promise<void>;
    onApproveSubstitution: (attendeeId: string) => Promise<void>;
    onRejectSubstitution: (attendeeId: string) => Promise<void>;
    onApproveSectorChange: (attendeeId: string) => Promise<void>;
    onRejectSectorChange: (attendeeId: string) => Promise<void>;
    onApproveNewRegistration: (attendeeId: string) => Promise<void>;
    onRejectNewRegistration: (attendeeId: string) => Promise<void>;
    onUpdateSectorsForSelectedAttendees: (attendeeIds: string[], sectorIds: string[]) => Promise<void>;
    onCreateUser: (userData: Omit<User, 'id'>) => Promise<void>;
    onUpdateUser: (userId: string, data: Partial<User>) => Promise<void>;
    onDeleteUser: (userId: string) => Promise<void>;
    onBack: () => void;
    setError: (message: string) => void;
}

const AdminView: React.FC<AdminViewProps> = (props) => {
    const { t } = useTranslation();
    const sessionKey = `activeTab_${props.currentEvent.id}`;
    const [activeTab, setActiveTab] = useState<AdminTab>(() => {
        const savedTab = sessionStorage.getItem(sessionKey);
        return (savedTab as AdminTab) || 'checkin';
    });

    const allTabs: { id: AdminTab; label: string }[] = useMemo(() => {
        const tabs: { id: AdminTab; label: string }[] = [
            { id: 'checkin', label: t('admin.tabs.checkin') },
            { id: 'checkinLog', label: t('admin.tabs.checkinLog') },
            { id: 'qrValidation', label: t('admin.tabs.qrValidation') },
            { id: 'register', label: t('admin.tabs.register') },
            { id: 'suppliers', label: t('admin.tabs.suppliers') },
            { id: 'companies', label: t('admin.tabs.companies') },
            { id: 'sectors', label: t('admin.tabs.sectors') },
            { id: 'wristbands', label: t('admin.tabs.wristbands') },
        ];
        if (props.currentUser.role === 'superadmin') {
            tabs.push({ id: 'users', label: t('admin.tabs.users') });
        }
        return tabs;
    }, [t, props.currentUser.role]);


    const tabs = useMemo(() => {
        const role = props.currentUser.role;
        if (role === 'checkin') {
            const checkinTabs = new Set<AdminTab>(['checkin', 'checkinLog', 'qrValidation']);
            return allTabs.filter(tab => checkinTabs.has(tab.id));
        }
        return allTabs;
    }, [props.currentUser.role, allTabs]);

    useEffect(() => {
        // If the current active tab is not available for the user role, default to the first available tab
        if (!tabs.some(tab => tab.id === activeTab)) {
            setActiveTab(tabs[0]?.id || 'checkin');
        }
    }, [tabs, activeTab]);

    useEffect(() => {
        sessionStorage.setItem(sessionKey, activeTab);
    }, [activeTab, sessionKey]);
    
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
                    userRole={props.currentUser.role}
                    attendees={props.attendees} 
                    suppliers={props.suppliers} 
                    sectors={props.sectors}
                    currentEventId={props.currentEvent.id}
                    currentEventName={props.currentEvent.name}
                    onUpdateAttendeeDetails={props.onAttendeeDetailsUpdate}
                    onDeleteAttendee={props.onDeleteAttendee}
                    onApproveSubstitution={props.onApproveSubstitution}
                    onRejectSubstitution={props.onRejectSubstitution}
                    onApproveSectorChange={props.onApproveSectorChange}
                    onRejectSectorChange={props.onRejectSectorChange}
                    onApproveNewRegistration={props.onApproveNewRegistration}
                    onRejectNewRegistration={props.onRejectNewRegistration}
                    setError={props.setError}
                />;
            case 'checkinLog':
                return <CheckinLogView attendees={props.attendees} />;
            case 'qrValidation':
                return <QRCodeScannerView
                    currentEvent={props.currentEvent}
                    attendees={props.attendees}
                    onUpdateStatus={props.onAttendeeStatusUpdate}
                    setError={props.setError}
                />;
            case 'register':
                return (
                    <div className="space-y-8">
                        <RegisterView 
                            onRegister={props.onRegister} 
                            setError={props.setError} 
                            sectors={props.sectors} 
                            suppliers={props.suppliers} 
                            eventName={props.currentEvent.name} 
                        />
                        <SpreadsheetUploadView 
                            onImport={props.onImportAttendees} 
                            setError={props.setError} 
                        />
                    </div>
                );
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
                    onUpdateSectorsForSelectedAttendees={props.onUpdateSectorsForSelectedAttendees}
                    setError={props.setError} 
                />;
            case 'companies':
                return <CompanyManagementView 
                    attendees={props.attendees} 
                    sectors={props.sectors} 
                    onUpdateSectorsForSelectedAttendees={props.onUpdateSectorsForSelectedAttendees}
                    setError={props.setError}
                />;
            case 'sectors':
                return <SectorManagementView sectors={props.sectors} onAddSector={props.onAddSector} onUpdateSector={props.onUpdateSector} onDeleteSector={props.onDeleteSector} setError={props.setError} />;
            case 'wristbands':
                return <WristbandReportView attendees={props.attendees} sectors={props.sectors} />;
             case 'users':
                if (props.currentUser.role === 'superadmin') {
                    return <UserManagementView 
                        users={props.users}
                        events={props.allEvents}
                        onCreateUser={props.onCreateUser}
                        onUpdateUser={props.onUpdateUser}
                        onDeleteUser={props.onDeleteUser}
                        setError={props.setError}
                    />;
                }
                return null;
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
                <ul className="flex flex-wrap items-center justify-center gap-2 md:gap-4 p-2 bg-gray-900/50 rounded-lg">
                    {tabs.map(tab => (
                        <li key={tab.id} className="flex-1 min-w-[100px]">
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