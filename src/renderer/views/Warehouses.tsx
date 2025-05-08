import React from 'react';
import WarehouseList from '../components/warehouses/WarehouseList';

const Warehouses: React.FC = () => {
  return (
    <div className="container py-6">
      <h1 className="text-2xl font-bold mb-6">Gestión de Almacenes</h1>
      <WarehouseList />
    </div>
  );
};

export default Warehouses; 