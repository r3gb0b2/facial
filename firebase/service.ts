import { collection, addDoc, onSnapshot, doc, updateDoc, query } from "firebase/firestore";
import { ref, uploadString, getDownloadURL } from "firebase/storage";
import { db, storage } from './config';
import { Attendee } from "../types";

const ATTENDEES_COLLECTION = 'attendees';

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
  // Query without orderBy to avoid needing a composite index in Firestore
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

  return unsubscribe; // Return the unsubscribe function to stop listening
};

// Function to add a new attendee
export const addAttendee = async (attendee: Omit<Attendee, 'id'>): Promise<void> => {
    try {
        // Upload the photo to Firebase Storage and get the URL
        const photoURL = await uploadPhoto(attendee.photo);

        // Create the attendee data object with the photo URL instead of the base64 string
        const attendeeData = {
            ...attendee,
            photo: photoURL,
        };
        
        // Add the new attendee document to Firestore
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