
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import { db, storage, FieldValue, Timestamp } from './config.ts';
import { Attendee, CheckinStatus, Event, Supplier, Sector, SubCompany, User, EventModules, EventType } from '../types.ts';
import { v4 as uuidv4 } from 'uuid';

// Helper to extract data and id from snapshots
const getData = <T>(doc: firebase.firestore.DocumentSnapshot): T => ({ id: doc.id, ...doc.data() } as T);
const getCollectionData = <T>(querySnapshot: firebase.firestore.QuerySnapshot): T[] => querySnapshot.docs.map(doc => getData<T>(doc));

// ==========================================
// ESTRATÉGIA DE UPLOAD ROBUSTA (ANTI-CRASH)
// ==========================================
const performRobustUpload = async (photoSource: string, identifier: string): Promise<string> => {
    if (photoSource.startsWith('http')) return photoSource;
    
    let blob: Blob;
    try {
        // Converte URL ou DataURL em Blob real
        const response = await fetch(photoSource);
        blob = await response.blob();
    } catch (e) {
        throw new Error("Erro ao processar imagem para upload.");
    }

    const filename = `photos/${identifier}-${Date.now()}.jpg`;
    const storageRef = storage.ref().child(filename);
    
    // Upload usando stream de blob (mais leve que string base64)
    const task = storageRef.put(blob, { contentType: 'image/jpeg' });
    
    return new Promise((resolve, reject) => {
        task.on('state_changed', 
            null, 
            (err) => reject(err), 
            async () => {
                const url = await task.snapshot.ref.getDownloadURL();
                // Limpeza agressiva: revoga o blob da memória do navegador
                if (photoSource.startsWith('blob:')) URL.revokeObjectURL(photoSource);
                resolve(url);
            }
        );
    });
};

// Event Management
export const getEvents = async (): Promise<Event[]> => {
    const snapshot = await db.collection('events').orderBy('name', 'asc').get();
    return getCollectionData<Event>(snapshot);
};

