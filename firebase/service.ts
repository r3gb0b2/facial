// FIX: Provided full content for `firebase/service.ts` with Firestore interaction logic.
import { db, storage } from './config';
import firebase from "firebase/compat/app";
import { Attendee, CheckinStatus, Sector, Event, Supplier } from '../types';

// Helper to get event ID from localStorage
const getCurrentEventId = (): string => {
    const eventId = localStorage.getItem('selectedEventId');
    if (!eventId) {
        console.error("No event selected");
        throw new Error("No event selected");
    }
    return eventId;
};

// --- Listener Functions ---

export const listenForAttendees = (eventId: string, callback: (attendees: Attendee[]) => void): (() => void) => {
    return db.collection('events').doc(eventId).collection('attendees').orderBy('name')
        .onSnapshot(snapshot => {
            const attendees = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Attendee));
            callback(attendees);
        }, error => console.error("Attendee listener error:", error));
};

export const listenForSectors = (eventId: string, callback: (sectors: Sector[]) => void): (() => void) => {
    return db.collection('events').doc(eventId).collection('sectors').orderBy('label')
        .onSnapshot(snapshot => {
            const sectors = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Sector));
            callback(sectors);
        }, error => console.error("Sector listener error:", error));
};

export const listenForSuppliers = (eventId: string, callback: (suppliers: Supplier[]) => void): (() => void) => {
    return db.collection('events').doc(eventId).collection('suppliers').orderBy('name')
        .onSnapshot(snapshot => {
            const suppliers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Supplier));
            callback(suppliers);
        }, error => console.error("Supplier listener error:", error));
};

// --- Attendee Functions ---

export const findAttendeeByCpf = async (cpf: string): Promise<Attendee | null> => {
    // Check within the current event first for optimization
    const eventId = getCurrentEventId();
    const snapshot = await db.collection('events').doc(eventId).collection('attendees').where('cpf', '==', cpf).limit(1).get();
    if (!snapshot.empty) {
        const doc = snapshot.docs[0];
        return { id: doc.id, ...doc.data() } as Attendee;
    }
    
    // Fallback: check in collection group for attendees from other events to reuse data
    const groupSnapshot = await db.collectionGroup('attendees').where('cpf', '==', cpf).limit(1).get();
    if (groupSnapshot.empty) {
        return null;
    }
    const attendeeDoc = groupSnapshot.docs[0];
    return { id: attendeeDoc.id, ...attendeeDoc.data() } as Attendee;
};

export const addAttendee = async (attendee: Omit<Attendee, 'id' | 'status' | 'createdAt' | 'eventId'>): Promise<string> => {
    const eventId = getCurrentEventId();
    // Upload photo to storage
    const photoUrl = await uploadPhoto(attendee.photo, `${eventId}/attendees/${attendee.cpf}-${Date.now()}.png`);

    const newAttendee = {
        ...attendee,
        photo: photoUrl,
        status: CheckinStatus.PENDING,
        eventId: eventId,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    };

    const docRef = await db.collection('events').doc(eventId).collection('attendees').add(newAttendee);
    return docRef.id;
};

export const updateAttendeeStatus = async (attendeeId: string, status: CheckinStatus): Promise<void> => {
    const eventId = getCurrentEventId();
    await db.collection('events').doc(eventId).collection('attendees').doc(attendeeId).update({ status });
};

// --- Photo Upload ---
const uploadPhoto = async (dataUrl: string, path: string): Promise<string> => {
    const storageRef = storage.ref();
    const photoRef = storageRef.child(path);
    // Firebase v8 compat storage expects a raw base64 string for 'base64' upload type.
    const base64String = dataUrl.split(',')[1];
    await photoRef.putString(base64String, 'base64', { contentType: 'image/png' });
    return photoRef.getDownloadURL();
};

// --- Event Functions ---
export const getEvents = async (): Promise<Event[]> => {
    const snapshot = await db.collection('events').orderBy('createdAt', 'desc').get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Event));
};

export const addEvent = async (name: string): Promise<string> => {
    const docRef = await db.collection('events').add({
        name,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    return docRef.id;
};

export const updateEvent = async (id: string, name: string): Promise<void> => {
    await db.collection('events').doc(id).update({ name });
};

export const deleteEvent = async (id: string): Promise<void> => {
    await db.collection('events').doc(id).delete();
};

// --- Sector Functions ---
export const addSector = async (label: string): Promise<string> => {
    const eventId = getCurrentEventId();
    const docRef = await db.collection('events').doc(eventId).collection('sectors').add({
        label,
        eventId: eventId,
    });
    return docRef.id;
};

export const updateSector = async (id: string, label: string): Promise<void> => {
    const eventId = getCurrentEventId();
    await db.collection('events').doc(eventId).collection('sectors').doc(id).update({ label });
};

export const deleteSector = async (id: string): Promise<void> => {
    const eventId = getCurrentEventId();
    // Check if sector is in use by attendees
    const attendeesSnapshot = await db.collection('events').doc(eventId).collection('attendees').where('sector', '==', id).limit(1).get();
    if (!attendeesSnapshot.empty) {
        throw new Error('Sector is in use and cannot be deleted.');
    }
    // Check if sector is in use by suppliers
    const suppliersSnapshot = await db.collection('events').doc(eventId).collection('suppliers').where('sectors', 'array-contains', id).limit(1).get();
    if (!suppliersSnapshot.empty) {
        throw new Error('Sector is in use and cannot be deleted.');
    }
    
    await db.collection('events').doc(eventId).collection('sectors').doc(id).delete();
};
