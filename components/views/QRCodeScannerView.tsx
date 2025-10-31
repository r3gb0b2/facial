import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Attendee, CheckinStatus, Event } from '../../types';
import { useTranslation } from '../../hooks/useTranslation.tsx';
import { QrCodeIcon, SpinnerIcon, CheckCircleIcon, XMarkIcon } from '../icons.tsx';

interface QRCodeScannerViewProps {
    currentEvent: Event;
    attendees: Attendee[];
    onUpdateStatus: (attendeeId: string, status: CheckinStatus) => Promise<void>;
    setError: (message: string) => void;
}

const QRCodeScannerView: React.FC<QRCodeScannerViewProps> = ({ currentEvent, attendees, onUpdateStatus, setError }) => {
    const { t } = useTranslation();
    const [isScanning, setIsScanning] = useState(false);
    const [scannedAttendee, setScannedAttendee] = useState<Attendee | null>(null);
    const [scanResult, setScanResult] = useState<{ type: 'success' | 'error', message: string} | null>(null);
    const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
    const readerId = "qr-reader";

    const attendeesMap = useMemo(() => new Map(attendees.map(a => [a.id, a])), [attendees]);

    const stopScanning = () => {
        if (html5QrCodeRef.current && isScanning) {
            html5QrCodeRef.current.stop().then(() => {
                setIsScanning(false);
                html5QrCodeRef.current?.clear();
            }).catch(err => {
                console.error("Failed to stop scanning:", err);
            });
        }
    };
    
    useEffect(() => {
        // Cleanup on component unmount
        return () => {
            if(html5QrCodeRef.current) {
                try {
                     html5QrCodeRef.current.clear();
                } catch(e) {
                    console.error("Error clearing scanner on unmount", e);
                }
            }
        };
    }, []);

    const startScanning = async () => {
        if (isScanning) return;

        setScannedAttendee(null);
        setScanResult(null);

        try {
            if (!html5QrCodeRef.current) {
                html5QrCodeRef.current = new Html5Qrcode(readerId);
            }
            setIsScanning(true);

            const cameras = await Html5Qrcode.getCameras();
            if (cameras && cameras.length) {
                const cameraId = cameras.find(camera => camera.label.toLowerCase().includes('back'))?.id || cameras[0].id;
                
                await html5QrCodeRef.current.start(
                    cameraId,
                    { fps: 10, qrbox: { width: 250, height: 250 } },
                    (decodedText, decodedResult) => {
                        handleScanSuccess(decodedText);
                        stopScanning();
                    },
                    (errorMessage) => {
                        // console.warn(`QR Code no match: ${errorMessage}`);
                    }
                );
            } else {
                setError(t('qrScanner.noCameraFound'));
                setIsScanning(false);
            }
        } catch (err: any) {
            console.error("Error starting scanner:", err);
            setError(t('qrScanner.permissionError'));
            setIsScanning(false);
        }
    };
    
    const handleScanSuccess = (decodedText: string) => {
        const scannedWristband = decodedText.trim();
        if (!scannedWristband) {
            setScanResult({ type: 'error', message: t('qrScanner.invalidCode')});
            return;
        }

        const foundAttendee = attendees.find(a => 
            a.wristbands && Object.values(a.wristbands).includes(scannedWristband)
        );

        if (foundAttendee) {
            setScannedAttendee(foundAttendee);
            setScanResult({ type: 'success', message: t('qrScanner.attendeeFound') });
        } else {
            setScanResult({ type: 'error', message: t('qrScanner.noAttendee') });
        }
    };

    const handleActionClick = async () => {
        if (!scannedAttendee) return;
        
        let newStatus: CheckinStatus | null = null;
        if(scannedAttendee.status === CheckinStatus.PENDING || scannedAttendee.status === CheckinStatus.MISSED) {
            newStatus = CheckinStatus.CHECKED_IN;
        } else if (scannedAttendee.status === CheckinStatus.CHECKED_IN) {
            newStatus = CheckinStatus.CHECKED_OUT;
        } else if (scannedAttendee.status === CheckinStatus.CHECKED_OUT) {
             newStatus = CheckinStatus.CHECKED_IN; // Re-entry
        }

        if (newStatus) {
            try {
                await onUpdateStatus(scannedAttendee.id, newStatus);
                // Refresh the local attendee state to show the new status
                setScannedAttendee(prev => prev ? { ...prev, status: newStatus! } : null);
            } catch(e) {
                setError("Falha ao atualizar status.");
            }
        }
    };
    
    const statusInfo = scannedAttendee ? {
        [CheckinStatus.PENDING]: { bg: 'bg-gray-600', text: 'text-gray-200', label: t('status.pending') },
        [CheckinStatus.CHECKED_IN]: { bg: 'bg-green-600', text: 'text-white', label: t('status.checked_in') },
        [CheckinStatus.CHECKED_OUT]: { bg: 'bg-slate-500', text: 'text-white', label: t('status.checked_out') },
        [CheckinStatus.CANCELLED]: { bg: 'bg-red-600', text: 'text-white', label: t('status.cancelled') },
    }[scannedAttendee.status] || { bg: 'bg-gray-700', text: 'text-white', label: scannedAttendee.status } : null;

    const actionButton = () => {
        if (!scannedAttendee) return null;

        let label = '';
        let style = 'bg-gray-500 cursor-not-allowed';
        let enabled = false;

        switch(scannedAttendee.status) {
            case CheckinStatus.PENDING:
            case CheckinStatus.MISSED:
                label = t('statusUpdateModal.confirmCheckin');
                style = 'bg-green-600 hover:bg-green-700';
                enabled = true;
                break;
            case CheckinStatus.CHECKED_IN:
                 label = t('attendeeDetail.confirmCheckout');
                 style = 'bg-yellow-600 hover:bg-yellow-700';
                 enabled = true;
                 break;
            case CheckinStatus.CHECKED_OUT:
                label = t('qrScanner.reentry');
                style = 'bg-blue-600 hover:bg-blue-700';
                enabled = true;
                break;
        }
        
        if (!enabled) return null;

        return (
             <button onClick={handleActionClick} className={`w-full font-bold py-4 px-4 rounded-lg text-white transition-colors ${style}`}>
                {label}
            </button>
        )
    }

    return (
        <div className="w-full max-w-xl mx-auto">
            <div className="bg-gray-800/50 backdrop-blur-sm p-8 rounded-2xl shadow-2xl border border-gray-700">
                <h2 className="text-3xl font-bold text-white mb-6 flex items-center justify-center gap-3">
                    <QrCodeIcon className="w-8 h-8" />
                    {t('qrScanner.title')}
                </h2>
                
                <div id={readerId} className="w-full border-2 border-dashed border-gray-600 rounded-lg overflow-hidden"></div>

                {!isScanning && (
                     <p className="text-center text-gray-400 mt-4">{t('qrScanner.scanning')}</p>
                )}

                <div className="mt-6 flex gap-4">
                    <button onClick={startScanning} disabled={isScanning} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-lg disabled:bg-gray-500 disabled:cursor-not-allowed">
                        {t('qrScanner.start')}
                    </button>
                    <button onClick={stopScanning} disabled={!isScanning} className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-4 rounded-lg disabled:bg-gray-500 disabled:cursor-not-allowed">
                        {t('qrScanner.stop')}
                    </button>
                </div>

                {scanResult && (
                    <div className={`mt-6 text-center p-3 rounded-lg border flex items-center justify-center gap-2 ${scanResult.type === 'success' ? 'bg-green-500/20 text-green-300 border-green-500' : 'bg-red-500/20 text-red-300 border-red-500'}`}>
                        {scanResult.type === 'success' ? <CheckCircleIcon className="w-5 h-5"/> : <XMarkIcon className="w-5 h-5"/>}
                        <p className="font-semibold">{scanResult.message}</p>
                    </div>
                )}
                
                {scannedAttendee && (
                    <div className="mt-6 p-4 bg-gray-900/50 rounded-lg border border-gray-700 animate-fade-in-up">
                        <div className="flex items-center gap-4">
                            <img src={scannedAttendee.photo} alt={scannedAttendee.name} className="w-24 h-24 rounded-lg object-contain bg-black border-2 border-gray-600" />
                            <div>
                                <h3 className="text-xl font-bold text-white">{scannedAttendee.name}</h3>
                                {statusInfo && (
                                     <div className={`mt-1 inline-flex px-2 py-1 text-xs font-bold rounded ${statusInfo.bg} ${statusInfo.text}`}>
                                        {statusInfo.label}
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="mt-4 space-y-2">
                           {actionButton()}
                           <button onClick={startScanning} className="w-full font-bold py-3 px-4 rounded-lg text-indigo-400 hover:bg-indigo-500/10 transition-colors">
                                {t('qrScanner.scanNext')}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default QRCodeScannerView;