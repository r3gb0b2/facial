
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
      // HARD LOCK: Constraints para Moto G53 e similares
      // Usamos 'exact' para forçar o hardware a não subir a resolução
      const constraints = {
        video: {
          facingMode: 'user',
          width: { exact: 640 },
          height: { exact: 480 },
          frameRate: { max: 20 }
        },
        audio: false
      };
      
      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = mediaStream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.setAttribute('playsinline', 'true');
        videoRef.current.muted = true;
        await videoRef.current.play();
        setIsStreamActive(true);
      }
    } catch (err: any) {
      console.error("Camera error:", err);
      // Fallback para caso o hardware não suporte 'exact' 640x480
      try {
          const fallbackStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
          streamRef.current = fallbackStream;
          if (videoRef.current) {
              videoRef.current.srcObject = fallbackStream;
              await videoRef.current.play();
              setIsStreamActive(true);
          }
      } catch (e) {
          setError("Câmera bloqueada ou indisponível.");
      }
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

  const handleCapture = async () => {
    const video = videoRef.current;
    if (!video || !isStreamActive || isProcessing) return;

    setIsProcessing(true);

    try {
      // 1. Criar canvas de baixa resolução
      const canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 480;
      const ctx = canvas.getContext('2d', { alpha: false });

      if (ctx) {
        // 2. Capturar o frame IMEDIATAMENTE
        ctx.drawImage(video, 0, 0, 640, 480);

        // 3. ESTRATÉGIA CRÍTICA: Desligar a câmera ANTES de converter para string
        // Isso libera a memória da GPU usada pelo vídeo ao vivo, evitando a tela branca.
        stopStream();
        
        // Pequena pausa para o Android liberar o hardware
        await new Promise(r => setTimeout(r, 100));

        // 4. Converter usando Blob (mais estável que toDataURL no Chrome Android)
        canvas.toBlob((blob) => {
          if (blob) {
            const reader = new FileReader();
            reader.onloadend = () => {
              const base64data = reader.result as string;
              onCapture(base64data);
              setIsProcessing(false);
              // Limpar canvas
              canvas.width = 0;
              canvas.height = 0;
            };
            reader.readAsDataURL(blob);
          }
        }, 'image/jpeg', 0.5);
      }
    } catch (err) {
      console.error("Capture failure:", err);
      alert("Falha na captura. Tente fechar outras abas.");
      setIsProcessing(false);
      startStream();
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
            <button onClick={startStream} className="bg-white/10 text-white text-[10px] px-4 py-2 rounded-full font-black uppercase">Reiniciar</button>
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
            className="w-full h-full object-cover scale-x-[-1]" 
          ></video>
        )}

        {(isProcessing || (!isStreamActive && !capturedImage && !error)) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 z-10">
            <SpinnerIcon className="w-8 h-8 text-indigo-500 animate-spin mb-2" />
            <p className="text-[10px] font-bold text-white uppercase tracking-widest">
              {isProcessing ? "Processando..." : "Aguarde..."}
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
