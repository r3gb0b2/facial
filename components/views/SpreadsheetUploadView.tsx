import React, { useState, useRef } from 'react';
import { parse } from 'papaparse';
import { useTranslation } from '../../hooks/useTranslation.tsx';
import { CheckCircleIcon, SpinnerIcon, XMarkIcon, UsersIcon } from '../icons.tsx';

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

    parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results: any) => {
        const requiredColumns = ['nome', 'cpf', 'setor'];
        const headers = results.meta.fields || [];
        const missingColumns = requiredColumns.filter(col => !headers.includes(col));

        if (missingColumns.length > 0) {
          setError(t('register.import.errors.missingColumns'));
          setIsLoading(false);
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
          return;
        }

        try {
          const report = await onImport(results.data);
          setImportReport(report);
        } catch (e) {
          setError(t('register.import.errors.parsing'));
        } finally {
          setIsLoading(false);
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
        }
      },
      error: (error: any) => {
        console.error("PapaParse error:", error);
        setError(t('register.import.errors.parsing'));
        setIsLoading(false);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
      }
    });
  };

  const triggerFileSelect = () => {
    setImportReport(null);
    fileInputRef.current?.click();
  };

  return (
    <div className="bg-gray-800/50 backdrop-blur-sm p-8 rounded-2xl shadow-2xl border border-gray-700">
      <h3 className="text-2xl font-bold text-center text-white mb-4 flex items-center justify-center gap-3">
        <UsersIcon className="w-7 h-7" />
        {t('register.import.title')}
      </h3>
      <p className="text-center text-gray-400 text-sm mb-4">
        {t('register.import.instructions')}
        <a href="/template.csv" download="modelo_importacao.csv" className="text-indigo-400 hover:underline ml-2">
            {t('register.import.downloadTemplate')}
        </a>
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
        onClick={triggerFileSelect}
        className="w-full bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 px-4 rounded-lg transition-colors duration-300 disabled:opacity-50"
        disabled={isLoading}
      >
        {isLoading ? (
          <div className="flex items-center justify-center gap-2">
            <SpinnerIcon className="w-5 h-5"/>
            <span>{t('register.import.processing')}</span>
          </div>
        ) : t('register.import.button')}
      </button>

      {importReport && (
        <div className="mt-6 p-4 bg-gray-900 rounded-lg border border-gray-700">
          <h4 className="font-semibold text-white mb-2">{t('register.import.reportTitle')}</h4>
          {importReport.successCount > 0 && (
            <div className="flex items-center gap-2 text-green-400">
              <CheckCircleIcon className="w-5 h-5" />
              <p>{t('register.import.success', importReport.successCount)}</p>
            </div>
          )}
          {importReport.errors.length > 0 && (
            <div className="mt-2">
              <div className="flex items-center gap-2 text-red-400">
                <XMarkIcon className="w-5 h-5" />
                <p>{importReport.errors.length} erro(s) encontrado(s):</p>
              </div>
              <ul className="list-disc list-inside text-red-400 text-sm mt-1 max-h-32 overflow-y-auto">
                {importReport.errors.map((err, index) => (
                  <li key={index}>{t('register.import.errors.rowError', err.row, err.message)}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SpreadsheetUploadView;