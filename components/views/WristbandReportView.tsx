// FIX: Implemented the WristbandReportView component to resolve the module not found error.
import React, { useMemo } from 'react';
import { Attendee, CheckinStatus, Sector } from '../../types';

interface WristbandReportViewProps {
  attendees: Attendee[];
  sectors: Sector[];
}

const WristbandReportView: React.FC<WristbandReportViewProps> = ({ attendees, sectors }) => {
  const sectorMap = useMemo(() => new Map(sectors.map(s => [s.id, s.label])), [sectors]);

  const checkedInAttendees = useMemo(() => {
    return attendees
      .filter(a => a.status === CheckinStatus.CHECKED_IN && a.wristbandNumber)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [attendees]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="w-full max-w-4xl mx-auto">
      <div className="bg-gray-800/50 backdrop-blur-sm p-8 rounded-2xl shadow-2xl border border-gray-700">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-3xl font-bold text-white">Relatório de Pulseiras Entregues</h2>
          <button
            onClick={handlePrint}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg transition-all duration-300 print:hidden"
          >
            Imprimir Relatório
          </button>
        </div>
        
        {checkedInAttendees.length === 0 ? (
          <p className="text-gray-400 text-center py-8">Nenhum participante com check-in e pulseira registrada.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-700">
              <thead className="bg-gray-900/50">
                <tr>
                  <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-white sm:pl-6">Nome</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-white">CPF</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-white">Setor</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-white">Pulseira</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {checkedInAttendees.map((attendee) => (
                  <tr key={attendee.id} className="hover:bg-gray-700/50">
                    <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-white sm:pl-6">{attendee.name}</td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-300">{attendee.cpf}</td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-300">{sectorMap.get(attendee.sector) || attendee.sector}</td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm font-bold text-indigo-400">{attendee.wristbandNumber}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default WristbandReportView;
