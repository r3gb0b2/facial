// FIX: Provided full content for `SupplierManagementView.tsx`.
import React from 'react';
import { Sector, Supplier } from '../../types';
import { PencilIcon, TagIcon, TrashIcon, UsersIcon } from '../icons';

interface SupplierManagementViewProps {
    suppliers: Supplier[];
    sectors: Sector[];
    setError: (message: string) => void;
}

const SupplierManagementView: React.FC<SupplierManagementViewProps> = ({
    suppliers,
    sectors,
    setError,
}) => {
    
    const handleAction = () => {
        alert("A gestão de fornecedores (Adicionar/Editar/Deletar) deve ser implementada no Firebase e conectada aqui.");
    };

    const getSectorLabels = (sectorIds: string[]): string => {
        if (!sectors || sectors.length === 0) return sectorIds.join(', ');
        return sectorIds.map(id => sectors.find(s => s.id === id)?.label || id).join(', ');
    }

    return (
        <div className="w-full max-w-3xl mx-auto">
            <div className="bg-gray-800/50 backdrop-blur-sm p-8 rounded-2xl shadow-2xl border border-gray-700">
                <h2 className="text-3xl font-bold text-white mb-6 flex items-center justify-center gap-3">
                    <UsersIcon className="w-8 h-8"/>
                    Gerenciar Fornecedores
                </h2>
                {suppliers.length === 0 ? (
                    <div className="text-center text-gray-400 py-8">
                        <p className="text-lg mb-2">Nenhum fornecedor cadastrado neste evento.</p>
                        <p className="text-sm">Você pode adicionar fornecedores através do painel do Firebase.</p>
                    </div>
                ) : (
                    <ul className="space-y-3">
                        {suppliers.map((supplier) => (
                            <li key={supplier.id} className="bg-gray-900/70 p-4 rounded-lg flex items-center justify-between transition-all hover:bg-gray-800">
                                <div>
                                    <p className="font-semibold text-white">{supplier.name}</p>
                                    <p className="text-sm text-gray-400 flex items-center gap-1"><TagIcon className="w-4 h-4" /> Setores: {getSectorLabels(supplier.sectors)}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button onClick={handleAction} className="p-2 text-gray-400 hover:text-yellow-400 transition-colors rounded-full hover:bg-gray-700">
                                        <PencilIcon className="w-5 h-5" />
                                    </button>
                                    <button onClick={handleAction} className="p-2 text-gray-400 hover:text-red-400 transition-colors rounded-full hover:bg-gray-700">
                                        <TrashIcon className="w-5 h-5" />
                                    </button>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
                <div className="mt-8">
                    <button onClick={handleAction} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-lg transition-all duration-300">
                        Adicionar Fornecedor
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SupplierManagementView;
