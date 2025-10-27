import { db, storage, FieldValue } from './config.ts';
import { Attendee, CheckinStatus, Event, Sector, Supplier } from '../types.ts';

// Helper to get eventId, otherwise throw error
const ensureEventId = (eventId?: string): string => {
    if (!eventId) throw new Error("Event ID is required for this operation.");
    return eventId;
};

// Helper to check if a string is a data URL
const isDataUrl = (s: string) => s.startsWith('data:image');


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
    
    // Check for existing CPF within the same event
    const existingAttendeeQuery = eventRef.collection('attendees').where('cpf', '==', attendeeData.cpf);
    const existingAttendeeSnapshot = await existingAttendeeQuery.get();
    if (!existingAttendeeSnapshot.empty) {
        throw new Error("Este CPF já foi cadastrado para este evento.");
    }
    
    const newAttendeeRef = eventRef.collection('attendees').doc();
    
    // If the photo is a new base64 string, upload it. Otherwise, use the existing URL.
    const photoUrl = isDataUrl(attendeeData.photo)
        ? await uploadPhoto(attendeeData.photo, newAttendeeRef.id)
        : attendeeData.photo;
    
    const newAttendee = {
        ...attendeeData,
        photo: photoUrl,
        status: CheckinStatus.PENDING,
        eventId,
        createdAt: FieldValue.serverTimestamp(),
    };

    await newAttendeeRef.set(newAttendee);
    return newAttendeeRef.id;
};

export const registerAttendeeForSupplier = async (
    eventId: string,
    supplierId: string,
    attendeeData: Omit<Attendee, 'id' | 'status' | 'eventId' | 'createdAt' | 'supplierId'>
): Promise<string> => {
    const eventRef = db.collection('events').doc(ensureEventId(eventId));
    const supplierRef = eventRef.collection('suppliers').doc(supplierId);
    const newAttendeeRef = eventRef.collection('attendees').doc();

    // If the photo is a new base64 string, upload it. Otherwise, use the existing URL.
    const photoUrl = isDataUrl(attendeeData.photo)
        ? await uploadPhoto(attendeeData.photo, newAttendeeRef.id)
        : attendeeData.photo;

    return db.runTransaction(async (transaction) => {
        const supplierDoc = await transaction.get(supplierRef);
        if (!supplierDoc.exists) {
            throw new Error("Fornecedor não encontrado.");
        }

        const supplier = supplierDoc.data() as Supplier;
        if (!supplier.active) {
            throw new Error("Este link de cadastro não está mais ativo.");
        }
        
        // Check for existing CPF within the same event
        const attendeesCollectionRef = eventRef.collection('attendees');
        const cpfQuery = attendeesCollectionRef.where('cpf', '==', attendeeData.cpf);
        const existingAttendeeSnapshot = await cpfQuery.get();
        if (!existingAttendeeSnapshot.empty) {
            throw new Error("Este CPF já foi cadastrado para este evento.");
        }

        const attendeesForSupplierQuery = eventRef.collection('attendees').where('supplierId', '==', supplierId);
        const attendeesForSupplierSnapshot = await attendeesForSupplierQuery.get();

        if (attendeesForSupplierSnapshot.size >= supplier.registrationLimit) {
            throw new Error("Limite de inscrições para este fornecedor foi atingido.");
        }
        
        const newAttendee = {
            ...attendeeData,
            photo: photoUrl,
            supplierId: supplierId,
            status: CheckinStatus.PENDING,
            eventId,
            createdAt: FieldValue.serverTimestamp(),
        };

        transaction.set(newAttendeeRef, newAttendee);
        return newAttendeeRef.id;
    });
};


export const updateAttendeeStatus = async (eventId: string, attendeeId: string, status: CheckinStatus, wristbandNumber?: string): Promise<void> => {
    const dataToUpdate: any = { status };
    // Only add the wristband number if the status is CHECKED_IN and a number is provided.
    // An empty string will clear the field.
    if (status === CheckinStatus.CHECKED_IN && typeof wristbandNumber !== 'undefined') {
        dataToUpdate.wristbandNumber = wristbandNumber;
    }
    const eventRef = db.collection('events').doc(eventId);
    await eventRef.collection('attendees').doc(attendeeId).update(dataToUpdate);
};

export const updateAttendeeDetails = async (eventId: string, attendeeId: string, data: Partial<Pick<Attendee, 'name' | 'cpf' | 'sector'>>): Promise<void> => {
    const eventRef = db.collection('events').doc(ensureEventId(eventId));
    await eventRef.collection('attendees').doc(attendeeId).update(data);
};

