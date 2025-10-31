import React, { useRef, useEffect } from 'react';
import QRCode from 'qrcode';
import { useTranslation } from '../hooks/useTranslation.tsx';

interface QRCodeDisplayProps {
  data: string;
}

const QRCodeDisplay: React.FC<QRCodeDisplayProps> = ({ data }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { t } = useTranslation();

  useEffect(() => {
    if (canvasRef.current && data) {
      QRCode.toCanvas(canvasRef.current, data, {
        width: 256,
        margin: 2,
        color: {
          dark: '#FFFFFF', // White dots
          light: '#00000000' // Transparent background
        }
      }, (error) => {
        if (error) console.error('QR Code generation error:', error);
      });
    }
  }, [data]);

  return (
    <div className="flex flex-col items-center justify-center p-4 bg-gray-900 rounded-lg">
      <canvas ref={canvasRef} className="w-48 h-48 md:w-56 md:h-56"></canvas>
    </div>
  );
};

export default QRCodeDisplay;
