import React, { useState, useRef } from 'react';
import * as Papa from 'papaparse';
// FIX: Added .tsx extension to module import.
import { useTranslation } from '../../hooks/useTranslation.tsx';
// FIX: Add .tsx extension to icons import.
import { CheckCircleIcon, SpinnerIcon, XMarkIcon, UsersIcon } from '../icons.tsx';

interface SpreadsheetUploadViewProps {
  onImport: (data: any[]) => Promise<{ successCount: number; errors: { row: number; message: string }[] }>;
  setError: (message: string) => void;
}

const SpreadsheetUploadView: React.FC<SpreadsheetUploadViewProps> = ({ onImport, setError }) => {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ successCount: number; errors: { row: number; message: string }[] } | null>(null);

  const handleFileParse = (file: File) => {
    if (!file) return;

    setIsImporting(true);
    setImportResult(null);
    setError('');

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const result = await onImport(results.data);
          setImportResult(result);
        } catch (err) {
          console.error("Import Error:", err);
          setError(t('spreadsheet.error'));
        } finally {
          setIsImporting(false);
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
        }
      },
      error: (error: any) => {
        console.error("Parsing Error:", error);
        setError(`Erro ao ler o arquivo CSV: ${error.message}`);
        setIsImporting(false);
      },
    });
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleFileParse(file);
    }
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const file = event.dataTransfer.files?.[0];
    if (file && file.type === 'text/csv') {
      handleFileParse(file);
    } else {
      setError("Por favor, solte um arquivo .csv");
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
  };

  return (
    <div className="bg-gray-800/50 backdrop-blur-sm p-8 rounded-2xl shadow-2xl border border-gray-700">
      <div className="text-center mb-6">
        <h2 className="text-3xl font-bold text-white flex items-center justify-center gap-3">
          <UsersIcon className="w-8 h-8"/>
          {t('spreadsheet.title')}
        </h2>
      </div>

      <div
        className="border-2 border-dashed border-gray-600 rounded-lg p-8 text-center cursor-pointer hover:border-indigo-500 transition-colors"
        onClick={() => fileInputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
          accept=".csv"
          disabled={isImporting}
        />
        {isImporting ? (
          <div className="flex flex-col items-center justify-center">
            <SpinnerIcon className="w-8 h-8 text-indigo-400" />
            <p className="mt-2 text-gray-300">{t('spreadsheet.importing')}</p>
          </div>
        ) : (
          <div>
            <p className="text-white font-semibold">{t('spreadsheet.uploadButton')}</p>
            <p className="text-gray-400 text-sm">{t('spreadsheet.dragAndDrop')}</p>
          </div>
        )}
      </div>

      <div className="text-center mt-4">
        <a href="/template.csv" download className="text-sm text-indigo-400 hover:underline">
          {t('spreadsheet.templateLink')}
        </a>
      </div>

      {importResult && (
        <div className="mt-6">
          {importResult.errors.length === 0 && importResult.successCount > 0 && (
            <div className="bg-green-500/20 text-green-300 border border-green-500 p-3 rounded-lg flex items-center justify-center gap-2">
              <CheckCircleIcon className="w-5 h-5" />
              <p>{t('spreadsheet.success', importResult.successCount)}</p>
            </div>
          )}
          {importResult.errors.length > 0 && (
            <div className="bg-yellow-500/20 text-yellow-300 border border-yellow-500 p-3 rounded-lg">
              <p className="font-bold">{t('spreadsheet.partialSuccess', importResult.successCount, importResult.successCount + importResult.errors.length)}</p>
              <p className="text-sm mt-2 font-semibold">{t('spreadsheet.errorListTitle')}</p>
              <ul className="list-disc list-inside mt-1 text-xs max-h-40 overflow-y-auto">
                {importResult.errors.map((err, index) => (
                  <li key={index}>Linha {err.row + 2}: {err.message}</li>
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
