import { collection, addDoc, onSnapshot, doc, updateDoc, query, where, getDocs, serverTimestamp, orderBy, deleteDoc } from "firebase/firestore";
import { ref, uploadString, getDownloadURL, deleteObject } from "firebase/storage";
import { db, storage } from './config';
import { Attendee, Supplier, Event } from "../types";

const EVENTS_COLLECTION = 'events';
const ATTENDEES_COLLECTION = 'attendees';
const SUPPLIERS_COLLECTION = 'suppliers';

// === EVENT FUNCTIONS ===

export const onEventsUpdate = (
    callback: (events: Event[]) => void,
    onError: (error: Error) => void
) => {
    const q = query(collection(db, EVENTS_COLLECTION), orderBy('createdAt', 'desc'));
    return onSnapshot(q,
        (querySnapshot) => {
            const events: Event[] = [];
            querySnapshot.forEach((doc) => {
                events.push({ id: doc.id, ...doc.data() } as Event);
            });
            callback(events);
        },
        (error) => {
            console.error('Error listening to events collection:', error.message);
            onError(error);
        }
    );
};

export const addEvent = (eventName: string) => {
    return addDoc(collection(db, EVENTS_COLLECTION), {
        name: eventName,
        createdAt: serverTimestamp(),
    });
};

export const updateEvent = (eventId: string, eventName: string) => {
    const eventDocRef = doc(db, EVENTS_COLLECTION, eventId);
    return updateDoc(eventDocRef, { name: eventName });
};

export const deleteEvent = (eventId: string) => {
    // Note: This only deletes the event document. Subcollections (attendees, suppliers)
    // are not automatically deleted by this client-side operation.
    // For a production app, a Cloud Function would be needed to handle cascading deletes.
    const eventDocRef = doc(db, EVENTS_COLLECTION, eventId);
    return deleteDoc(eventDocRef);
};


// === ATTENDEE FUNCTIONS (scoped by event) ===

const uploadPhoto = async (eventId: string, photoDataUrl: string): Promise<string> => {
    const fileName = `photo_${Date.now()}.png`;
    const storageRef = ref(storage, `events/${eventId}/attendee-photos/${fileName}`);
    const uploadResult = await uploadString(storageRef, photoDataUrl, 'data_url');
    return await getDownloadURL(uploadResult.ref);
};

export const onAttendeesUpdate = (
  eventId: string,
  callback: (attendees: Attendee[]) => void,
  onError: (error: Error) => void
) => {
  const attendeesColRef = collection(db, EVENTS_COLLECTION, eventId, ATTENDEES_COLLECTION);
  const q = query(attendeesColRef);
  return onSnapshot(q, 
    (querySnapshot) => {
        const attendees: Attendee[] = [];
        querySnapshot.forEach((doc) => {
            attendees.push({ id: doc.id, ...doc.data() } as Attendee);
        });
        callback(attendees);
    },
    (error) => {
        console.error(`Error listening to attendees for event ${eventId}:`, error.message);
        onError(error);
    }
  );
};

export const addAttendee = async (eventId: string, attendee: Omit<Attendee, 'id'>): Promise<void> => {
    try {
        const attendeesColRef = collection(db, EVENTS_COLLECTION, eventId, ATTENDEES_COLLECTION);
        const q = query(attendeesColRef, where("cpf", "==", attendee.cpf));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
          const error: any = new Error("An attendee with this CPF is already registered for this event.");
          error.code = 'duplicate-cpf';
          throw error;
        }

        const photoURL = await uploadPhoto(eventId, attendee.photo);
        const attendeeData = { ...attendee, photo: photoURL };
        await addDoc(attendeesColRef, attendeeData);
    } catch (e: any) {
        console.error('Error adding document:', e.message);
        throw e;
    }
}

export const updateAttendee = async (eventId: string, id: string, updates: Partial<Attendee>): Promise<void> => {
    const attendeeDocRef = doc(db, EVENTS_COLLECTION, eventId, ATTENDEES_COLLECTION, id);
    try {
        await updateDoc(attendeeDocRef, updates);
    } catch (e: any) {
        console.error('Error updating document:', e.message);
        throw e;
    }
}

// === SUPPLIER FUNCTIONS (scoped by event) ===

export const onSuppliersUpdate = (
  eventId: string,
  callback: (suppliers: Supplier[]) => void,
  onError: (error: Error) => void
) => {
  const suppliersColRef = collection(db, EVENTS_COLLECTION, eventId, SUPPLIERS_COLLECTION);
  const q = query(suppliersColRef);
  return onSnapshot(q,
    (querySnapshot) => {
      const suppliers: Supplier[] = [];
      querySnapshot.forEach((doc) => {
        suppliers.push({ id: doc.id, ...doc.data() } as Supplier);
      });
      callback(suppliers);
    },
    (error) => {
      console.error(`Error listening to suppliers for event ${eventId}:`, error.message);
      onError(error);
    }
  );
};

export const addSupplier = async (eventId: string, supplier: Omit<Supplier, 'id'>): Promise<void> => {
    try {
        const suppliersColRef = collection(db, EVENTS_COLLECTION, eventId, SUPPLIERS_COLLECTION);
        const q = query(suppliersColRef, where("slug", "==", supplier.slug));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
            const error: any = new Error("A supplier with this name/slug already exists for this event.");
            error.code = 'duplicate-slug';
            throw error;
        }
        await addDoc(suppliersColRef, { ...supplier, isRegistrationEnabled: true });
    } catch (e: any) {
        console.error('Error adding supplier:', e.message);
        throw e;
    }
};

export const updateSupplier = async (eventId: string, supplierId: string, updates: Partial<Supplier>): Promise<void> => {
    const supplierDocRef = doc(db, EVENTS_COLLECTION, eventId, SUPPLIERS_COLLECTION, supplierId);
    try {
        await updateDoc(supplierDocRef, updates);
    } catch (e: any) {
        console.error('Error updating supplier:', e.message);
        throw e;
    }
};