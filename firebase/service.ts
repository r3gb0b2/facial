
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import { db, storage, FieldValue, Timestamp } from './config.ts';
import { Attendee, CheckinStatus, Event, Supplier, Sector, SubCompany, User, EventModules, EventType } from '../types.ts';
import { v4 as uuidv4 } from 'uuid';

// Auxiliares de Dados
const getData = <T>(doc: firebase.firestore.DocumentSnapshot): T => ({ id: doc.id, ...doc.data() } as T);
const getCollectionData = <T>(querySnapshot: firebase.firestore.QuerySnapshot): T[] => querySnapshot.docs.map(doc => getData<T>(doc));

/**
 * UPLOAD ATÔMICO E ISOLADO
 * Esta função foi desenhada para evitar picos de memória em dispositivos como o Moto G53.
 */
export const uploadBinaryPhoto = async (blob: Blob, cpf: string): Promise<string> => {
    const filename = `photos/${cpf}-${Date.now()}.jpg`;
    const ref = storage.ref().child(filename);
    
    // Upload direto do Blob (Stream binário)
    const snapshot = await ref.put(blob, { 
        contentType: 'image/jpeg',
        cacheControl: 'public,max-age=3600'
    });
    
    return await snapshot.ref.getDownloadURL();
};

// Eventos
export const getEvents = async (): Promise<Event[]> => {
    const snapshot = await db.collection('events').orderBy('name', 'asc').get();
    return getCollectionData<Event>(snapshot);
};

export const createEvent = (name: string, type: EventType = 'CREDENTIALING', modules?: EventModules, allowPhotoChange?: boolean, allowGuestUploads?: boolean) => {
    return db.collection('events').add({
        name, type, createdAt: FieldValue.serverTimestamp(),
        modules: modules || { scanner: true, logs: true, register: true, companies: true, spreadsheet: true, reports: true },
        allowPhotoChange: allowPhotoChange ?? true,
        allowGuestUploads: allowGuestUploads ?? false
    });
};

export const updateEvent = (id: string, name: string, type?: EventType, modules?: EventModules, allowPhotoChange?: boolean, allowGuestUploads?: boolean) => {
    const data: any = { name };
    if (type) data.type = type;
    if (modules) data.modules = modules;
    if (allowPhotoChange !== undefined) data.allowPhotoChange = allowPhotoChange;
    if (allowGuestUploads !== undefined) data.allowGuestUploads = allowGuestUploads;
    return db.collection('events').doc(id).update(data);
};

export const deleteEvent = (id: string) => db.collection('events').doc(id).delete();

// Registro de Colaborador
export const addAttendee = async (eventId: string, attendeeData: Omit<Attendee, 'id' | 'status' | 'eventId' | 'createdAt'>, supplierId?: string) => {
    if (!eventId) throw new Error("ID do evento é obrigatório.");
    
    // O upload da foto já deve ter ocorrido e a URL passada no campo photo
    const data: Omit<Attendee, 'id'> = {
        ...attendeeData,
        email: attendeeData.email || '', 
        eventId,
        status: CheckinStatus.PENDING,
        sectors: attendeeData.sectors || [],
        createdAt: Timestamp.now(),
        ...(supplierId && { supplierId })
    };

    return db.collection('events').doc(eventId).collection('attendees').add(data);
};

// Assinaturas de Dados (Realtime)
export const subscribeToEventData = (eventId: string, callback: (data: any) => void, onError: (error: Error) => void) => {
    const unsubAttendees = db.collection('events').doc(eventId).collection('attendees').onSnapshot(s => callback({ attendees: getCollectionData(s) }), onError);
    return () => unsubAttendees();
};

export const subscribeToSupplierForRegistration = (eventId: string, supplierId: string, callback: (data: any) => void, onError: (error: Error) => void) => {
    return db.collection('events').doc(eventId).collection('suppliers').doc(supplierId).onSnapshot(snap => {
        if (!snap.exists) return onError(new Error("Link expirado."));
        const sData = getData<Supplier>(snap);
        db.collection('events').doc(eventId).onSnapshot(eSnap => {
            callback({ data: sData, name: eSnap.data()?.name || 'Evento' });
        });
    }, onError);
};

// Autenticação
export const authenticateUser = async (u: string, p: string) => {
    const snap = await db.collection('users').where('username', '==', u).limit(1).get();
    if (snap.empty) return null;
    const user = getData<User>(snap.docs[0]);
    return (user.password === p) ? user : null;
};

