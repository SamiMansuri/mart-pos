import React, { useState, useEffect, useMemo } from 'react';

const CashControl = () => {
  const [openingCash, setOpeningCash] = useState('');
  const [closingCash, setClosingCash] = useState('');
  const [cashHistory, setCashHistory] = useState([]);
  const [isSaved, setIsSaved] = useState(false);

  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    const history = JSON.parse(localStorage.getItem('super_mart_cash_history') || '[]');
    setCashHistory(history);
    
    const todaysRecord = history.find(h => h.date === today);
    if (todaysRecord) {
      setOpeningCash(todaysRecord.opening);
      setClosingCash(todaysRecord.closing || '');
      setIsSaved(!!todaysRecord.closing);
    }
  }, [today]);

  const expectedCashFromSales = useMemo(() => {
    const bills = JSON.parse(localStorage.getItem('super_mart_bills') || '[]');
    return bills
      .filter(b => b.createdAt.startsWith(today) && b.paymentMethod === 'Cash' && b.status !== 'voided')
      .reduce((sum, b) => sum + b.totalAmount, 0);
  }, [today]);

  const expectedTotal = Number(openingCash || 0) + expectedCashFromSales;
  const difference = Number(closingCash || 0) - expectedTotal;

  const handleSave = (e) => {
    e.preventDefault();
    const newRecord = {
      date: today,
      opening: Number(openingCash),
      sales: expectedCashFromSales,
      expected: expectedTotal,
      closing: Number(closingCash),
      difference: difference,
      timestamp: new Date().toISOString()
    };

    const updatedHistory = cashHistory.filter(h => h.date !== today);
    updatedHistory.push(newRecord);
    
    setCashHistory(updatedHistory);
    localStorage.setItem('super_mart_cash_history', JSON.stringify(updatedHistory));
    setIsSaved(true);
    alert('Daily cash record saved successfully!');
  };

  return (
    <div className="pos-container" style={{ flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1>Daily Cash Control ({today})</h1>
      </div>

      <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
        <div className="pos-card" style={{ flex: 1, minWidth: '300px' }}>
          <h3>Reconciliation Form</h3>
          <form onSubmit={handleSave} style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '5px', fontWeight: 600 }}>Opening Cash (₹)</label>
              <input 
                type="number" 
                value={openingCash} 
                onChange={e => setOpeningCash(e.target.value)}
                placeholder="0.00"
                required
                disabled={isSaved}
              />
            </div>

            <div style={{ padding: '15px', background: 'var(--bg)', borderRadius: 'var(--radius)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                <span>Opening Cash:</span>
                <span>₹{Number(openingCash || 0)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                <span>Today's Cash Sales:</span>
                <span>₹{expectedCashFromSales}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, borderTop: '1px solid var(--border)', paddingTop: '5px', marginTop: '5px' }}>
                <span>Expected Total:</span>
                <span>₹{expectedTotal}</span>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '5px', fontWeight: 600 }}>Closing Cash Entry (₹)</label>
              <input 
                type="number" 
                value={closingCash} 
                onChange={e => setClosingCash(e.target.value)}
                placeholder="0.00"
                required
                disabled={isSaved}
              />
            </div>

            <div style={{ 
              padding: '15px', 
              borderRadius: 'var(--radius)', 
              background: difference === 0 ? 'var(--success)' : 'var(--danger)',
              color: 'white',
              display: (openingCash && closingCash) ? 'flex' : 'none',
              justifyContent: 'space-between',
              fontWeight: 700
            }}>
              <span>Difference:</span>
              <span>₹{difference} {difference === 0 ? '(Perfect)' : ''}</span>
            </div>

            {!isSaved && (
              <button type="submit" className="primary" style={{ padding: '15px' }}>
                Save & Close Day
              </button>
            )}
            {isSaved && (
              <p style={{ color: 'var(--success)', fontWeight: 600, textAlign: 'center' }}>✓ Record finalized for today</p>
            )}
          </form>
        </div>

        <div className="pos-card" style={{ flex: 1.5, minWidth: '400px' }}>
          <h3>Cash History</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '15px' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '2px solid var(--border)', fontSize: '0.9rem' }}>
                <th style={{ padding: '10px' }}>Date</th>
                <th style={{ padding: '10px' }}>Opening</th>
                <th style={{ padding: '10px' }}>Sales</th>
                <th style={{ padding: '10px' }}>Closing</th>
                <th style={{ padding: '10px', textAlign: 'right' }}>Diff</th>
              </tr>
            </thead>
            <tbody>
              {cashHistory.slice().reverse().map(record => (
                <tr key={record.date} style={{ borderBottom: '1px solid var(--border)', fontSize: '0.85rem' }}>
                  <td style={{ padding: '10px' }}>{record.date}</td>
                  <td style={{ padding: '10px' }}>₹{record.opening}</td>
                  <td style={{ padding: '10px' }}>₹{record.sales}</td>
                  <td style={{ padding: '10px' }}>₹{record.closing}</td>
                  <td style={{ 
                    padding: '10px', 
                    textAlign: 'right', 
                    fontWeight: 700, 
                    color: record.difference === 0 ? 'var(--success)' : 'var(--danger)' 
                  }}>
                    ₹{record.difference}
                  </td>
                </tr>
              ))}
              {cashHistory.length === 0 && (
                <tr>
                  <td colSpan="5" style={{ padding: '20px', textAlign: 'center', color: 'var(--muted)' }}>No records yet</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default CashControl;
