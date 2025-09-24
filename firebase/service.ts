// FIX: Rewrote all Firebase calls to use the v8 compatibility API to match the changes in firebase/config.ts.
// This ensures the application works correctly with older versions of the Firebase SDK.
import firebase from 'firebase/compat/app';
import { db, storage } from './config';
import { Attendee, CheckinStatus, Event, Supplier } from '../types';

const EVENTS_COLLECTION = 'events';
const ATTENDEES_COLLECTION = 'attendees';
const SUPPLIERS_COLLECTION = 'suppliers';


// Event Functions
export const getEvents = async (): Promise<Event[]> => {
  const q = db.collection(EVENTS_COLLECTION).orderBy('createdAt', 'desc');
  const querySnapshot = await q.get();
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Event));
};

export const getEvent = async (eventId: string): Promise<Event | null> => {
    const eventDoc = await db.collection(EVENTS_COLLECTION).doc(eventId).get();
    return eventDoc.exists ? { id: eventDoc.id, ...eventDoc.data() } as Event : null;
};


export const addEvent = (name: string): Promise<any> => {
  return db.collection(EVENTS_COLLECTION).add({
    name,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
};

export const updateEvent = (id: string, name: string): Promise<void> => {
  const eventDoc = db.collection(EVENTS_COLLECTION).doc(id);
  return eventDoc.update({ name });
};

export const deleteEvent = async (eventId: string): Promise<void> => {
  const batch = db.batch();

  // Delete all attendees and their photos
  const attendeesQuery = db.collection(EVENTS_COLLECTION).doc(eventId).collection(ATTENDEES_COLLECTION);
  const attendeesSnapshot = await attendeesQuery.get();
  for (const attendeeDoc of attendeesSnapshot.docs) {
    const attendee = attendeeDoc.data() as Omit<Attendee, 'id'>;
    if (attendee.photo) {
      try {
          const photoRef = storage.ref(`events/${eventId}/${attendeeDoc.id}.png`);
          await photoRef.delete();
      } catch (e) {
          console.error("Error deleting photo, it may not exist:", e);
      }
    }
    batch.delete(attendeeDoc.ref);
  }

  // Delete all suppliers
  const suppliersQuery = db.collection(EVENTS_COLLECTION).doc(eventId).collection(SUPPLIERS_COLLECTION);
  const suppliersSnapshot = await suppliersQuery.get();
  for (const supplierDoc of suppliersSnapshot.docs) {
      batch.delete(supplierDoc.ref);
  }

  await batch.commit();

  // Finally, delete the event document itself
  const eventDoc = db.collection(EVENTS_COLLECTION).doc(eventId);
  await eventDoc.delete();
};


// Attendee Functions
export const getAttendees = async (eventId: string): Promise<Attendee[]> => {
  const attendeesRef = db.collection(EVENTS_COLLECTION).doc(eventId).collection(ATTENDEES_COLLECTION);
  const q = attendeesRef.orderBy('name', 'asc');
  const querySnapshot = await q.get();
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Attendee));
};

