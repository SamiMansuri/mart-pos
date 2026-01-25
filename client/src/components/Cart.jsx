const Cart = ({ cart, onUpdateQty, onRemove, subtotal, paymentMethod, setPaymentMethod, onPrint, onCancel }) => {
  return (
    <div className="pos-right">
      <div style={{ padding: '20px', borderBottom: '1px solid var(--border)' }}>
        <h2>Current Order</h2>
      </div>
      
      <div className="cart-items">
        {cart.length === 0 ? (
          <p style={{ color: 'var(--muted)', textAlign: 'center', marginTop: '20px' }}>Cart is empty</p>
        ) : (
          cart.map(item => (
            <div key={item.id} className="cart-item">
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600 }}>{item.name}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>₹{item.price} x {item.qty}</div>
              </div>
              
              <div className="cart-controls">
                <button className="qty-btn" onClick={() => onUpdateQty(item.id, -1)}>-</button>
                <span style={{ minWidth: '20px', textAlign: 'center' }}>{item.qty}</span>
                <button className="qty-btn" onClick={() => onUpdateQty(item.id, 1)}>+</button>
                <button 
                  style={{ background: 'transparent', color: 'var(--danger)', marginLeft: '10px', padding: '5px' }}
                  onClick={() => onRemove(item.id)}
                >
                  ✕
                </button>
              </div>
              
              <div style={{ marginLeft: '15px', fontWeight: 600, minWidth: '60px', textAlign: 'right' }}>
                ₹{item.price * item.qty}
              </div>
            </div>
          ))
        )}
      </div>
      
      <div className="cart-summary">
        <div className="summary-row">
          <span>Subtotal</span>
          <span>₹{subtotal}</span>
        </div>
        
        <div style={{ margin: '15px 0' }}>
          <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '5px', fontWeight: 600 }}>Payment Method</label>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button 
              style={{ flex: 1, background: paymentMethod === 'Cash' ? 'var(--primary)' : 'white', color: paymentMethod === 'Cash' ? 'white' : 'var(--text)', border: '1px solid var(--border)' }}
              onClick={() => setPaymentMethod('Cash')}
            >
              Cash
            </button>
            <button 
              style={{ flex: 1, background: paymentMethod === 'UPI' ? 'var(--primary)' : 'white', color: paymentMethod === 'UPI' ? 'white' : 'var(--text)', border: '1px solid var(--border)' }}
              onClick={() => setPaymentMethod('UPI')}
            >
              UPI
            </button>
          </div>
        </div>
        
        <div className="summary-row summary-total">
          <span>Total</span>
          <span>₹{subtotal}</span>
        </div>
        
        <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
          <button 
            style={{ flex: 1, background: 'var(--danger)', color: 'white' }}
            onClick={onCancel}
            disabled={cart.length === 0}
          >
            Cancel Order
          </button>
          <button 
            className="primary" 
            style={{ flex: 2, padding: '15px', fontSize: '1.2rem' }}
            onClick={onPrint}
            disabled={cart.length === 0}
          >
            Print Bill
          </button>
        </div>
      </div>
    </div>
  );
};

export default Cart;
