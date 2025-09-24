import { db, storage } from './config';
import firebase from 'firebase/compat/app';
import { Attendee, Event, Supplier, Sector, CheckinStatus } from '../types';

// =================================================================================================
// INDEXING NOTE FOR `findAttendeeByCpf`
// =================================================================================================
// For the `findAttendeeByCpf` function to work, you must create a composite index in Firestore.
// This is because it performs a query across all 'attendees' subcollections (a "collection group query").
//
// HOW TO CREATE THE INDEX:
// 1. Go to your Firebase Console.
// 2. Navigate to "Build > Firestore Database > Indexes".
// 3. Click "Create Index".
// 4. Collection ID: `attendees`
// 5. Fields to index:
//    - `cpf` -> Ascending
// 6. Query Scopes: `Collection Group`
// 7. Click "Create".
//
// The index will take a few minutes to build. The query will fail until it's ready.
// The error message in the console will often include a direct link to create the required index.
// =================================================================================================


// --- Event Management ---

export const getEvents = async (): Promise<Event[]> => {
  const snapshot = await db.collection('events').orderBy('createdAt', 'desc').get();
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Event));
};

export const getEvent = async (eventId: string): Promise<Event | null> => {
    const doc = await db.collection('events').doc(eventId).get();
    if (!doc.exists) {
        return null;
    }
    return { id: doc.id, ...doc.data() } as Event;
};

export const addEvent = async (name: string): Promise<void> => {
  await db.collection('events').add({
    name,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
};

export const updateEvent = async (eventId: string, name: string): Promise<void> => {
  await db.collection('events').doc(eventId).update({ name });
};

export const deleteEvent = async (eventId: string): Promise<void> => {
    const eventRef = db.collection('events').doc(eventId);
    const collectionsToDelete = ['attendees', 'suppliers', 'sectors'];

    const batch = db.batch();

    for (const collectionName of collectionsToDelete) {
        const snapshot = await eventRef.collection(collectionName).get();
        snapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
        });
    }
    
    // In a real-world app, you'd also list all files in `event_photos/${eventId}/` and delete them from Storage.
    // This is a more complex operation often best handled by a Cloud Function for robustness.

    batch.delete(eventRef);
    await batch.commit();
};


// --- Attendee Management ---

// Utility to upload photo and get URL
const uploadPhoto = async (eventId: string, photoDataUrl: string, cpf: string): Promise<string> => {
  const fileName = `${cpf}-${Date.now()}.png`;
  const storageRef = storage.ref(`event_photos/${eventId}/${fileName}`);
  const response = await storageRef.putString(photoDataUrl, 'data_url');
  return response.ref.getDownloadURL();
};

export const addAttendee = async (eventId: string, attendeeData: Omit<Attendee, 'id' | 'status' | 'eventId' | 'createdAt'>): Promise<void> => {
  const photoUrl = await uploadPhoto(eventId, attendeeData.photo, attendeeData.cpf);
  
  await db.collection('events').doc(eventId).collection('attendees').add({
    ...attendeeData,
    photo: photoUrl,
    status: CheckinStatus.PENDING,
    eventId: eventId,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
};

export const registerAttendeeForSupplier = async (eventId: string, supplierId: string, attendeeData: Omit<Attendee, 'id' | 'status' | 'eventId' | 'createdAt' | 'supplierId'>): Promise<void> => {
  const photoUrl = await uploadPhoto(eventId, attendeeData.photo, attendeeData.cpf);

  await db.collection('events').doc(eventId).collection('attendees').add({
      ...attendeeData,
      photo: photoUrl,
      status: CheckinStatus.PENDING,
      eventId: eventId,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      supplierId: supplierId,
  });
};


export const listenToAttendees = (
    eventId: string, 
    callback: (attendees: Attendee[]) => void, 
    onError: (error: Error) => void
): (() => void) => {
  return db.collection('events').doc(eventId).collection('attendees')
    .orderBy('name', 'asc')
    .onSnapshot(
      snapshot => {
        const attendees = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Attendee));
        callback(attendees);
      },
      error => {
        console.error("Error listening to attendees:", error);
        onError(error);
      }
    );
};

