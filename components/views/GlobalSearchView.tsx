
import React, { useState } from 'react';
import { useTranslation } from '../../hooks/useTranslation.tsx';
import { SearchIcon, TrashIcon, SpinnerIcon, FaceSmileIcon } from '../icons.tsx';
import * as api from '../../firebase/service.ts';
import UserAvatar from '../UserAvatar.tsx';
import { Attendee } from '../../types.ts';

interface GlobalSearchViewProps {
    setError: (message: string) => void;
}

const GlobalSearchView: React.FC<GlobalSearchViewProps> = ({ setError }) => {
    const { t } = useTranslation();
    const [cpf, setCpf] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [isDeleting, setIsDeleting] = useState<string | null>(null);
    const [results, setResults] = useState<(Attendee & { eventId: string, eventName: string })[]>([]);
    const [hasSearched, setHasSearched] = useState(false);

    const formatCPF = (value: string) => {
        return value
            .replace(/\D/g, '')
            .slice(0, 11)
            .replace(/(\d{3})(\d)/, '$1.$2')
            .replace(/(\d{3})(\d)/, '$1.$2')
            .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    };

    const handleSearch = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        const rawCpf = cpf.replace(/\D/g, '');
        if (rawCpf.length !== 11) {
            setError("CPF inválido. Digite os 11 dígitos.");
            return;
        }

        setIsSearching(true);
        setHasSearched(true);
        try {
            const data = await api.searchAttendeesGlobal(rawCpf);
            setResults(data);
        } catch (err: any) {
            setError(err.message || "Falha ao realizar busca global.");
        } finally {
            setIsSearching(false);
        }
    };

    // FIX: Updated parameter type to include eventName to match results state and resolve property access error.
    const handleDelete = async (attendee: Attendee & { eventId: string, eventName: string }) => {
        if (!window.confirm(`ATENÇÃO: Você está prestes a excluir o registro de ${attendee.name} do evento ${attendee.eventName}.\n\nEsta ação permitirá que este CPF seja cadastrado novamente. Deseja continuar?`)) {
            return;
        }

        setIsDeleting(attendee.id);
        try {
            await api.deleteAttendee(attendee.eventId, attendee.id);
            setResults(prev => prev.filter(r => r.id !== attendee.id));
        } catch (err: any) {
            setError(err.message || "Erro ao deletar registro.");
        } finally {
            setIsDeleting(null);
        }
    };

    return (
        <div className="w-full max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
            <div className="bg-neutral-900/50 backdrop-blur-xl p-10 rounded-[3rem] border border-white/10 shadow-2xl">
                <div className="text-center mb-10">
                    <h2 className="text-4xl font-black text-white uppercase tracking-tighter mb-2">Busca Global</h2>
                    <p className="text-gray-500 text-sm font-bold uppercase tracking-widest">Localize e remova registros em todos os eventos ativos</p>
                </div>

                <form onSubmit={handleSearch} className="relative group">
                    <div className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-indigo-400 transition-colors">
                        <SearchIcon className="w-6 h-6" />
                    </div>
                    <input
                        type="text"
                        value={cpf}
                        onChange={(e) => setCpf(formatCPF(e.target.value))}
                        placeholder="000.000.000-00"
                        className="w-full bg-black/40 border-2 border-white/5 rounded-3xl py-6 pl-16 pr-40 text-2xl font-black text-white placeholder:text-neutral-800 focus:outline-none focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/10 transition-all"
                    />
                    <button
                        type="submit"
                        disabled={isSearching || cpf.replace(/\D/g, '').length !== 11}
                        className="absolute right-3 top-1/2 -translate-y-1/2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-neutral-800 disabled:text-neutral-600 text-white font-black uppercase tracking-widest text-xs py-4 px-8 rounded-2xl shadow-xl transition-all active:scale-95 flex items-center gap-2"
                    >
                        {isSearching ? <SpinnerIcon className="w-5 h-5" /> : <SearchIcon className="w-5 h-5" />}
                        {isSearching ? 'Buscando...' : 'Pesquisar'}
                    </button>
                </form>
            </div>

            {hasSearched && (
                <div className="space-y-4">
                    {results.length > 0 ? (
                        results.map(result => (
                            <div key={result.id} className="bg-neutral-900/80 border border-white/5 rounded-[2.5rem] p-8 flex flex-col md:flex-row items-center gap-8 shadow-xl hover:border-white/10 transition-all group animate-in slide-in-from-bottom-4 duration-500">
                                <div className="w-32 h-32 flex-shrink-0 relative">
                                    <UserAvatar src={result.photo} alt={result.name} className="w-full h-full rounded-[2rem] object-cover bg-black border-4 border-white/5 shadow-2xl group-hover:scale-105 transition-transform" />
                                </div>
                                <div className="flex-grow text-center md:text-left space-y-1">
                                    <h3 className="text-2xl font-black text-white uppercase tracking-tight leading-none">{result.name}</h3>
                                    <p className="text-indigo-400 font-mono text-sm tracking-widest">{formatCPF(result.cpf)}</p>
                                    <div className="pt-4 flex flex-wrap justify-center md:justify-start gap-4">
                                        <div className="bg-white/5 px-4 py-2 rounded-xl border border-white/5">
                                            <p className="text-[9px] text-gray-500 font-black uppercase tracking-widest">Evento Vinculado</p>
                                            <p className="text-xs text-gray-200 font-bold uppercase">{result.eventName}</p>
                                        </div>
                                        <div className="bg-white/5 px-4 py-2 rounded-xl border border-white/5">
                                            <p className="text-[9px] text-gray-500 font-black uppercase tracking-widest">Status Atual</p>
                                            <p className="text-xs text-indigo-300 font-bold uppercase">{result.status}</p>
                                        </div>
                                    </div>
                                </div>
                                <button
                                    onClick={() => handleDelete(result)}
                                    disabled={isDeleting === result.id}
                                    className="w-full md:w-auto bg-red-600/10 hover:bg-red-600 border border-red-500/20 hover:border-red-400 text-red-500 hover:text-white font-black uppercase tracking-widest text-[10px] py-5 px-8 rounded-2xl transition-all shadow-lg flex items-center justify-center gap-3 active:scale-95"
                                >
                                    {isDeleting === result.id ? <SpinnerIcon className="w-4 h-4" /> : <TrashIcon className="w-5 h-5" />}
                                    {isDeleting === result.id ? 'Excluindo...' : 'Excluir Cadastro'}
                                </button>
                            </div>
                        ))
                    ) : (
                        <div className="bg-neutral-900/30 border-2 border-dashed border-white/5 rounded-[3rem] p-20 text-center">
                            <FaceSmileIcon className="w-16 h-16 mx-auto text-neutral-800 mb-4" />
                            <p className="text-gray-600 font-bold uppercase tracking-widest text-lg">Nenhum registro encontrado para este CPF</p>
                            <p className="text-neutral-700 text-sm mt-2">Verifique se o CPF foi digitado corretamente.</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default GlobalSearchView;
