import { collection, addDoc, onSnapshot, doc, updateDoc, query, orderBy } from "firebase/firestore";
import { db } from './config';
import { Attendee } from "../types";

const ATTENDEES_COLLECTION = 'attendees';

// Function to listen for real-time updates on the attendees collection
export const onAttendeesUpdate = (callback: (attendees: Attendee[]) => void) => {
  const q = query(collection(db, ATTENDEES_COLLECTION), orderBy("name"));

  const unsubscribe = onSnapshot(q, (querySnapshot) => {
    const attendees: Attendee[] = [];
    querySnapshot.forEach((doc) => {
        attendees.push({ id: doc.id, ...doc.data() } as Attendee);
    });
    callback(attendees);
  });

  return unsubscribe; // Return the unsubscribe function to stop listening
};

// Function to add a new attendee
export const addAttendee = async (attendee: Omit<Attendee, 'id'>): Promise<void> => {
    try {
        await addDoc(collection(db, ATTENDEES_COLLECTION), attendee);
    } catch (e) {
        console.error("Error adding document: ", e);
        throw e;
    }
}

// Function to update an existing attendee
export const updateAttendee = async (id: string, updates: Partial<Attendee>): Promise<void> => {
    const attendeeDocRef = doc(db, ATTENDEES_COLLECTION, id);
    try {
        await updateDoc(attendeeDocRef, updates);
    } catch (e) {
        console.error("Error updating document: ", e);
        throw e;
    }
}