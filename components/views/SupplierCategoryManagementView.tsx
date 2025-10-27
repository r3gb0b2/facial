import React, { useState } from 'react';
import { SupplierCategory, Supplier } from '../../types';
import { useTranslation } from '../../hooks/useTranslation';
import { PencilIcon, TagIcon, TrashIcon } from '../icons';

interface SupplierCategoryManagementViewProps {
    categories: SupplierCategory[];
    suppliers: Supplier[];
    onAddCategory: (name: string) => Promise<void>;
    onUpdateCategory: (categoryId: string, name: string) => Promise<void>;
    onDeleteCategory: (categoryId: string) => Promise<void>;
    setError: (message: string) => void;
}

const SupplierCategoryManagementView: React.FC<SupplierCategoryManagementViewProps> = ({
    categories,
    suppliers,
    onAddCategory,
    onUpdateCategory,
    onDeleteCategory,
    setError,
}) => {
    const { t } = useTranslation();
    const [newCategoryName, setNewCategoryName] = useState('');
    const [editingCategory, setEditingCategory] = useState<SupplierCategory | null>(null);

    const handleAddCategory = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newCategoryName.trim()) {
            setError(t('supplierCategories.form.noNameError'));
            return;
        }
        await onAddCategory(newCategoryName);
        setNewCategoryName('');
    };
    
    const handleUpdateCategory = async () => {
        if (!editingCategory || !editingCategory.name.trim()) {
            setError(t('supplierCategories.form.noNameError'));
            return;
        }
        await onUpdateCategory(editingCategory.id, editingCategory.name);
        setEditingCategory(null);
    };

    const handleDeleteCategory = async (category: SupplierCategory) => {
        if (window.confirm(t('supplierCategories.deleteConfirm', category.name))) {
            try {
                await onDeleteCategory(category.id);
            } catch (e: any) {
                if (e.message.includes('in use')) {
                     setError(t('supplierCategories.deleteErrorInUse', category.name));
                } else {
                     setError(e.message || 'Falha ao deletar categoria.');
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
                
                 {/* Form for new category */}
                <form onSubmit={handleAddCategory} className="mb-8 flex gap-2">
                    <input
                      type="text"
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      placeholder={t('supplierCategories.form.namePlaceholder')}
                      className="flex-grow bg-gray-900 border border-gray-600 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg transition-all">
                      {t('supplierCategories.createButton')}
                    </button>
                </form>

                {categories.length === 0 ? (
                    <div className="text-center text-gray-400 py-8">
                        <p className="text-lg mb-2">{t('supplierCategories.noCategories')}</p>
                        <p className="text-sm">{t('supplierCategories.noCategoriesSubtitle')}</p>
                    </div>
                ) : (
                    <ul className="space-y-3">
                        {categories.map((category) => (
                            <li key={category.id} className="bg-gray-900/70 p-4 rounded-lg flex items-center justify-between transition-all hover:bg-gray-800">
                                {editingCategory?.id === category.id ? (
                                    <input
                                        type="text"
                                        value={editingCategory.name}
                                        onChange={(e) => setEditingCategory({ ...editingCategory, name: e.target.value })}
                                        className="flex-grow bg-gray-800 border border-gray-600 rounded-md py-1 px-2 text-white"
                                        autoFocus
                                    />
                                ) : (
                                    <p className="font-semibold text-white">{category.name}</p>
                                )}
                                <div className="flex items-center gap-2">
                                    {editingCategory?.id === category.id ? (
                                        <>
                                            <button onClick={handleUpdateCategory} className="bg-green-600 text-white py-1 px-3 rounded">{t('supplierCategories.form.saveButton')}</button>
                                            <button onClick={() => setEditingCategory(null)} className="bg-gray-500 text-white py-1 px-3 rounded">{t('suppliers.cancelButton')}</button>
                                        </>
                                    ) : (
                                        <>
                                            <button onClick={() => setEditingCategory(category)} className="p-2 text-gray-400 hover:text-yellow-400 transition-colors rounded-full hover:bg-gray-700">
                                                <PencilIcon className="w-5 h-5" />
                                            </button>
                                            <button onClick={() => handleDeleteCategory(category)} className="p-2 text-gray-400 hover:text-red-400 transition-colors rounded-full hover:bg-gray-700">
                                                <TrashIcon className="w-5 h-5" />
                                            </button>
                                        </>
                                    )}
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
};

export default SupplierCategoryManagementView;