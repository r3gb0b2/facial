// FIX: Provided full content for `AdminView.tsx`.
import React from 'react';
import { Sector, Supplier } from '../../types';
import SectorManagementView from './SectorManagementView';
import SupplierManagementView from './SupplierManagementView';

interface AdminViewProps {
  sectors: Sector[];
  suppliers: Supplier[];
  onAddSector: (label: string) => Promise<void>;
  onUpdateSector: (sectorId: string, label: string) => Promise<void>;
  onDeleteSector: (sector: Sector) => Promise<void>;
  setError: (message: string) => void;
}

const AdminView: React.FC<AdminViewProps> = (props) => {

  return (
    <div className="w-full max-w-7xl mx-auto space-y-8">
      <h1 className="text-4xl font-bold text-center text-white">
        Painel Administrativo
      </h1>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        <SectorManagementView
          sectors={props.sectors}
          onAddSector={props.onAddSector}
          onUpdateSector={props.onUpdateSector}
          onDeleteSector={props.onDeleteSector}
          setError={props.setError}
        />
        {/* Supplier management can be added here once fully implemented */}
        <SupplierManagementView
          suppliers={props.suppliers}
          sectors={props.sectors}
          setError={props.setError}
        />
      </div>
    </div>
  );
};

export default AdminView;
