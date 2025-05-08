import React from 'react';
import ProductList from '../components/products/ProductList';

const Products: React.FC = () => {
  return (
    <div className="container py-6">
      <h1 className="text-2xl font-bold mb-6">Gestión de Productos</h1>
      <ProductList />
    </div>
  );
};

export default Products; 