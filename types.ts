// FIX: Provided full content for `types.ts` to define application-wide types.
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
  photo: string; // URL to the photo in storage
  sector: string; // Sector ID
  status: CheckinStatus;
  eventId: string;
  createdAt: any; // Firestore Timestamp
}

export interface Sector {
  id: string;
  label: string;
  eventId: string;
}

export interface Event {
  id: string;
  name: string;
  createdAt: any; // Firestore Timestamp
}

export interface Supplier {
  id: string;
  name: string;
  sectors: string[]; // array of sector IDs
  password?: string; // used for login
  eventId: string;
}
