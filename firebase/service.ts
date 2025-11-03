import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import { db, storage, FieldValue, Timestamp } from './config.ts';
import { Attendee, CheckinStatus, Event, Supplier, Sector, SubCompany, User } from '../types.ts';
import { v4 as uuidv4 } from 'uuid';

// Helper to extract data and id from snapshots
const getData = <T>(doc: firebase.firestore.DocumentSnapshot): T => ({ id: doc.id, ...doc.data() } as T);
const getCollectionData = <T>(querySnapshot: firebase.firestore.QuerySnapshot): T[] => querySnapshot.docs.map(doc => getData<T>(doc));

// Event Management
export const getEvents = async (): Promise<Event[]> => {
    const snapshot = await db.collection('events').orderBy('name', 'asc').get();
    return getCollectionData<Event>(snapshot);
};

export const createEvent = (name: string): Promise<firebase.firestore.DocumentReference> => {
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
    const data = {
        attendees: [] as Attendee[],
        suppliers: [] as Supplier[],
        sectors: [] as Sector[],
    };

    const updateCallback = () => {
        // Create a shallow copy to ensure React detects the change
        callback({ ...data });
    };

    const attendeesUnsub = db.collection('events').doc(eventId).collection('attendees').onSnapshot(snap => {
        data.attendees = getCollectionData<Attendee>(snap);
        updateCallback();
    }, onError);

    const suppliersUnsub = db.collection('events').doc(eventId).collection('suppliers').onSnapshot(snap => {
        data.suppliers = getCollectionData<Supplier>(snap);
        updateCallback();
    }, onError);
    
    const sectorsUnsub = db.collection('events').doc(eventId).collection('sectors').onSnapshot(snap => {
        data.sectors = getCollectionData<Sector>(snap);
        updateCallback();
    }, onError);


    // Return a function that unsubscribes from all listeners
    return () => {
        attendeesUnsub();
        suppliersUnsub();
        sectorsUnsub();
    };
};

// Attendee Management
export const getAttendees = async (eventId: string): Promise<Attendee[]> => {
    const snapshot = await db.collection('events').doc(eventId).collection('attendees').get();
    return getCollectionData<Attendee>(snapshot);
};

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
    // If the provided string is already a downloadable URL (from spreadsheet), just return it.
    if (photoDataUrl.startsWith('http://') || photoDataUrl.startsWith('https://')) {
        return photoDataUrl;
    }
    // Otherwise, assume it's a base64 Data URL and upload it.
    const blob = await (await fetch(photoDataUrl)).blob();
    const ref = storage.ref(`photos/${cpf}-${Date.now()}.png`);
    const snapshot = await ref.put(blob);
    return snapshot.ref.getDownloadURL();
};


