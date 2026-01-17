
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

  // Busca todas as câmeras disponíveis
  const getDevices = useCallback(async () => {
    try {
      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = allDevices.filter(d => d.kind === 'videoinput');
      setDevices(videoDevices);
      if (videoDevices.length > 0 && !activeDeviceId) {
        // Prefere a frontal por padrão
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
      videoRef.current.srcObject = null;
    }
    setIsStreamActive(false);
  }, []);

  const startStream = useCallback(async () => {
    stopStream();
    
    // Pequeno delay para o Moto G53 liberar o hardware
    await new Promise(r => setTimeout(r, 200));

    try {
      setError(null);
      // RESOLUÇÃO DE SEGURANÇA: 320x240 (QVGA)
      // É a resolução mais estável do mundo para browsers móveis
      const constraints = {
        video: {
          deviceId: activeDeviceId ? { exact: activeDeviceId } : undefined,
          facingMode: activeDeviceId ? undefined : 'user',
          width: { ideal: 320 },
          height: { ideal: 240 },
          frameRate: { ideal: 10 }
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
      
      // Atualiza lista de dispositivos após permissão concedida
      getDevices();
      
    } catch (err: any) {
      console.error("Camera error:", err);
      setError("Câmera travada. Tente alternar ou recarregar.");
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

  const handleSwitchCamera = () => {
    if (devices.length < 2) return;
    const currentIndex = devices.findIndex(d => d.deviceId === activeDeviceId);
    const nextIndex = (currentIndex + 1) % devices.length;
    setActiveDeviceId(devices[nextIndex].deviceId);
  };

  const handleCapture = async () => {
    const video = videoRef.current;
    if (!video || !isStreamActive || isProcessing) return;

    setIsProcessing(true);

    try {
      // 1. Congelar
      video.pause();

      // 2. Tentar usar ImageCapture (Mais estável no Chrome Android)
      const track = streamRef.current?.getVideoTracks()[0];
      let captured = false;

      // @ts-ignore - ImageCapture pode não estar no tipo TS mas existe no Chrome
      if (window.ImageCapture && track) {
        try {
          // @ts-ignore
          const imageCapture = new ImageCapture(track);
          const blob = await imageCapture.takePhoto({ imageHeight: 320, imageWidth: 320 });
          const reader = new FileReader();
          reader.onloadend = () => {
            onCapture(reader.result as string);
            setIsProcessing(false);
          };
          reader.readAsDataURL(blob);
          captured = true;
        } catch (e) {
          console.warn("ImageCapture falhou, usando canvas fallback", e);
        }
      }

      // 3. Fallback Canvas (se ImageCapture falhar ou não existir)
      if (!captured) {
        const canvas = document.createElement('canvas');
        canvas.width = 320;
        canvas.height = 320;
        const ctx = canvas.getContext('2d', { alpha: false });
        if (ctx) {
          const size = Math.min(video.videoWidth, video.videoHeight);
          ctx.drawImage(video, (video.videoWidth-size)/2, (video.videoHeight-size)/2, size, size, 0, 0, 320, 320);
          onCapture(canvas.toDataURL('image/jpeg', 0.5));
          setIsProcessing(false);
        }
      }
      
      stopStream();
    } catch (err) {
      console.error("Capture failure:", err);
      alert("Erro ao capturar. Tente 'Enviar Arquivo'.");
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
            <button onClick={startStream} className="bg-white/10 hover:bg-white/20 text-white text-[10px] px-6 py-3 rounded-full font-black uppercase tracking-widest transition-all">Resetar Driver</button>
          </div>
        )}
        
        {capturedImage ? (
          <img src={capturedImage} alt="Captured" className="w-full h-full object-cover" />
        ) : (
          <>
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              muted
              className="w-full h-full object-cover" 
            ></video>
            {devices.length > 1 && !isProcessing && (
              <button 
                onClick={handleSwitchCamera}
                className="absolute top-4 right-4 bg-black/50 p-3 rounded-full text-white backdrop-blur-md border border-white/10 active:scale-90 transition-all"
              >
                <ArrowPathIcon className="w-5 h-5" />
              </button>
            )}
          </>
        )}

        {(isProcessing || (!isStreamActive && !capturedImage && !error)) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-10 gap-4">
            <SpinnerIcon className="w-8 h-8 text-indigo-500 animate-spin" />
            <p className="text-[10px] font-black text-white uppercase tracking-[0.3em]">
              {isProcessing ? "Finalizando..." : "Câmera (QVGA)"}
            </p>
          </div>
        )}
      </div>

      <div className="mt-8 w-full space-y-4 px-4">
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
                Alternativa: Galeria / Arquivo
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default WebcamCapture;
