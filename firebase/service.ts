
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import { db, storage, FieldValue, Timestamp } from './config.ts';
import { Attendee, CheckinStatus, Event, Supplier, Sector, SubCompany, User, EventModules, EventType } from '../types.ts';
import { v4 as uuidv4 } from 'uuid';

// Helper to extract data and id from snapshots
const getData = <T>(doc: firebase.firestore.DocumentSnapshot): T => ({ id: doc.id, ...doc.data() } as T);
const getCollectionData = <T>(querySnapshot: firebase.firestore.QuerySnapshot): T[] => querySnapshot.docs.map(doc => getData<T>(doc));

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
        modules: modules || { // Default all to true if not provided
            scanner: true,
            logs: true,
            register: true,
            companies: true,
            spreadsheet: true,
            reports: true
        },
        allowPhotoChange: allowPhotoChange !== undefined ? allowPhotoChange : true, // Default to allowing changes
        allowGuestUploads: allowGuestUploads !== undefined ? allowGuestUploads : false // Default to disable uploads (live camera only)
    });
};

export const updateEvent = (id: string, name: string, type?: EventType, modules?: EventModules, allowPhotoChange?: boolean, allowGuestUploads?: boolean) => {
    const data: any = { name };
    if (type) {
        data.type = type;
    }
    if (modules) {
        data.modules = modules;
    }
    if (allowPhotoChange !== undefined) {
        data.allowPhotoChange = allowPhotoChange;
    }
    if (allowGuestUploads !== undefined) {
        data.allowGuestUploads = allowGuestUploads;
    }
    return db.collection('events').doc(id).update(data);
};

export const deleteEvent = (id: string) => {
    return db.collection('events').doc(id).delete();
};

