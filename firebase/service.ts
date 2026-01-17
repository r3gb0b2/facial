
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import { db, storage, FieldValue, Timestamp } from './config.ts';
import { Attendee, CheckinStatus, Event, Supplier, Sector, SubCompany, User, EventModules, EventType } from '../types.ts';

const getData = <T>(doc: firebase.firestore.DocumentSnapshot): T => ({ id: doc.id, ...doc.data() } as T);
const getCollectionData = <T>(querySnapshot: firebase.firestore.QuerySnapshot): T[] => querySnapshot.docs.map(doc => getData<T>(doc));

// ==========================================
// UPLOAD BINÁRIO (RESILIÊNCIA MOTO G53)
// ==========================================
export const uploadBinaryPhoto = async (blob: Blob, cpf: string): Promise<string> => {
    const filename = `photos/${cpf.replace(/\D/g, '')}-${Date.now()}.jpg`;
    const ref = storage.ref().child(filename);
    const snapshot = await ref.put(blob, { contentType: 'image/jpeg' });
    return await snapshot.ref.getDownloadURL();
};

// ==========================================
// EVENTOS
// ==========================================
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

// ==========================================
// ASSINATURA DE DADOS (FIX CRÍTICO)
// ==========================================
export const subscribeToEventData = (eventId: string, callback: (data: any) => void, onError: (error: Error) => void) => {
    const eventRef = db.collection('events').doc(eventId);
    let attendees: Attendee[] = [];
    let suppliers: Supplier[] = [];
    let sectors: Sector[] = [];

    const emit = () => callback({ attendees, suppliers, sectors });

    const unsubAttendees = eventRef.collection('attendees').onSnapshot(s => {
        attendees = getCollectionData<Attendee>(s);
        emit();
    }, onError);

    const unsubSuppliers = eventRef.collection('suppliers').onSnapshot(s => {
        suppliers = getCollectionData<Supplier>(s);
        emit();
    }, onError);

    const unsubSectors = eventRef.collection('sectors').onSnapshot(s => {
        sectors = getCollectionData<Sector>(s);
        emit();
    }, onError);

    return () => {
        unsubAttendees();
        unsubSuppliers();
        unsubSectors();
    };
};

// ==========================================
// COLABORADORES / ATTENDEES
// ==========================================
export const addAttendee = async (eventId: string, attendeeData: any, supplierId?: string) => {
    const data = {
        ...attendeeData,
        eventId,
        status: CheckinStatus.PENDING,
        createdAt: Timestamp.now(),
        ...(supplierId && { supplierId })
    };
    return db.collection('events').doc(eventId).collection('attendees').add(data);
};

export const updateAttendeeDetails = (eventId: string, attendeeId: string, data: any) => {
    return db.collection('events').doc(eventId).collection('attendees').doc(attendeeId).update(data);
};

export const updateAttendeeStatus = (eventId: string, attendeeId: string, status: CheckinStatus, username: string, wristbands?: any) => {
    const data: any = { status };
    if (status === CheckinStatus.CHECKED_IN) {
        data.checkinTime = Timestamp.now();
        data.checkedInBy = username;
        if (wristbands) data.wristbands = wristbands;
    } else if (status === CheckinStatus.CHECKED_OUT) {
        data.checkoutTime = Timestamp.now();
        data.checkedOutBy = username;
    }
    return db.collection('events').doc(eventId).collection('attendees').doc(attendeeId).update(data);
};

export const deleteAttendee = (eventId: string, attendeeId: string) => {
    return db.collection('events').doc(eventId).collection('attendees').doc(attendeeId).delete();
};

export const blockAttendee = (eventId: string, attendeeId: string, reason: string) => {
    return db.collection('events').doc(eventId).collection('attendees').doc(attendeeId).update({
        status: CheckinStatus.BLOCKED,
        blockReason: reason
    });
};

export const unblockAttendee = (eventId: string, attendeeId: string) => {
    return db.collection('events').doc(eventId).collection('attendees').doc(attendeeId).update({
        status: CheckinStatus.PENDING
    });
};

// FIX: Added missing requestSubstitution function
export const requestSubstitution = (eventId: string, attendeeId: string, substitutionData: any) => {
    return db.collection('events').doc(eventId).collection('attendees').doc(attendeeId).update({
        substitutionData,
        status: CheckinStatus.SUBSTITUTION_REQUEST
    });
};

// FIX: Added missing approveSubstitution function
export const approveSubstitution = async (eventId: string, attendeeId: string) => {
    const ref = db.collection('events').doc(eventId).collection('attendees').doc(attendeeId);
    const snap = await ref.get();
    const data = snap.data() as Attendee;
    if (data && data.substitutionData) {
        const updateData: any = {
            name: data.substitutionData.name,
            cpf: data.substitutionData.cpf,
            status: CheckinStatus.PENDING,
            substitutionData: FieldValue.delete()
        };
        if (data.substitutionData.photo) updateData.photo = data.substitutionData.photo;
        if (data.substitutionData.newSectorIds) updateData.sectors = data.substitutionData.newSectorIds;
        
        return ref.update(updateData);
    }
};

