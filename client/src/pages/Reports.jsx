import React, { useMemo, useState, useEffect } from 'react';

const Reports = () => {
  const [bills, setBills] = useState([]);

  useEffect(() => {
    const savedBills = JSON.parse(localStorage.getItem('super_mart_bills') || '[]');
    setBills(savedBills);
  }, []);

  const stats = useMemo(() => {
    // Only count non-voided bills for sales stats
    const activeBills = bills.filter(b => b.status !== 'voided');
    
    const totalBills = activeBills.length;
    let totalSales = 0;
    let cashSales = 0;
    let upiSales = 0;

    activeBills.forEach(bill => {
      totalSales += bill.totalAmount;
      if (bill.paymentMethod === 'Cash') {
        cashSales += bill.totalAmount;
      } else if (bill.paymentMethod === 'UPI') {
        upiSales += bill.totalAmount;
      }
    });

    return { totalBills, totalSales, cashSales, upiSales };
  }, [bills]);

  const voidBill = (billId) => {
    if (!window.confirm('Void this bill? Items will be returned to stock.')) return;

    const billToVoid = bills.find(b => b.billId === billId);
    if (!billToVoid) return;

    // 1. Update bill status
    const updatedBills = bills.map(b => 
      b.billId === billId ? { ...b, status: 'voided' } : b
    );
    setBills(updatedBills);
    localStorage.setItem('super_mart_bills', JSON.stringify(updatedBills));

    // 2. Reverse Stock
    const products = JSON.parse(localStorage.getItem('super_mart_products') || '[]');
    const updatedProducts = products.map(p => {
      const returnedItem = billToVoid.items.find(item => item.id === p.id);
      if (returnedItem) {
        return { ...p, stock: (p.stock || 0) + returnedItem.qty };
      }
      return p;
    });
    localStorage.setItem('super_mart_products', JSON.stringify(updatedProducts));
  };

  return (
    <div className="pos-container" style={{ flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1>Daily Sales Summary</h1>
      </div>

      <div className="product-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', overflow: 'visible' }}>
        <div className="pos-card" style={{ textAlign: 'center' }}>
          <h3 style={{ color: 'var(--muted)', fontSize: '1rem', marginBottom: '10px' }}>Total Bills (Active)</h3>
          <p style={{ fontSize: '2.5rem', fontWeight: 700, color: 'var(--primary)' }}>{stats.totalBills}</p>
        </div>

        <div className="pos-card" style={{ textAlign: 'center' }}>
          <h3 style={{ color: 'var(--muted)', fontSize: '1rem', marginBottom: '10px' }}>Total Sales (Active)</h3>
          <p style={{ fontSize: '2.5rem', fontWeight: 700, color: 'var(--success)' }}>₹{stats.totalSales}</p>
        </div>
      </div>

      <div className="pos-card" style={{ marginTop: '20px' }}>
        <h3 style={{ marginBottom: '20px' }}>Payment-wise Breakdown (Active)</h3>
        <div style={{ display: 'flex', gap: '20px' }}>
          <div style={{ flex: 1, padding: '20px', background: 'var(--bg)', borderRadius: 'var(--radius)' }}>
            <p style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>Cash Sales</p>
            <p style={{ fontSize: '1.5rem', fontWeight: 600 }}>₹{stats.cashSales}</p>
          </div>
          <div style={{ flex: 1, padding: '20px', background: 'var(--bg)', borderRadius: 'var(--radius)' }}>
            <p style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>UPI Sales</p>
            <p style={{ fontSize: '1.5rem', fontWeight: 600 }}>₹{stats.upiSales}</p>
          </div>
        </div>
      </div>

      {bills.length > 0 && (
        <div className="pos-card" style={{ marginTop: '20px', flex: 1, overflowY: 'auto' }}>
          <h3 style={{ marginBottom: '15px' }}>Transaction History</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '2px solid var(--border)' }}>
                <th style={{ padding: '10px' }}>Bill ID</th>
                <th style={{ padding: '10px' }}>Time</th>
                <th style={{ padding: '10px' }}>Method</th>
                <th style={{ padding: '10px' }}>Status</th>
                <th style={{ padding: '10px', textAlign: 'right' }}>Amount</th>
                <th style={{ padding: '10px', textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {bills.slice().reverse().map(bill => (
                <tr key={bill.billId} style={{ 
                  borderBottom: '1px solid var(--border)',
                  opacity: bill.status === 'voided' ? 0.6 : 1,
                  background: bill.status === 'voided' ? '#fff5f5' : 'transparent'
                }}>
                  <td style={{ padding: '10px', fontSize: '0.9rem' }}>
                    {bill.status === 'voided' && <span style={{ textDecoration: 'line-through' }}>{bill.billId}</span>}
                    {bill.status !== 'voided' && bill.billId}
                  </td>
                  <td style={{ padding: '10px', fontSize: '0.9rem' }}>{new Date(bill.createdAt).toLocaleTimeString()}</td>
                  <td style={{ padding: '10px' }}>
                    <span style={{ 
                      padding: '2px 8px', 
                      borderRadius: '12px', 
                      fontSize: '0.8rem',
                      background: bill.paymentMethod === 'Cash' ? '#fde68a' : '#bfdbfe',
                      color: bill.paymentMethod === 'Cash' ? '#92400e' : '#1e40af'
                    }}>
                      {bill.paymentMethod}
                    </span>
                  </td>
                  <td style={{ padding: '10px' }}>
                    <span style={{ 
                      padding: '2px 8px', 
                      borderRadius: '12px', 
                      fontSize: '0.8rem',
                      background: bill.status === 'voided' ? 'var(--danger)' : 'var(--success)',
                      color: 'white'
                    }}>
                      {bill.status || 'completed'}
                    </span>
                  </td>
                  <td style={{ padding: '10px', textAlign: 'right', fontWeight: 600 }}>₹{bill.totalAmount}</td>
                  <td style={{ padding: '10px', textAlign: 'right' }}>
                    {bill.status !== 'voided' && (
                      <button 
                        onClick={() => voidBill(bill.billId)}
                        style={{ background: 'transparent', color: 'var(--danger)', fontSize: '0.8rem', padding: '5px' }}
                      >
                        Void
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default Reports;
