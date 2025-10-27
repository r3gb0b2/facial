import React, { useState } from 'react';
import { SupplierCategory } from '../../types';
import { useTranslation } from '../../hooks/useTranslation.tsx';
import { PencilIcon, TagIcon, TrashIcon, XMarkIcon } from '../icons';

// Modal component specific to this view
interface CategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string, categoryId?: string) => void;
  categoryToEdit?: SupplierCategory | null;
}

const CategoryModal: React.FC<CategoryModalProps> = ({ isOpen, onClose, onSave, categoryToEdit }) => {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  React.useEffect(() => {
    if (isOpen) {
      setName(categoryToEdit ? categoryToEdit.name : '');
      setError('');
    }
  }, [categoryToEdit, isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    if (!name.trim()) {
      setError(t('supplierCategories.modal.error'));
      return;
    }
    onSave(name, categoryToEdit?.id);
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md border border-gray-700" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b border-gray-700 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-white">
            {categoryToEdit ? t('supplierCategories.modal.editTitle') : t('supplierCategories.modal.createTitle')}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><XMarkIcon className="w-6 h-6" /></button>
        </div>
        <div className="p-8">
          <label htmlFor="categoryName" className="block text-sm font-medium text-gray-300 mb-1">{t('supplierCategories.modal.nameLabel')}</label>
          <input
            type="text"
            id="categoryName"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-gray-900 border border-gray-600 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder={t('supplierCategories.modal.namePlaceholder')}
            autoFocus
          />
          {error && <p className="text-red-400 text-sm mt-1">{error}</p>}
        </div>
        <div className="p-6 bg-gray-900/50 rounded-b-2xl">
          <button onClick={handleSave} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-lg">
            {categoryToEdit ? t('supplierCategories.modal.saveButton') : t('supplierCategories.modal.createButton')}
          </button>
        </div>
      </div>
    </div>
  );
};


interface SupplierCategoryManagementViewProps {
    categories: SupplierCategory[];
    onAddCategory: (name: string) => Promise<void>;
    onUpdateCategory: (categoryId: string, name: string) => Promise<void>;
    onDeleteCategory: (category: SupplierCategory) => Promise<void>;
    setError: (message: string) => void;
}

const SupplierCategoryManagementView: React.FC<SupplierCategoryManagementViewProps> = ({
    categories,
    onAddCategory,
    onUpdateCategory,
    onDeleteCategory,
    setError,
}) => {
    const { t } = useTranslation();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [categoryToEdit, setCategoryToEdit] = useState<SupplierCategory | null>(null);

    const handleOpenModal = (category: SupplierCategory | null) => {
        setCategoryToEdit(category);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setCategoryToEdit(null);
        setIsModalOpen(false);
    };

    const handleSave = async (name: string, categoryId?: string) => {
        try {
            if (categoryId) {
                await onUpdateCategory(categoryId, name);
            } else {
                await onAddCategory(name);
            }
            handleCloseModal();
        } catch (error: any) {
            setError(error.message || 'Falha ao salvar categoria.');
        }
    };
    
    const handleDelete = async (category: SupplierCategory) => {
        if (window.confirm(t('supplierCategories.deleteConfirm', category.name))) {
            try {
                await onDeleteCategory(category);
            } catch (e: any) {
                if (e.message.includes("is in use")) {
                    setError(t('supplierCategories.deleteErrorInUse', category.name));
                } else {
                    setError(e.message || 'Falha ao deletar a categoria.');
                }
            }
        }
    };

    return (
        <div className="w-full max-w-3xl mx-auto">
            <div className="bg-gray-800/50 backdrop-blur-sm p-8 rounded-2xl shadow-2xl border border-gray-700">
                <h2 className="text-3xl font-bold text-white mb-6 flex items-center justify-center gap-3">
                    <TagIcon className="w-8 h-8"/>
                    {t('supplierCategories.title')}
                </h2>
                {categories.length === 0 ? (
                    <div className="text-center text-gray-400 py-8">
                        <p className="text-lg mb-2">{t('supplierCategories.noCategories')}</p>
                        <p className="text-sm">{t('supplierCategories.noCategoriesSubtitle')}</p>
                    </div>
                ) : (
                    <ul className="space-y-3">
                        {categories.map((category) => (
                            <li key={category.id} className="bg-gray-900/70 p-4 rounded-lg flex items-center justify-between transition-all hover:bg-gray-800">
                                <p className="font-semibold text-white">{category.name}</p>
                                <div className="flex items-center gap-2">
                                    <button onClick={() => handleOpenModal(category)} className="p-2 text-gray-400 hover:text-yellow-400 transition-colors rounded-full hover:bg-gray-700">
                                        <PencilIcon className="w-5 h-5" />
                                    </button>
                                    <button onClick={() => handleDelete(category)} className="p-2 text-gray-400 hover:text-red-400 transition-colors rounded-full hover:bg-gray-700">
                                        <TrashIcon className="w-5 h-5" />
                                    </button>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
                <div className="mt-8">
                    <button onClick={() => handleOpenModal(null)} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-lg transition-all duration-300">
                        {t('supplierCategories.createButton')}
                    </button>
                </div>
            </div>
            <CategoryModal
                isOpen={isModalOpen}
                onClose={handleCloseModal}
                onSave={handleSave}
                categoryToEdit={categoryToEdit}
            />
        </div>
    );
};

export default SupplierCategoryManagementView;