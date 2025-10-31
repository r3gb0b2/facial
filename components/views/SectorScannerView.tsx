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
    const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
    const readerId = "sector-qr-reader";
    const [isScanning, setIsScanning] = useState(false);

    const sector = sectors.find(s => s.id === validationPoint.sectorId);

    useEffect(() => {
        if (!html5QrCodeRef.current) {
            html5QrCodeRef.current = new Html5Qrcode(readerId, {
                // verbose: true 
            });
        }

        const startScanner = async () => {
            try {
                if (html5QrCodeRef.current && !html5QrCodeRef.current.isScanning) {
                    setIsScanning(true);
                    await html5QrCodeRef.current.start(
                        { facingMode: "environment" },
                        { fps: 10, qrbox: { width: 250, height: 250 } },
                        handleScanSuccess,
                        (errorMessage) => { /* ignore */ }
                    );
                }
            } catch (err) {
                console.error("Scanner start error:", err);
                setError(t('qrScanner.permissionError'));
                setIsScanning(false);
            }
        };

        startScanner();

        return () => {
            if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
                html5QrCodeRef.current.stop().catch(err => console.error("Failed to stop scanner on cleanup.", err));
            }
        };
    }, []);

    const handleScanSuccess = async (decodedText: string) => {
        const scannedWristband = decodedText.trim();
        const foundAttendee = attendees.find(a =>
            a.status === CheckinStatus.CHECKED_IN && a.wristbands && Object.values(a.wristbands).includes(scannedWristband)
        );

        if (foundAttendee) {
            try {
                await onRecordAccess(eventId, foundAttendee.id, validationPoint.sectorId);
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
        } else {
            const alreadyScanned = attendees.find(a => a.wristbands && Object.values(a.wristbands).includes(scannedWristband));
             setLastScanned({
                attendee: alreadyScanned || { name: 'Desconhecido', photo: '' } as Attendee,
                status: 'error',
                message: alreadyScanned ? 'Colaborador não está com check-in ativo.' : t('qrScanner.noAttendee')
            });
        }
    };

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