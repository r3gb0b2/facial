import React, { useRef, useEffect, useState, useCallback } from 'react';
import { CameraIcon, RefreshIcon } from './icons';
import { useTranslation } from '../hooks/useTranslation';

interface WebcamCaptureProps {
  onCapture: (imageDataUrl: string) => void;
  capturedImage: string | null;
}

const WebcamCapture: React.FC<WebcamCaptureProps> = ({ onCapture, capturedImage }) => {
  const { t } = useTranslation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);

  const stopStream = useCallback(() => {
    setStream(currentStream => {
      if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
      }
      return null;
    });
  }, []);

  const startStream = useCallback(async () => {
    try {
      setError(null);
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: {
            width: { ideal: 480 },
            height: { ideal: 480 },
            facingMode: 'user'
        }
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err: any) {
      console.error("Error accessing webcam:", err.message);
      // Hardcode string to avoid dependency on unstable 't' function from context, which was causing a re-render loop.
      setError("Não foi possível acessar a webcam. Por favor, verifique as permissões e tente novamente.");
    }
  }, [setError]);

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

  const handleCapture = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const context = canvas.getContext('2d');
      if (context) {
        context.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/png');
        onCapture(dataUrl);
      }
    }
  };
  
  const handleRetake = () => {
      onCapture('');
  };

  return (
    <div className="w-full max-w-sm mx-auto flex flex-col items-center">
        <div className="relative w-full aspect-square bg-gray-900 rounded-lg overflow-hidden border-2 border-gray-600 shadow-lg">
            {error && <div className="absolute inset-0 flex items-center justify-center text-center text-red-400 p-4">{error}</div>}
            {capturedImage ? (
                <img src={capturedImage} alt="Captured" className="w-full h-full object-cover" />
            ) : (
                <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" muted></video>
            )}
             {!stream && !capturedImage && !error &&
                <div className="absolute inset-0 flex items-center justify-center">
                    <p className="text-gray-400">{t('webcam.starting')}</p>
                </div>
            }
        </div>
        <div className="mt-4 w-full">
            {capturedImage ? (
                <button
                    type="button"
                    onClick={handleRetake}
                    className="w-full bg-yellow-500 hover:bg-yellow-600 text-black font-bold py-3 px-4 rounded-lg transition-colors duration-300 flex items-center justify-center gap-2"
                >
                    <RefreshIcon className="w-5 h-5"/>
                    {t('webcam.retakeButton')}
                </button>
            ) : (
                <button
                    type="button"
                    onClick={handleCapture}
                    disabled={!stream}
                    className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-4 rounded-lg transition-colors duration-300 flex items-center justify-center gap-2 disabled:bg-gray-500 disabled:cursor-not-allowed"
                >
                    <CameraIcon className="w-5 h-5" />
                    {t('webcam.captureButton')}
                </button>
            )}
        </div>
    </div>
  );
};

export default WebcamCapture;