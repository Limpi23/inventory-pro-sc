import React from 'react';
import LocationList from '../components/locations/LocationList';

const Locations: React.FC = () => {
  return (
    <div className="container py-6">
      <h1 className="text-2xl font-bold mb-6">Gestión de Ubicaciones</h1>
      <LocationList />
    </div>
  );
};

export default Locations;
