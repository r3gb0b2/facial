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
  sector?: string;
}

export interface Supplier {
  id?: string; // ID from Firestore
  name: string;
  sector: string;
  slug: string; // URL-friendly identifier
}
