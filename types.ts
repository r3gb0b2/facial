export enum CheckinStatus {
  REGISTERED = 'Registered',
  CHECKED_IN = 'Checked-in',
}

export interface Attendee {
  id: string;
  name: string;
  email: string;
  photo: string; // base64 data URL
  status: CheckinStatus;
  checkinTime?: string;
  sector?: string;
}
