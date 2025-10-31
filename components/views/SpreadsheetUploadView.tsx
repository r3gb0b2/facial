import React, { useState } from 'react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { ArrowUpTrayIcon } from '../icons.tsx';
import { useTranslation } from '../../hooks/useTranslation.tsx';

interface SpreadsheetUploadViewProps {
  onImport: (data: any[]) => Promise<any>;
  setError: (message: string) => void;
}

const SpreadsheetUploadView: React.FC<SpreadsheetUploadViewProps> = ({ onImport, setError }) => {
  const { t } = useTranslation();
  const [isUploading, setIsUploading] = useState(false);
  const [fileName, setFileName] = useState('');

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const cleanup = () => {
        setIsUploading(false);
        setFileName('');
        if (event.target) event.target.value = '';
    };

    setFileName(file.name);
    setIsUploading(true);
    setError('');
    
    if (file.name.endsWith('.csv')) {
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: async (results) => {
              try {
                if (results.data.length === 0) {
                  setError(t('spreadsheet.error.emptyFile'));
                  return;
                }
                await onImport(results.data);
              } catch (error: any) {
                console.error("Import failed:", error);
                setError(`Erro na importação: ${error.message}`);
              } finally {
                cleanup();
              }
            },
            error: (error: any) => {
              setError(t('spreadsheet.error.readFile', error.message));
              cleanup();
            }
        });
    } else if (file.name.endsWith('.xls') || file.name.endsWith('.xlsx')) {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = e.target?.result;
                const workbook = XLSX.read(data, { type: 'array' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const json = XLSX.utils.sheet_to_json(worksheet);
                
                if (json.length === 0) {
                    setError(t('spreadsheet.error.emptyFile'));
                    return;
                }
                await onImport(json);
            } catch (error: any) {
                setError(t('spreadsheet.error.readFile', error.message));
            } finally {
                cleanup();
            }
        };
        reader.onerror = () => {
            setError(t('spreadsheet.error.readFile', 'Could not read file.'));
            cleanup();
        };
        reader.readAsArrayBuffer(file);
    } else {
        setError(t('spreadsheet.error.unsupportedFile'));
        cleanup();
    }
  };

  const handleDownloadTemplate = () => {
    const csv = 'name,cpf,sector,fornecedor,empresa';
    // Add BOM for better Excel compatibility
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'template_importacao.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    
    // Clean up
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-gray-800/50 backdrop-blur-sm p-8 rounded-2xl shadow-2xl border border-gray-700">
      <h3 className="text-2xl font-bold text-white text-center mb-4">{t('spreadsheet.title')}</h3>
      <div className="text-sm text-gray-400 space-y-1 mb-6 text-center max-w-md mx-auto">
        <p>{t('spreadsheet.description')}</p>
        <p dangerouslySetInnerHTML={{ __html: t('spreadsheet.requiredColumns') }} />
        <p dangerouslySetInnerHTML={{ __html: t('spreadsheet.optionalColumns') }} />
      </div>
      <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
        <label htmlFor="csv-upload" className="w-full sm:w-auto cursor-pointer bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-lg transition-colors duration-300 flex items-center justify-center gap-2">
          <ArrowUpTrayIcon className="w-5 h-5" />
          {isUploading ? t('spreadsheet.button.processing') : (fileName || t('spreadsheet.button.choose'))}
        </label>
        <input
          id="csv-upload"
          type="file"
          accept=".csv,.xls,.xlsx"
          onChange={handleFileChange}
          className="hidden"
          disabled={isUploading}
        />
        <button onClick={handleDownloadTemplate} className="w-full sm:w-auto text-sm text-indigo-400 hover:text-indigo-300 font-semibold">
          {t('spreadsheet.button.downloadTemplate')}
        </button>
      </div>
    </div>
  );
};

export default SpreadsheetUploadView;