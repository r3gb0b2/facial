import React, { useState, useMemo } from 'react';
import { ValidationPoint, Sector } from '../../types';
import { useTranslation } from '../../hooks/useTranslation.tsx';
import { QrCodeIcon, LinkIcon, CheckCircleIcon, TrashIcon } from '../icons.tsx';

interface ValidationPointViewProps {
    currentEventId: string;
    validationPoints: ValidationPoint[];
    sectors: Sector[];
    onAddPoint: (name: string, sectorId: string) => Promise<void>;
    onDeletePoint: (pointId: string) => Promise<void>;
    setError: (message: string) => void;
}

const ValidationPointView: React.FC<ValidationPointViewProps> = ({
    currentEventId,
    validationPoints,
    sectors,
    onAddPoint,
    onDeletePoint,
    setError,
}) => {
    const { t } = useTranslation();
    const [pointName, setPointName] = useState('');
    const [selectedSector, setSelectedSector] = useState('');
    const [copiedLink, setCopiedLink] = useState<string | null>(null);

    const sectorMap = useMemo(() => new Map(sectors.map(s => [s.id, s.label])), [sectors]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!pointName.trim() || !selectedSector) {
            setError('Nome do ponto e setor são obrigatórios.');
            return;
        }
        await onAddPoint(pointName.trim(), selectedSector);
        setPointName('');
        setSelectedSector('');
    };

    const handleDelete = (point: ValidationPoint) => {
        if (window.confirm(t('validationPoints.deleteConfirm', point.name))) {
            onDeletePoint(point.id);
        }
    };
    
    const handleCopyLink = (pointId: string) => {
        const url = `${window.location.origin}?eventId=${currentEventId}&scannerId=${pointId}`;
        navigator.clipboard.writeText(url);
        setCopiedLink(pointId);
        setTimeout(() => setCopiedLink(null), 2000);
    };

    return (
        <div className="w-full max-w-4xl mx-auto space-y-6">
            <div className="bg-gray-800/50 backdrop-blur-sm p-8 rounded-2xl shadow-2xl border border-gray-700">
                <h2 className="text-3xl font-bold text-white mb-6 text-center">{t('validationPoints.createTitle')}</h2>
                <form onSubmit={handleSubmit} className="flex flex-col md:flex-row gap-4 items-end">
                    <div className="flex-grow w-full">
                        <label htmlFor="pointName" className="block text-sm font-medium text-gray-300 mb-1">
                            {t('validationPoints.nameLabel')}
                        </label>
                        <input
                            type="text"
                            id="pointName"
                            value={pointName}
                            onChange={(e) => setPointName(e.target.value)}
                            className="w-full bg-gray-900 border border-gray-600 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            placeholder={t('validationPoints.namePlaceholder')}
                        />
                    </div>
                    <div className="flex-grow w-full">
                         <label htmlFor="sectorSelect" className="block text-sm font-medium text-gray-300 mb-1">
                            {t('validationPoints.sectorLabel')}
                        </label>
                        <select
                            id="sectorSelect"
                            value={selectedSector}
                            onChange={(e) => setSelectedSector(e.target.value)}
                            className="w-full bg-gray-900 border border-gray-600 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                            <option value="" disabled>Selecione um setor...</option>
                            {sectors.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                        </select>
                    </div>
                    <button type="submit" className="w-full md:w-auto bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg transition-colors flex-shrink-0">
                        {t('validationPoints.createButton')}
                    </button>
                </form>
            </div>
            
            <div className="bg-gray-800/50 backdrop-blur-sm p-8 rounded-2xl shadow-2xl border border-gray-700">
                 <h3 className="text-2xl font-bold text-white text-center mb-6">{t('validationPoints.title')}</h3>
                 {validationPoints.length === 0 ? (
                    <div className="text-center text-gray-400 py-8">
                        <QrCodeIcon className="w-16 h-16 mx-auto text-gray-500 mb-4" />
                        <p className="text-lg mb-2">{t('validationPoints.noPoints')}</p>
                        <p className="text-sm">{t('validationPoints.noPointsSubtitle')}</p>
                    </div>
                 ) : (
                    <ul className="space-y-3">
                        {validationPoints.map(point => (
                            <li key={point.id} className="bg-gray-900/70 p-4 rounded-lg flex items-center justify-between transition-all hover:bg-gray-800">
                                <div>
                                    <p className="font-semibold text-white">{point.name}</p>
                                    <p className="text-sm text-indigo-400">{sectorMap.get(point.sectorId) || 'Setor desconhecido'}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button onClick={() => handleCopyLink(point.id)} className="p-2 text-gray-400 hover:text-white transition-colors rounded-full hover:bg-gray-700" title={t('validationPoints.copyLinkTooltip')}>
                                        {copiedLink === point.id ? <CheckCircleIcon className="w-5 h-5 text-green-400" /> : <LinkIcon className="w-5 h-5" />}
                                    </button>
                                    <button onClick={() => handleDelete(point)} className="p-2 text-gray-400 hover:text-red-400 transition-colors rounded-full hover:bg-gray-700">
                                        <TrashIcon className="w-5 h-5" />
                                    </button>
                                </div>
                            </li>
                        ))}
                    </ul>
                 )}
            </div>
        </div>
    );
};

export default ValidationPointView;