// FIX: Added missing rejectSubstitution function
export const rejectSubstitution = (eventId: string, attendeeId: string) => {
    return db.collection('events').doc(eventId).collection('attendees').doc(attendeeId).update({
        status: CheckinStatus.PENDING,
        substitutionData: FieldValue.delete()
    });
};

// FIX: Added missing approveSectorChange function
export const approveSectorChange = async (eventId: string, attendeeId: string) => {
    const ref = db.collection('events').doc(eventId).collection('attendees').doc(attendeeId);
    const snap = await ref.get();
    const data = snap.data() as Attendee;
    if (data && data.sectorChangeData) {
        return ref.update({
            sectors: [data.sectorChangeData.newSectorId],
            status: CheckinStatus.PENDING,
            sectorChangeData: FieldValue.delete()
        });
    }
};

// FIX: Added missing rejectSectorChange function
export const rejectSectorChange = (eventId: string, attendeeId: string) => {
    return db.collection('events').doc(eventId).collection('attendees').doc(attendeeId).update({
        status: CheckinStatus.PENDING,
        sectorChangeData: FieldValue.delete()
    });
};

// FIX: Added missing updateSectorsForAttendees function for batch updates
export const updateSectorsForAttendees = async (eventId: string, attendeeIds: string[], sectorIds: string[]) => {
    const batch = db.batch();
    attendeeIds.forEach(id => {
        const ref = db.collection('events').doc(eventId).collection('attendees').doc(id);
        batch.update(ref, { sectors: sectorIds });
    });
    return batch.commit();
};

// ==========================================
// BUSCA E AUTO-FILL
// ==========================================
export const findAttendeeByCpf = async (cpf: string) => {
    const snap = await db.collectionGroup('attendees').where('cpf', '==', cpf.replace(/\D/g, '')).limit(1).get();
    return snap.empty ? null : getData<Attendee>(snap.docs[0]);
};

export const searchAttendeesGlobal = async (cpf: string) => {
    const snap = await db.collectionGroup('attendees').where('cpf', '==', cpf.replace(/\D/g, '')).get();
    const results = [];
    for (const doc of snap.docs) {
        const attendee = getData<Attendee>(doc);
        const eventSnap = await db.collection('events').doc(attendee.eventId).get();
        results.push({ ...attendee, eventName: eventSnap.data()?.name || 'Evento Desconhecido' });
    }
    return results;
};

// ==========================================
// FORNECEDORES E SETORES
// ==========================================
export const addSupplier = (eventId: string, name: string, sectors: string[], limit: number, subCompanies: any[], email?: string, needsApproval?: boolean) => {
    return db.collection('events').doc(eventId).collection('suppliers').add({
        name, sectors, registrationLimit: limit, subCompanies, email, active: true, needsApproval: !!needsApproval, adminToken: Math.random().toString(36).substr(2, 9)
    });
};

export const updateSupplier = (eventId: string, supplierId: string, data: any) => {
    return db.collection('events').doc(eventId).collection('suppliers').doc(supplierId).update(data);
};

export const deleteSupplier = async (eventId: string, supplierId: string) => {
    const attendeesSnap = await db.collection('events').doc(eventId).collection('attendees').where('supplierId', '==', supplierId).limit(1).get();
    if (!attendeesSnap.empty) throw new Error("supplier_in_use");
    return db.collection('events').doc(eventId).collection('suppliers').doc(supplierId).delete();
};

export const updateSupplierStatus = (eventId: string, supplierId: string, active: boolean) => {
    return db.collection('events').doc(eventId).collection('suppliers').doc(supplierId).update({ active });
};

// FIX: Added missing regenerateSupplierAdminToken function
export const regenerateSupplierAdminToken = async (eventId: string, supplierId: string) => {
    const newToken = Math.random().toString(36).substr(2, 9);
    await db.collection('events').doc(eventId).collection('suppliers').doc(supplierId).update({
        adminToken: newToken
    });
    return newToken;
};

// FIX: Added missing getRegistrationsCountForSupplier function
export const getRegistrationsCountForSupplier = async (eventId: string, supplierId: string) => {
    const snap = await db.collection('events').doc(eventId).collection('attendees').where('supplierId', '==', supplierId).get();
    return snap.size;
};

export const addSector = (eventId: string, label: string, color: string) => {
    return db.collection('events').doc(eventId).collection('sectors').add({ label, color });
};

export const updateSector = (eventId: string, sectorId: string, data: any) => {
    return db.collection('events').doc(eventId).collection('sectors').doc(sectorId).update(data);
};

export const deleteSector = (eventId: string, sectorId: string) => {
    return db.collection('events').doc(eventId).collection('sectors').doc(sectorId).delete();
};

