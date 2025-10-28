// FIX: Add .ts extension to firebase/config import.
// FIX: Changed import to get the Timestamp type from firebase/compat/app namespace.
import type { firestore } from 'firebase/compat/app';

export enum CheckinStatus {
  PENDING = 'PENDING',
  CHECKED_IN = 'CHECKED_IN',
  CANCELLED = 'CANCELLED',
  SUBSTITUTION = 'SUBSTITUTION',
  MISSED = 'MISSED',
}

export interface Attendee {
  id: string;
  name: string;
  cpf: string;
  photo: string; // This is a URL to the image in Firebase Storage
  sectors: string[];
  status: CheckinStatus;
  eventId: string;
  createdAt: firestore.Timestamp;
  supplierId?: string; // To track which supplier registered the attendee
  subCompany?: string; // The attendee's specific company under a supplier
  wristbands?: { [sectorId: string]: string }; // Maps sectorId to wristband number
}

export interface Event {
  id: string;
  name: string;
  createdAt: firestore.Timestamp;
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