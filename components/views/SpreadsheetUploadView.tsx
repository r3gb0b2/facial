import React, { useState } from 'react';
import Papa from 'papaparse';
import { ArrowUpTrayIcon } from '../icons.tsx';

interface SpreadsheetUploadViewProps {
  onImport: (data: any[]) => Promise<any>;
  setError: (message: string) => void;
}

const SpreadsheetUploadView: React.FC<SpreadsheetUploadViewProps> = ({ onImport, setError }) => {
  const [isUploading, setIsUploading] = useState(false);
  const [fileName, setFileName] = useState('');

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setFileName(file.name);
      setIsUploading(true);
      setError('');
      
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: async (results) => {
          try {
            if (results.data.length === 0) {
              setError("O arquivo CSV está vazio ou em um formato incorreto.");
              return;
            }
            await onImport(results.data);
            alert(`${results.data.length} participantes importados com sucesso!`);
          } catch (error: any) {
            console.error("Import failed:", error);
            setError(`Erro na importação: ${error.message}`);
          } finally {
            setIsUploading(false);
            setFileName('');
            if (event.target) event.target.value = '';
          }
        },
        error: (error: any) => {
          setError(`Erro ao ler o arquivo: ${error.message}`);
          setIsUploading(false);
          setFileName('');
          if (event.target) event.target.value = '';
        }
      });
    }
  };

  const handleDownloadTemplate = () => {
    const csv = 'name,cpf,sector,photoUrl,fornecedor,empresa';
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', 'template_importacao.csv');
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return (
    <div className="bg-gray-800/50 backdrop-blur-sm p-8 rounded-2xl shadow-2xl border border-gray-700">
      <h3 className="text-2xl font-bold text-white text-center mb-4">Importar em Lote</h3>
      <div className="text-sm text-gray-400 space-y-1 mb-6 text-center max-w-md mx-auto">
        <p>Faça o upload de um arquivo CSV para registrar múltiplos participantes de uma vez.</p>
        <p>Colunas obrigatórias: <strong>name, cpf, sector, photoUrl</strong>.</p>
        <p>Colunas opcionais: <strong>fornecedor, empresa</strong>.</p>
      </div>
      <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
        <label htmlFor="csv-upload" className="w-full sm:w-auto cursor-pointer bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-lg transition-colors duration-300 flex items-center justify-center gap-2">
          <ArrowUpTrayIcon className="w-5 h-5" />
          {isUploading ? 'Processando...' : (fileName || 'Escolher Arquivo CSV')}
        </label>
        <input
          id="csv-upload"
          type="file"
          accept=".csv"
          onChange={handleFileChange}
          className="hidden"
          disabled={isUploading}
        />
        <button onClick={handleDownloadTemplate} className="w-full sm:w-auto text-sm text-indigo-400 hover:text-indigo-300 font-semibold">
          Baixar modelo da planilha
        </button>
      </div>
    </div>
  );
};

export default SpreadsheetUploadView;
