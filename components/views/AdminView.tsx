

import React, { useState, useMemo, useEffect } from 'react';
import { User, Attendee, Supplier, Sector, Event, UserRole } from '../../types.ts';
import { useTranslation } from '../../hooks/useTranslation.tsx';
import CheckinView from './CheckinView.tsx';
import RegisterView from './RegisterView.tsx';
import SupplierManagementView from './SupplierManagementView.tsx';
import SectorManagementView from './SectorManagementView.tsx';
import CompanyManagementView from './CompanyManagementView.tsx';
import SpreadsheetUploadView from './SpreadsheetUploadView.tsx';
import WristbandReportView from './WristbandReportView.tsx';
import CheckinLogView from './CheckinLogView.tsx';
import QRCodeScannerView from './QRCodeScannerView.tsx';
import UserManagementView from './UserManagementView.tsx';
import * as api from '../../firebase/service.ts';
import { 
    ArrowLeftOnRectangleIcon, 
    UsersIcon, 
    QrCodeIcon,
    CalendarIcon,
    FingerPrintIcon,
    BuildingOfficeIcon,
    TagIcon,
    ArrowUpTrayIcon
} from '../icons.tsx';

type AdminTab = 'checkin' | 'register' | 'suppliers' | 'sectors' | 'companies' | 'spreadsheet' | 'reports' | 'logs' | 'scanner' | 'users';

interface AdminViewProps {
    user: User;
    eventData: { attendees: Attendee[], suppliers: Supplier[], sectors: Sector[] };
    currentEventId: string;
    currentEventName: string;
    onBackToEvents: () => void;
    onLogout: () => void;
    onRegister: (newAttendee: Omit<Attendee, 'id' | 'status' | 'eventId' | 'createdAt'>, supplierId?: string) => Promise<void>;
    onUpdateAttendeeDetails: (attendeeId: string, data: Partial<Attendee>) => Promise<void>;
    onDeleteAttendee: (attendeeId: string) => Promise<void>;
    onApproveSubstitution: (attendeeId: string) => Promise<void>;
    onRejectSubstitution: (attendeeId: string) => Promise<void>;
    onApproveSectorChange: (attendeeId: string) => Promise<void>;
    onRejectSectorChange: (attendeeId: string) => Promise<void>;
    onApproveNewRegistration: (attendeeId: string) => Promise<void>;
    onRejectNewRegistration: (attendeeId: string) => Promise<void>;
    setError: (message: string) => void;
}

const TABS: { id: AdminTab, labelKey: string, roles: UserRole[] }[] = [
    { id: 'checkin', labelKey: 'admin.tabs.checkin', roles: ['superadmin', 'admin', 'checkin'] },
    { id: 'scanner', labelKey: 'admin.tabs.scanner', roles: ['superadmin', 'admin', 'checkin'] },
    { id: 'logs', labelKey: 'admin.tabs.logs', roles: ['superadmin', 'admin', 'checkin'] },
    { id: 'register', labelKey: 'admin.tabs.register', roles: ['superadmin', 'admin'] },
    { id: 'suppliers', labelKey: 'admin.tabs.suppliers', roles: ['superadmin', 'admin'] },
    { id: 'companies', labelKey: 'admin.tabs.companies', roles: ['superadmin', 'admin'] },
    { id: 'sectors', labelKey: 'admin.tabs.sectors', roles: ['superadmin', 'admin'] },
    { id: 'spreadsheet', labelKey: 'admin.tabs.spreadsheet', roles: ['superadmin', 'admin'] },
    { id: 'reports', labelKey: 'admin.tabs.reports', roles: ['superadmin', 'admin'] },
    { id: 'users', labelKey: 'admin.tabs.users', roles: ['superadmin', 'admin'] },
];