export const addAttendee = async (eventId: string, attendeeData: Omit<Attendee, 'id' | 'status' | 'eventId' | 'createdAt'>, supplierId?: string) => {
    // Check if photo is a data URL that needs uploading
    let photoUrl = attendeeData.photo;
    if (attendeeData.photo.startsWith('data:image') || !attendeeData.photo.startsWith('http')) {
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

export const requestNewRegistration = async (eventId: string, attendeeData: Omit<Attendee, 'id' | 'status' | 'eventId' | 'createdAt'>, supplierId: string) => {
    let photoUrl = attendeeData.photo;
    if (attendeeData.photo.startsWith('data:image')) {
        photoUrl = await uploadPhoto(attendeeData.photo, attendeeData.cpf);
    }

    const data: Omit<Attendee, 'id'> = {
        ...attendeeData,
        photo: photoUrl,
        eventId,
        status: CheckinStatus.PENDING_APPROVAL,
        createdAt: Timestamp.now(),
        supplierId,
    };

    return db.collection('events').doc(eventId).collection('attendees').add(data);
};

export const approveNewRegistration = (eventId: string, attendeeId: string) => {
    return db.collection('events').doc(eventId).collection('attendees').doc(attendeeId).update({
        status: CheckinStatus.PENDING,
    });
};

export const rejectNewRegistration = (eventId: string, attendeeId: string) => {
    return db.collection('events').doc(eventId).collection('attendees').doc(attendeeId).delete();
};


export const updateAttendeeStatus = (eventId: string, attendeeId: string, status: CheckinStatus, username: string, wristbands?: { [sectorId: string]: string }) => {
    const dataToUpdate: any = { status };

    switch (status) {
        case CheckinStatus.CHECKED_IN:
            dataToUpdate.checkinTime = FieldValue.serverTimestamp();
            dataToUpdate.checkedInBy = username;
            dataToUpdate.checkoutTime = FieldValue.delete();
            dataToUpdate.checkedOutBy = FieldValue.delete();
            if (wristbands !== undefined) {
                dataToUpdate.wristbands = wristbands;
            }
            break;
        case CheckinStatus.CHECKED_OUT:
            dataToUpdate.checkoutTime = FieldValue.serverTimestamp();
            dataToUpdate.checkedOutBy = username;
            break;
        case CheckinStatus.PENDING:
            // This handles cancelling a check-in or checkout
            dataToUpdate.checkinTime = FieldValue.delete();
            dataToUpdate.checkoutTime = FieldValue.delete();
            dataToUpdate.wristbands = FieldValue.delete();
            dataToUpdate.checkedInBy = FieldValue.delete();
            dataToUpdate.checkedOutBy = FieldValue.delete();
            break;
    }

    return db.collection('events').doc(eventId).collection('attendees').doc(attendeeId).update(dataToUpdate);
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

    const { name, cpf, photo: photoDataUrl, newSectorIds } = attendee.substitutionData;

    // VALIDATION: Ensure critical data exists before creating the update object.
    // This prevents accidental deletion of fields if substitutionData is malformed.
    if (typeof name !== 'string' || name.trim() === '') {
        throw new Error("Invalid substitution data: name is missing or invalid.");
    }
    if (typeof cpf !== 'string' || cpf.trim() === '') {
        throw new Error("Invalid substitution data: CPF is missing or invalid.");
    }

    const dataToUpdate: any = {
        name: name.trim(),
        cpf: cpf.trim(),
        status: CheckinStatus.PENDING,
        substitutionData: FieldValue.delete(),
    };

    // Only upload and update photo if a new base64 photo is provided
    if (photoDataUrl && photoDataUrl.startsWith('data:image')) {
        const photoUrl = await uploadPhoto(photoDataUrl, cpf);
        dataToUpdate.photo = photoUrl;
    }

    if (newSectorIds && Array.isArray(newSectorIds) && newSectorIds.length > 0) {
        dataToUpdate.sectors = newSectorIds;
    }

    return attendeeRef.update(dataToUpdate);
};

export const rejectSubstitution = (eventId: string, attendeeId: string) => {
    return db.collection('events').doc(eventId).collection('attendees').doc(attendeeId).update({
        status: CheckinStatus.PENDING,
        substitutionData: FieldValue.delete(),
    });
};

export const requestSectorChange = async (eventId: string, attendeeId: string, sectorChangeData: Required<Attendee>['sectorChangeData']) => {
    return db.collection('events').doc(eventId).collection('attendees').doc(attendeeId).update({
        status: CheckinStatus.SECTOR_CHANGE_REQUEST,
        sectorChangeData: sectorChangeData,
    });
};

export const approveSectorChange = async (eventId: string, attendeeId: string) => {
    const attendeeRef = db.collection('events').doc(eventId).collection('attendees').doc(attendeeId);
    const doc = await attendeeRef.get();
    const attendee = doc.data() as Attendee;

    if (!attendee || !attendee.sectorChangeData) {
        throw new Error("Sector change data not found for this attendee.");
    }
    
    const { newSectorId } = attendee.sectorChangeData;

    return attendeeRef.update({
        sectors: [newSectorId],
        status: CheckinStatus.PENDING,
        sectorChangeData: FieldValue.delete(),
    });
};

export const rejectSectorChange = (eventId: string, attendeeId: string) => {
    return db.collection('events').doc(eventId).collection('attendees').doc(attendeeId).update({
        status: CheckinStatus.PENDING,
        sectorChangeData: FieldValue.delete(),
    });
};

export const updateSectorsForAttendees = async (eventId: string, attendeeIds: string[], sectorIds: string[]) => {
    if (attendeeIds.length === 0) {
        return;
    }

    const batch = db.batch();
    attendeeIds.forEach(attendeeId => {
        const docRef = db.collection('events').doc(eventId).collection('attendees').doc(attendeeId);
        batch.update(docRef, { sectors: sectorIds });
    });

    await batch.commit();
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

export const subscribeToSupplierForRegistration = (
    eventId: string,
    supplierId: string,
    callback: (data: { data: Supplier & { eventId: string }, name: string, sectors: Sector[] } | null) => void,
    onError: (error: Error) => void
) => {
    const data = {
        eventName: null as string | null,
        supplier: null as (Supplier & { eventId: string }) | null,
        allSectors: null as Sector[] | null,
    };

    const updateCallback = () => {
        if (data.eventName !== null && data.supplier !== null && data.allSectors !== null) {
            const { eventName, supplier, allSectors } = data;
            const validSectorIds = new Set(allSectors.map(s => s.id));
            const dataForUI = { ...supplier };
            dataForUI.sectors = (supplier.sectors || []).filter(sectorId => validSectorIds.has(sectorId));
            dataForUI.subCompanies = (supplier.subCompanies || []).filter(sc => validSectorIds.has(sc.sector));
            callback({ data: dataForUI, name: eventName, sectors: allSectors });
        }
    };
    
    let unsubscribes: (()=>void)[] = [];
    const cleanup = () => unsubscribes.forEach(unsub => unsub());

    const handleError = (error: Error) => {
        cleanup();
        onError(error);
    };

    const eventUnsub = db.collection('events').doc(eventId).onSnapshot(eventSnap => {
        if (!eventSnap.exists) {
            handleError(new Error("Event not found"));
            return;
        }
        data.eventName = eventSnap.data()?.name || 'Evento';
        updateCallback();
    }, handleError);
    unsubscribes.push(eventUnsub);

    const supplierUnsub = db.collection('events').doc(eventId).collection('suppliers').doc(supplierId).onSnapshot(supplierSnap => {
        if (!supplierSnap.exists) {
            handleError(new Error("Supplier not found"));
            return;
        }
        data.supplier = { ...getData<Supplier>(supplierSnap), eventId };
        updateCallback();
    }, handleError);
    unsubscribes.push(supplierUnsub);

    const sectorsUnsub = db.collection('events').doc(eventId).collection('sectors').onSnapshot(sectorsSnap => {
        data.allSectors = getCollectionData<Sector>(sectorsSnap);
        updateCallback();
    }, handleError);
    unsubscribes.push(sectorsUnsub);

    return cleanup;
};

export const getRegistrationsCountForSupplier = async (eventId: string, supplierId: string): Promise<number> => {
    const snapshot = await db.collection('events').doc(eventId).collection('attendees').where('supplierId', '==', supplierId).get();
    return snapshot.size;
};

export const subscribeToSupplierAdminData = (
    token: string,
    callback: (data: { eventName: string, attendees: Attendee[], eventId: string, supplierId: string, supplier: Supplier, sectors: Sector[] }) => void,
    onError: (error: Error) => void
) => {
    let unsubscribes: (() => void)[] = [];

    const findAndSubscribe = async () => {
        // Clean up previous listeners if this function is ever called again for the same token
        unsubscribes.forEach(unsub => unsub());
        unsubscribes = [];

        const suppliersSnap = await db.collectionGroup('suppliers').where('adminToken', '==', token).limit(1).get();
        if (suppliersSnap.empty) {
            onError(new Error("Invalid token"));
            return;
        }

        const supplierDoc = suppliersSnap.docs[0];
        const eventRef = supplierDoc.ref.parent.parent;

        if (!eventRef) {
            onError(new Error("Event not found for supplier"));
            return;
        }

        let eventName: string | null = null;
        let supplier: Supplier | null = null;
        let sectors: Sector[] | null = null;
        let attendees: Attendee[] | null = null;
        
        const eventId = eventRef.id;

        const updateCallback = () => {
            // Only fire callback once all data sources have loaded at least once
            if (eventName !== null && supplier !== null && sectors !== null && attendees !== null) {
                callback({ eventName, attendees, eventId, supplierId: supplier.id, supplier, sectors });
            }
        };

        const eventSnap = await eventRef.get();
        if (eventSnap.exists) {
            eventName = eventSnap.data()?.name || 'Evento';
        } else {
            onError(new Error("Event data could not be retrieved."));
            return;
        }

        const supplierUnsub = supplierDoc.ref.onSnapshot(doc => {
            supplier = getData<Supplier>(doc);
            updateCallback();
        }, onError);
        unsubscribes.push(supplierUnsub);

        const sectorsUnsub = eventRef.collection('sectors').onSnapshot(snap => {
            sectors = getCollectionData<Sector>(snap);
            updateCallback();
        }, onError);
        unsubscribes.push(sectorsUnsub);

        const attendeesUnsub = eventRef.collection('attendees').where('supplierId', '==', supplierDoc.id).onSnapshot(attendeesSnap => {
            attendees = getCollectionData<Attendee>(attendeesSnap);
            updateCallback();
        }, onError);
        unsubscribes.push(attendeesUnsub);
    };

    findAndSubscribe().catch(onError);

    // Return a function to clean up all listeners
    return () => unsubscribes.forEach(unsub => unsub());
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


// User Management
export const authenticateUser = async (username: string, password: string): Promise<User | null> => {
    const snapshot = await db.collection('users').where('username', '==', username).limit(1).get();
    if (snapshot.empty) {
        return null;
    }
    const user = getData<User>(snapshot.docs[0]);
    // Note: In a real-world application, passwords should be hashed and compared securely.
    if (user.password === password) {
        const { password: _, ...userWithoutPassword } = user;
        return userWithoutPassword as User;
    }
    return null;
};

export const getUsers = async (): Promise<User[]> => {
    const snapshot = await db.collection('users').orderBy('username', 'asc').get();
    // Exclude passwords from the data sent to the client
    return snapshot.docs.map(doc => {
        const data = doc.data();
        delete data.password;
        return { id: doc.id, ...data } as User;
    });
};

export const createUser = async (userData: Omit<User, 'id'>) => {
    // Check for unique username server-side
    const snapshot = await db.collection('users').where('username', '==', userData.username).get();
    if (!snapshot.empty) {
        throw new Error("Username already exists.");
    }
    return db.collection('users').add(userData);
};

export const updateUser = (id: string, data: Partial<User>) => {
    // If password is an empty string or undefined, don't update it.
    if (!data.password) {
        delete data.password;
    }
    return db.collection('users').doc(id).update(data);
};

export const deleteUser = (id: string) => {
    return db.collection('users').doc(id).delete();
};