import React from 'react';
import { Attendee, Sector } from '../../types';

interface RegisterViewProps {
  onRegister: (newAttendee: Omit<Attendee, 'id' | 'status' | 'eventId' | 'createdAt'>) => Promise<void>;
  onImportAttendees: (data: any[]) => Promise<any>;
  setError: (message: string) => void;
  sectors: Sector[];
}

const RegisterView: React.FC<RegisterViewProps> = () => {
  return <div>Register View</div>;
};

export default RegisterView;
