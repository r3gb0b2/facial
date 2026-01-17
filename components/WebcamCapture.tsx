
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { CameraIcon, RefreshIcon, ArrowUpTrayIcon, SpinnerIcon, ArrowPathIcon, CheckCircleIcon, XMarkIcon } from './icons.tsx';
import { useTranslation } from '../hooks/useTranslation.tsx';

interface WebcamCaptureProps {
  onCapture: (imageDataUrl: string) => void;
  capturedImage: string | null; // Recebe o estado do pai
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
  
  // Estado local para o Modal de Confirmação
  const [tempImage, setTempImage] = useState<string | null>(null);

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
    stopStream();
    await new Promise(r => setTimeout(r, 400));
    
    try {
      setError(null);
      const constraints = {
        video: {
          facingMode: 'user',
          width: { ideal: 480 },
          height: { ideal: 480 },
          frameRate: { ideal: 15 }
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
      setError("Câmera indisponível.");
    }
  }, [stopStream]);

  useEffect(() => {
    // Só inicia a câmera se NÃO houver imagem confirmada (capturedImage) 
    // E NÃO estiver no modal de confirmação (tempImage)
    if (!capturedImage && !tempImage) {
      startStream();
    } else {
      stopStream();
    }
    return () => stopStream();
  }, [capturedImage, tempImage, startStream, stopStream]);

  const processSource = async (source: HTMLVideoElement | Blob) => {
    setIsProcessing(true);
    try {
      const bitmap = await createImageBitmap(source, {
        resizeWidth: 400,
        resizeQuality: 'medium'
      });

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
            const reader = new FileReader();
            reader.onloadend = () => {
              setTempImage(reader.result as string); // Abre o Modal
              setIsProcessing(false);
              canvas.width = 0;
            };
            reader.readAsDataURL(blob);
          }
        }, 'image/jpeg', 0.4);
      }
    } catch (e) {
      console.error(e);
      setIsProcessing(false);
      startStream();
    }
  };

  const handleCapture = () => {
    if (!videoRef.current || !isStreamActive) return;
    processSource(videoRef.current);
  };

  const handleConfirmImage = () => {
    if (tempImage) {
      onCapture(tempImage); // Envia para o pai
      setTempImage(null);   // Fecha modal e limpa RAM local
    }
  };

  return (
    <div className="w-full max-w-sm mx-auto">
      {/* 1. VIEW PRINCIPAL: Nunca mostra a foto, apenas status */}
      <div className="relative w-full aspect-square bg-neutral-950 rounded-[2.5rem] overflow-hidden border-2 border-white/5 shadow-2xl">
        {capturedImage ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-indigo-950/20 p-8 text-center animate-in fade-in zoom-in-95 duration-500">
             <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(34,197,94,0.4)] mb-6">
                <CheckCircleIcon className="w-12 h-12 text-white" />
             </div>
             <p className="text-white font-black uppercase tracking-[0.2em] text-sm mb-2">Biometria Pronta</p>
             <p className="text-gray-500 text-[10px] font-bold uppercase tracking-widest leading-relaxed">A imagem foi processada e está segura em cache temporário.</p>
          </div>
        ) : (
          <>
            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover bg-black"></video>
            {isProcessing && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 z-30 gap-4">
                <SpinnerIcon className="w-10 h-10 text-indigo-500 animate-spin" />
                <p className="text-[10px] font-black text-white uppercase tracking-[0.3em]">Criptografando...</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* 2. BOTÕES DE AÇÃO */}
      <div className="mt-8 space-y-4 px-4">
        {capturedImage ? (
          <button
            type="button"
            onClick={() => onCapture('')}
            className="w-full bg-neutral-800 text-white font-black uppercase tracking-[0.2em] text-[10px] py-5 rounded-2xl flex items-center justify-center gap-3 active:scale-95 transition-all"
          >
            <RefreshIcon className="w-4 h-4"/>
            Refazer Biometria
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={handleCapture}
              disabled={!isStreamActive || isProcessing}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase tracking-[0.2em] text-[10px] py-5 rounded-2xl shadow-xl transition-all active:scale-95 disabled:opacity-30 flex items-center justify-center gap-3"
            >
              <CameraIcon className="w-5 h-5" />
              Capturar Agora
            </button>
            
            {allowUpload && (
              <div className="w-full">
                <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={(e) => {
                  const f = e.target.files?.[0];
                  if(f) processSource(f);
                }} />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full bg-white/5 hover:bg-white/10 text-neutral-500 font-black uppercase tracking-[0.2em] text-[9px] py-4 rounded-2xl border border-white/5 flex items-center justify-center gap-2"
                >
                  <ArrowUpTrayIcon className="w-3 h-3" />
                  Anexar da Galeria
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* 3. MODAL DE CONFIRMAÇÃO (ISOLADO PARA NÃO PESAR A TELA) */}
      {tempImage && (
        <div className="fixed inset-0 z-[200] bg-black/95 backdrop-blur-xl flex flex-col items-center justify-center p-6 animate-in fade-in duration-300">
           <div className="w-full max-w-sm flex flex-col gap-8">
              <div className="text-center">
                <h3 className="text-white font-black uppercase tracking-[0.3em] text-xs mb-2">Confirme sua foto</h3>
                <p className="text-gray-500 text-[10px] font-bold uppercase tracking-widest">A foto está nítida e centralizada?</p>
              </div>

              <div className="relative aspect-square w-full rounded-[3rem] overflow-hidden border-4 border-white/10 shadow-2xl">
                 <img src={tempImage} alt="Confirmação" className="w-full h-full object-cover" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                 <button 
                  onClick={() => setTempImage(null)}
                  className="bg-neutral-900 text-gray-500 font-black uppercase tracking-widest text-[10px] py-5 rounded-3xl border border-white/5"
                 >
                   Não, Refazer
                 </button>
                 <button 
                  onClick={handleConfirmImage}
                  className="bg-white text-black font-black uppercase tracking-widest text-[10px] py-5 rounded-3xl shadow-xl shadow-white/10"
                 >
                   Sim, Confirmar
                 </button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default WebcamCapture;
