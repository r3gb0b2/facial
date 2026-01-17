
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { CameraIcon, SpinnerIcon } from './icons.tsx';

interface WebcamCaptureProps {
  onCapture: (imageDataUrl: string) => void;
  capturedImage: string | null;
}

const WebcamCapture: React.FC<WebcamCaptureProps> = ({ onCapture }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isStarting, setIsStarting] = useState(true);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const startCamera = useCallback(async () => {
    stopCamera();
    try {
      const ms = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: 'user', width: 640, height: 640 } 
      });
      streamRef.current = ms;
      if (videoRef.current) {
        videoRef.current.srcObject = ms;
        await videoRef.current.play();
        setIsStarting(false);
      }
    } catch (e) {
      console.error("Câmera bloqueada");
    }
  }, [stopCamera]);

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, [startCamera, stopCamera]);

  const capture = async () => {
    if (!videoRef.current) return;
    
    // Captura instantânea e desligamento imediato para salvar memória
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 640;
    const ctx = canvas.getContext('2d', { alpha: false });
    
    if (ctx) {
        ctx.drawImage(video, 0, 0, 640, 640);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
        stopCamera(); // MATA O HARDWARE AGORA
        onCapture(dataUrl);
    }
  };

  return (
    <div className="w-full">
      <div className="relative aspect-square bg-black rounded-[2rem] overflow-hidden border-2 border-white/10">
        <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
        {isStarting && (
            <div className="absolute inset-0 flex items-center justify-center bg-neutral-900">
                <SpinnerIcon className="w-10 h-10 text-indigo-500 animate-spin" />
            </div>
        )}
      </div>
      <button onClick={capture} disabled={isStarting} className="mt-8 w-full bg-indigo-600 text-white font-black uppercase py-5 rounded-2xl shadow-2xl flex items-center justify-center gap-3 active:scale-95 transition-all">
        <CameraIcon className="w-6 h-6" /> Capturar Biometria
      </button>
    </div>
  );
};

export default WebcamCapture;
