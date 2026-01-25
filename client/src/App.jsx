import POS from './pages/POS'
import Reports from './pages/Reports'
import Products from './pages/Products'
import CashControl from './pages/CashControl'
import { useState } from 'react';

function App() {
  const [currentPage, setCurrentPage] = useState('POS');

  return (
    <div className="App">
      <nav className="no-print" style={{ 
        background: 'var(--card-bg)', 
        borderBottom: '1px solid var(--border)',
        padding: '0 20px',
        display: 'flex',
        gap: '20px',
        height: '50px',
        alignItems: 'center'
      }}>
        <button 
          onClick={() => setCurrentPage('POS')}
          style={{ 
            background: 'transparent', 
            color: currentPage === 'POS' ? 'var(--primary)' : 'var(--text)',
            borderBottom: currentPage === 'POS' ? '2px solid var(--primary)' : 'none',
            borderRadius: 0,
            padding: '0 10px',
            height: '100%',
            fontWeight: currentPage === 'POS' ? 700 : 400
          }}
        >
          POS
        </button>
        <button 
          onClick={() => setCurrentPage('Products')}
          style={{ 
            background: 'transparent', 
            color: currentPage === 'Products' ? 'var(--primary)' : 'var(--text)',
            borderBottom: currentPage === 'Products' ? '2px solid var(--primary)' : 'none',
            borderRadius: 0,
            padding: '0 10px',
            height: '100%',
            fontWeight: currentPage === 'Products' ? 700 : 400
          }}
        >
          Products
        </button>
        <button 
          onClick={() => setCurrentPage('CashControl')}
          style={{ 
            background: 'transparent', 
            color: currentPage === 'CashControl' ? 'var(--primary)' : 'var(--text)',
            borderBottom: currentPage === 'CashControl' ? '2px solid var(--primary)' : 'none',
            borderRadius: 0,
            padding: '0 10px',
            height: '100%',
            fontWeight: currentPage === 'CashControl' ? 700 : 400
          }}
        >
          Cash Control
        </button>
        <button 
          onClick={() => setCurrentPage('Reports')}
          style={{ 
            background: 'transparent', 
            color: currentPage === 'Reports' ? 'var(--primary)' : 'var(--text)',
            borderBottom: currentPage === 'Reports' ? '2px solid var(--primary)' : 'none',
            borderRadius: 0,
            padding: '0 10px',
            height: '100%',
            fontWeight: currentPage === 'Reports' ? 700 : 400
          }}
        >
          Sales Summary
        </button>
      </nav>

      {currentPage === 'POS' && <POS />}
      {currentPage === 'Products' && <Products />}
      {currentPage === 'CashControl' && <CashControl />}
      {currentPage === 'Reports' && <Reports />}
    </div>
  )
}

export default App
