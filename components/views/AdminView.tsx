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
} from '../icons.tsx';

type AdminTab = 'checkin' | 'register' | 'suppliers' | 'sectors' | 'companies' | 'spreadsheet' | 'reports' | 'logs' | 'scanner' | 'users';

interface AdminViewProps {
    user: User;
    eventData: { attendees: Attendee[], suppliers: Supplier[], sectors: Sector[] };
    currentEvent: Event;
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
    const { user, eventData, currentEvent, currentEventId, currentEventName, onBackToEvents, onLogout, onRegister, setError } = props;
    const { t } = useTranslation();
    const isVip = currentEvent.type === 'VIP_LIST';

    const availableTabs = useMemo(() => {
        return TABS.filter(tab => {
            if (!tab.roles.includes(user.role)) return false;
            if (isVip && tab.id === 'sectors') return false;
            if (currentEvent && currentEvent.modules) {
                if (tab.id === 'scanner' && currentEvent.modules.scanner === false) return false;
                if (tab.id === 'logs' && currentEvent.modules.logs === false) return false;
                if (tab.id === 'register' && currentEvent.modules.register === false) return false;
                if (tab.id === 'companies' && currentEvent.modules.companies === false) return false;
                if (tab.id === 'spreadsheet' && currentEvent.modules.spreadsheet === false) return false;
                if (tab.id === 'reports' && currentEvent.modules.reports === false) return false;
            }
            return true;
        });
    }, [user.role, currentEvent, isVip]);

    const [activeTab, setActiveTab] = useState<AdminTab>('checkin');

    useEffect(() => {
        if (!availableTabs.some(t => t.id === activeTab) && availableTabs.length > 0) {
            setActiveTab(availableTabs[0].id);
        }
    }, [availableTabs, activeTab]);
    