export const createEvent = (name: string, type: EventType = 'CREDENTIALING', modules?: EventModules, allowPhotoChange?: boolean, allowGuestUploads?: boolean): Promise<firebase.firestore.DocumentReference> => {
    return db.collection('events').add({
        name,
        type,
        createdAt: FieldValue.serverTimestamp(),
        modules: modules || {
            scanner: true,
            logs: true,
            register: true,
            companies: true,
            spreadsheet: true,
            reports: true
        },
        allowPhotoChange: allowPhotoChange !== undefined ? allowPhotoChange : true,
        allowGuestUploads: allowGuestUploads !== undefined ? allowGuestUploads : false
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

export const subscribeToEventData = (
    eventId: string,
    callback: (data: { attendees: Attendee[], suppliers: Supplier[], sectors: Sector[] }) => void,
    onError: (error: Error) => void
) => {
    const data = { attendees: [] as Attendee[], suppliers: [] as Supplier[], sectors: [] as Sector[] };
    const updateCallback = () => callback({ ...data });

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

    return () => {
        attendeesUnsub();
        suppliersUnsub();
        sectorsUnsub();
    };
};

export const findAttendeeByCpf = async (cpf: string, eventId?: string): Promise<(Attendee & { eventId?: string }) | null> => {
    if (eventId) {
        const localSnapshot = await db.collection('events').doc(eventId).collection('attendees').where('cpf', '==', cpf).limit(1).get();
        if (!localSnapshot.empty) {
             const attendee = getData<Attendee>(localSnapshot.docs[0]);
             return { ...attendee, eventId: eventId };
        }
    }
    let query = db.collectionGroup('attendees').where('cpf', '==', cpf).limit(1);
    const snapshot = await query.get();
    if (snapshot.empty) return null;
    const attendee = getData<Attendee>(snapshot.docs[0]);
    const docEventId = snapshot.docs[0].ref.parent.parent?.id;
    return { ...attendee, eventId: docEventId };
};

export const searchAttendeesGlobal = async (cpf: string): Promise<(Attendee & { eventId: string, eventName: string })[]> => {
    const snapshot = await db.collectionGroup('attendees').where('cpf', '==', cpf).get();
    const results: (Attendee & { eventId: string, eventName: string })[] = [];
    for (const doc of snapshot.docs) {
        const attendee = getData<Attendee>(doc);
        const eventRef = doc.ref.parent.parent;
        if (eventRef) {
            const eventSnap = await eventRef.get();
            results.push({ ...attendee, eventId: eventRef.id, eventName: eventSnap.data()?.name || 'Evento Desconhecido' });
        }
    }
    return results;
};

export const addAttendee = async (eventId: string, attendeeData: Omit<Attendee, 'id' | 'status' | 'eventId' | 'createdAt'>, supplierId?: string) => {
    if (!eventId) throw new Error("ID do evento é obrigatório.");
    
    // Inicia upload primeiro
    const photoUrl = await performRobustUpload(attendeeData.photo, attendeeData.cpf);

    let initialStatus = attendeeData.blockReason ? CheckinStatus.PENDING_APPROVAL : CheckinStatus.PENDING;

    if (supplierId) {
        const supplierRef = db.collection('events').doc(eventId).collection('suppliers').doc(supplierId);
        const [supplierSnap, countSnap] = await Promise.all([
            supplierRef.get(),
            db.collection('events').doc(eventId).collection('attendees').where('supplierId', '==', supplierId).get()
        ]);
        if (supplierSnap.exists) {
            const supplier = supplierSnap.data();
            if (countSnap.size >= (supplier?.registrationLimit || 0)) throw new Error("Limite atingido.");
            if (supplier?.needsApproval === true) initialStatus = CheckinStatus.SUPPLIER_REVIEW;
        }
    }

    const data: Omit<Attendee, 'id'> = {
        ...attendeeData,
        email: attendeeData.email || '', 
        photo: photoUrl || '',
        eventId,
        status: initialStatus,
        sectors: attendeeData.sectors || [],
        createdAt: Timestamp.now(),
        ...(supplierId && { supplierId })
    };

    return db.collection('events').doc(eventId).collection('attendees').add(data);
};

export const requestNewRegistration = async (eventId: string, attendeeData: Omit<Attendee, 'id' | 'status' | 'eventId' | 'createdAt'>, supplierId: string) => {
    const photoUrl = await performRobustUpload(attendeeData.photo, attendeeData.cpf);
    const data: Omit<Attendee, 'id'> = {
        ...attendeeData,
        email: attendeeData.email || '',
        photo: photoUrl || '',
        eventId,
        status: CheckinStatus.PENDING_APPROVAL,
        sectors: attendeeData.sectors || [],
        createdAt: Timestamp.now(),
        supplierId,
    };
    return db.collection('events').doc(eventId).collection('attendees').add(data);
};

export const approveNewRegistration = (eventId: string, attendeeId: string) => db.collection('events').doc(eventId).collection('attendees').doc(attendeeId).update({ status: CheckinStatus.PENDING });
export const rejectNewRegistration = (eventId: string, attendeeId: string) => db.collection('events').doc(eventId).collection('attendees').doc(attendeeId).update({ status: CheckinStatus.REJECTED });
export const approveAttendeesBySupplier = async (eventId: string, attendeeIds: string[]) => {
    const batch = db.batch();
    attendeeIds.forEach(id => batch.update(db.collection('events').doc(eventId).collection('attendees').doc(id), { status: CheckinStatus.PENDING }));
    await batch.commit();
};

export const updateAttendeeStatus = (eventId: string, attendeeId: string, status: CheckinStatus, username: string, wristbands?: { [sectorId: string]: string }) => {
    const dataToUpdate: any = { status };
    if (status === CheckinStatus.CHECKED_IN) {
        dataToUpdate.checkinTime = FieldValue.serverTimestamp();
        dataToUpdate.checkedInBy = username;
        if (wristbands) dataToUpdate.wristbands = wristbands;
    } else if (status === CheckinStatus.CHECKED_OUT) {
        dataToUpdate.checkoutTime = FieldValue.serverTimestamp();
        dataToUpdate.checkedOutBy = username;
    }
    return db.collection('events').doc(eventId).collection('attendees').doc(attendeeId).update(dataToUpdate);
};

export const updateAttendeeDetails = async (eventId: string, attendeeId: string, data: Partial<Attendee>) => {
    const dataToUpdate = { ...data };
    if (dataToUpdate.photo && (dataToUpdate.photo.startsWith('data:image') || dataToUpdate.photo.startsWith('blob:'))) {
        dataToUpdate.photo = await performRobustUpload(dataToUpdate.photo, dataToUpdate.cpf || attendeeId);
    }
    return db.collection('events').doc(eventId).collection('attendees').doc(attendeeId).update(dataToUpdate);
};

export const deleteAttendee = (eventId: string, attendeeId: string) => db.collection('events').doc(eventId).collection('attendees').doc(attendeeId).delete();

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
    if (!attendee?.substitutionData) throw new Error("Dados não encontrados.");

    const { name, cpf, photo: photoDataUrl } = attendee.substitutionData;
    const dataToUpdate: any = { name, cpf, status: CheckinStatus.PENDING, substitutionData: FieldValue.delete() };

    if (photoDataUrl) {
        dataToUpdate.photo = await performRobustUpload(photoDataUrl, cpf);
    }
    return attendeeRef.update(dataToUpdate);
};

// FIX: Added missing rejectSubstitution function
export const rejectSubstitution = (eventId: string, attendeeId: string) => 
    db.collection('events').doc(eventId).collection('attendees').doc(attendeeId).update({ 
        status: CheckinStatus.PENDING, 
        substitutionData: FieldValue.delete() 
    });

// FIX: Added missing approveSectorChange function
export const approveSectorChange = async (eventId: string, attendeeId: string) => {
    const attendeeRef = db.collection('events').doc(eventId).collection('attendees').doc(attendeeId);
    const doc = await attendeeRef.get();
    const attendee = doc.data() as Attendee;
    if (!attendee?.sectorChangeData) throw new Error("Dados de mudança de setor não encontrados.");

    return attendeeRef.update({
        sectors: [attendee.sectorChangeData.newSectorId],
        status: CheckinStatus.PENDING,
        sectorChangeData: FieldValue.delete()
    });
};

// FIX: Added missing rejectSectorChange function
export const rejectSectorChange = (eventId: string, attendeeId: string) => 
    db.collection('events').doc(eventId).collection('attendees').doc(attendeeId).update({ 
        status: CheckinStatus.PENDING, 
        sectorChangeData: FieldValue.delete() 
    });

export const blockAttendee = (eventId: string, attendeeId: string, reason?: string) => db.collection('events').doc(eventId).collection('attendees').doc(attendeeId).update({ status: CheckinStatus.BLOCKED, blockReason: reason || '' });
export const unblockAttendee = (eventId: string, attendeeId: string) => db.collection('events').doc(eventId).collection('attendees').doc(attendeeId).update({ status: CheckinStatus.PENDING, blockReason: FieldValue.delete() });

// FIX: Added missing updateSectorsForAttendees function
export const updateSectorsForAttendees = async (eventId: string, attendeeIds: string[], sectorIds: string[]) => {
    const batch = db.batch();
    const eventRef = db.collection('events').doc(eventId);
    attendeeIds.forEach(id => {
        batch.update(eventRef.collection('attendees').doc(id), { sectors: sectorIds });
    });
    await batch.commit();
};

export const addSupplier = (eventId: string, name: string, sectors: string[], registrationLimit: number, subCompanies: SubCompany[], email?: string, needsApproval?: boolean) => {
    return db.collection('events').doc(eventId).collection('suppliers').add({ 
        name, email: email || '', sectors, registrationLimit, subCompanies, active: true, adminToken: uuidv4(), needsApproval: needsApproval || false
    });
};

export const updateSupplier = (eventId: string, supplierId: string, data: Partial<Supplier>) => db.collection('events').doc(eventId).collection('suppliers').doc(supplierId).update(data);
export const deleteSupplier = (eventId: string, supplierId: string) => db.collection('events').doc(eventId).collection('suppliers').doc(supplierId).delete();

// FIX: Added missing regenerateSupplierAdminToken function
export const regenerateSupplierAdminToken = async (eventId: string, supplierId: string) => {
    const newToken = uuidv4();
    await db.collection('events').doc(eventId).collection('suppliers').doc(supplierId).update({ adminToken: newToken });
    return newToken;
};

export const updateSupplierStatus = (eventId: string, supplierId: string, active: boolean) => updateSupplier(eventId, supplierId, { active });

// FIX: Added missing getRegistrationsCountForSupplier function
export const getRegistrationsCountForSupplier = async (eventId: string, supplierId: string): Promise<number> => {
    const snapshot = await db.collection('events').doc(eventId).collection('attendees').where('supplierId', '==', supplierId).get();
    return snapshot.size;
};

// FIX: Added missing Sector management functions
export const addSector = (eventId: string, label: string, color: string) => 
    db.collection('events').doc(eventId).collection('sectors').add({ label, color });

export const updateSector = (eventId: string, sectorId: string, data: { label: string, color: string }) => 
    db.collection('events').doc(eventId).collection('sectors').doc(sectorId).update(data);

export const deleteSector = (eventId: string, sectorId: string) => 
    db.collection('events').doc(eventId).collection('sectors').doc(sectorId).delete();

export const subscribeToSupplierForRegistration = (
    eventId: string,
    supplierId: string,
    callback: (data: any) => void,
    onError: (error: Error) => void
) => {
    let unsubscribes: (()=>void)[] = [];
    const data = { eventName: '', eventType: 'CREDENTIALING', allowPhotoChange: true, allowGuestUploads: false, supplier: null, allSectors: [] };
    
    const updateCallback = () => {
        if (data.supplier && data.allSectors.length > 0) {
            callback({ data: data.supplier, name: data.eventName, sectors: data.allSectors, allowPhotoChange: data.allowPhotoChange, type: data.eventType });
        }
    };

    unsubscribes.push(db.collection('events').doc(eventId).onSnapshot(snap => {
        const d = snap.data();
        data.eventName = d?.name || '';
        data.eventType = d?.type || 'CREDENTIALING';
        updateCallback();
    }));

    unsubscribes.push(db.collection('events').doc(eventId).collection('suppliers').doc(supplierId).onSnapshot(snap => {
        data.supplier = { ...getData<Supplier>(snap), eventId };
        updateCallback();
    }));

    unsubscribes.push(db.collection('events').doc(eventId).collection('sectors').onSnapshot(snap => {
        data.allSectors = getCollectionData<Sector>(snap);
        updateCallback();
    }));

    return () => unsubscribes.forEach(u => u());
};

export const subscribeToSupplierAdminData = (token: string, callback: (data: any) => void, onError: (error: Error) => void) => {
    const find = async () => {
        const snap = await db.collectionGroup('suppliers').where('adminToken', '==', token).limit(1).get();
        if (snap.empty) throw new Error("Inexistente.");
        const doc = snap.docs[0];
        const eventRef = doc.ref.parent.parent!;
        const eventId = eventRef.id;
        
        eventRef.collection('attendees').where('supplierId', '==', doc.id).onSnapshot(s => {
            callback({ eventName: 'Painel', attendees: getCollectionData(s), eventId, supplierId: doc.id, supplier: getData(doc), sectors: [] });
        });
    };
    find().catch(onError);
    return () => {};
};

export const authenticateUser = async (username: string, password: string): Promise<User | null> => {
    const snapshot = await db.collection('users').where('username', '==', username).limit(1).get();
    if (snapshot.empty) return null;
    const user = getData<User>(snapshot.docs[0]);
    return (user.password === password && user.active !== false) ? user : null;
};

export const getUsers = async (): Promise<User[]> => {
    const snapshot = await db.collection('users').orderBy('username', 'asc').get();
    return getCollectionData<User>(snapshot);
};

export const createUser = (userData: Omit<User, 'id'>) => db.collection('users').add({ ...userData, active: true });
export const updateUser = (id: string, data: Partial<User>) => db.collection('users').doc(id).update(data);
export const deleteUser = (id: string) => db.collection('users').doc(id).delete();

export const generateUserInvite = async (eventId: string, createdBy: string) => {
    const token = uuidv4();
    await db.collection('user_invites').add({ token, eventId, createdBy, used: false, createdAt: FieldValue.serverTimestamp() });
    return token;
};

export const validateUserInvite = async (token: string) => {
    const snap = await db.collection('user_invites').where('token', '==', token).where('used', '==', false).limit(1).get();
    if (snap.empty) throw new Error("Inválido.");
    return snap.docs[0].data();
};

export const registerUserWithInvite = async (token: string, userData: any) => {
    const snap = await db.collection('user_invites').where('token', '==', token).limit(1).get();
    const inv = snap.docs[0];
    await db.collection('users').add({ username: userData.username, password: userData.password, role: 'checkin', active: false, linkedEventIds: [inv.data().eventId] });
    await inv.ref.update({ used: true });
};
