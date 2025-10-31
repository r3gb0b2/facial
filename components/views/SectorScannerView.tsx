import React, { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Attendee, CheckinStatus, ValidationPoint, Sector } from '../../types.ts';
import { useTranslation } from '../../hooks/useTranslation.tsx';
import { QrCodeIcon, CheckCircleIcon, XMarkIcon } from '../icons.tsx';

interface SectorScannerViewProps {
    eventId: string;
    eventName: string;
    validationPoint: ValidationPoint;
    sectors: Sector[];
    attendees: Attendee[];
    onRecordAccess: (eventId: string, attendeeId: string, sectorId: string) => Promise<void>;
    setError: (message: string) => void;
}

const SectorScannerView: React.FC<SectorScannerViewProps> = ({ eventId, eventName, validationPoint, sectors, attendees, onRecordAccess, setError }) => {
    const { t } = useTranslation();
    const [lastScanned, setLastScanned] = useState<{ attendee: Attendee, status: 'success' | 'error', message: string } | null>(null);
    const readerId = "sector-qr-reader";

    // Refs to hold the latest version of props that change frequently.
    // This prevents the camera's useEffect from re-running unnecessarily.
    const attendeesRef = useRef(attendees);
    useEffect(() => {
        attendeesRef.current = attendees;
    }, [attendees]);
    
    const onRecordAccessRef = useRef(onRecordAccess);
    useEffect(() => {
        onRecordAccessRef.current = onRecordAccess;
    }, [onRecordAccess]);


    const sector = sectors.find(s => s.id === validationPoint.sectorId);

    // This effect manages the camera lifecycle. It should only run once on mount and clean up on unmount.
    useEffect(() => {
        const qrScanner = new Html5Qrcode(readerId, false);
        let isStopped = false;

        const handleScanSuccess = async (decodedText: string) => {
            if (isStopped) return;

            const currentAttendees = attendeesRef.current;
            const recordAccess = onRecordAccessRef.current;
            
            const scannedWristband = decodedText.trim();
            const foundAttendee = currentAttendees.find(a => 
                a.wristbands && Object.values(a.wristbands).includes(scannedWristband)
            );

            if (!foundAttendee) {
                setLastScanned({
                    attendee: { name: 'Desconhecido', photo: '' } as Attendee,
                    status: 'error',
                    message: t('qrScanner.noAttendee')
                });
                return;
            }

            if (foundAttendee.status !== CheckinStatus.CHECKED_IN) {
                setLastScanned({
                    attendee: foundAttendee,
                    status: 'error',
                    message: 'Colaborador não está com check-in ativo.'
                });
                return;
            }

            const hasPermission = (foundAttendee.sectors || []).includes(validationPoint.sectorId);
            if (!hasPermission) {
                setLastScanned({
                    attendee: foundAttendee,
                    status: 'error',
                    message: t('sectorScanner.sectorNotAllowed')
                });
                return;
            }
    
            try {
                await recordAccess(eventId, foundAttendee.id, validationPoint.sectorId);
                setLastScanned({
                    attendee: foundAttendee,
                    status: 'success',
                    message: t('sectorScanner.scanSuccess')
                });
            } catch (err) {
                setLastScanned({
                    attendee: foundAttendee,
                    status: 'error',
                    message: t('sectorScanner.scanError')
                });
            }
        };

        qrScanner.start(
            { facingMode: "environment" },
            { fps: 10, qrbox: { width: 250, height: 250 } },
            handleScanSuccess,
            (errorMessage) => { /* ignore error message */ }
        ).catch(err => {
            console.error("Scanner start error:", err);
            setError(t('qrScanner.permissionError'));
        });

        // Cleanup function for when the component unmounts
        return () => {
            isStopped = true;
            if (qrScanner && qrScanner.isScanning) {
                qrScanner.stop()
                    .then(() => qrScanner.clear())
                    .catch(err => console.error("Failed to stop scanner on cleanup.", err));
            }
        };
    // This dependency array is intentionally minimal. It ensures the camera lifecycle logic
    // does not re-run when props like 'attendees' or 'onRecordAccess' change.
    }, [eventId, validationPoint.sectorId, t, setError]);


    return (
        <div className="min-h-screen flex items-center justify-center p-4">
            <div className="w-full max-w-lg mx-auto bg-gray-800/50 backdrop-blur-sm p-8 rounded-2xl shadow-2xl border border-gray-700">
                <div className="text-center">
                    <QrCodeIcon className="w-12 h-12 mx-auto text-indigo-400 mb-2" />
                    <h1 className="text-2xl font-bold text-white">{t('sectorScanner.title')}</h1>
                    <p className="text-gray-400 text-lg">{eventName}</p>
                    <div className="mt-4 p-3 rounded-lg" style={{ backgroundColor: sector ? `${sector.color}20` : '#4B556320', border: `1px solid ${sector?.color || '#4B5563'}` }}>
                        <p className="text-sm font-medium text-gray-400">{t('sectorScanner.validatingFor')}</p>
                        <p className="text-xl font-bold" style={{ color: sector?.color || 'white' }}>{sector?.label || '...'}</p>
                    </div>
                </div>

                <div id={readerId} className="w-full aspect-square mt-6 border-2 border-dashed border-gray-600 rounded-lg overflow-hidden bg-black"></div>

                {lastScanned && (
                     <div className="mt-6 p-4 bg-gray-900/50 rounded-lg border border-gray-700 animate-fade-in-up">
                        <div className="flex items-center gap-4">
                            <img src={lastScanned.attendee.photo} alt={lastScanned.attendee.name} className="w-16 h-16 rounded-lg object-contain bg-black border-2 border-gray-600" />
                            <div>
                                <h3 className="text-lg font-bold text-white">{lastScanned.attendee.name}</h3>
                                <div className={`mt-1 inline-flex items-center gap-1.5 px-2 py-1 text-xs font-bold rounded ${lastScanned.status === 'success' ? 'bg-green-600/50 text-green-200' : 'bg-red-600/50 text-red-200'}`}>
                                    {lastScanned.status === 'success' ? <CheckCircleIcon className="w-4 h-4"/> : <XMarkIcon className="w-4 h-4"/>}
                                    {lastScanned.message}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SectorScannerView;