// Realtime Data Subscription for a specific event
export const subscribeToEventData = (
    eventId: string,
    callback: (data: { attendees: Attendee[], suppliers: Supplier[], sectors: Sector[] }) => void,
    onError: (error: Error) => void
) => {
    const data = {
        attendees: [] as Attendee[],
        suppliers: [] as Supplier[],
        sectors: [] as Sector[],
    };

    const updateCallback = () => {
        callback({ ...data });
    };

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

// Attendee Management
export const getAttendees = async (eventId: string): Promise<Attendee[]> => {
    const snapshot = await db.collection('events').doc(eventId).collection('attendees').get();
    return getCollectionData<Attendee>(snapshot);
};

export const findAttendeeByCpf = async (cpf: string, eventId?: string): Promise<(Attendee & { eventId?: string }) | null> => {
    if (eventId) {
        const localSnapshot = await db.collection('events').doc(eventId).collection('attendees').where('cpf', '==', cpf).limit(1).get();
        if (!localSnapshot.empty) {
             const attendee = getData<Attendee>(localSnapshot.docs[0]);
             return { ...attendee, eventId: eventId };
        }
    }

    let query: firebase.firestore.Query = db.collectionGroup('attendees').where('cpf', '==', cpf).limit(1);
    
    const snapshot = await query.get();
    if (snapshot.empty) {
        return null;
    }
    
    const attendee = getData<Attendee>(snapshot.docs[0]);
    const docEventId = snapshot.docs[0].ref.parent.parent?.id;
    return { ...attendee, eventId: docEventId };
};

export const checkBlockedStatus = async (cpf: string): Promise<{ isBlocked: true, reason: string, eventName: string } | null> => {
    const snapshot = await db.collectionGroup('attendees')
        .where('cpf', '==', cpf)
        .where('status', '==', CheckinStatus.BLOCKED)
        .limit(1)
        .get();

    if (snapshot.empty) return null;

    const doc = snapshot.docs[0];
    const data = doc.data() as Attendee;
    
    let eventName = 'Evento desconhecido';
    const eventId = doc.ref.parent.parent?.id;
    
    if (eventId) {
        const eventSnap = await db.collection('events').doc(eventId).get();
        if (eventSnap.exists) {
            eventName = eventSnap.data()?.name || eventName;
        }
    }

    return { 
        isBlocked: true, 
        reason: data.blockReason || 'Motivo não informado', 
        eventName 
    };
}

const uploadPhoto = async (photoDataUrl: string, cpf: string): Promise<string> => {
    if (photoDataUrl.startsWith('http://') || photoDataUrl.startsWith('https://')) {
        return photoDataUrl;
    }
    const blob = await (await fetch(photoDataUrl)).blob();
    const ref = storage.ref(`photos/${cpf}-${Date.now()}.png`);
    const snapshot = await ref.put(blob);
    return snapshot.ref.getDownloadURL();
};

export const addAttendee = async (eventId: string, attendeeData: Omit<Attendee, 'id' | 'status' | 'eventId' | 'createdAt'>, supplierId?: string) => {
    let photoUrl = attendeeData.photo;
    if (attendeeData.photo.startsWith('data:image') || !attendeeData.photo.startsWith('http')) {
        photoUrl = await uploadPhoto(attendeeData.photo, attendeeData.cpf);
    }

    let initialStatus = attendeeData.blockReason ? CheckinStatus.PENDING_APPROVAL : CheckinStatus.PENDING;

    // Se o fornecedor exigir análise, o status inicial deve ser SUPPLIER_REVIEW
    if (supplierId) {
        const supplierSnap = await db.collection('events').doc(eventId).collection('suppliers').doc(supplierId).get();
        if (supplierSnap.exists && supplierSnap.data()?.needsApproval === true) {
            initialStatus = CheckinStatus.SUPPLIER_REVIEW;
        }
    }

    const data: Omit<Attendee, 'id'> = {
        ...attendeeData,
        email: attendeeData.email || '', 
        photo: photoUrl,
        eventId,
        status: initialStatus,
        createdAt: Timestamp.now(),
        ...(supplierId && { supplierId })
    };

    return db.collection('events').doc(eventId).collection('attendees').add(data);
};

export const requestNewRegistration = async (eventId: string, attendeeData: Omit<Attendee, 'id' | 'status' | 'eventId' | 'createdAt'>, supplierId: string) => {
    let photoUrl = attendeeData.photo;
    if (attendeeData.photo.startsWith('data:image')) {
        photoUrl = await uploadPhoto(attendeeData.photo, attendeeData.cpf);
    }

    const data: Omit<Attendee, 'id'> = {
        ...attendeeData,
        email: attendeeData.email || '',
        photo: photoUrl,
        eventId,
        status: CheckinStatus.PENDING_APPROVAL,
        createdAt: Timestamp.now(),
        supplierId,
    };

    return db.collection('events').doc(eventId).collection('attendees').add(data);
};

export const approveNewRegistration = (eventId: string, attendeeId: string) => {
    return db.collection('events').doc(eventId).collection('attendees').doc(attendeeId).update({
        status: CheckinStatus.PENDING,
    });
};

export const rejectNewRegistration = (eventId: string, attendeeId: string) => {
    return db.collection('events').doc(eventId).collection('attendees').doc(attendeeId).update({
        status: CheckinStatus.REJECTED
    });
};

export const approveAttendeesBySupplier = async (eventId: string, attendeeIds: string[]) => {
    if (attendeeIds.length === 0) return;
    const batch = db.batch();
    attendeeIds.forEach(id => {
        const ref = db.collection('events').doc(eventId).collection('attendees').doc(id);
        batch.update(ref, { status: CheckinStatus.PENDING });
    });
    await batch.commit();
};

export const blockAttendee = (eventId: string, attendeeId: string, reason?: string) => {
    return db.collection('events').doc(eventId).collection('attendees').doc(attendeeId).update({
        status: CheckinStatus.BLOCKED,
        blockReason: reason || ''
    });
}

export const unblockAttendee = (eventId: string, attendeeId: string) => {
    return db.collection('events').doc(eventId).collection('attendees').doc(attendeeId).update({
        status: CheckinStatus.PENDING,
        blockReason: FieldValue.delete()
    });
}

export const updateAttendeeStatus = (eventId: string, attendeeId: string, status: CheckinStatus, username: string, wristbands?: { [sectorId: string]: string }) => {
    const dataToUpdate: any = { status };

    switch (status) {
        case CheckinStatus.CHECKED_IN:
            dataToUpdate.checkinTime = FieldValue.serverTimestamp();
            dataToUpdate.checkedInBy = username;
            dataToUpdate.checkoutTime = FieldValue.delete();
            dataToUpdate.checkedOutBy = FieldValue.delete();
            if (wristbands !== undefined) {
                dataToUpdate.wristbands = wristbands;
            }
            break;
        case CheckinStatus.CHECKED_OUT:
            dataToUpdate.checkoutTime = FieldValue.serverTimestamp();
            dataToUpdate.checkedOutBy = username;
            break;
        case CheckinStatus.PENDING:
            dataToUpdate.checkinTime = FieldValue.delete();
            dataToUpdate.checkoutTime = FieldValue.delete();
            dataToUpdate.wristbands = FieldValue.delete();
            dataToUpdate.checkedInBy = FieldValue.delete();
            dataToUpdate.checkedOutBy = FieldValue.delete();
            break;
    }

    return db.collection('events').doc(eventId).collection('attendees').doc(attendeeId).update(dataToUpdate);
};

export const updateAttendeeDetails = async (eventId: string, attendeeId: string, data: Partial<Attendee>) => {
    const dataToUpdate = { ...data };
    
    if (dataToUpdate.photo && dataToUpdate.photo.startsWith('data:image')) {
        const identifier = dataToUpdate.cpf || attendeeId;
        dataToUpdate.photo = await uploadPhoto(dataToUpdate.photo, identifier);
    }

    return db.collection('events').doc(eventId).collection('attendees').doc(attendeeId).update(dataToUpdate);
};

export const deleteAttendee = (eventId: string, attendeeId: string) => {
    return db.collection('events').doc(eventId).collection('attendees').doc(attendeeId).delete();
};

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

    if (!attendee || !attendee.substitutionData) {
        throw new Error("Substitution data not found for this attendee.");
    }

    const { name, cpf, photo: photoDataUrl, newSectorIds } = attendee.substitutionData;

    if (typeof name !== 'string' || name.trim() === '') {
        throw new Error("Invalid substitution data: name is missing or invalid.");
    }
    if (typeof cpf !== 'string' || cpf.trim() === '') {
        throw new Error("Invalid substitution data: CPF is missing or invalid.");
    }

    const dataToUpdate: any = {
        name: name.trim(),
        cpf: cpf.trim(),
        status: CheckinStatus.PENDING,
        substitutionData: FieldValue.delete(),
    };

    if (photoDataUrl && photoDataUrl.startsWith('data:image')) {
        const photoUrl = await uploadPhoto(photoDataUrl, cpf);
        dataToUpdate.photo = photoUrl;
    }

    if (newSectorIds && Array.isArray(newSectorIds) && newSectorIds.length > 0) {
        dataToUpdate.sectors = newSectorIds;
    }

    return attendeeRef.update(dataToUpdate);
};

export const rejectSubstitution = (eventId: string, attendeeId: string) => {
    return db.collection('events').doc(eventId).collection('attendees').doc(attendeeId).update({
        status: CheckinStatus.PENDING,
        substitutionData: FieldValue.delete(),
    });
};

export const requestSectorChange = async (eventId: string, attendeeId: string, sectorChangeData: Required<Attendee>['sectorChangeData']) => {
    return db.collection('events').doc(eventId).collection('attendees').doc(attendeeId).update({
        status: CheckinStatus.SECTOR_CHANGE_REQUEST,
        sectorChangeData: sectorChangeData,
    });
};

export const approveSectorChange = async (eventId: string, attendeeId: string) => {
    const attendeeRef = db.collection('events').doc(eventId).collection('attendees').doc(attendeeId);
    const doc = await attendeeRef.get();
    const attendee = doc.data() as Attendee;

    if (!attendee || !attendee.sectorChangeData) {
        throw new Error("Sector change data not found for this attendee.");
    }
    
    const { newSectorId } = attendee.sectorChangeData;

    return attendeeRef.update({
        sectors: [newSectorId],
        status: CheckinStatus.PENDING,
        sectorChangeData: FieldValue.delete(),
    });
};

export const rejectSectorChange = (eventId: string, attendeeId: string) => {
    return db.collection('events').doc(eventId).collection('attendees').doc(attendeeId).update({
        status: CheckinStatus.PENDING,
        sectorChangeData: FieldValue.delete(),
    });
};

// FIX: Added missing sectorIds parameter to resolve "Cannot find name 'sectorIds'" and argument count mismatch in AdminView.tsx.
export const updateSectorsForAttendees = async (eventId: string, attendeeIds: string[], sectorIds: string[]) => {
    if (attendeeIds.length === 0) {
        return;
    }

    const batch = db.batch();
    attendeeIds.forEach(attendeeId => {
        const docRef = db.collection('events').doc(eventId).collection('attendees').doc(attendeeId);
        batch.update(docRef, { sectors: sectorIds });
    });

    await batch.commit();
};


// Supplier Management
export const addSupplier = (eventId: string, name: string, sectors: string[], registrationLimit: number, subCompanies: SubCompany[], email?: string, needsApproval?: boolean) => {
    const adminToken = uuidv4();
    return db.collection('events').doc(eventId).collection('suppliers').add({ 
        name, 
        email: email || '',
        sectors, 
        registrationLimit,
        subCompanies,
        active: true,
        adminToken,
        needsApproval: needsApproval || false
    });
};

export const updateSupplier = (eventId: string, supplierId: string, data: Partial<Supplier>) => {
    return db.collection('events').doc(eventId).collection('suppliers').doc(supplierId).update(data);
};

export const deleteSupplier = async (eventId: string, supplierId: string) => {
    const attendeesSnap = await db.collection('events').doc(eventId).collection('attendees').where('supplierId', '==', supplierId).get();
    if (!attendeesSnap.empty) {
        throw new Error("Supplier is in use and cannot be deleted.");
    }
    return db.collection('events').doc(eventId).collection('suppliers').doc(supplierId).delete();
};

export const updateSupplierStatus = (eventId: string, supplierId: string, active: boolean) => {
    return updateSupplier(eventId, supplierId, { active });
};

export const subscribeToSupplierForRegistration = (
    eventId: string,
    supplierId: string,
    callback: (data: { data: Supplier & { eventId: string }, name: string, sectors: Sector[], allowPhotoChange: boolean, allowGuestUploads: boolean, type: EventType } | null) => void,
    onError: (error: Error) => void
) => {
    const data = {
        eventName: null as string | null,
        eventType: 'CREDENTIALING' as EventType,
        allowPhotoChange: true as boolean,
        allowGuestUploads: false as boolean,
        supplier: null as (Supplier & { eventId: string }) | null,
        allSectors: null as Sector[] | null,
    };

    const updateCallback = () => {
        if (data.eventName !== null && data.supplier !== null && data.allSectors !== null) {
            const { eventName, eventType, supplier, allSectors, allowPhotoChange, allowGuestUploads } = data;
            const validSectorIds = new Set(allSectors.map(s => s.id));
            const dataForUI = { ...supplier };
            dataForUI.sectors = (supplier.sectors || []).filter(sectorId => validSectorIds.has(sectorId));
            dataForUI.subCompanies = (supplier.subCompanies || []).filter(sc => validSectorIds.has(sc.sector));
            callback({ data: dataForUI, name: eventName, sectors: allSectors, allowPhotoChange, allowGuestUploads, type: eventType });
        }
    };
    
    let unsubscribes: (()=>void)[] = [];
    const cleanup = () => unsubscribes.forEach(unsub => unsub());

    const handleError = (error: Error) => {
        cleanup();
        onError(error);
    };

    const eventUnsub = db.collection('events').doc(eventId).onSnapshot(eventSnap => {
        if (!eventSnap.exists) {
            handleError(new Error("Event not found"));
            return;
        }
        const eventData = eventSnap.data();
        data.eventName = eventData?.name || 'Evento';
        data.eventType = eventData?.type || 'CREDENTIALING';
        data.allowPhotoChange = eventData?.allowPhotoChange !== undefined ? eventData.allowPhotoChange : true;
        data.allowGuestUploads = eventData?.allowGuestUploads !== undefined ? eventData.allowGuestUploads : false;
        updateCallback();
    }, handleError);
    unsubscribes.push(eventUnsub);

    const supplierUnsub = db.collection('events').doc(eventId).collection('suppliers').doc(supplierId).onSnapshot(supplierSnap => {
        if (!supplierSnap.exists) {
            handleError(new Error("Supplier not found"));
            return;
        }
        data.supplier = { ...getData<Supplier>(supplierSnap), eventId };
        updateCallback();
    }, handleError);
    unsubscribes.push(supplierUnsub);

    const sectorsUnsub = db.collection('events').doc(eventId).collection('sectors').onSnapshot(sectorsSnap => {
        data.allSectors = getCollectionData<Sector>(sectorsSnap);
        updateCallback();
    }, handleError);
    unsubscribes.push(sectorsUnsub);

    return cleanup;
};

export const getRegistrationsCountForSupplier = async (eventId: string, supplierId: string): Promise<number> => {
    const snapshot = await db.collection('events').doc(eventId).collection('attendees').where('supplierId', '==', supplierId).get();
    return snapshot.size;
};

export const subscribeToSupplierAdminData = (
    token: string,
    callback: (data: { eventName: string, attendees: Attendee[], eventId: string, supplierId: string, supplier: Supplier, sectors: Sector[] }) => void,
    onError: (error: Error) => void
) => {
    let unsubscribes: (() => void)[] = [];

    const findAndSubscribe = async () => {
        unsubscribes.forEach(unsub => unsub());
        unsubscribes = [];

        const suppliersSnap = await db.collectionGroup('suppliers').where('adminToken', '==', token).limit(1).get();
        if (suppliersSnap.empty) {
            onError(new Error("Invalid token"));
            return;
        }

        const supplierDoc = suppliersSnap.docs[0];
        const eventRef = supplierDoc.ref.parent.parent;

        if (!eventRef) {
            onError(new Error("Event not found for supplier"));
            return;
        }

        let eventName: string | null = null;
        let supplier: Supplier | null = null;
        let sectors: Sector[] | null = null;
        let attendees: Attendee[] | null = null;
        
        const eventId = eventRef.id;

        const updateCallback = () => {
            if (eventName !== null && supplier !== null && sectors !== null && attendees !== null) {
                callback({ eventName, attendees, eventId, supplierId: supplier.id, supplier, sectors });
            }
        };

        const eventSnap = await eventRef.get();
        if (eventSnap.exists) {
            eventName = eventSnap.data()?.name || 'Evento';
        } else {
            onError(new Error("Event data could not be retrieved."));
            return;
        }

        const supplierUnsub = supplierDoc.ref.onSnapshot(doc => {
            supplier = getData<Supplier>(doc);
            updateCallback();
        }, onError);
        unsubscribes.push(supplierUnsub);

        const sectorsUnsub = eventRef.collection('sectors').onSnapshot(snap => {
            sectors = getCollectionData<Sector>(snap);
            updateCallback();
        }, onError);
        unsubscribes.push(sectorsUnsub);

        const attendeesUnsub = eventRef.collection('attendees').where('supplierId', '==', supplierDoc.id).onSnapshot(attendeesSnap => {
            attendees = getCollectionData<Attendee>(attendeesSnap);
            updateCallback();
        }, onError);
        unsubscribes.push(attendeesUnsub);
    };

    findAndSubscribe().catch(onError);
    return () => unsubscribes.forEach(unsub => unsub());
};

export const regenerateSupplierAdminToken = async (eventId: string, supplierId: string): Promise<string> => {
    const newToken = uuidv4();
    await updateSupplier(eventId, supplierId, { adminToken: newToken });
    return newToken;
};

// Sector Management
export const addSector = (eventId: string, label: string, color: string) => {
    return db.collection('events').doc(eventId).collection('sectors').add({ label, color });
};

export const updateSector = (eventId: string, sectorId: string, data: { label: string, color: string }) => {
    return db.collection('events').doc(eventId).collection('sectors').doc(sectorId).update(data);
};

