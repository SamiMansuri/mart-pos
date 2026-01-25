import React, { useState, useEffect } from 'react';

const DEFAULT_PRODUCTS = [
  { id: 1, name: 'Apple', price: 120, icon: '🍎', stock: 50 },
  { id: 2, name: 'Banana', price: 40, icon: '🍌', stock: 100 },
  { id: 3, name: 'Bread', price: 45, icon: '🍞', stock: 20 },
  { id: 4, name: 'Milk (1L)', price: 65, icon: '🥛', stock: 30 },
  { id: 5, name: 'Eggs (12)', price: 90, icon: '🥚', stock: 40 },
  { id: 6, name: 'Rice (1kg)', price: 75, icon: '🍚', stock: 60 },
  { id: 7, name: 'Cooking Oil (1L)', price: 180, icon: '🛢️', stock: 15 },
  { id: 8, name: 'Sugar (1kg)', price: 45, icon: '🧂', stock: 25 },
];

const Products = () => {
  const [products, setProducts] = useState([]);
  const [isEditing, setIsEditing] = useState(null);
  const [formData, setFormData] = useState({ name: '', price: '', icon: '📦', stock: '' });

  useEffect(() => {
    const savedProducts = JSON.parse(localStorage.getItem('super_mart_products'));
    if (!savedProducts || savedProducts.length === 0) {
      localStorage.setItem('super_mart_products', JSON.stringify(DEFAULT_PRODUCTS));
      setProducts(DEFAULT_PRODUCTS);
    } else {
      setProducts(savedProducts.map(p => ({ ...p, stock: p.stock || 0 })));
    }
  }, []);

  const saveProducts = (updatedProducts) => {
    setProducts(updatedProducts);
    localStorage.setItem('super_mart_products', JSON.stringify(updatedProducts));
  };

  const handleAddOrUpdate = (e) => {
    e.preventDefault();
    if (isEditing) {
      const updated = products.map(p => 
        p.id === isEditing ? { ...p, ...formData, price: Number(formData.price), stock: Number(formData.stock) } : p
      );
      saveProducts(updated);
      setIsEditing(null);
    } else {
      const newProduct = {
        id: Date.now(),
        ...formData,
        price: Number(formData.price),
        stock: Number(formData.stock)
      };
      saveProducts([...products, newProduct]);
    }
    setFormData({ name: '', price: '', icon: '📦', stock: '' });
  };

  const deleteProduct = (id) => {
    if (window.confirm('Delete this product?')) {
      saveProducts(products.filter(p => p.id !== id));
    }
  };

  const startEdit = (product) => {
    setIsEditing(product.id);
    setFormData({ name: product.name, price: product.price, icon: product.icon, stock: product.stock });
  };

  return (
    <div className="pos-container" style={{ flexDirection: 'column' }}>
      <h1>Product Management</h1>
      
      <div className="pos-card" style={{ marginBottom: '20px' }}>
        <h3>{isEditing ? 'Edit Product' : 'Add New Product'}</h3>
        <form onSubmit={handleAddOrUpdate} style={{ display: 'flex', gap: '10px', marginTop: '10px', alignItems: 'flex-end' }}>
          <div style={{ flex: 2 }}>
            <label style={{ fontSize: '0.8rem' }}>Name</label>
            <input 
              required
              value={formData.name}
              onChange={e => setFormData({...formData, name: e.target.value})}
              placeholder="Product Name"
            />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: '0.8rem' }}>Price (₹)</label>
            <input 
              required
              type="number"
              value={formData.price}
              onChange={e => setFormData({...formData, price: e.target.value})}
              placeholder="Price"
            />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: '0.8rem' }}>Stock</label>
            <input 
              required
              type="number"
              value={formData.stock}
              onChange={e => setFormData({...formData, stock: e.target.value})}
              placeholder="Qty"
            />
          </div>
          <div style={{ flex: 0.5 }}>
            <label style={{ fontSize: '0.8rem' }}>Icon</label>
            <input 
              value={formData.icon}
              onChange={e => setFormData({...formData, icon: e.target.value})}
              placeholder="🛒"
              maxLength="2"
              style={{ textAlign: 'center' }}
            />
          </div>
          <button type="submit" className="primary" style={{ height: '45px' }}>
            {isEditing ? 'Update' : 'Add'}
          </button>
          {isEditing && (
            <button type="button" onClick={() => setIsEditing(null)} style={{ height: '45px' }}>
              Cancel
            </button>
          )}
        </form>
      </div>

      <div className="pos-card" style={{ flex: 1, overflowY: 'auto' }}>
        <h3>Product List</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '2px solid var(--border)' }}>
              <th style={{ padding: '10px' }}>Icon</th>
              <th style={{ padding: '10px' }}>Name</th>
              <th style={{ padding: '10px' }}>Price</th>
              <th style={{ padding: '10px' }}>Stock</th>
              <th style={{ padding: '10px', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {products.map(product => (
              <tr key={product.id} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '10px', fontSize: '1.5rem' }}>{product.icon}</td>
                <td style={{ padding: '10px' }}>{product.name}</td>
                <td style={{ padding: '10px' }}>₹{product.price}</td>
                <td style={{ padding: '10px' }}>
                  <span style={{ 
                    fontWeight: 600, 
                    color: product.stock < 10 ? 'var(--danger)' : 'var(--success)' 
                  }}>
                    {product.stock}
                  </span>
                </td>
                <td style={{ padding: '10px', textAlign: 'right' }}>
                  <button 
                    onClick={() => startEdit(product)}
                    style={{ background: 'var(--bg)', marginRight: '5px', padding: '5px 10px' }}
                  >
                    Edit
                  </button>
                  <button 
                    onClick={() => deleteProduct(product.id)}
                    style={{ background: 'transparent', color: 'var(--danger)', padding: '5px 10px' }}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Products;
