import React, { useState, useRef } from 'react';
import * as Papa from 'papaparse';
// FIX: Added .tsx extension to module import.
import { useTranslation } from '../../hooks/useTranslation.tsx';
import { CheckCircleIcon, SpinnerIcon, XMarkIcon, UsersIcon } from '../icons';

interface SpreadsheetUploadViewProps {
  onImport: (data: any[]) => Promise<{ successCount: number; errors: { row: number; message: string }[] }>;
  setError: (message: string) => void;
}

const SpreadsheetUploadView: React.FC<SpreadsheetUploadViewProps> = ({ onImport, setError }) => {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [importReport, setImportReport] = useState<{ successCount: number; errors: { row: number; message: string }[] } | null>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
      setError(t('register.import.errors.fileType'));
      return;
    }

    setIsLoading(true);
    setImportReport(null);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results: any) => {
        const requiredColumns = ['nome', 'cpf', 'setor'];
        const headers = results.meta.fields || [];
        const missingColumns = requiredColumns.filter(col => !headers.includes(col));

        if (missingColumns.length > 0) {
          setError(t('register.import.errors.missingColumns'));
          setIsLoading(false);
          return;
        }

        try {
          const report = await onImport(results.data);
          setImportReport(report);
        } catch (error: any) {
          setError(error.message || t('register.import.errors.parsing'));
        } finally {
          setIsLoading(false);
        }
      },
      error: () => {
        setError(t('register.import.errors.parsing'));
        setIsLoading(false);
      }
    });

    // Reset file input to allow re-uploading the same file
    if (fileInputRef.current) {
        fileInputRef.current.value = "";
    }
  };

  const handleDownloadTemplate = () => {
    const csvContent = "data:text/csv;charset=utf-8,nome,cpf,setor\n";
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "modelo_importacao.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };


  return (
    <div className="bg-gray-800/50 backdrop-blur-sm p-8 rounded-2xl shadow-2xl border border-gray-700">
      <h3 className="text-2xl font-bold text-white mb-4 flex items-center justify-center gap-3">
        <UsersIcon className="w-7 h-7"/>
        {t('register.import.title')}
      </h3>
      <p className="text-gray-400 text-center mb-2">{t('register.import.instructions')}</p>
      <p className="text-center mb-6">
        <button onClick={handleDownloadTemplate} className="text-indigo-400 hover:text-indigo-300 transition-colors text-sm font-semibold">
          {t('register.import.downloadTemplate')}
        </button>
      </p>

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
        accept=".csv"
        disabled={isLoading}
      />
      
      <button 
        onClick={handleButtonClick}
        disabled={isLoading}
        className="w-full bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:bg-gray-500 disabled:cursor-wait"
      >
        {isLoading ? (
            <>
                <SpinnerIcon className="w-5 h-5"/>
                <span>{t('register.import.processing')}</span>
            </>
        ) : (
            <span>{t('register.import.button')}</span>
        )}
      </button>

      {importReport && (
        <div className="mt-6">
          <h4 className="font-bold text-lg text-white mb-2">{t('register.import.reportTitle')}</h4>
          <div className="bg-gray-900/50 p-4 rounded-lg max-h-60 overflow-y-auto">
            {importReport.successCount > 0 && (
              <div className="flex items-center gap-2 text-green-400 mb-2">
                <CheckCircleIcon className="w-5 h-5" />
                <p>{t('register.import.success', importReport.successCount)}</p>
              </div>
            )}
            {importReport.errors.length > 0 && (
                <div className="space-y-1">
                    {importReport.errors.map((err, index) => (
                         <div key={index} className="flex items-start gap-2 text-red-400 text-sm">
                            <XMarkIcon className="w-4 h-4 mt-0.5 flex-shrink-0"/>
                            <span>{t('register.import.errors.rowError', err.row, err.message)}</span>
                        </div>
                    ))}
                </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SpreadsheetUploadView;