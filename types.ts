import type { Timestamp } from './firebase/config';

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
  photo: string;
  status: CheckinStatus;
  sector: string; // Corresponds to Sector['id']
  eventId: string;
  createdAt: Timestamp;
  wristbandNumber?: string;
  supplierId?: string; // Corresponds to Supplier['id']
  subCompany?: string;
}

export interface Sector {
  id: string;
  label: string;
  color: string;
  eventId: string;
}

export interface SubCompany {
  name: string;
  sector: string; // Corresponds to Sector['id']
}

export interface Supplier {
  id: string;
  name: string;
  sectors: string[]; // Array of Sector['id']
  eventId: string;
  registrationOpen: boolean;
  subCompanies?: SubCompany[];
}

export interface Event {
  id: string;
  name:string;
  createdAt: Timestamp;
}