    const [users, setUsers] = useState<User[]>([]);
    const [eventsForUserManagement, setEventsForUserManagement] = useState<Event[]>([]);

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
        setError: setError,
        isVip: isVip
    }), [user, eventData, currentEventId, currentEventName, props.onUpdateAttendeeDetails, props.onDeleteAttendee, props.onApproveSubstitution, props.onRejectSubstitution, props.onApproveSectorChange, props.onRejectSectorChange, props.onApproveNewRegistration, props.onRejectNewRegistration, setError, isVip]);

    const handleAddSupplier = (name: string, sectors: string[], registrationLimit: number, subCompanies: any[], email?: string) => api.addSupplier(currentEventId, name, sectors, registrationLimit, subCompanies, email);
    const handleUpdateSupplier = (supplierId: string, data: Partial<Supplier>) => api.updateSupplier(currentEventId, supplierId, data);
    const handleDeleteSupplier = (supplier: Supplier) => api.deleteSupplier(currentEventId, supplier.id);
    const handleSupplierStatusUpdate = (supplierId: string, active: boolean) => api.updateSupplierStatus(currentEventId, supplierId, active);
    const handleRegenerateAdminToken = (supplierId: string) => api.regenerateSupplierAdminToken(currentEventId, supplierId);

    const handleAddSector = (label: string, color: string) => api.addSector(currentEventId, label, color);
    const handleUpdateSector = (sectorId: string, data: { label: string, color: string }) => api.updateSector(currentEventId, sectorId, data);
    const handleDeleteSector = (sector: Sector) => api.deleteSector(currentEventId, sector.id);

    const handleUpdateSectorsForAttendees = (attendeeIds: string[], sectorIds: string[]) => api.updateSectorsForAttendees(currentEventId, attendeeIds, sectorIds);

    const handleImport = async (data: any[]) => {
         for (const row of data) {
            const name = row.name;
            const cpf = row.cpf ? String(row.cpf).replace(/\D/g, '') : '';
            const sectorLabel = row.sector;
            const supplierName = row.fornecedor || row.promoter || row.divulgadora; 
            let supplierId = undefined;
            if (supplierName) {
                const foundSupplier = eventData.suppliers.find(s => s.name.toLowerCase() === supplierName.toLowerCase());
                if (foundSupplier) supplierId = foundSupplier.id;
            }
            const subCompany = row.empresa || '';
            if (!name || !cpf) continue; 
            const sectorId = eventData.sectors.find(s => s.label.toLowerCase() === sectorLabel?.toLowerCase())?.id || (eventData.sectors.length > 0 ? eventData.sectors[0].id : undefined);
            if (!sectorId && !isVip) continue; 
            try {
                const exists = eventData.attendees.some(a => a.cpf.replace(/\D/g,'') === cpf);
                if (exists) continue;
                const photo = row.photo || '';
                await onRegister({ name, cpf, photo, sectors: sectorId ? [sectorId] : [], subCompany }, supplierId);
            } catch (e) {
                console.error(`Failed to import ${name}`, e);
            }
        }
    };

    const handleUpdateStatusForScanner = (attendeeId: string, status: any) => api.updateAttendeeStatus(currentEventId, attendeeId, status, user.username);
    
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
            <header className="flex-shrink-0 bg-gray-800/40 backdrop-blur-md p-4 rounded-xl shadow-lg border border-gray-700/50">
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <div className={`w-3 h-10 rounded-full ${isVip ? 'bg-gradient-to-b from-pink-500 to-rose-600 shadow-[0_0_10px_rgba(236,72,153,0.5)]' : 'bg-indigo-500'}`}></div>
                        <div>
                            <h1 className="text-2xl font-bold text-white tracking-tight">{currentEventName}</h1>
                            <div className="flex items-center gap-3">
                                <button onClick={onBackToEvents} className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors uppercase font-bold tracking-widest">&larr; Trocar de evento</button>
                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-widest ${isVip ? 'bg-pink-600/20 text-pink-400 border border-pink-500/30' : 'bg-gray-700 text-gray-300'}`}>
                                    {isVip ? 'Lista VIP' : 'Credenciamento'}
                                </span>
                            </div>
                        </div>
                    </div>
                     <div className="flex items-center gap-4">
                        <span className="text-gray-400 text-xs hidden md:block">Usuário: <span className="text-white font-medium">{user.username}</span></span>
                        <button onClick={onLogout} className="text-gray-400 hover:text-white transition-colors flex items-center gap-2 p-2 rounded-md hover:bg-gray-700/50">
                            <ArrowLeftOnRectangleIcon className="w-5 h-5"/>
                            <span className="hidden md:inline text-xs font-bold uppercase tracking-wider">Sair</span>
                        </button>
                    </div>
                </div>
                 <nav className="mt-4 -mb-4 -mx-4 px-4 overflow-x-auto scrollbar-hide">
                    <div className="flex gap-2">
                        {availableTabs.map(tab => {
                            let label = t(tab.labelKey);
                            if (isVip) {
                                if (tab.id === 'register') label = "Novo Convidado";
                                if (tab.id === 'suppliers') label = "Divulgadoras / Promoters";
                                if (tab.id === 'companies') label = "Empresas / Grupos";
                            }

                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`px-4 py-3 text-xs font-bold uppercase tracking-widest transition-all relative ${activeTab === tab.id ? `text-white` : 'text-gray-500 hover:text-gray-300'}`}
                                >
                                    {label}
                                    {activeTab === tab.id && (
                                        <div className={`absolute bottom-0 left-0 right-0 h-0.5 ${isVip ? 'bg-pink-500' : 'bg-indigo-500'} animate-in fade-in slide-in-from-bottom-1`}></div>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </nav>
            </header>
            <main className="flex-grow overflow-y-auto rounded-lg">
                <div className="py-6">
                    {activeTab === 'checkin' && <CheckinView {...checkinViewProps} />}
                    {activeTab === 'register' && <RegisterView onRegister={onRegister} setError={setError} sectors={eventData.sectors} suppliers={eventData.suppliers} currentEventId={currentEventId} eventType={currentEvent.type} />}
                    {activeTab === 'suppliers' && <SupplierManagementView currentEventId={currentEventId} suppliers={eventData.suppliers} attendees={eventData.attendees} sectors={eventData.sectors} onAddSupplier={handleAddSupplier} onUpdateSupplier={handleUpdateSupplier} onDeleteSupplier={handleDeleteSupplier} onSupplierStatusUpdate={handleSupplierStatusUpdate} onRegenerateAdminToken={handleRegenerateAdminToken} onUpdateSectorsForSelectedAttendees={handleUpdateSectorsForAttendees} setError={setError} eventType={currentEvent.type} />}
                    {activeTab === 'sectors' && <SectorManagementView sectors={eventData.sectors} onAddSector={handleAddSector} onUpdateSector={handleUpdateSector} onDeleteSector={handleDeleteSector} setError={setError} />}
                    {activeTab === 'companies' && <CompanyManagementView attendees={eventData.attendees} sectors={eventData.sectors} onUpdateSectorsForSelectedAttendees={handleUpdateSectorsForAttendees} setError={setError} />}
                    {activeTab === 'spreadsheet' && <SpreadsheetUploadView onImport={handleImport} setError={setError} eventType={currentEvent.type} />}
                    {activeTab === 'reports' && <WristbandReportView attendees={eventData.attendees} sectors={eventData.sectors} />}
                    {activeTab === 'logs' && <CheckinLogView attendees={eventData.attendees} />}
                    {activeTab === 'scanner' && <QRCodeScannerView currentEvent={{ id: currentEventId, name: currentEventName, createdAt: null!, type: currentEvent.type }} attendees={eventData.attendees} onUpdateStatus={handleUpdateStatusForScanner} setError={setError} />}
                    {activeTab === 'users' && <UserManagementView currentUser={user} users={users} events={eventsForUserManagement} onCreateUser={handleCreateUser} onUpdateUser={handleUpdateUser} onDeleteUser={handleDeleteUser} setError={setError} />}
                </div>
            </main>
        </div>
    );
};

export default AdminView;