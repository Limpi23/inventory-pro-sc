import React from 'react';
import ProductList from '../components/products/ProductList';

const Products: React.FC = () => {
  return (
    <div className="container py-6">
      <h1 className="text-2xl font-bold mb-6">Gestión de Productos</h1>
      {/* Placeholder to inspect; actual content will be preserved by the system if present. */}
      <ProductList />
    </div>
  );
};

export default Products;