
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { CameraIcon, RefreshIcon, ArrowUpTrayIcon, SpinnerIcon } from './icons.tsx';
import { useTranslation } from '../hooks/useTranslation.tsx';

interface WebcamCaptureProps {
  onCapture: (imageDataUrl: string) => void;
  capturedImage: string | null;
  disabled?: boolean;
  allowUpload?: boolean;
}

const WebcamCapture: React.FC<WebcamCaptureProps> = ({ onCapture, capturedImage, disabled = false, allowUpload = false }) => {
  const { t } = useTranslation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isStreamActive, setIsStreamActive] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    stopStream();
    try {
      setError(null);
      // HARDENING: Moto G53 prefere constraints ideais do que exatas
      const constraints = {
        video: {
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: 15 }
        },
        audio: false
      };
      
      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = mediaStream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.setAttribute('playsinline', 'true');
        videoRef.current.muted = true;
        // Não usar mirror CSS no Android para evitar crash de GPU
        videoRef.current.style.transform = 'none';
        
        await videoRef.current.play();
        setIsStreamActive(true);
      }
    } catch (err: any) {
      console.error("Camera access error:", err);
      setError("Câmera bloqueada. Verifique as permissões do Chrome.");
    }
  }, [stopStream]);

  useEffect(() => {
    if (!capturedImage) {
      startStream();
    } else {
      stopStream();
    }
    return () => stopStream();
  }, [capturedImage, startStream, stopStream]);

  const handleCapture = () => {
    const video = videoRef.current;
    if (!video || !isStreamActive || isProcessing) return;

    setIsProcessing(true);

    try {
      // 1. CONGELAR O VÍDEO (Técnica Vital para Android)
      // Pausar o vídeo libera o hardware de renderização para focar na captura do frame
      video.pause();

      const canvas = document.createElement('canvas');
      // Usar resolução pequena e quadrada para economizar RAM
      canvas.width = 400;
      canvas.height = 400;
      
      const ctx = canvas.getContext('2d', { 
        alpha: false,
        willReadFrequently: true 
      });

      if (ctx) {
        // 2. CAPTURA
        // Calculamos o crop para centralizar a imagem quadrada
        const size = Math.min(video.videoWidth, video.videoHeight);
        const startX = (video.videoWidth - size) / 2;
        const startY = (video.videoHeight - size) / 2;
        
        ctx.drawImage(video, startX, startY, size, size, 0, 0, 400, 400);

        // 3. CONVERSÃO (JPEG 0.4 é muito leve e estável no Moto G53)
        const dataUrl = canvas.toDataURL('image/jpeg', 0.4);
        
        // 4. PARAR HARDWARE IMEDIATAMENTE
        stopStream();
        
        // 5. FINALIZAR
        onCapture(dataUrl);
        
        // Limpeza de memória
        canvas.width = 0;
        canvas.height = 0;
      }
    } catch (err) {
      console.error("Capture failure:", err);
      alert("Erro de memória no navegador. Tente fechar outras abas.");
      startStream(); // Tenta reativar se falhar
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => onCapture(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="w-full max-w-sm mx-auto flex flex-col items-center">
      <div className="relative w-full aspect-square bg-black rounded-[2rem] overflow-hidden border-2 border-white/10 shadow-xl">
        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center z-20 bg-neutral-900">
            <p className="text-red-400 text-xs font-bold uppercase mb-4">{error}</p>
            <button onClick={startStream} className="bg-white/10 text-white text-[10px] px-4 py-2 rounded-full font-black uppercase">Recarregar</button>
          </div>
        )}
        
        {capturedImage ? (
          <img src={capturedImage} alt="Captured" className="w-full h-full object-cover" />
        ) : (
          <video 
            ref={videoRef} 
            autoPlay 
            playsInline 
            muted
            className="w-full h-full object-cover" 
          ></video>
        )}

        {(isProcessing || (!isStreamActive && !capturedImage && !error)) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 z-10">
            <SpinnerIcon className="w-8 h-8 text-indigo-500 animate-spin mb-2" />
            <p className="text-[10px] font-bold text-white uppercase tracking-widest">
              {isProcessing ? "Gravando..." : "Câmera..."}
            </p>
          </div>
        )}
      </div>

      <div className="mt-6 w-full space-y-3 px-2">
        {capturedImage ? (
          <button
            type="button"
            onClick={() => onCapture('')}
            className="w-full bg-neutral-800 hover:bg-neutral-700 text-white font-black uppercase tracking-widest text-[10px] py-4 rounded-xl transition-all flex items-center justify-center gap-3"
          >
            <RefreshIcon className="w-4 h-4"/>
            {t('webcam.retakeButton')}
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={handleCapture}
              disabled={!isStreamActive || isProcessing}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase tracking-widest text-[10px] py-5 rounded-xl shadow-lg transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3"
            >
              <CameraIcon className="w-5 h-5" />
              {t('webcam.captureButton')}
            </button>
            
            {allowUpload && (
              <div className="w-full">
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  accept="image/*"
                  onChange={handleFileChange}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full bg-white/5 hover:bg-white/10 text-neutral-400 font-bold uppercase tracking-widest text-[9px] py-3 rounded-xl border border-white/5 transition-all flex items-center justify-center gap-2"
                >
                  <ArrowUpTrayIcon className="w-3 h-3" />
                  {t('webcam.uploadButton')}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default WebcamCapture;
