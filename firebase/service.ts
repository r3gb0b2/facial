import firebase from "firebase/compat/app";
import { db, storage } from './config.ts';
import { Attendee, CheckinStatus, Event, Sector, Supplier } from '../types.ts';

// Helper to get eventId, otherwise throw error
const ensureEventId = (eventId?: string): string => {
    if (!eventId) throw new Error("Event ID is required for this operation.");
    return eventId;
};


// --- Photo Upload ---
export const uploadPhoto = async (photoDataUrl: string, attendeeId: string): Promise<string> => {
    const storageRef = storage.ref();
    const photoRef = storageRef.child(`attendees/${attendeeId}.png`);
    await photoRef.putString(photoDataUrl, 'data_url');
    return photoRef.getDownloadURL();
};

// --- Attendee Management ---

export const getAttendees = (eventId: string, onUpdate: (attendees: Attendee[]) => void): (() => void) => {
    const eventRef = db.collection('events').doc(eventId);
    return eventRef.collection('attendees')
      .orderBy('name')
      .onSnapshot(snapshot => {
        const attendeesData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Attendee));
        onUpdate(attendeesData);
      }, error => {
        console.error("Error getting attendees:", error);
      });
};

export const findAttendeeByCpf = async (cpf: string): Promise<Attendee | null> => {
    // This query requires a composite index on the 'attendees' collection group.
    const snapshot = await db.collectionGroup('attendees').where('cpf', '==', cpf).limit(1).get();
    if (snapshot.empty) {
        return null;
    }
    const doc = snapshot.docs[0];
    return { id: doc.id, ...doc.data() } as Attendee;
};

export const addAttendee = async (
    eventId: string,
    attendeeData: Omit<Attendee, 'id' | 'status' | 'eventId' | 'createdAt'>
): Promise<string> => {
    const eventRef = db.collection('events').doc(eventId);
    const newAttendeeRef = eventRef.collection('attendees').doc();
    
    const photoUrl = await uploadPhoto(attendeeData.photo, newAttendeeRef.id);
    
    const newAttendee: Omit<Attendee, 'id'> = {
        ...attendeeData,
        photo: photoUrl,
        status: CheckinStatus.PENDING,
        eventId,
        createdAt: firebase.firestore.FieldValue.serverTimestamp() as firebase.firestore.Timestamp,
    };

    await newAttendeeRef.set(newAttendee);
    return newAttendeeRef.id;
};

export const updateAttendeeStatus = async (eventId: string, attendeeId: string, status: CheckinStatus): Promise<void> => {
    const eventRef = db.collection('events').doc(eventId);
    await eventRef.collection('attendees').doc(attendeeId).update({ status });
};

// --- Event Management ---
export const getEvents = (onUpdate: (events: Event[]) => void): (() => void) => {
    return db.collection('events').orderBy('createdAt', 'desc').onSnapshot(snapshot => {
        const eventsData = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
        } as Event));
        onUpdate(eventsData);
    });
};

export const addEvent = async (name: string): Promise<string> => {
    const res = await db.collection('events').add({
        name,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    return res.id;
};

export const updateEvent = async (eventId: string, name: string): Promise<void> => {
    await db.collection('events').doc(eventId).update({ name });
};

export const deleteEvent = async (eventId: string): Promise<void> => {
    // Note: This does not delete subcollections like attendees.
    // A more robust solution would use a Firebase Function to handle cascading deletes.
    await db.collection('events').doc(eventId).delete();
};


// --- Sector Management ---

export const getSectors = (eventId: string, onUpdate: (sectors: Sector[]) => void): (() => void) => {
    const eventRef = db.collection('events').doc(ensureEventId(eventId));
    return eventRef.collection('sectors').orderBy('label').onSnapshot(snapshot => {
        const sectorsData = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
        } as Sector));
        onUpdate(sectorsData);
    });
};

export const addSector = async (eventId: string, label: string): Promise<string> => {
    const eventRef = db.collection('events').doc(ensureEventId(eventId));
    const id = label.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    await eventRef.collection('sectors').doc(id).set({ label });
    return id;
};

export const updateSector = async (eventId: string, sectorId: string, label:string): Promise<void> => {
    const eventRef = db.collection('events').doc(ensureEventId(eventId));
    await eventRef.collection('sectors').doc(sectorId).update({ label });
};

export const deleteSector = async (eventId: string, sectorId: string): Promise<void> => {
    const eventRef = db.collection('events').doc(ensureEventId(eventId));
    // Here we should check if the sector is in use by attendees or suppliers.
    const attendeesSnapshot = await eventRef.collection('attendees').where('sector', '==', sectorId).limit(1).get();
    const suppliersSnapshot = await eventRef.collection('suppliers').where('sectors', 'array-contains', sectorId).limit(1).get();
    
    if (!attendeesSnapshot.empty || !suppliersSnapshot.empty) {
        throw new Error('Sector is in use and cannot be deleted.');
    }
    
    await eventRef.collection('sectors').doc(sectorId).delete();
};


// --- Supplier Management ---

export const getSuppliers = (eventId: string, onUpdate: (suppliers: Supplier[]) => void): (() => void) => {
    const eventRef = db.collection('events').doc(ensureEventId(eventId));
    return eventRef.collection('suppliers').orderBy('name').onSnapshot(snapshot => {
        const suppliersData = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
        } as Supplier));
        onUpdate(suppliersData);
    });
};

export const getSupplier = async (eventId: string, supplierId: string): Promise<Supplier | null> => {
    const doc = await db.collection('events').doc(eventId).collection('suppliers').doc(supplierId).get();
    if (!doc.exists) return null;
    return { id: doc.id, ...doc.data() } as Supplier;
};


export const addSupplier = async (eventId: string, name: string, sectors: string[], registrationLimit: number): Promise<string> => {
    const eventRef = db.collection('events').doc(ensureEventId(eventId));
    const newSupplier = {
        name,
        sectors,
        registrationLimit,
        active: true,
    };
    const res = await eventRef.collection('suppliers').add(newSupplier);
    return res.id;
};

export const updateSupplier = async (eventId: string, supplierId: string, data: Partial<Supplier>): Promise<void> => {
    const eventRef = db.collection('events').doc(ensureEventId(eventId));
    await eventRef.collection('suppliers').doc(supplierId).update(data);
};