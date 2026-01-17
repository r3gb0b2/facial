
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { CameraIcon, RefreshIcon, ArrowUpTrayIcon, SpinnerIcon, ArrowPathIcon, CheckCircleIcon, XMarkIcon } from './icons.tsx';
import { useTranslation } from '../hooks/useTranslation.tsx';

interface WebcamCaptureProps {
  onCapture: (imageDataUrl: string) => void;
  capturedImage: string | null;
  disabled?: boolean;
  allowUpload?: boolean;
}

const WebcamCapture: React.FC<WebcamCaptureProps> = ({ onCapture, capturedImage, disabled = false, allowUpload = true }) => {
  const { t } = useTranslation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  const [isStreamActive, setIsStreamActive] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tempImage, setTempImage] = useState<string | null>(null);
  const [isClosingModal, setIsClosingModal] = useState(false);

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        track.stop();
        track.enabled = false;
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
    }
    setIsStreamActive(false);
  }, []);

  const startStream = useCallback(async () => {
    if (capturedImage || tempImage) return;
    
    stopStream();
    await new Promise(r => setTimeout(r, 600)); // Delay maior para estabilidade do driver
    
    try {
      setError(null);
      const constraints = {
        video: { 
          facingMode: 'user', 
          width: { ideal: 480 }, 
          height: { ideal: 480 }, 
          frameRate: { ideal: 20 } 
        }
      };
      const ms = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = ms;
      if (videoRef.current) {
        videoRef.current.srcObject = ms;
        videoRef.current.setAttribute('playsinline', 'true');
        await videoRef.current.play();
        setIsStreamActive(true);
      }
    } catch (err) {
      console.error(err);
      setError("Falha ao abrir câmera.");
    }
  }, [capturedImage, tempImage, stopStream]);

  useEffect(() => {
    if (!capturedImage && !tempImage) {
      startStream();
    }
    return () => stopStream();
  }, [capturedImage, tempImage, startStream, stopStream]);

  const processSource = async (source: HTMLVideoElement | Blob) => {
    setIsProcessing(true);
    try {
      // 1. CAPTURAR BITMAP PRIMEIRO (Câmera ainda ligada para não vir preto)
      const bitmap = await createImageBitmap(source, {
        resizeWidth: 480,
        resizeQuality: 'medium'
      });

      // 2. DESLIGAR HARDWARE (Agora é seguro liberar a RAM da câmera)
      if (source instanceof HTMLVideoElement) stopStream();

      const canvas = document.createElement('canvas');
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const ctx = canvas.getContext('2d', { alpha: false });
      
      if (ctx) {
        ctx.drawImage(bitmap, 0, 0);
        bitmap.close();

        canvas.toBlob((blob) => {
          if (blob) {
            const blobUrl = URL.createObjectURL(blob);
            setTempImage(blobUrl);
            setIsProcessing(false);
            // Garbage collection
            canvas.width = 0;
            canvas.height = 0;
          }
        }, 'image/jpeg', 0.5);
      }
    } catch (e) {
      console.error("Capture Error:", e);
      setIsProcessing(false);
      startStream(); // Volta para a câmera se falhar
    }
  };

  const handleConfirmImage = async () => {
    if (!tempImage || isClosingModal) return;
    setIsClosingModal(true);
    await new Promise(r => setTimeout(r, 250));
    onCapture(tempImage);
    await new Promise(r => setTimeout(r, 350));
    setTempImage(null);
    setIsClosingModal(false);
  };

  const handleRetake = () => {
    if (capturedImage?.startsWith('blob:')) URL.revokeObjectURL(capturedImage);
    if (tempImage?.startsWith('blob:')) URL.revokeObjectURL(tempImage);
    onCapture('');
    setTempImage(null);
    startStream();
  };

  return (
    <div className="w-full max-w-sm mx-auto">
      <div className="relative w-full aspect-square bg-neutral-950 rounded-[2.5rem] overflow-hidden border-2 border-white/5 shadow-2xl">
        {capturedImage ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-indigo-950/20 p-8 text-center animate-in fade-in duration-500">
             <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(34,197,94,0.3)] mb-4">
                <CheckCircleIcon className="w-10 h-10 text-white" />
             </div>
             <p className="text-white font-black uppercase tracking-[0.2em] text-xs mb-1">Biometria Pronta</p>
             <p className="text-gray-500 text-[9px] font-bold uppercase tracking-widest">A foto foi validada.</p>
          </div>
        ) : (
          <>
            {/* O Vídeo continua montado durante o isProcessing para evitar flash de tela preta */}
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              muted 
              className={`w-full h-full object-cover bg-black transition-opacity duration-300 ${tempImage ? 'opacity-0' : 'opacity-100'}`}
            ></video>
            
            {isProcessing && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 z-30 gap-4">
                <SpinnerIcon className="w-8 h-8 text-indigo-500 animate-spin" />
                <p className="text-[10px] font-black text-white uppercase tracking-[0.3em]">Processando...</p>
              </div>
            )}
          </>
        )}
      </div>

      <div className="mt-8 space-y-4 px-4">
        {capturedImage ? (
          <button type="button" onClick={handleRetake} className="w-full bg-neutral-800 text-white font-black uppercase tracking-[0.2em] text-[10px] py-5 rounded-2xl flex items-center justify-center gap-3">
            <RefreshIcon className="w-4 h-4"/>
            Refazer Biometria
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={() => !isProcessing && videoRef.current && processSource(videoRef.current)}
              disabled={!isStreamActive || isProcessing}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase tracking-[0.2em] text-[10px] py-5 rounded-2xl shadow-xl transition-all active:scale-95 disabled:opacity-30 flex items-center justify-center gap-3"
            >
              <CameraIcon className="w-5 h-5" />
              Capturar Biometria
            </button>
            {allowUpload && (
              <div className="w-full">
                <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={(e) => {
                  const f = e.target.files?.[0];
                  if(f) processSource(f);
                }} />
                <button type="button" onClick={() => fileInputRef.current?.click()} className="w-full bg-white/5 text-neutral-500 font-black uppercase tracking-[0.2em] text-[9px] py-4 rounded-2xl border border-white/5 flex items-center justify-center gap-2">
                  <ArrowUpTrayIcon className="w-3 h-3" />
                  Galeria do Celular
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {tempImage && (
        <div className={`fixed inset-0 z-[200] bg-black/95 flex flex-col items-center justify-center p-6 transition-opacity duration-300 ${isClosingModal ? 'opacity-0' : 'opacity-100'}`}>
           <div className="w-full max-w-sm flex flex-col gap-8">
              <div className="text-center">
                <h3 className="text-white font-black uppercase tracking-[0.3em] text-xs mb-2">Validar Foto</h3>
                <p className="text-gray-500 text-[10px] font-bold uppercase tracking-widest">Verifique se seu rosto está visível.</p>
              </div>
              <div className="relative aspect-square w-full rounded-[3rem] overflow-hidden border-4 border-white/10 shadow-2xl">
                 <img src={tempImage} alt="Confirm" className="w-full h-full object-cover" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                 <button 
                  onClick={() => { URL.revokeObjectURL(tempImage); setTempImage(null); startStream(); }} 
                  disabled={isClosingModal}
                  className="bg-neutral-900 text-gray-500 font-black uppercase tracking-widest text-[10px] py-5 rounded-3xl border border-white/5 disabled:opacity-50"
                 >
                   Refazer
                 </button>
                 <button 
                  onClick={handleConfirmImage}
                  disabled={isClosingModal}
                  className="bg-white text-black font-black uppercase tracking-widest text-[10px] py-5 rounded-3xl shadow-xl flex items-center justify-center gap-2 disabled:opacity-50"
                 >
                   {isClosingModal ? <SpinnerIcon className="w-4 h-4 animate-spin"/> : "Confirmar"}
                 </button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default WebcamCapture;
