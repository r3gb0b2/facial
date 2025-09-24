import React, { useState } from 'react';
import { useTranslation } from '../../hooks/useTranslation';
import { Supplier } from '../../types';
import { CogIcon, ClipboardIcon, CheckCircleIcon, SpinnerIcon } from '../icons';

interface AdminViewProps {
  eventId: string;
  suppliers: Supplier[];
  onAddSupplier: (name: string, sectors: string[]) => Promise<void>;
  setSuccess: (message: string) => void;
  setError: (message: string) => void;
}

const AdminView: React.FC<AdminViewProps> = ({ eventId, suppliers, onAddSupplier, setSuccess, setError }) => {
  const { t, sectors } = useTranslation();
  const [newSupplierName, setNewSupplierName] = useState('');
  const [newSupplierSectors, setNewSupplierSectors] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);

  const handleSectorChange = (sectorValue: string) => {
    setNewSupplierSectors(prev => 
      prev.includes(sectorValue) 
        ? prev.filter(s => s !== sectorValue) 
        : [...prev, sectorValue]
    );
  };

  const handleAddSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSupplierName || newSupplierSectors.length === 0) {
      setError(t('admin.errors.allFields'));
      setTimeout(() => setError(''), 3000);
      return;
    }
    setIsSubmitting(true);
    try {
      await onAddSupplier(newSupplierName, newSupplierSectors);
      setNewSupplierName('');
      setNewSupplierSectors([]);
    } catch (error) {
        // Error is already set in the parent component
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyLink = (slug: string) => {
    const link = `${window.location.origin}${window.location.pathname}?eventId=${eventId}&supplier=${slug}`;
    navigator.clipboard.writeText(link);
    setCopiedSlug(slug);
    setSuccess(t('admin.success.linkCopied'))
    setTimeout(() => {
        setCopiedSlug(null);
        setSuccess('');
    }, 2000);
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-12">
      <h2 className="text-3xl font-bold text-center text-white flex items-center justify-center gap-3">
        <CogIcon className="w-8 h-8" />
        {t('admin.title')}
      </h2>

      {/* Add Supplier Form */}
      <div className="bg-gray-800/50 backdrop-blur-sm p-8 rounded-2xl shadow-2xl border border-gray-700">
        <h3 className="text-xl font-bold text-white mb-6">{t('admin.form.title')}</h3>
        <form onSubmit={handleAddSupplier} className="space-y-6">
          <div>
            <label htmlFor="supplierName" className="block text-sm font-medium text-gray-300 mb-1">{t('admin.form.nameLabel')}</label>
            <input
              type="text" id="supplierName" value={newSupplierName} onChange={(e) => setNewSupplierName(e.target.value)}
              className="w-full bg-gray-900 border border-gray-600 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder={t('admin.form.namePlaceholder')}
              disabled={isSubmitting}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">{t('admin.form.sectorLabel')}</label>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 bg-gray-900/50 p-4 rounded-lg">
                {sectors.map(s => (
                    <label key={s.value} htmlFor={s.value} className="flex items-center space-x-2 cursor-pointer text-sm text-gray-200">
                        <input
                            type="checkbox"
                            id={s.value}
                            value={s.value}
                            checked={newSupplierSectors.includes(s.value)}
                            onChange={() => handleSectorChange(s.value)}
                            disabled={isSubmitting}
                            className="h-4 w-4 rounded border-gray-500 bg-gray-700 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span>{s.label}</span>
                    </label>
                ))}
            </div>
          </div>
          <button type="submit" className="w-full md:w-auto bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-6 rounded-lg transition-all duration-300 flex items-center justify-center gap-2 disabled:bg-indigo-400 disabled:cursor-wait" disabled={!newSupplierName || newSupplierSectors.length === 0 || isSubmitting}>
            {isSubmitting ? (
              <>
                <SpinnerIcon className="w-5 h-5" />
                Adicionando...
              </>
            ) : (
                t('admin.form.button')
            )}
          </button>
        </form>
      </div>

      {/* Supplier List */}
      <div className="bg-gray-800/50 backdrop-blur-sm p-8 rounded-2xl shadow-2xl border border-gray-700">
        <h3 className="text-xl font-bold text-white mb-6">{t('admin.list.title')}</h3>
        {suppliers.length === 0 ? (
          <p className="text-center text-gray-400">{t('admin.list.noSuppliers')}</p>
        ) : (
          <ul className="space-y-4">
            {suppliers.sort((a,b) => a.name.localeCompare(b.name)).map(supplier => (
              <li key={supplier.id} className="bg-gray-900/70 p-4 rounded-lg flex items-center justify-between flex-wrap gap-2">
                <div>
                  <p className="font-semibold text-white">{supplier.name}</p>
                  <p className="text-sm text-gray-400">
                    Setor(es): {supplier.sector.map(s => sectors.find(opt => opt.value === s)?.label || s).join(', ')}
                  </p>
                </div>
                <button
                  onClick={() => handleCopyLink(supplier.slug)}
                  className={`px-4 py-2 rounded-md text-sm font-semibold transition-colors flex items-center gap-2 ${copiedSlug === supplier.slug ? 'bg-green-600 text-white' : 'bg-gray-700 hover:bg-gray-600 text-gray-200'}`}
                >
                  {copiedSlug === supplier.slug ? <CheckCircleIcon className="w-5 h-5" /> : <ClipboardIcon className="w-5 h-5" />}
                  {copiedSlug === supplier.slug ? t('admin.buttons.copied') : t('admin.buttons.copyLink')}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default AdminView;