
// FIX: Replaced Timestamp value with FirebaseTimestamp type to resolve conflict between value and type.
import type { FirebaseTimestamp } from './firebase/config.ts';

export enum CheckinStatus {
  PENDING = 'PENDING',
  CHECKED_IN = 'CHECKED_IN',
  CANCELLED = 'CANCELLED',
  SUBSTITUTION = 'SUBSTITUTION',
  SUBSTITUTION_REQUEST = 'SUBSTITUTION_REQUEST',
  SECTOR_CHANGE_REQUEST = 'SECTOR_CHANGE_REQUEST',
  MISSED = 'MISSED',
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  CHECKED_OUT = 'CHECKED_OUT',
  BLOCKED = 'BLOCKED', 
  REJECTED = 'REJECTED', 
}

export type EventType = 'CREDENTIALING' | 'VIP_LIST';

export interface Attendee {
  id: string;
  name: string;
  cpf: string;
  email?: string;
  age?: number; // Nova propriedade
  photo: string;
  sectors: string[];
  status: CheckinStatus;
  eventId: string;
  createdAt: FirebaseTimestamp;
  checkinTime?: FirebaseTimestamp;
  checkedInBy?: string;
  checkoutTime?: FirebaseTimestamp;
  checkedOutBy?: string;
  supplierId?: string;
  subCompany?: string;
  wristbands?: { [sectorId: string]: string };
  blockReason?: string;
  substitutionData?: {
    name: string;
    cpf: string;
    age?: number;
    email?: string;
    photo?: string;
    newSectorIds?: string[];
  };
  sectorChangeData?: {
    newSectorId: string;
    justification?: string;
  };
}

export interface EventModules {
  scanner: boolean;
  logs: boolean;
  register: boolean;
  companies: boolean;
  spreadsheet: boolean;
  reports: boolean;
}

export interface Event {
  id: string;
  name: string;
  type: EventType;
  createdAt: FirebaseTimestamp;
  modules?: EventModules;
  allowPhotoChange?: boolean;
  allowGuestUploads?: boolean;
}

export interface SubCompany {
  name: string;
  sector: string;
}

export interface Supplier {
  id: string;
  name: string;
  email?: string;
  sectors: string[];
  active: boolean;
  registrationLimit: number;
  subCompanies?: SubCompany[];
  adminToken?: string;
}

export interface Sector {
  id: string;
  label: string;
  color?: string;
}

export type UserRole = 'superadmin' | 'admin' | 'checkin';

export interface User {
  id: string;
  username: string;
  password?: string;
  role: UserRole;
  linkedEventIds: string[];
  createdBy?: string;
  active?: boolean;
}
