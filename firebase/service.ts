// FIX: Import firebase to provide the namespace for firestore types.
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import { db, storage, FieldValue, Timestamp } from './config.ts';
import { Attendee, CheckinStatus, Event, Supplier, Sector, SubCompany } from '../types.ts';
import { v4 as uuidv4 } from 'uuid';

// Helper to extract data and id from snapshots
const getData = <T>(doc: firebase.firestore.DocumentSnapshot): T => ({ id: doc.id, ...doc.data() } as T);
const getCollectionData = <T>(querySnapshot: firebase.firestore.QuerySnapshot): T[] => querySnapshot.docs.map(doc => getData<T>(doc));

// Event Management
export const getEvents = async (): Promise<Event[]> => {
    const snapshot = await db.collection('events').orderBy('createdAt', 'desc').get();
    return getCollectionData<Event>(snapshot);
};

export const createEvent = (name: string) => {
    return db.collection('events').add({
        name,
        createdAt: FieldValue.serverTimestamp(),
    });
};

export const updateEvent = (id: string, name: string) => {
    return db.collection('events').doc(id).update({ name });
};

export const deleteEvent = (id: string) => {
    // Note: This is a simple delete. In a real app, you'd want a Cloud Function
    // to recursively delete all subcollections (attendees, suppliers, etc.).
    return db.collection('events').doc(id).delete();
};

// Realtime Data Subscription for a specific event
export const subscribeToEventData = (
    eventId: string,
    callback: (data: { attendees: Attendee[], suppliers: Supplier[], sectors: Sector[] }) => void,
    onError: (error: Error) => void
) => {
    const attendeesUnsub = db.collection('events').doc(eventId).collection('attendees').onSnapshot(snap => {
        const attendees = getCollectionData<Attendee>(snap);
        callback({ attendees, suppliers: [], sectors: [] }); // partial update
    }, onError);

    const suppliersUnsub = db.collection('events').doc(eventId).collection('suppliers').onSnapshot(snap => {
        const suppliers = getCollectionData<Supplier>(snap);
        callback({ attendees: [], suppliers, sectors: [] }); // partial update
    }, onError);
    
    const sectorsUnsub = db.collection('events').doc(eventId).collection('sectors').onSnapshot(snap => {
        const sectors = getCollectionData<Sector>(snap);
        callback({ attendees: [], suppliers: [], sectors }); // partial update
    }, onError);

    // This is a simplified subscription model. A better approach would be to manage state more granularly.
    // For now, we'll merge the state in the App component.
    // We'll refetch all data on any change.
    const combinedUnsub = db.collection('events').doc(eventId).onSnapshot(async () => {
       try {
            const attendeesSnap = await db.collection('events').doc(eventId).collection('attendees').get();
            const suppliersSnap = await db.collection('events').doc(eventId).collection('suppliers').get();
            const sectorsSnap = await db.collection('events').doc(eventId).collection('sectors').get();
            callback({
                attendees: getCollectionData<Attendee>(attendeesSnap),
                suppliers: getCollectionData<Supplier>(suppliersSnap),
                sectors: getCollectionData<Sector>(sectorsSnap),
            });
       } catch (error: any) {
           onError(error)
       }
    });


    return () => {
        // attendeesUnsub();
        // suppliersUnsub();
        // sectorsUnsub();
        combinedUnsub();
    };
};

// Attendee Management
export const findAttendeeByCpf = async (cpf: string, eventId?: string): Promise<(Attendee & { eventId?: string }) | null> => {
    let query: firebase.firestore.Query = db.collectionGroup('attendees').where('cpf', '==', cpf).limit(1);
    
    const snapshot = await query.get();
    if (snapshot.empty) {
        return null;
    }
    const attendee = getData<Attendee>(snapshot.docs[0]);
    
    // If eventId is provided, check if the attendee is registered in THAT event
    if (eventId) {
        const eventRef = snapshot.docs[0].ref.parent.parent;
        if (eventRef?.id === eventId) {
            return { ...attendee, eventId: eventRef.id };
        } else {
             // Found attendee but in a different event, return basic data but no eventId match
            return attendee;
        }
    }
    
    return attendee;
};

const uploadPhoto = async (photoDataUrl: string, cpf: string): Promise<string> => {
    const blob = await (await fetch(photoDataUrl)).blob();
    const ref = storage.ref(`photos/${cpf}-${Date.now()}.png`);
    const snapshot = await ref.put(blob);
    return snapshot.ref.getDownloadURL();
};


export const addAttendee = async (eventId: string, attendeeData: Omit<Attendee, 'id' | 'status' | 'eventId' | 'createdAt'>, supplierId?: string) => {
    // Check if photo is a data URL that needs uploading
    let photoUrl = attendeeData.photo;
    if (attendeeData.photo.startsWith('data:image')) {
        photoUrl = await uploadPhoto(attendeeData.photo, attendeeData.cpf);
    }

    const data: Omit<Attendee, 'id'> = {
        ...attendeeData,
        photo: photoUrl,
        eventId,
        status: CheckinStatus.PENDING,
        createdAt: Timestamp.now(),
        ...(supplierId && { supplierId })
    };

    return db.collection('events').doc(eventId).collection('attendees').add(data);
};

export const updateAttendeeStatus = (eventId: string, attendeeId: string, status: CheckinStatus, wristbands?: { [sectorId: string]: string }) => {
    return db.collection('events').doc(eventId).collection('attendees').doc(attendeeId).update({ status, wristbands });
};

export const updateAttendeeDetails = (eventId: string, attendeeId: string, data: Partial<Attendee>) => {
    return db.collection('events').doc(eventId).collection('attendees').doc(attendeeId).update(data);
};

