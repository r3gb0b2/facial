
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { CameraIcon, RefreshIcon, ArrowUpTrayIcon, SpinnerIcon, CheckCircleIcon, XMarkIcon } from './icons.tsx';
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
  const [tempImage, setTempImage] = useState<string | null>(null);

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
      videoRef.current.load(); // Força release de hardware
    }
    setIsStreamActive(false);
  }, []);

  const startStream = useCallback(async () => {
    if (capturedImage || tempImage) return;
    stopStream();
    await new Promise(r => setTimeout(r, 600));
    try {
      const constraints = {
        video: { facingMode: 'user', width: { ideal: 400 }, height: { ideal: 400 }, frameRate: { ideal: 15 } }
      };
      const ms = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = ms;
      if (videoRef.current) {
        videoRef.current.srcObject = ms;
        await videoRef.current.play();
        setIsStreamActive(true);
      }
    } catch (err) {
      console.error("Camera Error:", err);
    }
  }, [capturedImage, tempImage, stopStream]);

  useEffect(() => {
    startStream();
    return () => stopStream();
  }, [capturedImage, tempImage, startStream, stopStream]);

  const processSource = async (source: HTMLVideoElement | Blob) => {
    setIsProcessing(true);
    try {
      // Captura o bitmap antes de qualquer outra ação
      const bitmap = await createImageBitmap(source, {
        resizeWidth: 400,
        resizeQuality: 'low'
      });

      // Se for vídeo, para a câmera logo após pegar o bitmap
      if (source instanceof HTMLVideoElement) stopStream();

      const canvas = document.createElement('canvas');
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
      
      if (ctx) {
        ctx.drawImage(bitmap, 0, 0);
        bitmap.close();

        // 0.3 de qualidade para evitar crash no Moto G53
        canvas.toBlob((blob) => {
          if (blob) {
            const blobUrl = URL.createObjectURL(blob);
            setTempImage(blobUrl);
            setIsProcessing(false);
            canvas.width = 0; // Limpeza manual de canvas
          }
        }, 'image/jpeg', 0.3);
      }
    } catch (e) {
      console.error(e);
      setIsProcessing(false);
      startStream();
    }
  };

  const handleConfirmImage = () => {
    if (!tempImage) return;
    
    // ESTRATÉGIA ZERO-OVERLAP:
    const finalUrl = tempImage;
    setTempImage(null); // 1. Remove o Modal do DOM primeiro
    setIsProcessing(true); // 2. Mostra um estado de "salvando" leve no background

    // 3. Aguarda o DOM do Modal ser destruído antes de atualizar o pai
    setTimeout(() => {
      onCapture(finalUrl);
      setIsProcessing(false);
    }, 400);
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
      {/* BACKGROUND AREA (STATUS OU CÂMERA) */}
      <div className="relative w-full aspect-square bg-neutral-950 rounded-[2.5rem] overflow-hidden border-2 border-white/5 shadow-2xl">
        {capturedImage ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-indigo-950/20 p-8 text-center animate-in fade-in duration-500">
             <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center shadow-lg mb-4">
                <CheckCircleIcon className="w-10 h-10 text-white" />
             </div>
             <p className="text-white font-black uppercase tracking-[0.2em] text-xs">Biometria Pronta</p>
             <p className="text-gray-500 text-[9px] font-bold mt-1 uppercase tracking-widest leading-relaxed">Pode concluir o cadastro.</p>
          </div>
        ) : (
          <>
            {!tempImage && (
              <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover bg-black"></video>
            )}
            {isProcessing && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 z-30 gap-4">
                <SpinnerIcon className="w-8 h-8 text-indigo-500 animate-spin" />
                <p className="text-[10px] font-black text-white uppercase tracking-[0.3em]">Sincronizando...</p>
              </div>
            )}
          </>
        )}
      </div>

      <div className="mt-8 space-y-4 px-4">
        {capturedImage ? (
          <button type="button" onClick={handleRetake} className="w-full bg-neutral-800 text-white font-black uppercase tracking-[0.2em] text-[10px] py-5 rounded-2xl flex items-center justify-center gap-3">
            <RefreshIcon className="w-4 h-4"/> Refazer
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={() => !isProcessing && videoRef.current && processSource(videoRef.current)}
              disabled={!isStreamActive || isProcessing}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase tracking-[0.2em] text-[10px] py-5 rounded-2xl shadow-xl active:scale-95 disabled:opacity-30 flex items-center justify-center gap-3 transition-all"
            >
              <CameraIcon className="w-5 h-5" /> Iniciar Biometria
            </button>
            {allowUpload && (
              <div className="w-full">
                <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={(e) => {
                  const f = e.target.files?.[0];
                  if(f) processSource(f);
                }} />
                <button type="button" onClick={() => fileInputRef.current?.click()} className="w-full bg-white/5 text-neutral-600 font-black uppercase tracking-[0.2em] text-[9px] py-4 rounded-2xl border border-white/5 flex items-center justify-center gap-2 transition-all">
                   Galeria
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* POPUP DE CONFIRMAÇÃO ISOLADO */}
      {tempImage && (
        <div className="fixed inset-0 z-[200] bg-black/98 flex flex-col items-center justify-center p-6 animate-in fade-in duration-300">
           <div className="w-full max-w-sm flex flex-col gap-8">
              <div className="text-center">
                <h3 className="text-white font-black uppercase tracking-[0.3em] text-xs mb-2">Conferir Foto</h3>
                <p className="text-gray-500 text-[10px] font-bold uppercase tracking-widest">A foto está nítida?</p>
              </div>

              <div className="relative aspect-square w-full rounded-[3rem] overflow-hidden border-4 border-white/10 shadow-2xl">
                 <img src={tempImage} alt="Preview" className="w-full h-full object-cover" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                 <button 
                  onClick={() => { URL.revokeObjectURL(tempImage); setTempImage(null); startStream(); }}
                  className="bg-neutral-900 text-gray-500 font-black uppercase tracking-widest text-[10px] py-5 rounded-3xl border border-white/5"
                 >
                   Refazer
                 </button>
                 <button 
                  onClick={handleConfirmImage}
                  className="bg-white text-black font-black uppercase tracking-widest text-[10px] py-5 rounded-3xl shadow-xl"
                 >
                   Confirmar
                 </button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default WebcamCapture;