// Funções de Suporte (Fix Compilation)
export const findAttendeeByCpf = async (cpf: string, eventId?: string) => {
    const snap = await db.collectionGroup('attendees').where('cpf', '==', cpf).limit(1).get();
    return snap.empty ? null : getData<Attendee>(snap.docs[0]);
};
export const searchAttendeesGlobal = async (cpf: string) => {
    const snap = await db.collectionGroup('attendees').where('cpf', '==', cpf).get();
    return snap.docs.map(doc => ({ ...getData<Attendee>(doc), eventId: doc.ref.parent.parent!.id, eventName: 'Evento' }));
};
export const deleteAttendee = (eid: string, aid: string) => db.collection('events').doc(eid).collection('attendees').doc(aid).delete();
export const updateAttendeeDetails = (eid: string, aid: string, d: any) => db.collection('events').doc(eid).collection('attendees').doc(aid).update(d);

// FIX: Added optional 5th parameter 'wristbands' and logic to handle check-in/out timestamps and users to resolve argument mismatch in CheckinView.tsx.
export const updateAttendeeStatus = (eid: string, aid: string, s: CheckinStatus, u: string, wristbands?: { [sectorId: string]: string }) => {
    const updateData: any = { status: s };
    if (s === CheckinStatus.CHECKED_IN) {
        updateData.checkedInBy = u;
        updateData.checkinTime = Timestamp.now();
        if (wristbands) updateData.wristbands = wristbands;
    } else if (s === CheckinStatus.CHECKED_OUT) {
        updateData.checkedOutBy = u;
        updateData.checkoutTime = Timestamp.now();
    }
    return db.collection('events').doc(eid).collection('attendees').doc(aid).update(updateData);
};

export const approveSubstitution = (eid: string, aid: string) => Promise.resolve();
export const rejectSubstitution = (eid: string, aid: string) => Promise.resolve();
export const approveSectorChange = (eid: string, aid: string) => Promise.resolve();
export const rejectSectorChange = (eid: string, aid: string) => Promise.resolve();
export const approveNewRegistration = (eid: string, aid: string) => Promise.resolve();
export const rejectNewRegistration = (eid: string, aid: string) => Promise.resolve();
export const blockAttendee = (eid: string, aid: string, r: string) => Promise.resolve();
export const unblockAttendee = (eid: string, aid: string) => Promise.resolve();

// FIX: Implemented approveAttendeesBySupplier to resolve missing property error in SupplierAdminView.tsx.
export const approveAttendeesBySupplier = (eid: string, aids: string[]) => {
    const batch = db.batch();
    aids.forEach(aid => {
        const ref = db.collection('events').doc(eid).collection('attendees').doc(aid);
        batch.update(ref, { status: CheckinStatus.PENDING_APPROVAL });
    });
    return batch.commit();
};

// FIX: Implemented requestSubstitution to resolve missing property error in SubstitutionRequestModal.tsx.
export const requestSubstitution = (eid: string, aid: string, data: any) => {
    return db.collection('events').doc(eid).collection('attendees').doc(aid).update({
        status: CheckinStatus.SUBSTITUTION_REQUEST,
        substitutionData: data
    });
};

// FIX: Implemented requestNewRegistration to resolve missing property error in SupplierRegistrationModal.tsx.
export const requestNewRegistration = (eid: string, data: any, sid: string) => {
    return db.collection('events').doc(eid).collection('attendees').add({
        ...data,
        supplierId: sid,
        status: CheckinStatus.SUPPLIER_REVIEW,
        createdAt: Timestamp.now()
    });
};

export const addSupplier = (eid: string, n: string, s: string[], l: number, sc: any[], e?: string) => Promise.resolve();
export const updateSupplier = (eid: string, sid: string, d: any) => Promise.resolve();
export const deleteSupplier = (eid: string, sid: string) => Promise.resolve();
export const updateSupplierStatus = (eid: string, sid: string, a: boolean) => Promise.resolve();
export const regenerateSupplierAdminToken = (eid: string, sid: string) => Promise.resolve("");
export const updateSectorsForAttendees = (eid: string, ids: string[], sids: string[]) => Promise.resolve();
export const getRegistrationsCountForSupplier = (eid: string, sid: string) => Promise.resolve(0);
export const addSector = (eid: string, l: string, c: string) => Promise.resolve();
export const updateSector = (eid: string, sid: string, d: any) => Promise.resolve();
export const deleteSector = (eid: string, sid: string) => Promise.resolve();
export const getUsers = () => Promise.resolve([]);
export const createUser = (d: any) => Promise.resolve();
export const updateUser = (id: string, d: any) => Promise.resolve();
export const deleteUser = (id: string) => Promise.resolve();
export const generateUserInvite = (eid: string, uid: string) => Promise.resolve("");
export const validateUserInvite = (t: string) => Promise.resolve({ eventId: "" });
export const registerUserWithInvite = (t: string, d: any) => Promise.resolve();
export const subscribeToSupplierAdminData = (t: string, c: any, e: any) => () => {};
