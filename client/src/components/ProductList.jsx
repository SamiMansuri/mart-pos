const ProductList = ({ products, onAddToCart }) => {
  return (
    <div className="product-grid">
      {products.map(product => (
        <div key={product.id} className="product-item">
          <div style={{ fontSize: '2rem' }}>{product.icon}</div>
          <h3 style={{ fontSize: '1rem', margin: '5px 0' }}>{product.name}</h3>
          <p style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>₹{product.price}</p>
          <p style={{ 
            fontSize: '0.8rem', 
            fontWeight: 600, 
            color: product.stock < 10 ? 'var(--danger)' : 'var(--muted)',
            marginBottom: '5px'
          }}>
            Stock: {product.stock}
          </p>
          <button 
            className="primary" 
            style={{ width: '100%', marginTop: 'auto' }}
            onClick={() => onAddToCart(product)}
            disabled={product.stock <= 0}
          >
            {product.stock <= 0 ? 'Out of Stock' : 'Add'}
          </button>
        </div>
      ))}
      {products.length === 0 && <p style={{ textAlign: 'center', width: '100%', color: 'var(--muted)' }}>No products found</p>}
    </div>
  );
};

export default ProductList;
