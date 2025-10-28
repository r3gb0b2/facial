import type { Timestamp } from './firebase/config.ts';

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
  sector: string;
  status: CheckinStatus;
  eventId: string;
  createdAt: Timestamp;
  supplierId?: string; // To track which supplier registered the attendee
  subCompany?: string; // The attendee's specific company under a supplier
  wristbandNumber?: string; // Optional wristband number assigned at check-in
}

export interface Event {
  id: string;
  name: string;
  createdAt: Timestamp;
}

export interface SubCompany {
  name: string;
  color: string;
}

export interface Supplier {
  id: string;
  name: string;
  sectors: string[];
  active: boolean;
  registrationLimit: number;
  subCompanies?: SubCompany[]; // Optional list of sub-companies for this supplier
}

export interface Sector {
  id: string; // e.g., 'staff'
  label: string; // e.g., 'Staff'
  color?: string; // e.g., '#ff0000'
}