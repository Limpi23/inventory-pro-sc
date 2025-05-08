import React from 'react';
import CategoryList from '../components/categories/CategoryList';

const Categories: React.FC = () => {
  return (
    <div className="container py-6">
      <h1 className="text-2xl font-bold mb-6">Gestión de Categorías</h1>
      <CategoryList />
    </div>
  );
};

export default Categories; 