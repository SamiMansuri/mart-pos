import { useState, useMemo, useEffect, useRef } from 'react';
import SearchBar from '../components/SearchBar';
import ProductList from '../components/ProductList';
import Cart from '../components/Cart';
import Receipt from '../components/Receipt';

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

const POS = () => {
  const [products, setProducts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [cart, setCart] = useState([]);
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [lastBill, setLastBill] = useState(null);
  const searchInputRef = useRef(null);

  const filteredProducts = useMemo(() => {
    return products.filter(p => 
      p.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [searchTerm, products]);

  const addToCart = (product) => {
    const cartItem = cart.find(item => item.id === product.id);
    const currentQty = cartItem ? cartItem.qty : 0;
    
    if (currentQty + 1 > product.stock) {
      alert('Insufficient stock!');
      return;
    }

    setCart(prevCart => {
      const existing = prevCart.find(item => item.id === product.id);
      if (existing) {
        return prevCart.map(item => 
          item.id === product.id ? { ...item, qty: item.qty + 1 } : item
        );
      }
      return [...prevCart, { ...product, qty: 1 }];
    });
  };

  const handleCancelOrder = () => {
    if (window.confirm('Are you sure you want to cancel this order? Item quantities will not be saved.')) {
      setCart([]);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'F2') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      
      if (e.key === 'Enter' && filteredProducts.length > 0 && document.activeElement === searchInputRef.current) {
        e.preventDefault();
        addToCart(filteredProducts[0]);
      }

      if (e.key === 'Escape' && cart.length > 0) {
        e.preventDefault();
        handleCancelOrder();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [filteredProducts, cart]);

  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem('super_mart_products'));
    if (!saved || saved.length === 0) {
      localStorage.setItem('super_mart_products', JSON.stringify(DEFAULT_PRODUCTS));
      setProducts(DEFAULT_PRODUCTS);
    } else {
      setProducts(saved.map(p => ({ ...p, stock: p.stock ?? 0 })));
    }
  }, []);

  const updateQty = (id, delta) => {
    const product = products.find(p => p.id === id);
    const cartItem = cart.find(item => item.id === id);
    
    if (delta > 0 && cartItem.qty + delta > product.stock) {
      alert('Insufficient stock!');
      return;
    }

    setCart(prevCart => {
      return prevCart.map(item => {
        if (item.id === id) {
          const newQty = Math.max(1, item.qty + delta);
          return { ...item, qty: newQty };
        }
        return item;
      });
    });
  };

  const removeItem = (id) => {
    setCart(prevCart => prevCart.filter(item => item.id !== id));
  };

  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);

  const handlePrint = () => {
    if (cart.length === 0) return;

    const billId = `BILL-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const billData = {
      billId,
      items: [...cart],
      totalAmount: subtotal,
      paymentMethod,
      createdAt: new Date().toISOString(),
      status: 'completed'
    };

    setLastBill(billData);

    const updatedProducts = products.map(p => {
      const soldItem = cart.find(item => item.id === p.id);
      if (soldItem) {
        return { ...p, stock: p.stock - soldItem.qty };
      }
      return p;
    });
    setProducts(updatedProducts);
    localStorage.setItem('super_mart_products', JSON.stringify(updatedProducts));

    const existingBills = JSON.parse(localStorage.getItem('super_mart_bills') || '[]');
    localStorage.setItem('super_mart_bills', JSON.stringify([...existingBills, billData]));

    setTimeout(() => {
      window.print();
      setCart([]);
      setLastBill(null);
    }, 100);
  };

  return (
    <>
      <div className="pos-container">
        <div className="pos-left">
          <h1 style={{ marginBottom: '10px' }}>Super Mart POS</h1>
          <SearchBar ref={searchInputRef} onSearch={setSearchTerm} />
          <ProductList products={filteredProducts} onAddToCart={addToCart} />
        </div>
        
        <Cart 
          cart={cart} 
          onUpdateQty={updateQty} 
          onRemove={removeItem}
          subtotal={subtotal}
          paymentMethod={paymentMethod}
          setPaymentMethod={setPaymentMethod}
          onPrint={handlePrint}
          onCancel={handleCancelOrder}
        />
      </div>
      
      <Receipt billData={lastBill} />
    </>
  );
};

export default POS;
