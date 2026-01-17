
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { CameraIcon, RefreshIcon, ArrowUpTrayIcon, SpinnerIcon, ArrowPathIcon } from './icons.tsx';
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
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [activeDeviceId, setActiveDeviceId] = useState<string>('');

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

  const getDevices = useCallback(async () => {
    try {
      const all = await navigator.mediaDevices.enumerateDevices();
      const vids = all.filter(d => d.kind === 'videoinput');
      setDevices(vids);
      if (vids.length > 0 && !activeDeviceId) {
        const frontal = vids.find(d => d.label.toLowerCase().includes('front') || d.label.toLowerCase().includes('user'));
        setActiveDeviceId(frontal ? frontal.deviceId : vids[0].deviceId);
      }
    } catch (e) { console.error(e); }
  }, [activeDeviceId]);

  const startStream = useCallback(async () => {
    stopStream();
    await new Promise(r => setTimeout(r, 300)); // Delay para o Android liberar o driver
    
    try {
      setError(null);
      const constraints = {
        video: {
          deviceId: activeDeviceId ? { exact: activeDeviceId } : undefined,
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: 15 }
        }
      };
      const ms = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = ms;
      if (videoRef.current) {
        videoRef.current.srcObject = ms;
        await videoRef.current.play();
        setIsStreamActive(true);
        getDevices();
      }
    } catch (err) {
      setError("Câmera bloqueada ou em uso.");
    }
  }, [activeDeviceId, stopStream, getDevices]);

  useEffect(() => {
    if (!capturedImage) startStream();
    else stopStream();
    return () => stopStream();
  }, [capturedImage, activeDeviceId, startStream, stopStream]);

  // FUNÇÃO DE PROCESSAMENTO ULTRA-LEVE (Moto G53 Optimized)
  const processSource = async (source: HTMLVideoElement | Blob) => {
    setIsProcessing(true);
    
    try {
      // 1. Criar Bitmap (mais leve que Image)
      const bitmap = await createImageBitmap(source, {
        resizeWidth: 480, // Resolução de segurança para não estourar RAM
        resizeQuality: 'medium'
      });

      // 2. Limpar o hardware ANTES de converter para string (Libera VRAM)
      if (source instanceof HTMLVideoElement) stopStream();

      const canvas = document.createElement('canvas');
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const ctx = canvas.getContext('2d', { alpha: false });
      
      if (ctx) {
        ctx.drawImage(bitmap, 0, 0);
        bitmap.close(); // Libera o bitmap da memória

        // 3. Conversão final
        canvas.toBlob((blob) => {
          if (blob) {
            const reader = new FileReader();
            reader.onloadend = () => {
              onCapture(reader.result as string);
              setIsProcessing(false);
              canvas.width = 0; // Garbage collection manual
            };
            reader.readAsDataURL(blob);
          }
        }, 'image/jpeg', 0.5);
      }
    } catch (e) {
      console.error(e);
      alert("Falha no processamento de imagem.");
      setIsProcessing(false);
      if (!capturedImage) startStream();
    }
  };

  const handleCapture = () => {
    if (!videoRef.current || !isStreamActive) return;
    processSource(videoRef.current);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processSource(file);
  };

  const switchCam = () => {
    if (devices.length < 2) return;
    const idx = devices.findIndex(d => d.deviceId === activeDeviceId);
    setActiveDeviceId(devices[(idx + 1) % devices.length].deviceId);
  };

  return (
    <div className="w-full max-w-sm mx-auto flex flex-col items-center">
      <div className="relative w-full aspect-square bg-neutral-950 rounded-[2.5rem] overflow-hidden border-2 border-white/5 shadow-2xl">
        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center z-20 bg-neutral-900">
            <p className="text-red-500 text-[10px] font-black uppercase mb-4 tracking-widest">{error}</p>
            <button onClick={startStream} className="bg-white/10 text-white text-[10px] px-6 py-3 rounded-full font-black uppercase">Reiniciar</button>
          </div>
        )}
        
        {capturedImage ? (
          <img src={capturedImage} alt="Preview" className="w-full h-full object-cover" />
        ) : (
          <>
            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover bg-black"></video>
            {devices.length > 1 && !isProcessing && (
              <button onClick={switchCam} className="absolute top-4 right-4 bg-black/60 p-3 rounded-full text-white backdrop-blur-md border border-white/10 active:scale-75 transition-all">
                <ArrowPathIcon className="w-5 h-5" />
              </button>
            )}
          </>
        )}

        {isProcessing && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 z-30 gap-4">
            <SpinnerIcon className="w-10 h-10 text-indigo-500 animate-spin" />
            <p className="text-[10px] font-black text-white uppercase tracking-[0.4em] animate-pulse">Otimizando RAM...</p>
          </div>
        )}
      </div>

      <div className="mt-8 w-full space-y-4 px-4">
        {capturedImage ? (
          <button
            type="button"
            onClick={() => onCapture('')}
            className="w-full bg-neutral-800 text-white font-black uppercase tracking-[0.2em] text-[10px] py-5 rounded-2xl flex items-center justify-center gap-3"
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
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase tracking-[0.2em] text-[10px] py-5 rounded-2xl shadow-xl transition-all active:scale-95 disabled:opacity-30 flex items-center justify-center gap-3"
            >
              <CameraIcon className="w-5 h-5" />
              {t('webcam.captureButton')}
            </button>
            
            <div className="w-full">
              <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isProcessing}
                className="w-full bg-white/5 hover:bg-white/10 text-neutral-500 font-black uppercase tracking-[0.2em] text-[9px] py-4 rounded-2xl border border-white/5 flex items-center justify-center gap-2"
              >
                <ArrowUpTrayIcon className="w-3 h-3" />
                {t('webcam.uploadButton')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default WebcamCapture;
