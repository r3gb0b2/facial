import firebase from "firebase/compat/app";
import { db, storage, FieldValue } from './config.ts';
import { type Attendee, type Event, type Sector, type Supplier, CheckinStatus } from '../types.ts';

// Helper to convert Firestore doc to a typed object with ID
const fromDoc = <T extends { id: string }>(doc: firebase.firestore.DocumentSnapshot): T => {
    return { ...doc.data(), id: doc.id } as T;
};

// Helper to generate a secure random token
const generateToken = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let token = '';
    for (let i = 0; i < 20; i++) {
        token += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return token;
}

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
    
    // Also delete tokens associated with suppliers of this event
    const supplierTokensSnapshot = await db.collectionGroup('suppliers').where('eventId', '==', eventId).get();
    supplierTokensSnapshot.forEach(doc => {
        const supplier = fromDoc<Supplier>(doc);
        if (supplier.adminToken) {
             batch.delete(db.collection('supplier_tokens').doc(supplier.adminToken));
        }
        if (supplier.registrationToken) {
            batch.delete(db.collection('supplier_tokens').doc(supplier.registrationToken));
        }
    });

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
        data.wristbandNumber = FieldValue.delete();
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
    // You might also want to check if it's used by suppliers
    return db.collection('events').doc(eventId).collection('sectors').doc(sectorId).delete();
};


// =================================================================================================
// Supplier Management & Tokens
// =================================================================================================

export const subscribeToSuppliers = (eventId: string, callback: (suppliers: Supplier[]) => void) => {
    return db.collection('events').doc(eventId).collection('suppliers')
        .onSnapshot(snapshot => {
            const suppliers = snapshot.docs.map(doc => fromDoc<Supplier>(doc));
            callback(suppliers);
        });
};

export const addSupplier = (eventId: string, name: string, sectors: string[]) => {
    const batch = db.batch();
    const supplierRef = db.collection('events').doc(eventId).collection('suppliers').doc();
    const registrationToken = generateToken();
    const adminToken = generateToken();

    // Create supplier document
    batch.set(supplierRef, {
        eventId,
        name,
        sectors,
        registrationOpen: true,
        registrationToken,
        adminToken,
    });
    
    // Create token lookups
    const regTokenRef = db.collection('supplier_tokens').doc(registrationToken);
    batch.set(regTokenRef, { eventId, supplierId: supplierRef.id, type: 'registration' });
    
    const adminTokenRef = db.collection('supplier_tokens').doc(adminToken);
    batch.set(adminTokenRef, { eventId, supplierId: supplierRef.id, type: 'admin' });

    return batch.commit();
};

export const updateSupplier = (eventId: string, supplierId: string, data: Partial<Supplier>) => {
    return db.collection('events').doc(eventId).collection('suppliers').doc(supplierId).update(data);
};

export const deleteSupplier = async (eventId: string, supplierId: string) => {
    const batch = db.batch();
    const supplierRef = db.collection('events').doc(eventId).collection('suppliers').doc(supplierId);
    const supplierDoc = await supplierRef.get();
    const supplier = fromDoc<Supplier>(supplierDoc);

    // Delete tokens from lookup collection
    if (supplier.registrationToken) batch.delete(db.collection('supplier_tokens').doc(supplier.registrationToken));
    if (supplier.adminToken) batch.delete(db.collection('supplier_tokens').doc(supplier.adminToken));

    // Delete supplier document
    batch.delete(supplierRef);

    return batch.commit();
};

export const toggleSupplierRegistration = (eventId: string, supplierId: string, isOpen: boolean) => {
    return db.collection('events').doc(eventId).collection('suppliers').doc(supplierId).update({ registrationOpen: isOpen });
};

const regenerateToken = async (eventId: string, supplierId: string, tokenType: 'adminToken' | 'registrationToken') => {
    const batch = db.batch();
    const supplierRef = db.collection('events').doc(eventId).collection('suppliers').doc(supplierId);
    const supplierDoc = await supplierRef.get();
    const supplier = fromDoc<Supplier>(supplierDoc);

    // Delete old token if it exists
    const oldToken = supplier[tokenType];
    if (oldToken) {
        batch.delete(db.collection('supplier_tokens').doc(oldToken));
    }
    
    // Create new token
    const newToken = generateToken();
    const tokenDocRef = db.collection('supplier_tokens').doc(newToken);
    batch.set(tokenDocRef, { eventId, supplierId, type: tokenType === 'adminToken' ? 'admin' : 'registration' });

    // Update supplier with new token
    batch.update(supplierRef, { [tokenType]: newToken });

    return batch.commit();
};

export const regenerateSupplierAdminToken = (eventId: string, supplierId: string) => {
    return regenerateToken(eventId, supplierId, 'adminToken');
};

export const regenerateSupplierRegistrationToken = (eventId: string, supplierId: string) => {
    return regenerateToken(eventId, supplierId, 'registrationToken');
};

// Robust function to get supplier by any token
const getSupplierByToken = async (token: string, expectedType: 'admin' | 'registration'): Promise<Supplier> => {
    if (!token) throw new Error("Token inválido.");

    const tokenRef = db.collection('supplier_tokens').doc(token);
    const tokenDoc = await tokenRef.get();
    if (!tokenDoc.exists) {
        throw new Error("O link é inválido ou expirou. Por favor, solicite um novo link ao administrador.");
    }
    const tokenData = tokenDoc.data();
    if (tokenData?.type !== expectedType) {
        throw new Error("Tipo de link incorreto.");
    }
    const { eventId, supplierId } = tokenData;
    if (!eventId || !supplierId) {
        throw new Error("Link corrompido. Contate o suporte.");
    }

    const supplierRef = db.collection('events').doc(eventId).collection('suppliers').doc(supplierId);
    const supplierDoc = await supplierRef.get();
    if (!supplierDoc.exists) {
        throw new Error("O fornecedor associado a este link não foi encontrado.");
    }

    return fromDoc<Supplier>(supplierDoc);
};

export const getSupplierByRegistrationToken = (token: string) => {
    return getSupplierByToken(token, 'registration');
};


export const getSupplierDataForAdminView = async (token: string): Promise<{ data: Supplier, attendees: Attendee[] }> => {
    const supplier = await getSupplierByToken(token, 'admin');
    const attendeesSnapshot = await db.collection('events').doc(supplier.eventId).collection('attendees')
        .where('supplierId', '==', supplier.id).get();
    const attendees = attendeesSnapshot.docs.map(doc => fromDoc<Attendee>(doc));
    return { data: supplier, attendees };
};

export const getAttendeesForSupplier = async (supplierId: string): Promise<Attendee[]> => {
    const snapshot = await db.collectionGroup('attendees').where('supplierId', '==', supplierId).get();
    return snapshot.docs.map(doc => fromDoc<Attendee>(doc));
};