import firebase from "firebase/compat/app";
import { db, storage, FieldValue } from './config.ts';
// FIX: `CheckinStatus` is an enum used as a value, so it must be imported as a value. Other members are interfaces and can be imported as types.
import { type Attendee, type Event, type Sector, type Supplier, CheckinStatus } from '../types.ts';

// Helper to convert Firestore doc to a typed object with ID
const fromDoc = <T extends { id: string }>(doc: firebase.firestore.DocumentSnapshot): T => {
    return { ...doc.data(), id: doc.id } as T;
};

// =================================================================================================
// Event Management
// =================================================================================================

export const getEvents = async (): Promise<Event[]> => {
    const snapshot = await db.collection('events').orderBy('createdAt', 'desc').get();
    return snapshot.docs.map(doc => fromDoc<Event>(doc));
};

export const getEvent = async (eventId: string): Promise<Event | null> => {
    const doc = await db.collection('events').doc(eventId).get();
    if (!doc.exists) {
        return null;
    }
    return fromDoc<Event>(doc);
};

export const addEvent = (name: string) => {
    return db.collection('events').add({
        name,
        createdAt: FieldValue.serverTimestamp(),
    });
};

export const updateEvent = (eventId: string, name: string) => {
    return db.collection('events').doc(eventId).update({ name });
};

export const deleteEvent = async (eventId: string) => {
    const batch = db.batch();
    const collections = ['attendees', 'sectors', 'suppliers'];
    for (const collection of collections) {
        const snapshot = await db.collection('events').doc(eventId).collection(collection).get();
        snapshot.docs.forEach(doc => batch.delete(doc.ref));
    }
    batch.delete(db.collection('events').doc(eventId));
    return batch.commit();
};

// =================================================================================================
// Attendee Management
// =================================================================================================

export const subscribeToAttendees = (eventId: string, callback: (attendees: Attendee[]) => void) => {
    return db.collection('events').doc(eventId).collection('attendees')
        .onSnapshot(snapshot => {
            const attendees = snapshot.docs.map(doc => fromDoc<Attendee>(doc));
            callback(attendees);
        });
};

export const addAttendee = async (attendeeData: Omit<Attendee, 'id' | 'createdAt'> & {createdAt?: Date}) => {
    const dataWithTimestamp = {
        ...attendeeData,
        createdAt: FieldValue.serverTimestamp()
    };
    return db.collection('events').doc(attendeeData.eventId).collection('attendees').add(dataWithTimestamp);
};

export const findAttendeeByCpf = async (cpf: string): Promise<Attendee | null> => {
    const snapshot = await db.collectionGroup('attendees').where('cpf', '==', cpf).limit(1).get();
    if (snapshot.empty) {
        return null;
    }
    return fromDoc<Attendee>(snapshot.docs[0]);
};

export const updateAttendeeStatus = (eventId: string, attendeeId: string, status: CheckinStatus, wristbandNumber?: string) => {
    const data: any = { status };
    if (status === CheckinStatus.CHECKED_IN) {
        data.wristbandNumber = wristbandNumber || null;
    }
    if (status === CheckinStatus.PENDING) {
        data.wristbandNumber = null;
    }
    return db.collection('events').doc(eventId).collection('attendees').doc(attendeeId).update(data);
};

export const updateAttendeeDetails = (eventId: string, attendeeId: string, data: Partial<Attendee>) => {
    return db.collection('events').doc(eventId).collection('attendees').doc(attendeeId).update(data);
};

export const deleteAttendee = (eventId: string, attendeeId: string) => {
    return db.collection('events').doc(eventId).collection('attendees').doc(attendeeId).delete();
};


// =================================================================================================
// Sector Management
// =================================================================================================

export const subscribeToSectors = (eventId: string, callback: (sectors: Sector[]) => void) => {
    return db.collection('events').doc(eventId).collection('sectors')
        .onSnapshot(snapshot => {
            const sectors = snapshot.docs.map(doc => fromDoc<Sector>(doc));
            callback(sectors);
        });
};

export const getSectors = async (eventId: string): Promise<Sector[]> => {
    const snapshot = await db.collection('events').doc(eventId).collection('sectors').get();
    return snapshot.docs.map(doc => fromDoc<Sector>(doc));
}

export const addSector = (eventId: string, label: string, color: string) => {
    return db.collection('events').doc(eventId).collection('sectors').add({ eventId, label, color });
};

export const updateSector = (eventId: string, sectorId: string, data: { label: string, color: string }) => {
    return db.collection('events').doc(eventId).collection('sectors').doc(sectorId).update(data);
};

export const deleteSector = async (eventId: string, sectorId: string, attendees: Attendee[]) => {
    const isInUse = attendees.some(a => a.sector === sectorId);
    if (isInUse) {
        throw new Error('Sector is in use and cannot be deleted.');
    }
    return db.collection('events').doc(eventId).collection('sectors').doc(sectorId).delete();
};


// =================================================================================================
// Supplier Management
// =================================================================================================

export const subscribeToSuppliers = (eventId: string, callback: (suppliers: Supplier[]) => void) => {
    return db.collection('events').doc(eventId).collection('suppliers')
        .onSnapshot(snapshot => {
            const suppliers = snapshot.docs.map(doc => fromDoc<Supplier>(doc));
            callback(suppliers);
        });
};

export const addSupplier = (eventId: string, name: string, sectors: string[]) => {
    return db.collection('events').doc(eventId).collection('suppliers').add({
        eventId,
        name,
        sectors,
        registrationOpen: true,
    });
};

export const updateSupplier = (eventId: string, supplierId: string, data: Partial<Supplier>) => {
    return db.collection('events').doc(eventId).collection('suppliers').doc(supplierId).update(data);
};

export const deleteSupplier = (eventId: string, supplierId: string) => {
    return db.collection('events').doc(eventId).collection('suppliers').doc(supplierId).delete();
};

export const toggleSupplierRegistration = (eventId: string, supplierId: string, isOpen: boolean) => {
    return db.collection('events').doc(eventId).collection('suppliers').doc(supplierId).update({ registrationOpen: isOpen });
};

export const getSupplierInfoForRegistration = async (supplierId: string): Promise<Supplier> => {
    const querySnapshot = await db.collectionGroup('suppliers').get();
    const doc = querySnapshot.docs.find(d => d.id === supplierId);

    if (!doc) {
        throw new Error('Supplier not found.');
    }
    return fromDoc<Supplier>(doc);
};

export const getAttendeesForSupplier = async (supplierId: string): Promise<Attendee[]> => {
    const snapshot = await db.collectionGroup('attendees').where('supplierId', '==', supplierId).get();
    return snapshot.docs.map(doc => fromDoc<Attendee>(doc));
};