
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

  const getDevices = useCallback(async () => {
    try {
      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = allDevices.filter(d => d.kind === 'videoinput');
      setDevices(videoDevices);
      if (videoDevices.length > 0 && !activeDeviceId) {
        const frontal = videoDevices.find(d => d.label.toLowerCase().includes('front') || d.label.toLowerCase().includes('user'));
        setActiveDeviceId(frontal ? frontal.deviceId : videoDevices[0].deviceId);
      }
    } catch (e) {
      console.error("Erro ao listar câmeras", e);
    }
  }, [activeDeviceId]);

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
    await new Promise(r => setTimeout(r, 250));
    try {
      setError(null);
      const constraints = {
        video: {
          deviceId: activeDeviceId ? { exact: activeDeviceId } : undefined,
          facingMode: activeDeviceId ? undefined : 'user',
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
        await videoRef.current.play();
        setIsStreamActive(true);
      }
      getDevices();
    } catch (err: any) {
      console.error("Camera error:", err);
      setError("Câmera indisponível.");
    }
  }, [stopStream, activeDeviceId, getDevices]);

  useEffect(() => {
    if (!capturedImage) {
      startStream();
    } else {
      stopStream();
    }
    return () => stopStream();
  }, [capturedImage, activeDeviceId, startStream, stopStream]);

  // Função mestre de processamento: Reduz QUALQUER imagem para 640px Max (Leve para RAM)
  const processAndSetImage = (source: HTMLVideoElement | HTMLImageElement) => {
    const canvas = document.createElement('canvas');
    const MAX_SIZE = 640;
    
    let width = source instanceof HTMLVideoElement ? source.videoWidth : source.width;
    let height = source instanceof HTMLVideoElement ? source.videoHeight : source.height;

    // Calcula proporções para não distorcer
    if (width > height) {
      if (width > MAX_SIZE) {
        height *= MAX_SIZE / width;
        width = MAX_SIZE;
      }
    } else {
      if (height > MAX_SIZE) {
        width *= MAX_SIZE / height;
        height = MAX_SIZE;
      }
    }

    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { alpha: false });
    
    if (ctx) {
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(source, 0, 0, width, height);
      
      // Converte para JPEG 0.5 (equilíbrio perfeito entre peso e qualidade para IA)
      canvas.toBlob((blob) => {
        if (blob) {
          const reader = new FileReader();
          reader.onloadend = () => {
            onCapture(reader.result as string);
            setIsProcessing(false);
          };
          reader.readAsDataURL(blob);
        }
      }, 'image/jpeg', 0.5);
    }
  };

  const handleCapture = async () => {
    const video = videoRef.current;
    if (!video || !isStreamActive || isProcessing) return;
    setIsProcessing(true);
    try {
      video.pause();
      processAndSetImage(video);
      stopStream();
    } catch (err) {
      console.error("Capture failure:", err);
      setIsProcessing(false);
      startStream();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    
    // IMPORTANTE: Criamos um objeto de imagem para redimensionar ANTES de virar Base64
    const img = new Image();
    const url = URL.createObjectURL(file);
    
    img.onload = () => {
      processAndSetImage(img);
      URL.revokeObjectURL(url); // Libera a memória do arquivo original pesado
    };
    
    img.onerror = () => {
      alert("Erro ao ler arquivo de imagem.");
      setIsProcessing(false);
    };
    
    img.src = url;
  };

  const handleSwitchCamera = () => {
    if (devices.length < 2) return;
    const currentIndex = devices.findIndex(d => d.deviceId === activeDeviceId);
    const nextIndex = (currentIndex + 1) % devices.length;
    setActiveDeviceId(devices[nextIndex].deviceId);
  };

  return (
    <div className="w-full max-w-sm mx-auto flex flex-col items-center">
      <div className="relative w-full aspect-square bg-neutral-900 rounded-[2.5rem] overflow-hidden border-2 border-white/5 shadow-2xl">
        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center z-20 bg-neutral-900">
            <p className="text-red-400 text-[10px] font-black uppercase mb-4 tracking-widest">{error}</p>
            <button onClick={startStream} className="bg-white/10 text-white text-[10px] px-6 py-3 rounded-full font-black uppercase">Recarregar</button>
          </div>
        )}
        
        {capturedImage ? (
          <img src={capturedImage} alt="Captured" className="w-full h-full object-cover" />
        ) : (
          <>
            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover"></video>
            {devices.length > 1 && !isProcessing && (
              <button onClick={handleSwitchCamera} className="absolute top-4 right-4 bg-black/50 p-3 rounded-full text-white backdrop-blur-md border border-white/10 active:scale-90 transition-all">
                <ArrowPathIcon className="w-5 h-5" />
              </button>
            )}
          </>
        )}

        {(isProcessing || (!isStreamActive && !capturedImage && !error)) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-10 gap-4">
            <SpinnerIcon className="w-8 h-8 text-indigo-500 animate-spin" />
            <p className="text-[10px] font-black text-white uppercase tracking-[0.3em]">
              {isProcessing ? "Otimizando..." : "Iniciando..."}
            </p>
          </div>
        )}
      </div>

      <div className="mt-8 w-full space-y-4 px-4">
        {capturedImage ? (
          <button
            type="button"
            onClick={() => onCapture('')}
            className="w-full bg-neutral-800 text-white font-black uppercase tracking-[0.2em] text-[10px] py-5 rounded-2xl transition-all flex items-center justify-center gap-3"
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
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase tracking-[0.2em] text-[10px] py-5 rounded-2xl shadow-xl transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3"
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
                className="w-full bg-white/5 hover:bg-white/10 text-neutral-500 font-black uppercase tracking-[0.2em] text-[9px] py-4 rounded-2xl border border-white/5 transition-all flex items-center justify-center gap-2"
              >
                <ArrowUpTrayIcon className="w-3 h-3" />
                Carregar da Galeria (Auto-Compress)
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default WebcamCapture;
