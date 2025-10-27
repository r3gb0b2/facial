// FIX: Replaced the value import with a type-only import for the Timestamp, aliasing the exported FirebaseTimestamp type.
import type { FirebaseTimestamp as Timestamp } from './firebase/config.ts';

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
}

export interface Event {
  id: string;
  name: string;
  createdAt: Timestamp;
}

export interface Supplier {
  id: string;
  name: string;
  sectors: string[];
  active: boolean;
  registrationLimit: number;
}

export interface Sector {
  id: string; // e.g., 'staff'
  label: string; // e.g., 'Staff'
}
