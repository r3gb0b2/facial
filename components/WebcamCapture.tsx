
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { CameraIcon, RefreshIcon, SpinnerIcon, CheckCircleIcon } from './icons.tsx';

interface WebcamCaptureProps {
  onCapture: (imageDataUrl: string) => void;
  capturedImage: string | null;
  disabled?: boolean;
  allowUpload?: boolean;
}

const WebcamCapture: React.FC<WebcamCaptureProps> = ({ onCapture, capturedImage, disabled = false, allowUpload = true }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  const [isStreamActive, setIsStreamActive] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [tempImage, setTempImage] = useState<string | null>(null);

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
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
    try {
      const constraints = {
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 640 } }
      };
      const ms = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = ms;
      if (videoRef.current) {
        videoRef.current.srcObject = ms;
        await videoRef.current.play();
        setIsStreamActive(true);
      }
    } catch (err) {
      console.error("Câmera indisponível");
    }
  }, [capturedImage, tempImage, stopStream]);

  useEffect(() => {
    startStream();
    return () => stopStream();
  }, [capturedImage, tempImage, startStream, stopStream]);

  const processSource = async (source: HTMLVideoElement | Blob) => {
    setIsProcessing(true);
    try {
      // Liberação de hardware IMEDIATA
      if (source instanceof HTMLVideoElement) {
          const bitmap = await createImageBitmap(source, { resizeWidth: 640, resizeHeight: 640 });
          stopStream(); // Mata a câmera AGORA
          const canvas = document.createElement('canvas');
          canvas.width = 640; canvas.height = 640;
          const ctx = canvas.getContext('2d', { alpha: false });
          if (ctx) {
            ctx.drawImage(bitmap, 0, 0);
            bitmap.close();
            canvas.toBlob((blob) => {
              if (blob) setTempImage(URL.createObjectURL(blob));
              setIsProcessing(false);
            }, 'image/jpeg', 0.4);
          }
      } else {
          // Se for arquivo
          const bitmap = await createImageBitmap(source, { resizeWidth: 640, resizeHeight: 640 });
          const canvas = document.createElement('canvas');
          canvas.width = 640; canvas.height = 640;
          const ctx = canvas.getContext('2d', { alpha: false });
          if (ctx) {
            ctx.drawImage(bitmap, 0, 0);
            bitmap.close();
            canvas.toBlob((blob) => {
              if (blob) setTempImage(URL.createObjectURL(blob));
              setIsProcessing(false);
            }, 'image/jpeg', 0.4);
          }
      }
    } catch (e) {
      console.error(e);
      setIsProcessing(false);
      startStream();
    }
  };

  const handleConfirmImage = () => {
    if (!tempImage) return;
    const finalUrl = tempImage;
    setTempImage(null);
    onCapture(finalUrl);
  };

  return (
    <div className="w-full max-w-sm mx-auto">
      <div className="relative w-full aspect-square bg-neutral-950 rounded-[2.5rem] overflow-hidden border-2 border-white/5 shadow-2xl">
        {capturedImage ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-indigo-500/10 p-8 text-center animate-in fade-in duration-500">
             <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(34,197,94,0.3)] mb-6">
                <CheckCircleIcon className="w-12 h-12 text-white" />
             </div>
             <p className="text-white font-black uppercase tracking-[0.3em] text-xs">Biometria OK</p>
          </div>
        ) : (
          <>
            {!tempImage && (
              <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover bg-black"></video>
            )}
            {isProcessing && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 z-30">
                <SpinnerIcon className="w-8 h-8 text-indigo-500 animate-spin" />
              </div>
            )}
          </>
        )}
      </div>

      <div className="mt-8 px-4">
        {capturedImage ? (
          <button type="button" onClick={() => { onCapture(''); startStream(); }} disabled={disabled} className="w-full bg-neutral-800 text-white font-black uppercase tracking-[0.2em] text-[10px] py-5 rounded-2xl flex items-center justify-center gap-3">
             <RefreshIcon className="w-4 h-4"/> Refazer Foto
          </button>
        ) : (
          <>
            <button type="button" onClick={() => !isProcessing && videoRef.current && processSource(videoRef.current)} disabled={!isStreamActive || isProcessing || disabled} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase tracking-[0.2em] text-[10px] py-5 rounded-2xl shadow-xl transition-all active:scale-95 disabled:opacity-30 flex items-center justify-center gap-3">
              <CameraIcon className="w-5 h-5" /> Capturar Foto
            </button>
            {allowUpload && !disabled && (
              <div className="mt-4 text-center">
                <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={(e) => {
                  const f = e.target.files?.[0];
                  if(f) processSource(f);
                }} />
                <button type="button" onClick={() => fileInputRef.current?.click()} className="text-neutral-600 font-black uppercase tracking-[0.2em] text-[9px] py-2">
                  Ou usar Galeria
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {tempImage && (
        <div className="fixed inset-0 z-[300] bg-black/95 backdrop-blur-md flex flex-col items-center justify-center p-6">
           <div className="w-full max-w-xs flex flex-col gap-8 animate-in zoom-in-95 duration-300">
              <div className="relative aspect-square w-full rounded-[3rem] overflow-hidden border-4 border-white/10">
                 <img src={tempImage} alt="Confirm" className="w-full h-full object-cover" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                 <button onClick={() => { URL.revokeObjectURL(tempImage); setTempImage(null); startStream(); }} className="bg-neutral-900 text-gray-500 font-black uppercase tracking-widest text-[10px] py-6 rounded-3xl">Refazer</button>
                 <button onClick={handleConfirmImage} className="bg-white text-black font-black uppercase tracking-widest text-[10px] py-6 rounded-3xl shadow-xl">Confirmar</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default WebcamCapture;
