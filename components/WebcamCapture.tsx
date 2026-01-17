
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

  // Limpeza total de hardware - Vital para Moto G53
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
      videoRef.current.load(); // Força o descarte do buffer de vídeo
    }
    setIsStreamActive(false);
  }, []);

  const startStream = useCallback(async () => {
    // SEMPRE limpa antes de tentar abrir, para evitar concorrência de hardware no Android
    stopStream();
    
    // Pequeno fôlego para o sistema operacional liberar o hardware da câmera
    await new Promise(r => setTimeout(r, 150));

    try {
      setError(null);
      const constraints = {
        video: {
          facingMode: 'user',
          // Resolução conservadora: Moto G53 lida melhor com 480p nativo do que forçando 720p/1080p
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
        
        // Android exige este fluxo para não crashar o renderizador
        videoRef.current.play().then(() => {
            setIsStreamActive(true);
        }).catch(e => {
            console.warn("Play Interrompido", e);
        });
      }
    } catch (err: any) {
      console.error("Camera error:", err);
      setError("Câmera indisponível. Reinicie o Chrome ou verifique as permissões.");
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
      // 1. CONGELA O VÍDEO imediatamente
      video.pause();

      const canvas = document.createElement('canvas');
      // Resolução de segurança para Gemini (320px é ultra-leve para RAM)
      const captureSize = 320;
      canvas.width = captureSize;
      canvas.height = captureSize;
      
      const ctx = canvas.getContext('2d', { 
        alpha: false,
        willReadFrequently: true // Otimização específica para Chrome Android
      });

      if (ctx) {
        // 2. CROP QUADRADO CENTRALIZADO
        const vWidth = video.videoWidth;
        const vHeight = video.videoHeight;
        const size = Math.min(vWidth, vHeight);
        const x = (vWidth - size) / 2;
        const y = (vHeight - size) / 2;
        
        ctx.drawImage(video, x, y, size, size, 0, 0, captureSize, captureSize);

        // 3. DESLIGA O HARDWARE ANTES DO PROCESSAMENTO PESADO
        stopStream();

        // 4. CONVERSÃO ASSÍNCRONA (toBlob é muito mais estável que toDataURL no G53)
        canvas.toBlob((blob) => {
          if (blob) {
            const reader = new FileReader();
            reader.onloadend = () => {
              const base64 = reader.result as string;
              onCapture(base64);
              setIsProcessing(false);
              // Limpeza agressiva de memória do canvas
              canvas.width = 0;
              canvas.height = 0;
            };
            reader.readAsDataURL(blob);
          } else {
             throw new Error("Blob Null");
          }
        }, 'image/jpeg', 0.4); // Compressão 40% (ideal para IA)
      }
    } catch (err) {
      console.error("Capture failure:", err);
      alert("Erro de processamento. Tente novamente.");
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
      <div className="relative w-full aspect-square bg-neutral-900 rounded-[2.5rem] overflow-hidden border-2 border-white/5 shadow-2xl">
        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center z-20 bg-neutral-900">
            <p className="text-red-400 text-[10px] font-black uppercase mb-4 tracking-widest leading-relaxed">{error}</p>
            <button onClick={startStream} className="bg-white/10 hover:bg-white/20 text-white text-[10px] px-6 py-3 rounded-full font-black uppercase tracking-widest transition-all">Tentar Novamente</button>
          </div>
        )}
        
        {capturedImage ? (
          <img src={capturedImage} alt="Captured" className="w-full h-full object-cover animate-in fade-in zoom-in-95 duration-500" />
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
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-10 gap-4">
            <SpinnerIcon className="w-8 h-8 text-indigo-500 animate-spin" />
            <p className="text-[10px] font-black text-white uppercase tracking-[0.3em] animate-pulse">
              {isProcessing ? "Processando..." : "Iniciando Câmera"}
            </p>
          </div>
        )}
      </div>

      <div className="mt-8 w-full space-y-3 px-4">
        {capturedImage ? (
          <button
            type="button"
            onClick={() => onCapture('')}
            className="w-full bg-neutral-800 hover:bg-neutral-700 text-white font-black uppercase tracking-[0.2em] text-[10px] py-5 rounded-2xl transition-all flex items-center justify-center gap-3 active:scale-95"
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
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase tracking-[0.2em] text-[10px] py-5 rounded-2xl shadow-xl shadow-indigo-500/20 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3"
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
                  className="w-full bg-white/5 hover:bg-white/10 text-neutral-500 font-black uppercase tracking-[0.2em] text-[9px] py-4 rounded-2xl border border-white/5 transition-all flex items-center justify-center gap-2"
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