export const deleteAttendee = async (eventId: string, attendeeId: string): Promise<void> => {
    const eventRef = db.collection('events').doc(ensureEventId(eventId));
    const attendeeRef = eventRef.collection('attendees').doc(attendeeId);

    const attendeeDoc = await attendeeRef.get();
    if (!attendeeDoc.exists) {
        throw new Error("Attendee not found.");
    }

    const attendeeData = attendeeDoc.data() as Attendee;

    // Delete photo from storage, handle potential errors (e.g., placeholder URLs)
    if (attendeeData.photo && attendeeData.photo.includes('firebasestorage')) {
        try {
            const photoRef = storage.refFromURL(attendeeData.photo);
            await photoRef.delete();
        } catch (error) {
            console.warn(`Could not delete photo for attendee ${attendeeId}:`, error);
            // Don't block deletion of the record if photo deletion fails
        }
    }
    
    // Delete the Firestore document
    await attendeeRef.delete();
};


export const addAttendeesFromSpreadsheet = async (eventId: string, data: any[], existingSectors: Sector[], existingAttendees: Attendee[]): Promise<{ successCount: number; errors: { row: number; message: string }[] }> => {
    const eventRef = db.collection('events').doc(ensureEventId(eventId));
    const batch = db.batch();
    
    let successCount = 0;
    const errors: { row: number, message: string }[] = [];
    const cpfsInFile = new Set<string>();
    const existingCpfs = new Set(existingAttendees.map(a => a.cpf));

    for (const [index, row] of data.entries()) {
        const rowNum = index + 2;
        const { nome, cpf, setor } = row;
        const rawCpf = (cpf || '').replace(/\D/g, '');

        if (!nome || !rawCpf || !setor) {
            errors.push({ row: rowNum, message: 'Dados incompletos (nome, cpf e setor são obrigatórios).' });
            continue;
        }

        if (cpfsInFile.has(rawCpf) || existingCpfs.has(rawCpf)) {
             errors.push({ row: rowNum, message: `CPF ${cpf} já registrado.` });
             continue;
        }
        
        const sectorMatch = existingSectors.find(s => s.label.toLowerCase() === setor.toLowerCase().trim());
        if (!sectorMatch) {
            errors.push({ row: rowNum, message: `Setor "${setor}" não encontrado.` });
            continue;
        }

        const initials = nome.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase();
        const placeholderPhoto = `https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&background=random&color=fff&size=256`;
        
        const newAttendeeRef = eventRef.collection('attendees').doc();
        const newAttendee = {
            name: nome,
            cpf: rawCpf,
            sector: sectorMatch.id,
            photo: placeholderPhoto,
            status: CheckinStatus.PENDING,
            eventId,
            createdAt: FieldValue.serverTimestamp(),
        };
        batch.set(newAttendeeRef, newAttendee);
        cpfsInFile.add(rawCpf);
        successCount++;
    }

    if (successCount > 0) {
        await batch.commit();
    }

    return { successCount, errors };
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
        createdAt: FieldValue.serverTimestamp(),
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

/**
 * Fetches all sectors for a given event in a single call.
 * This is used for views that need the sector list upfront, like supplier registration.
 */
export const getSectorsForEvent = async (eventId: string): Promise<Sector[]> => {
    const eventRef = db.collection('events').doc(ensureEventId(eventId));
    const snapshot = await eventRef.collection('sectors').orderBy('label').get();
    return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
    } as Sector));
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

export const getAttendeeCountForSupplier = async (eventId: string, supplierId: string): Promise<number> => {
    const query = db.collection('events').doc(eventId).collection('attendees').where('supplierId', '==', supplierId);
    const snapshot = await query.get();
    return snapshot.size;
};


export const addSupplier = async (eventId: string, name: string, sectors: string[], registrationLimit: number, sectorColors: Record<string, string>): Promise<string> => {
    const eventRef = db.collection('events').doc(ensureEventId(eventId));
    const newSupplier = {
        name,
        sectors,
        registrationLimit,
        sectorColors,
        active: true,
    };
    const res = await eventRef.collection('suppliers').add(newSupplier);
    return res.id;
};

export const updateSupplier = async (eventId: string, supplierId: string, data: Partial<Supplier>): Promise<void> => {
    const eventRef = db.collection('events').doc(ensureEventId(eventId));
    await eventRef.collection('suppliers').doc(supplierId).update(data);
};

export const deleteSupplier = async (eventId: string, supplierId: string): Promise<void> => {
    const eventRef = db.collection('events').doc(ensureEventId(eventId));
    // Safety check: prevent deletion if the supplier has registered attendees.
    const attendeesSnapshot = await eventRef.collection('attendees').where('supplierId', '==', supplierId).limit(1).get();
    if (!attendeesSnapshot.empty) {
        throw new Error('Supplier has registered attendees and cannot be deleted.');
    }
    await eventRef.collection('suppliers').doc(supplierId).delete();
};