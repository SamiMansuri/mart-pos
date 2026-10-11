import { useState, useEffect, useCallback, useRef } from 'react';
import { printStatement } from '../services/print.service';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';

export const usePrinterStatus = () => {
  const [state, setState] = useState('checking'); // 'connected', 'disconnected', 'unknown', 'checking'
  const [lastChecked, setLastChecked] = useState(null);
  const [error, setError] = useState(null);
  const previousState = useRef('checking');
  const [toastMessage, setToastMessage] = useState(null);

  const checkStatus = useCallback(async () => {
    setState('checking');
    try {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 2000); // 2s timeout
      
      const response = await fetch('http://localhost:5000/health', {
        signal: controller.signal
      });
      clearTimeout(id);
      
      if (!response.ok) throw new Error('Bad response');
      const data = await response.json();
      
      const newState = data.printer === 'connected' ? 'connected' : 'disconnected';
      
      if (previousState.current === 'connected' && newState === 'disconnected') {
        setToastMessage('Printer offline. Bills can still be saved.');
      }
      
      previousState.current = newState;
      setState(newState);
      setError(data.error || null);
    } catch (err) {
      const newState = 'unknown';
      if (previousState.current === 'connected' && newState === 'unknown') {
        setToastMessage('Printer offline. Bills can still be saved.');
      }
      previousState.current = newState;
      setState(newState);
      setError('Print server unreachable');
    } finally {
      setLastChecked(new Date());
    }
  }, []);

  const testPrint = async () => {
    try {
      await printStatement({ name: 'Test Print', total_due: 0 });
      checkStatus();
    } catch (err) {
      checkStatus();
    }
  };

  const clearToast = () => setToastMessage(null);

  useEffect(() => {
    let interval;
    
    const runPoll = () => {
      if (document.visibilityState === 'visible') {
        checkStatus();
        interval = setInterval(() => {
          if (document.visibilityState === 'visible') {
            checkStatus();
          }
        }, 10000);
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkStatus();
        clearInterval(interval);
        interval = setInterval(checkStatus, 10000);
      } else {
        clearInterval(interval);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    runPoll();

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [checkStatus]);

  return { state, lastChecked, error, checkNow: checkStatus, testPrint, toastMessage, clearToast };
};

export const useConnectionStatus = () => {
  const [state, setState] = useState('checking'); // 'online', 'offline', 'server unreachable'

  const checkServer = useCallback(async () => {
    if (!navigator.onLine) {
      setState('offline');
      return;
    }
    
    try {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 2000);
      
      const response = await fetch(`${API_URL}/health`, { signal: controller.signal });
      clearTimeout(id);
      
      if (response.ok) {
        setState('online');
      } else {
        setState('server unreachable');
      }
    } catch (err) {
      setState('server unreachable');
    }
  }, []);

  useEffect(() => {
    let interval;

    const handleOnline = () => {
      setState('checking');
      checkServer();
      clearInterval(interval);
      interval = setInterval(checkServer, 15000);
    };

    const handleOffline = () => {
      setState('offline');
      clearInterval(interval);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkServer();
        clearInterval(interval);
        interval = setInterval(checkServer, 15000);
      } else {
        clearInterval(interval);
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    handleOnline(); // Initial check

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(interval);
    };
  }, [checkServer]);

  return { state };
};