export const updateAttendeeStatus = async (eventId: string, attendeeId: string, newStatus: CheckinStatus): Promise<void> => {
  await db.collection('events').doc(eventId).collection('attendees').doc(attendeeId).update({
    status: newStatus,
  });
};

export const isCpfRegisteredInEvent = async (eventId: string, cpf: string): Promise<boolean> => {
    const snapshot = await db.collection('events').doc(eventId).collection('attendees').where('cpf', '==', cpf).limit(1).get();
    return !snapshot.empty;
};

export const findAttendeeByCpf = async (cpf: string): Promise<Attendee | null> => {
    try {
        const snapshot = await db.collectionGroup('attendees').where('cpf', '==', cpf).limit(1).get();
        if (snapshot.empty) {
            return null;
        }
        const doc = snapshot.docs[0];
        return { id: doc.id, ...doc.data() } as Attendee;
    } catch (error) {
        // This catch block is crucial for diagnosing missing Firestore indexes.
        console.error("Error in findAttendeeByCpf (check Firestore indexes):", error);
        throw error; // Re-throw the error to be handled by the caller
    }
};

// --- Supplier Management ---

export const listenToSuppliers = (
    eventId: string,
    callback: (suppliers: Supplier[]) => void,
    onError: (error: Error) => void
): (() => void) => {
    return db.collection('events').doc(eventId).collection('suppliers')
        .onSnapshot(
            snapshot => {
                const suppliers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Supplier));
                callback(suppliers);
            },
            error => {
                console.error("Error listening to suppliers:", error);
                onError(error);
            }
        );
};

export const getSupplier = async (eventId: string, supplierId: string): Promise<Supplier | null> => {
    const doc = await db.collection('events').doc(eventId).collection('suppliers').doc(supplierId).get();
    if (!doc.exists) {
        return null;
    }
    return { id: doc.id, ...doc.data() } as Supplier;
};


export const addSupplier = async (eventId: string, name: string, sectors: string[], registrationLimit: number): Promise<void> => {
    await db.collection('events').doc(eventId).collection('suppliers').add({
        name,
        sectors,
        registrationLimit,
        active: true
    });
};

export const updateSupplier = async (eventId: string, supplierId: string, data: Partial<Supplier>): Promise<void> => {
    await db.collection('events').doc(eventId).collection('suppliers').doc(supplierId).update(data);
};

export const updateSupplierStatus = async (eventId: string, supplierId: string, active: boolean): Promise<void> => {
    await db.collection('events').doc(eventId).collection('suppliers').doc(supplierId).update({ active });
};

export const getAttendeeCountForSupplier = async (eventId: string, supplierId: string): Promise<number> => {
    const snapshot = await db.collection('events').doc(eventId).collection('attendees')
        .where('supplierId', '==', supplierId)
        .get();
    return snapshot.size;
};


// --- Sector Management ---

export const listenToSectors = (
    eventId: string,
    callback: (sectors: Sector[]) => void,
    onError: (error: Error) => void
): (() => void) => {
    return db.collection('events').doc(eventId).collection('sectors')
        .orderBy('label', 'asc')
        .onSnapshot(
            snapshot => {
                const sectors = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Sector));
                callback(sectors);
            },
            error => {
                console.error("Error listening to sectors:", error);
                onError(error);
            }
        );
};

export const getSectors = async (eventId: string): Promise<Sector[]> => {
    const snapshot = await db.collection('events').doc(eventId).collection('sectors').orderBy('label', 'asc').get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Sector));
};

export const addSector = async (eventId: string, label: string): Promise<void> => {
    const normalizedLabel = label.trim().toLowerCase();
    const id = normalizedLabel.replace(/\s+/g, '-').replace(/[^\w-]/g, ''); // e.g., "Staff Member" -> "staff-member"

    if (!id) {
        throw new Error("Invalid sector label, results in empty ID.");
    }

    const sectorRef = db.collection('events').doc(eventId).collection('sectors').doc(id);
    const doc = await sectorRef.get();
    if (doc.exists) {
        throw new Error(`O setor '${label}' já existe.`);
    }

    await sectorRef.set({ label });
};