const AdminView: React.FC<AdminViewProps> = (props) => {
    const { user, eventData, currentEventId, currentEventName, onBackToEvents, onLogout, onRegister, setError } = props;
    const { t } = useTranslation();

    const availableTabs = useMemo(() => TABS.filter(tab => tab.roles.includes(user.role)), [user.role]);
    const [activeTab, setActiveTab] = useState<AdminTab>(availableTabs[0]?.id ?? 'checkin');
    
    // Additional state for user management
    const [users, setUsers] = useState<User[]>([]);
    const [eventsForUserManagement, setEventsForUserManagement] = useState<Event[]>([]);

    // Memoize the props for CheckinView to prevent re-renders on tab change
    const checkinViewProps = useMemo(() => ({
        user: user,
        attendees: eventData.attendees,
        suppliers: eventData.suppliers,
        sectors: eventData.sectors,
        currentEventId: currentEventId,
        currentEventName: currentEventName,
        onUpdateAttendeeDetails: props.onUpdateAttendeeDetails,
        onDeleteAttendee: props.onDeleteAttendee,
        onApproveSubstitution: props.onApproveSubstitution,
        onRejectSubstitution: props.onRejectSubstitution,
        onApproveSectorChange: props.onApproveSectorChange,
        onRejectSectorChange: props.onRejectSectorChange,
        onApproveNewRegistration: props.onApproveNewRegistration,
        onRejectNewRegistration: props.onRejectNewRegistration,
        setError: setError
    }), [user, eventData, currentEventId, currentEventName, props.onUpdateAttendeeDetails, props.onDeleteAttendee, props.onApproveSubstitution, props.onRejectSubstitution, props.onApproveSectorChange, props.onRejectSectorChange, props.onApproveNewRegistration, props.onRejectNewRegistration, setError]);

    const handleAddSupplier = (name: string, sectors: string[], registrationLimit: number, subCompanies: any[]) => api.addSupplier(currentEventId, name, sectors, registrationLimit, subCompanies);
    const handleUpdateSupplier = (supplierId: string, data: Partial<Supplier>) => api.updateSupplier(currentEventId, supplierId, data);
    const handleDeleteSupplier = (supplier: Supplier) => api.deleteSupplier(currentEventId, supplier.id);
    const handleSupplierStatusUpdate = (supplierId: string, active: boolean) => api.updateSupplierStatus(currentEventId, supplierId, active);
    const handleRegenerateAdminToken = (supplierId: string) => api.regenerateSupplierAdminToken(currentEventId, supplierId);

    const handleAddSector = (label: string, color: string) => api.addSector(currentEventId, label, color);
    const handleUpdateSector = (sectorId: string, data: { label: string, color: string }) => api.updateSector(currentEventId, sectorId, data);
    const handleDeleteSector = (sector: Sector) => api.deleteSector(currentEventId, sector.id);

    const handleUpdateSectorsForAttendees = (attendeeIds: string[], sectorIds: string[]) => api.updateSectorsForAttendees(currentEventId, attendeeIds, sectorIds);

    const handleImport = async (data: any[]) => {
        // ... (spreadsheet import logic)
    };

    const handleUpdateStatusForScanner = (attendeeId: string, status: any) => api.updateAttendeeStatus(currentEventId, attendeeId, status, user.username);
    
     // User management handlers
    const fetchUsersAndEvents = async () => {
        const [fetchedUsers, fetchedEvents] = await Promise.all([api.getUsers(), api.getEvents()]);
        setUsers(fetchedUsers);
        setEventsForUserManagement(fetchedEvents);
    };

    const handleCreateUser = (userData: Omit<User, 'id'>) => api.createUser(userData).then(fetchUsersAndEvents);
    const handleUpdateUser = (userId: string, data: Partial<User>) => api.updateUser(userId, data).then(fetchUsersAndEvents);
    const handleDeleteUser = (userId: string) => api.deleteUser(userId).then(fetchUsersAndEvents);
    
    useEffect(() => {
        if (activeTab === 'users' && (user.role === 'superadmin' || user.role === 'admin')) {
            fetchUsersAndEvents();
        }
    }, [activeTab, user.role]);

    return (
        <div className="w-full h-screen flex flex-col p-4 md:p-6 space-y-4">
            <header className="flex-shrink-0 bg-gray-800/50 backdrop-blur-sm p-4 rounded-xl shadow-lg border border-gray-700">
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-2xl font-bold text-white">{currentEventName}</h1>
                        <button onClick={onBackToEvents} className="text-sm text-indigo-400 hover:underline">&larr; Trocar de evento</button>
                    </div>
                     <div className="flex items-center gap-4">
                        <span className="text-gray-400 text-sm hidden md:block">Logado como: {user.username} ({user.role})</span>
                        <button onClick={onLogout} className="text-gray-400 hover:text-white transition-colors flex items-center gap-2 p-2 rounded-md hover:bg-gray-700">
                            <ArrowLeftOnRectangleIcon className="w-5 h-5"/>
                            <span className="hidden md:inline">Sair</span>
                        </button>
                    </div>
                </div>
                 <nav className="mt-4 -mb-4 -mx-4 px-4 overflow-x-auto">
                    <div className="flex border-b border-gray-700">
                        {availableTabs.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap ${activeTab === tab.id ? 'border-b-2 border-indigo-500 text-white' : 'text-gray-400 hover:text-white'}`}
                            >
                                {t(tab.labelKey)}
                            </button>
                        ))}
                    </div>
                </nav>
            </header>
            <main className="flex-grow overflow-y-auto rounded-lg">
                <div className="py-6">
                    {activeTab === 'checkin' && <CheckinView {...checkinViewProps} />}
                    {activeTab === 'register' && <RegisterView onRegister={onRegister} setError={setError} sectors={eventData.sectors} suppliers={eventData.suppliers} />}
                    {activeTab === 'suppliers' && <SupplierManagementView currentEventId={currentEventId} suppliers={eventData.suppliers} attendees={eventData.attendees} sectors={eventData.sectors} onAddSupplier={handleAddSupplier} onUpdateSupplier={handleUpdateSupplier} onDeleteSupplier={handleDeleteSupplier} onSupplierStatusUpdate={handleSupplierStatusUpdate} onRegenerateAdminToken={handleRegenerateAdminToken} onUpdateSectorsForSelectedAttendees={handleUpdateSectorsForAttendees} setError={setError} />}
                    {activeTab === 'sectors' && <SectorManagementView sectors={eventData.sectors} onAddSector={handleAddSector} onUpdateSector={handleUpdateSector} onDeleteSector={handleDeleteSector} setError={setError} />}
                    {activeTab === 'companies' && <CompanyManagementView attendees={eventData.attendees} sectors={eventData.sectors} onUpdateSectorsForSelectedAttendees={handleUpdateSectorsForAttendees} setError={setError} />}
                    {activeTab === 'spreadsheet' && <SpreadsheetUploadView onImport={handleImport} setError={setError} />}
                    {activeTab === 'reports' && <WristbandReportView attendees={eventData.attendees} sectors={eventData.sectors} />}
                    {activeTab === 'logs' && <CheckinLogView attendees={eventData.attendees} />}
                    {activeTab === 'scanner' && <QRCodeScannerView currentEvent={{ id: currentEventId, name: currentEventName, createdAt: null! }} attendees={eventData.attendees} onUpdateStatus={handleUpdateStatusForScanner} setError={setError} />}
                    {activeTab === 'users' && <UserManagementView currentUser={user} users={users} events={eventsForUserManagement} onCreateUser={handleCreateUser} onUpdateUser={handleUpdateUser} onDeleteUser={handleDeleteUser} setError={setError} />}
                </div>
            </main>
        </div>
    );
};

export default AdminView;