// =================================================================================================
// ❌❌❌ AÇÃO OBRIGATÓRIA DO FIREBASE: CRIAR ÍNDICE COMPOSTO ❌❌❌
// =================================================================================================
// A FUNÇÃO `findAttendeeByCpf` ABAIXO USA UMA CONSULTA "COLLECTION GROUP".
// Este tipo de consulta, que busca em todas as subcoleções 'attendees' de uma só vez,
// exige um ÍNDICE COMPOSTO para funcionar. Sem ele, o Firebase retornará um erro de
// "failed-precondition" (pré-condição falhou), que a aplicação exibirá como
// "Erro de configuração: Índice do banco de dados ausente...".
//
// === COMO RESOLVER (AÇÃO MANUAL NO PAINEL DO FIREBASE): ===
//
// 1. ABRA SEU PROJETO NO FIREBASE CONSOLE: https://console.firebase.google.com/
// 2. NAVEGUE ATÉ "BUILD" > "FIRESTORE DATABASE".
// 3. CLIQUE NA ABA "ÍNDICES" (INDEXES) NA PARTE SUPERIOR.
// 4. CLIQUE EM "CRIAR ÍNDICE".
//
// 5. PREENCHA OS CAMPOS EXATAMENTE ASSIM:
//    - ID DA COLEÇÃO: attendees
//    - CAMPOS A INDEXAR:
//      - Campo 1: cpf
//      - Ordem: Crescente (Ascending)
//    - ESCOPO DA CONSULTA: Grupo de coleções (Collection group)
//
// 6. CLIQUE EM "CRIAR".
//
// A criação do índice pode levar alguns minutos. Assim que estiver "Ativado" (Enabled),
// a funcionalidade de busca de CPF funcionará corretamente.
// =================================================================================================
export const findAttendeeByCpf = async (cpf: string): Promise<Attendee | null> => {
    const attendeesRef = db.collectionGroup(ATTENDEES_COLLECTION);
    const q = attendeesRef.where('cpf', '==', cpf).limit(1);
    const querySnapshot = await q.get();
    if (!querySnapshot.empty) {
        const doc = querySnapshot.docs[0];
        return { id: doc.id, ...doc.data() } as Attendee;
    }
    return null;
};

export const addAttendee = async (eventId: string, attendee: Omit<Attendee, 'id' | 'status' | 'eventId' | 'createdAt'>): Promise<void> => {
  const newAttendeeRef = db.collection(EVENTS_COLLECTION).doc(eventId).collection(ATTENDEES_COLLECTION).doc();
  
  let photoURL = attendee.photo;

  // Check if the photo is a new base64 string that needs uploading
  if (attendee.photo.startsWith('data:image')) {
    const photoRef = storage.ref(`events/${eventId}/${newAttendeeRef.id}.png`);
    await photoRef.putString(attendee.photo, 'data_url');
    photoURL = await photoRef.getDownloadURL();
  }
  
  const batch = db.batch();
  batch.set(newAttendeeRef, {
      ...attendee,
      photo: photoURL, // Use the determined URL (either new or existing)
      eventId: eventId,
      status: CheckinStatus.PENDING,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
  });

  await batch.commit();
};

export const updateAttendeeStatus = (eventId: string, attendeeId: string, status: CheckinStatus): Promise<void> => {
  // FIX: Corrected typo from ATTENDEDEES_COLLECTION to ATTENDEES_COLLECTION
  const attendeeDoc = db.collection(EVENTS_COLLECTION).doc(eventId).collection(ATTENDEES_COLLECTION).doc(attendeeId);
  return attendeeDoc.update({ status });
};


// Supplier Functions
export const getSuppliersForEvent = async (eventId: string): Promise<Supplier[]> => {
    const suppliersRef = db.collection(EVENTS_COLLECTION).doc(eventId).collection(SUPPLIERS_COLLECTION);
    const q = suppliersRef.orderBy('name', 'asc');
    const querySnapshot = await q.get();
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Supplier));
};

export const getSupplier = async (eventId: string, supplierId: string): Promise<Supplier | null> => {
    const supplierDocRef = db.collection(EVENTS_COLLECTION).doc(eventId).collection(SUPPLIERS_COLLECTION).doc(supplierId);
    const supplierDoc = await supplierDocRef.get();
    return supplierDoc.exists ? { id: supplierDoc.id, ...supplierDoc.data() } as Supplier : null;
};


export const addSupplier = (eventId: string, name: string, sectors: string[]): Promise<any> => {
    const suppliersRef = db.collection(EVENTS_COLLECTION).doc(eventId).collection(SUPPLIERS_COLLECTION);
    return suppliersRef.add({
        name,
        sectors,
        active: true, // New links are active by default
    });
};

export const updateSupplierStatus = (eventId: string, supplierId: string, active: boolean): Promise<void> => {
    const supplierDoc = db.collection(EVENTS_COLLECTION).doc(eventId).collection(SUPPLIERS_COLLECTION).doc(supplierId);
    return supplierDoc.update({ active });
};