export const updateSector = async (eventId: string, sectorId: string, label: string): Promise<void> => {
    await db.collection('events').doc(eventId).collection('sectors').doc(sectorId).update({ label });
};

export const deleteSector = async (eventId: string, sectorId: string): Promise<void> => {
    // Check if any attendee is using this sector
    const attendeeSnapshot = await db.collection('events').doc(eventId).collection('attendees')
        .where('sector', '==', sectorId)
        .limit(1)
        .get();

    if (!attendeeSnapshot.empty) {
        throw new Error('Sector is in use and cannot be deleted.');
    }

    // Check if any supplier is using this sector
    const supplierSnapshot = await db.collection('events').doc(eventId).collection('suppliers')
        .where('sectors', 'array-contains', sectorId)
        .limit(1)
        .get();
    
    if (!supplierSnapshot.empty) {
        throw new Error('Sector is in use and cannot be deleted.');
    }

    await db.collection('events').doc(eventId).collection('sectors').doc(sectorId).delete();
};


// --- Spreadsheet Import ---

export const addAttendeesFromSpreadsheet = async (
    eventId: string, 
    data: any[],
    existingSectors: Sector[],
    existingAttendees: Attendee[]
): Promise<{ successCount: number; errors: { row: number; message: string }[] }> => {
    const batch = db.batch();
    const attendeesCollection = db.collection('events').doc(eventId).collection('attendees');
    const report = { successCount: 0, errors: [] as { row: number; message: string }[] };
    const cpfsInFile = new Set<string>();
    const existingCpfSet = new Set(existingAttendees.map(a => a.cpf));
    const existingSectorMap = new Map(existingSectors.map(s => [s.label.trim().toLowerCase(), s.id]));

    for (let i = 0; i < data.length; i++) {
        const row = data[i];
        const rowNum = i + 2; // +1 for 0-index, +1 for header row

        const name = row.nome?.trim();
        const cpf = row.cpf?.replace(/\D/g, '');
        const sectorLabel = row.setor?.trim().toLowerCase();

        // Validation
        if (!name || !cpf || !sectorLabel) {
            report.errors.push({ row: rowNum, message: "Campos 'nome', 'cpf' ou 'setor' estão faltando." });
            continue;
        }
        if (cpf.length !== 11) {
            report.errors.push({ row: rowNum, message: "CPF inválido" });
            continue;
        }
        if (cpfsInFile.has(cpf)) {
            report.errors.push({ row: rowNum, message: "CPF duplicado na planilha" });
            continue;
        }
        if (existingCpfSet.has(cpf)) {
            report.errors.push({ row: rowNum, message: "CPF já registrado no evento" });
            continue;
        }
        const sectorId = existingSectorMap.get(sectorLabel);
        if (!sectorId) {
            report.errors.push({ row: rowNum, message: `Setor '${row.setor}' não encontrado.` });
            continue;
        }
        
        // Find if this person exists in the database already (cross-event) to reuse photo/name
        const existingPerson = await findAttendeeByCpf(cpf);
        
        const newAttendee: Omit<Attendee, 'id'> = {
            name: existingPerson?.name || name,
            cpf: cpf,
            // Spreadsheets don't include photos. A placeholder or null could be used.
            // For this app, we assume we want to find an existing photo or leave it empty.
            // This means imported users without a prior registration will have no photo.
            photo: existingPerson?.photo || '', 
            sector: sectorId,
            status: CheckinStatus.PENDING,
            eventId: eventId,
            createdAt: firebase.firestore.FieldValue.serverTimestamp() as firebase.firestore.Timestamp,
        };

        const docRef = attendeesCollection.doc();
        batch.set(docRef, newAttendee);
        report.successCount++;
        cpfsInFile.add(cpf);
        existingCpfSet.add(cpf); // Add to set to catch duplicates within the same file being processed
    }

    if (report.successCount > 0) {
        await batch.commit();
    }

    return report;
};
