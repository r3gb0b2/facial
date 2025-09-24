export enum CheckinStatus {
  REGISTERED = 'Registered',
  CHECKED_IN = 'Checked-in',
}

export interface Attendee {
  id?: string; // ID will be assigned by Firestore
  name: string;
  cpf: string;
  photo: string; // This will be a URL from Firebase Storage, not base64
  status: CheckinStatus;
  checkinTime?: string;
  braceletColor?: string;
}

export interface Supplier {
  id?: string; // ID from Firestore
  name: string;
  braceletColors: string[]; // Supplier can have access to multiple sectors
  slug: string; // URL-friendly identifier
}

export interface Event {
    id?: string;
    name: string;
    createdAt: any; // Firestore timestamp
}