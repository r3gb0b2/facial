
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
    await new Promise(r => setTimeout(r, 400));
    try {
      setError(null);
      const constraints = {
        video: { facingMode: 'user', width: { ideal: 480 }, height: { ideal: 480 }, frameRate: { ideal: 15 } }
      };
      const ms = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = ms;
      if (videoRef.current) {
        videoRef.current.srcObject = ms;
        await videoRef.current.play();
        setIsStreamActive(true);
      }
    } catch (err) {
      setError("Câmera indisponível.");
    }
  }, [capturedImage, tempImage, stopStream]);

  useEffect(() => {
    startStream();
    return () => stopStream();
  }, [capturedImage, tempImage, startStream, stopStream]);

  const processSource = async (source: HTMLVideoElement | Blob) => {
    setIsProcessing(true);
    try {
      const bitmap = await createImageBitmap(source, {
        resizeWidth: 480,
        resizeQuality: 'medium'
      });

      if (source instanceof HTMLVideoElement) stopStream();

      const canvas = document.createElement('canvas');
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const ctx = canvas.getContext('2d');
      
      if (ctx) {
        ctx.drawImage(bitmap, 0, 0);
        bitmap.close();

        canvas.toBlob((blob) => {
          if (blob) {
            // USAR OBJECT URL: Muito mais leve que Base64 para o Moto G53
            const blobUrl = URL.createObjectURL(blob);
            setTempImage(blobUrl);
            setIsProcessing(false);
            canvas.width = 0; // Manual clean
          }
        }, 'image/jpeg', 0.4);
      }
    } catch (e) {
      console.error(e);
      setIsProcessing(false);
      startStream();
    }
  };

  const handleConfirmImage = () => {
    if (tempImage) {
      onCapture(tempImage); // Passa o blob: URL para o pai
      setTempImage(null);   // Limpa estado local imediatamente
    }
  };

  const handleRetake = () => {
    if (capturedImage?.startsWith('blob:')) URL.revokeObjectURL(capturedImage);
    if (tempImage?.startsWith('blob:')) URL.revokeObjectURL(tempImage);
    onCapture('');
    setTempImage(null);
  };

  return (
    <div className="w-full max-w-sm mx-auto">
      <div className="relative w-full aspect-square bg-neutral-950 rounded-[2.5rem] overflow-hidden border-2 border-white/5 shadow-2xl">
        {capturedImage ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-indigo-950/20 p-8 text-center">
             <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(34,197,94,0.4)] mb-6">
                <CheckCircleIcon className="w-12 h-12 text-white" />
             </div>
             <p className="text-white font-black uppercase tracking-[0.2em] text-sm mb-2">BIO-IDENTIDADE OK</p>
             <p className="text-gray-500 text-[9px] font-bold uppercase tracking-widest">A foto foi validada e está aguardando o envio do formulário.</p>
          </div>
        ) : (
          <>
            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover bg-black"></video>
            {isProcessing && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 z-30 gap-4">
                <SpinnerIcon className="w-10 h-10 text-indigo-500 animate-spin" />
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
            Refazer Captura
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
              Capturar Foto
            </button>
            {allowUpload && (
              <div className="w-full">
                <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={(e) => {
                  const f = e.target.files?.[0];
                  if(f) processSource(f);
                }} />
                <button type="button" onClick={() => fileInputRef.current?.click()} className="w-full bg-white/5 text-neutral-500 font-black uppercase tracking-[0.2em] text-[9px] py-4 rounded-2xl border border-white/5 flex items-center justify-center gap-2">
                  <ArrowUpTrayIcon className="w-3 h-3" />
                  Galeria de Fotos
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {tempImage && (
        <div className="fixed inset-0 z-[200] bg-black/95 flex flex-col items-center justify-center p-6">
           <div className="w-full max-w-sm flex flex-col gap-8">
              <div className="text-center">
                <h3 className="text-white font-black uppercase tracking-[0.3em] text-xs mb-2">Confirmar Foto</h3>
                <p className="text-gray-500 text-[10px] font-bold uppercase tracking-widest">Verifique se está nítida.</p>
              </div>
              <div className="relative aspect-square w-full rounded-[3rem] overflow-hidden border-4 border-white/10">
                 <img src={tempImage} alt="Confirmação" className="w-full h-full object-cover" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                 <button onClick={() => { URL.revokeObjectURL(tempImage); setTempImage(null); startStream(); }} className="bg-neutral-900 text-gray-500 font-black uppercase tracking-widest text-[10px] py-5 rounded-3xl border border-white/5">Refazer</button>
                 <button onClick={handleConfirmImage} className="bg-white text-black font-black uppercase tracking-widest text-[10px] py-5 rounded-3xl shadow-xl">Confirmar</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default WebcamCapture;
