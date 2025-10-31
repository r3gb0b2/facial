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
}

export interface Attendee {
  id: string;
  name: string;
  cpf: string;
  photo: string; // This is a URL to the image in Firebase Storage
  sectors: string[];
  status: CheckinStatus;
  eventId: string;
  createdAt: FirebaseTimestamp;
  supplierId?: string; // To track which supplier registered the attendee
  subCompany?: string; // The attendee's specific company under a supplier
  wristbands?: { [sectorId: string]: string }; // Maps sectorId to wristband number
  substitutionData?: {
    name: string;
    cpf: string;
    photo?: string; // Base64 data URL
    newSectorIds?: string[];
  };
  sectorChangeData?: {
    newSectorId: string;
    justification?: string;
  };
}

export interface Event {
  id: string;
  name: string;
  createdAt: FirebaseTimestamp;
}

export interface SubCompany {
  name: string;
  sector: string; // The ID of the sector this sub-company belongs to
}

export interface Supplier {
  id: string;
  name: string;
  sectors: string[];
  active: boolean;
  registrationLimit: number;
  subCompanies?: SubCompany[]; // Optional list of sub-companies for this supplier
  adminToken?: string; // Unique token for the read-only admin link
}

export interface Sector {
  id: string; // e.g., 'staff'
  label: string; // e.g., 'Staff'
  color?: string; // e.g., '#ff0000'
}