import { collection, addDoc, onSnapshot, doc, updateDoc, query, where, getDocs } from "firebase/firestore";
import { ref, uploadString, getDownloadURL } from "firebase/storage";
import { db, storage } from './config';
import { Attendee, Supplier } from "../types";

const ATTENDEES_COLLECTION = 'attendees';
const SUPPLIERS_COLLECTION = 'suppliers';

// Function to upload a photo to Firebase Storage
const uploadPhoto = async (photoDataUrl: string): Promise<string> => {
    // Create a unique file name for the photo
    const fileName = `photo_${Date.now()}_${Math.random().toString(36).substring(2, 9)}.png`;
    const storageRef = ref(storage, `attendee-photos/${fileName}`);

    // Upload the photo from the data URL (base64 string)
    const uploadResult = await uploadString(storageRef, photoDataUrl, 'data_url');
    
    // Get the public download URL for the uploaded file
    const downloadURL = await getDownloadURL(uploadResult.ref);
    return downloadURL;
};


// Function to listen for real-time updates on the attendees collection
export const onAttendeesUpdate = (
  callback: (attendees: Attendee[]) => void,
  onError: (error: Error) => void
) => {
  const q = query(collection(db, ATTENDEES_COLLECTION));
  const unsubscribe = onSnapshot(q, 
    (querySnapshot) => {
        const attendees: Attendee[] = [];
        querySnapshot.forEach((doc) => {
            attendees.push({ id: doc.id, ...doc.data() } as Attendee);
        });
        callback(attendees);
    },
    (error) => {
        console.error('Error listening to attendees collection:', error.message);
        onError(error);
    }
  );
  return unsubscribe;
};

// Function to add a new attendee
export const addAttendee = async (attendee: Omit<Attendee, 'id'>): Promise<void> => {
    try {
        const q = query(collection(db, ATTENDEES_COLLECTION), where("cpf", "==", attendee.cpf));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
          const error: any = new Error("An attendee with this CPF is already registered.");
          error.code = 'duplicate-cpf';
          throw error;
        }

        const photoURL = await uploadPhoto(attendee.photo);
        const attendeeData = { ...attendee, photo: photoURL };
        await addDoc(collection(db, ATTENDEES_COLLECTION), attendeeData);
    } catch (e: any) {
        console.error('Error adding document:', e.message);
        throw e;
    }
}

// Function to update an existing attendee
export const updateAttendee = async (id: string, updates: Partial<Attendee>): Promise<void> => {
    const attendeeDocRef = doc(db, ATTENDEES_COLLECTION, id);
    try {
        await updateDoc(attendeeDocRef, updates);
    } catch (e: any) {
        console.error('Error updating document:', e.message);
        throw e;
    }
}

// === SUPPLIER FUNCTIONS ===

// Function to listen for real-time updates on the suppliers collection
export const onSuppliersUpdate = (
  callback: (suppliers: Supplier[]) => void,
  onError: (error: Error) => void
) => {
  const q = query(collection(db, SUPPLIERS_COLLECTION));
  const unsubscribe = onSnapshot(q,
    (querySnapshot) => {
      const suppliers: Supplier[] = [];
      querySnapshot.forEach((doc) => {
        suppliers.push({ id: doc.id, ...doc.data() } as Supplier);
      });
      callback(suppliers);
    },
    (error) => {
      console.error('Error listening to suppliers collection:', error.message);
      onError(error);
    }
  );
  return unsubscribe;
};

// Function to add a new supplier
export const addSupplier = async (supplier: Omit<Supplier, 'id'>): Promise<void> => {
    try {
        // Check for duplicate slug before adding
        const q = query(collection(db, SUPPLIERS_COLLECTION), where("slug", "==", supplier.slug));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
            const error: any = new Error("A supplier with this name/slug already exists.");
            error.code = 'duplicate-slug';
            throw error;
        }
        await addDoc(collection(db, SUPPLIERS_COLLECTION), supplier);
    } catch (e: any) {
        console.error('Error adding supplier:', e.message);
        throw e;
    }
};