export const deleteSector = async (eventId: string, sectorId: string) => {
    const suppliersSnap = await db.collection('events').doc(eventId).collection('suppliers').where('sectors', 'array-contains', sectorId).get();
    const attendeesSnap = await db.collection('events').doc(eventId).collection('attendees').where('sectors', 'array-contains', sectorId).get();

    if (!suppliersSnap.empty || !attendeesSnap.empty) {
        throw new Error('Sector is in use and cannot be deleted.');
    }
    return db.collection('events').doc(eventId).collection('sectors').doc(sectorId).delete();
};


// User Management
export const authenticateUser = async (username: string, password: string): Promise<User | null> => {
    const snapshot = await db.collection('users').where('username', '==', username).limit(1).get();
    if (snapshot.empty) {
        return null;
    }
    const user = getData<User>(snapshot.docs[0]);
    if (user.password === password) {
        if (user.active === false) {
            throw new Error("Este usuário está pendente de aprovação ou foi bloqueado.");
        }
        const { password: _, ...userWithoutPassword } = user;
        return userWithoutPassword as User;
    }
    return null;
};

export const getUsers = async (): Promise<User[]> => {
    const snapshot = await db.collection('users').orderBy('username', 'asc').get();
    return snapshot.docs.map(doc => {
        const data = doc.data();
        delete data.password;
        return { id: doc.id, ...data } as User;
    });
};

export const createUser = async (userData: Omit<User, 'id'>) => {
    const snapshot = await db.collection('users').where('username', '==', userData.username).get();
    if (!snapshot.empty) {
        throw new Error("Username already exists.");
    }
    const userWithStatus = {
        ...userData,
        active: userData.active !== undefined ? userData.active : true
    };
    return db.collection('users').add(userWithStatus);
};

// ONE-TIME INVITE SYSTEM
export const generateUserInvite = async (eventId: string, createdBy: string) => {
    const token = uuidv4();
    await db.collection('user_invites').add({
        token,
        eventId,
        createdBy,
        used: false,
        createdAt: FieldValue.serverTimestamp()
    });
    return token;
};

export const validateUserInvite = async (token: string): Promise<{ eventId: string, inviteId: string }> => {
    const snapshot = await db.collection('user_invites').where('token', '==', token).where('used', '==', false).limit(1).get();
    if (snapshot.empty) {
        throw new Error("Convite inválido ou já utilizado.");
    }
    const data = snapshot.docs[0].data();
    return { eventId: data.eventId, inviteId: snapshot.docs[0].id };
};

export const registerUserWithInvite = async (token: string, userData: Pick<User, 'username' | 'password'>) => {
     return db.runTransaction(async (transaction) => {
        const inviteQuery = await db.collection('user_invites').where('token', '==', token).where('used', '==', false).limit(1).get();
        if (inviteQuery.empty) {
             throw new Error("Convite inválido ou expirado.");
        }
        const inviteDoc = inviteQuery.docs[0];
        const inviteData = inviteDoc.data();

        const userQuery = await db.collection('users').where('username', '==', userData.username).limit(1).get();
        if (!userQuery.empty) {
            throw new Error("Nome de usuário já existe.");
        }

        const newUserRef = db.collection('users').doc();
        const newUser: Omit<User, 'id'> = {
            username: userData.username,
            password: userData.password,
            role: 'checkin',
            active: false, // Pending approval
            linkedEventIds: [inviteData.eventId],
            createdBy: 'invite_system'
        };
        
        transaction.set(newUserRef, newUser);
        transaction.update(inviteDoc.ref, { used: true, usedAt: FieldValue.serverTimestamp(), usedBy: newUserRef.id });
    });
};

export const registerPendingUser = async (userData: Pick<User, 'username' | 'password'>) => {
    const snapshot = await db.collection('users').where('username', '==', userData.username).get();
    if (!snapshot.empty) {
        throw new Error("Username already exists.");
    }
    const newUser: Omit<User, 'id'> = {
        username: userData.username,
        password: userData.password,
        role: 'checkin', 
        active: false,
        linkedEventIds: []
    };
    return db.collection('users').add(newUser);
};

export const updateUser = (id: string, data: Partial<User>) => {
    if (!data.password) {
        delete data.password;
    }
    return db.collection('users').doc(id).update(data);
};

export const deleteUser = (id: string) => {
    return db.collection('users').doc(id).delete();
};