// ==========================================
// SOLICITAÇÕES (SUPPLIER ADMIN)
// ==========================================
export const requestNewRegistration = (eventId: string, data: any, supplierId: string) => {
    return addAttendee(eventId, { ...data, status: CheckinStatus.SUPPLIER_REVIEW }, supplierId);
};

export const approveAttendeesBySupplier = async (eventId: string, attendeeIds: string[]) => {
    const batch = db.batch();
    attendeeIds.forEach(id => {
        const ref = db.collection('events').doc(eventId).collection('attendees').doc(id);
        batch.update(ref, { status: CheckinStatus.PENDING });
    });
    return batch.commit();
};

export const approveNewRegistration = (eventId: string, attendeeId: string) => {
    return db.collection('events').doc(eventId).collection('attendees').doc(attendeeId).update({ status: CheckinStatus.PENDING });
};

export const rejectNewRegistration = (eventId: string, attendeeId: string) => {
    return db.collection('events').doc(eventId).collection('attendees').doc(attendeeId).update({ status: CheckinStatus.REJECTED });
};

// ==========================================
// USUÁRIOS E SEGURANÇA
// ==========================================
export const authenticateUser = async (u: string, p: string) => {
    const snap = await db.collection('users').where('username', '==', u).limit(1).get();
    if (snap.empty) return null;
    const user = getData<User>(snap.docs[0]);
    return (user.password === p) ? user : null;
};

export const getUsers = async (): Promise<User[]> => {
    const snap = await db.collection('users').get();
    return getCollectionData<User>(snap);
};

export const createUser = (data: any) => db.collection('users').add(data);
export const updateUser = (id: string, data: any) => db.collection('users').doc(id).update(data);
export const deleteUser = (id: string) => db.collection('users').doc(id).delete();

// FIX: Added missing generateUserInvite function
export const generateUserInvite = async (eventId: string, createdBy: string) => {
    const token = Math.random().toString(36).substr(2, 12);
    await db.collection('invites').doc(token).set({
        eventId,
        createdBy,
        createdAt: FieldValue.serverTimestamp(),
        used: false
    });
    return token;
};

// FIX: Added missing validateUserInvite function
export const validateUserInvite = async (token: string) => {
    const snap = await db.collection('invites').doc(token).get();
    if (!snap.exists || snap.data()?.used) throw new Error("Link de convite inválido ou já utilizado.");
    return snap.data() as { eventId: string };
};

// FIX: Added missing registerUserWithInvite function
export const registerUserWithInvite = async (token: string, userData: any) => {
    const inviteSnap = await db.collection('invites').doc(token).get();
    if (!inviteSnap.exists || inviteSnap.data()?.used) throw new Error("Convite expirado.");
    
    const inviteData = inviteSnap.data()!;
    
    await db.collection('users').add({
        ...userData,
        role: 'checkin',
        linkedEventIds: [inviteData.eventId],
        createdBy: inviteData.createdBy,
        active: false,
        createdAt: FieldValue.serverTimestamp()
    });
    
    return db.collection('invites').doc(token).update({ used: true });
};

// Links de Registro Público
export const subscribeToSupplierForRegistration = (eventId: string, supplierId: string, callback: (data: any) => void, onError: (error: Error) => void) => {
    return db.collection('events').doc(eventId).collection('suppliers').doc(supplierId).onSnapshot(snap => {
        if (!snap.exists) return onError(new Error("Link expirado."));
        const sData = getData<Supplier>(snap);
        db.collection('events').doc(eventId).onSnapshot(eSnap => {
            callback({ 
                data: { ...sData, eventId }, 
                name: eSnap.data()?.name || 'Evento',
                sectors: [], 
                allowPhotoChange: eSnap.data()?.allowPhotoChange ?? true,
                type: eSnap.data()?.type || 'CREDENTIALING'
            });
        });
    }, onError);
};

// Links de Admin do Fornecedor
export const subscribeToSupplierAdminData = (token: string, callback: (data: any) => void, onError: (error: Error) => void) => {
    return db.collectionGroup('suppliers').where('adminToken', '==', token).onSnapshot(async snap => {
        if (snap.empty) return onError(new Error("Token inválido."));
        const supplierDoc = snap.docs[0];
        const supplier = getData<Supplier>(supplierDoc);
        const eventId = supplierDoc.ref.parent.parent?.id;
        if (!eventId) return;

        const eventSnap = await db.collection('events').doc(eventId).get();
        const sectorsSnap = await db.collection('events').doc(eventId).collection('sectors').get();
        const attendeesSnap = await db.collection('events').doc(eventId).collection('attendees').where('supplierId', '==', supplier.id).get();

        callback({
            eventId,
            supplierId: supplier.id,
            supplier,
            eventName: eventSnap.data()?.name || 'Evento',
            sectors: getCollectionData<Sector>(sectorsSnap),
            attendees: getCollectionData<Attendee>(attendeesSnap)
        });
    }, onError);
};
