
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
        videoRef.current.srcObject = null;
    }
    setIsStreamActive(false);
  }, []);

  const startStream = useCallback(async () => {
    stopStream();
    try {
      setError(null);
      // ANDROID SAFE CONSTRAINTS: 480p é o padrão mais estável para Chrome Android
      const constraints = {
        video: {
            facingMode: 'user',
            width: { ideal: 640 },
            height: { ideal: 480 },
            frameRate: { max: 20 } // Menos frames = menos uso de CPU/GPU
        }
      };
      
      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = mediaStream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.setAttribute('playsinline', 'true');
        videoRef.current.muted = true;
        
        try {
            await videoRef.current.play();
            setIsStreamActive(true);
        } catch (e) {
            console.warn("Auto-play blocked", e);
        }
      }
    } catch (err: any) {
      console.error("Error accessing webcam:", err);
      setError("Erro na câmera. Verifique se o Chrome tem permissão.");
    }
  }, [stopStream]);

  useEffect(() => {
    if (!capturedImage) {
        startStream();
    } else {
        stopStream();
    }
    
    return () => {
      stopStream();
    };
  }, [capturedImage, startStream, stopStream]);

  const handleCapture = async () => {
    const video = videoRef.current;
    if (!video || !streamRef.current || isProcessing) return;

    setIsProcessing(true);

    try {
        // 1. Pequeno delay para estabilização de hardware (Crucial no Android)
        await new Promise(r => setTimeout(r, 300));

        if (video.readyState < 2) throw new Error("Vídeo não pronto");

        // 2. TÉCNICA ULTRA-SAFE: Usar ImageBitmap para captura direta de memória
        // Isso evita o uso excessivo de CPU/GPU que o drawImage(video) causa no Android
        const bitmap = await createImageBitmap(video, {
            resizeWidth: 640,
            resizeHeight: 480,
            resizeQuality: 'medium'
        });

        // 3. Canvas descartável de baixa resolução
        const canvas = document.createElement('canvas');
        canvas.width = 640;
        canvas.height = 480;

        const context = canvas.getContext('2d', { 
            alpha: false,
            willReadFrequently: true 
        });

        if (context) {
            // Desenha o bitmap no canvas
            context.drawImage(bitmap, 0, 0);
            
            // 4. Liberar o bitmap da memória imediatamente
            bitmap.close();

            // 5. Converter para JPEG com compressão moderada (economiza RAM no transporte da string)
            const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
            
            if (dataUrl && dataUrl.length > 100) {
                onCapture(dataUrl);
            } else {
                throw new Error("Falha na geração dos dados");
            }
            
            // 6. Limpeza agressiva: Zerar o canvas para forçar o Garbage Collector do Chrome
            canvas.width = 0;
            canvas.height = 0;
        }
    } catch (err) {
        console.error("Capture Error:", err);
        alert("Erro ao capturar. Tente novamente.");
    } finally {
        setIsProcessing(false);
    }
  };
  
  const handleRetake = () => {
      onCapture('');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        onCapture(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="w-full max-w-sm mx-auto flex flex-col items-center">
        <div className="relative w-full aspect-square bg-neutral-950 rounded-[2.5rem] overflow-hidden border-4 border-white/5 shadow-2xl">
            {error && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8 bg-neutral-900/90 z-10">
                    <p className="text-red-400 text-[10px] font-black uppercase mb-4 leading-relaxed tracking-widest">{error}</p>
                    <button onClick={startStream} className="bg-white/10 hover:bg-white/20 text-white text-[10px] px-6 py-3 rounded-full font-black uppercase tracking-widest transition-all">Recarregar Câmera</button>
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
                    onCanPlay={() => setIsStreamActive(true)}
                ></video>
            )}
             {(!isStreamActive || isProcessing) && !capturedImage && !error &&
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 gap-4">
                    <SpinnerIcon className="w-8 h-8 text-indigo-500 animate-spin" />
                    <p className="text-neutral-500 text-[10px] font-black uppercase tracking-[0.2em]">
                        {isProcessing ? "Finalizando..." : t('webcam.starting')}
                    </p>
                </div>
            }
        </div>
        <div className="mt-8 w-full px-4 space-y-3">
            {capturedImage ? (
                <button
                    type="button"
                    onClick={handleRetake}
                    disabled={disabled || isProcessing}
                    className="w-full bg-neutral-800 hover:bg-neutral-700 text-white font-black uppercase tracking-[0.2em] text-[10px] py-5 rounded-2xl transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3"
                >
                    <RefreshIcon className="w-4 h-4"/>
                    {t('webcam.retakeButton')}
                </button>
            ) : (
                <>
                    <button
                        type="button"
                        onClick={handleCapture}
                        disabled={!isStreamActive || disabled || isProcessing}
                        className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase tracking-[0.2em] text-[10px] py-5 rounded-2xl shadow-xl shadow-indigo-500/20 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3"
                    >
                        {isProcessing ? <SpinnerIcon className="w-5 h-5 animate-spin" /> : <CameraIcon className="w-5 h-5" />}
                        {isProcessing ? "Aguarde..." : t('webcam.captureButton')}
                    </button>
                    
                    {allowUpload && !isProcessing && (
                        <div className="w-full">
                            <input
                                type="file"
                                ref={fileInputRef}
                                className="hidden"
                                accept="image/*"
                                onChange={handleFileChange}
                                disabled={disabled}
                            />
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={disabled}
                                className="w-full bg-white/5 hover:bg-white/10 text-neutral-400 font-black uppercase tracking-[0.2em] text-[10px] py-4 rounded-2xl transition-all flex items-center justify-center gap-3 border border-white/5"
                            >
                                <ArrowUpTrayIcon className="w-4 h-4" />
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