export const deleteAttendee = (eventId: string, attendeeId: string) => {
    return db.collection('events').doc(eventId).collection('attendees').doc(attendeeId).delete();
};

export const requestSubstitution = async (eventId: string, attendeeId: string, substitutionData: Required<Attendee>['substitutionData']) => {
    return db.collection('events').doc(eventId).collection('attendees').doc(attendeeId).update({
        status: CheckinStatus.SUBSTITUTION_REQUEST,
        substitutionData: substitutionData,
    });
};

export const approveSubstitution = async (eventId: string, attendeeId: string) => {
    const attendeeRef = db.collection('events').doc(eventId).collection('attendees').doc(attendeeId);
    const doc = await attendeeRef.get();
    const attendee = doc.data() as Attendee;

    if (!attendee || !attendee.substitutionData) {
        throw new Error("Substitution data not found for this attendee.");
    }
    
    const { name, cpf, photo: photoDataUrl } = attendee.substitutionData;
    
    const photoUrl = await uploadPhoto(photoDataUrl, cpf);

    return attendeeRef.update({
        name: name,
        cpf: cpf,
        photo: photoUrl,
        status: CheckinStatus.PENDING,
        substitutionData: FieldValue.delete(),
    });
};

export const rejectSubstitution = (eventId: string, attendeeId: string) => {
    return db.collection('events').doc(eventId).collection('attendees').doc(attendeeId).update({
        status: CheckinStatus.PENDING,
        substitutionData: FieldValue.delete(),
    });
};


// Supplier Management
export const addSupplier = (eventId: string, name: string, sectors: string[], registrationLimit: number, subCompanies: SubCompany[]) => {
    const adminToken = uuidv4();
    return db.collection('events').doc(eventId).collection('suppliers').add({ 
        name, 
        sectors, 
        registrationLimit,
        subCompanies,
        active: true,
        adminToken
    });
};

export const updateSupplier = (eventId: string, supplierId: string, data: Partial<Supplier>) => {
    return db.collection('events').doc(eventId).collection('suppliers').doc(supplierId).update(data);
};

export const deleteSupplier = async (eventId: string, supplierId: string) => {
    const attendeesSnap = await db.collection('events').doc(eventId).collection('attendees').where('supplierId', '==', supplierId).get();
    if (!attendeesSnap.empty) {
        throw new Error("Supplier is in use and cannot be deleted.");
    }
    return db.collection('events').doc(eventId).collection('suppliers').doc(supplierId).delete();
};

export const updateSupplierStatus = (eventId: string, supplierId: string, active: boolean) => {
    return updateSupplier(eventId, supplierId, { active });
};

export const getSupplierForRegistration = async (eventId: string, supplierId: string): Promise<{ data: Supplier & {eventId: string}, name: string, sectors: Sector[] } | null> => {
    const eventSnap = await db.collection('events').doc(eventId).get();
    if (!eventSnap.exists) return null;

    const supplierSnap = await db.collection('events').doc(eventId).collection('suppliers').doc(supplierId).get();
    if (!supplierSnap.exists) return null;
    
    const sectorsSnap = await db.collection('events').doc(eventId).collection('sectors').get();
    const sectors = getCollectionData<Sector>(sectorsSnap);

    return {
        data: { ...getData<Supplier>(supplierSnap), eventId },
        name: eventSnap.data()?.name || 'Evento',
        sectors,
    };
};

export const getRegistrationsCountForSupplier = async (eventId: string, supplierId: string): Promise<number> => {
    const snapshot = await db.collection('events').doc(eventId).collection('attendees').where('supplierId', '==', supplierId).get();
    return snapshot.size;
};

export const getSupplierAdminData = async (token: string): Promise<{ eventName: string, attendees: Attendee[], eventId: string, supplierId: string } | null> => {
    const suppliersSnap = await db.collectionGroup('suppliers').where('adminToken', '==', token).limit(1).get();
    if (suppliersSnap.empty) return null;
    
    const supplierDoc = suppliersSnap.docs[0];
    const supplier = getData<Supplier>(supplierDoc);
    const eventRef = supplierDoc.ref.parent.parent;
    
    if (!eventRef) return null;
    
    const eventSnap = await eventRef.get();
    const eventName = eventSnap.data()?.name || 'Evento';
    
    const attendeesSnap = await eventRef.collection('attendees').where('supplierId', '==', supplier.id).get();
    const attendees = getCollectionData<Attendee>(attendeesSnap);
    
    return { eventName: eventName, attendees, eventId: eventRef.id, supplierId: supplier.id };
};

export const regenerateSupplierAdminToken = async (eventId: string, supplierId: string): Promise<string> => {
    const newToken = uuidv4();
    await updateSupplier(eventId, supplierId, { adminToken: newToken });
    return newToken;
};

// Sector Management
export const addSector = (eventId: string, label: string, color: string) => {
    return db.collection('events').doc(eventId).collection('sectors').add({ label, color });
};

export const updateSector = (eventId: string, sectorId: string, data: { label: string, color: string }) => {
    return db.collection('events').doc(eventId).collection('sectors').doc(sectorId).update(data);
};

export const deleteSector = async (eventId: string, sectorId: string) => {
    // Check if sector is in use by any supplier or attendee
    const suppliersSnap = await db.collection('events').doc(eventId).collection('suppliers').where('sectors', 'array-contains', sectorId).get();
    const attendeesSnap = await db.collection('events').doc(eventId).collection('attendees').where('sectors', 'array-contains', sectorId).get();

    if (!suppliersSnap.empty || !attendeesSnap.empty) {
        throw new Error('Sector is in use and cannot be deleted.');
    }
    return db.collection('events').doc(eventId).collection('sectors').doc(sectorId).delete();
};