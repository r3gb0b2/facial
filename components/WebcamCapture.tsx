
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { CameraIcon, RefreshIcon, ArrowUpTrayIcon, SpinnerIcon, CheckCircleIcon } from './icons.tsx';

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
  const [isTransitioning, setIsTransitioning] = useState(false);

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
      videoRef.current.load();
    }
    setIsStreamActive(false);
  }, []);

  const startStream = useCallback(async () => {
    if (capturedImage || tempImage || isTransitioning) return;
    stopStream();
    await new Promise(r => setTimeout(r, 800)); // Delay para estabilizar hardware
    try {
      const constraints = {
        video: { facingMode: 'user', width: 320, height: 320, frameRate: 10 }
      };
      const ms = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = ms;
      if (videoRef.current) {
        videoRef.current.srcObject = ms;
        await videoRef.current.play();
        setIsStreamActive(true);
      }
    } catch (err) {
      console.error("Camera access denied");
    }
  }, [capturedImage, tempImage, isTransitioning, stopStream]);

  useEffect(() => {
    startStream();
    return () => stopStream();
  }, [capturedImage, tempImage, startStream, stopStream]);

  const processSource = async (source: HTMLVideoElement | Blob) => {
    setIsProcessing(true);
    try {
      // 1. Captura imediata em baixa resolução
      const bitmap = await createImageBitmap(source, {
        resizeWidth: 320,
        resizeHeight: 320,
        resizeQuality: 'low'
      });

      // 2. Mata o hardware ANTES de desenhar no canvas (libera RAM)
      if (source instanceof HTMLVideoElement) stopStream();

      const canvas = document.createElement('canvas');
      canvas.width = 320;
      canvas.height = 320;
      const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
      
      if (ctx) {
        ctx.drawImage(bitmap, 0, 0);
        bitmap.close();

        // 3. Qualidade 0.1 (Extremamente leve para o Moto G53)
        canvas.toBlob((blob) => {
          if (blob) {
            const blobUrl = URL.createObjectURL(blob);
            setTempImage(blobUrl);
            setIsProcessing(false);
            canvas.width = 0; // GC Manual
          }
        }, 'image/jpeg', 0.1);
      }
    } catch (e) {
      console.error(e);
      setIsProcessing(false);
      startStream();
    }
  };

  const handleConfirmImage = () => {
    if (!tempImage) return;
    
    // BLACKOUT STRATEGY: Isola a limpeza do modal da atualização do pai
    const finalUrl = tempImage;
    setIsTransitioning(true); // Escurece a tela para aliviar GPU
    setTempImage(null);       // Destrói o modal imediatamente

    // Aguarda o navegador processar a destruição do Modal antes de atualizar o pai
    setTimeout(() => {
      onCapture(finalUrl);
      setTimeout(() => {
        setIsTransitioning(false);
      }, 300);
    }, 600);
  };

  const handleRetake = () => {
    if (capturedImage?.startsWith('blob:')) URL.revokeObjectURL(capturedImage);
    if (tempImage?.startsWith('blob:')) URL.revokeObjectURL(tempImage);
    onCapture('');
    setTempImage(null);
    startStream();
  };

  // Se estiver em transição, mostra tela preta (evita pico de render)
  if (isTransitioning) {
    return <div className="w-full aspect-square bg-black rounded-[2.5rem] flex items-center justify-center">
      <SpinnerIcon className="w-8 h-8 text-indigo-500 animate-spin" />
    </div>;
  }

  return (
    <div className="w-full max-w-sm mx-auto">
      <div className="relative w-full aspect-square bg-neutral-950 rounded-[2.5rem] overflow-hidden border-2 border-white/5 shadow-2xl">
        {capturedImage ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-indigo-950/20 p-8 text-center animate-in fade-in duration-700">
             <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center shadow-lg mb-4">
                <CheckCircleIcon className="w-10 h-10 text-white" />
             </div>
             <p className="text-white font-black uppercase tracking-[0.2em] text-xs">Biometria OK</p>
          </div>
        ) : (
          <>
            {!tempImage && (
              <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover bg-black"></video>
            )}
            {isProcessing && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black z-30 gap-4">
                <SpinnerIcon className="w-8 h-8 text-indigo-500 animate-spin" />
                <p className="text-[10px] font-black text-white uppercase tracking-[0.3em]">Criptografando...</p>
              </div>
            )}
          </>
        )}
      </div>

      <div className="mt-8 space-y-4 px-4">
        {capturedImage ? (
          <button type="button" onClick={handleRetake} className="w-full bg-neutral-800 text-white font-black uppercase tracking-[0.2em] text-[10px] py-5 rounded-2xl flex items-center justify-center gap-3">
             <RefreshIcon className="w-4 h-4"/> Refazer Biometria
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={() => !isProcessing && videoRef.current && processSource(videoRef.current)}
              disabled={!isStreamActive || isProcessing}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase tracking-[0.2em] text-[10px] py-5 rounded-2xl shadow-xl transition-all active:scale-95 disabled:opacity-30 flex items-center justify-center gap-3"
            >
              <CameraIcon className="w-5 h-5" /> Capturar Foto
            </button>
            {allowUpload && (
              <button type="button" onClick={() => fileInputRef.current?.click()} className="w-full bg-white/5 text-neutral-600 font-black uppercase tracking-[0.2em] text-[9px] py-4 rounded-2xl border border-white/5">
                Galeria
              </button>
            )}
            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={(e) => {
              const f = e.target.files?.[0];
              if(f) processSource(f);
            }} />
          </>
        )}
      </div>

      {tempImage && (
        <div className="fixed inset-0 z-[300] bg-black flex flex-col items-center justify-center p-6">
           <div className="w-full max-w-xs flex flex-col gap-10">
              <div className="text-center">
                <h3 className="text-white font-black uppercase tracking-[0.3em] text-xs">Confirmar Bio</h3>
              </div>

              <div className="relative aspect-square w-full rounded-[3rem] overflow-hidden border-4 border-white/10">
                 <img src={tempImage} alt="Confirm" className="w-full h-full object-cover" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                 <button 
                  onClick={() => { URL.revokeObjectURL(tempImage); setTempImage(null); startStream(); }}
                  className="bg-neutral-900 text-gray-500 font-black uppercase tracking-widest text-[10px] py-6 rounded-3xl"
                 >
                   Refazer
                 </button>
                 <button 
                  onClick={handleConfirmImage}
                  className="bg-white text-black font-black uppercase tracking-widest text-[10px] py-6 rounded-3xl shadow-xl"
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
