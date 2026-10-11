import React, { useState } from 'react';
import { 
  Box, 
  Typography, 
  IconButton, 
  Popover, 
  Button, 
  Snackbar, 
  Alert 
} from '@mui/material';
import { Menu as MenuIcon } from '@mui/icons-material';
import { usePrinterStatus, useConnectionStatus } from '../hooks/useStatus';

const StatusDot = ({ color }) => (
  <Box
    sx={{
      width: 10,
      height: 10,
      borderRadius: '50%',
      bgcolor: color,
      display: 'inline-block',
      mr: 1
    }}
  />
);

const StatusBar = ({ onMenuClick, onMenuEnter, onMenuLeave }) => {
  const { 
    state: printerState, 
    lastChecked, 
    error: printerError, 
    checkNow, 
    testPrint,
    toastMessage,
    clearToast
  } = usePrinterStatus();
  
  const { state: connectionState } = useConnectionStatus();

  const [anchorEl, setAnchorEl] = useState(null);

  const handlePrinterClick = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const open = Boolean(anchorEl);

  const getPrinterColor = () => {
    switch (printerState) {
      case 'connected': return '#4ade80'; // green
      case 'disconnected': return '#f87171'; // red
      case 'checking': return '#fbbf24'; // yellow
      default: return '#9ca3af'; // grey
    }
  };

  const getPrinterLabel = () => {
    switch (printerState) {
      case 'connected': return 'Printer ready';
      case 'disconnected': return 'Printer offline';
      case 'checking': return 'Checking printer...';
      default: return 'Printer unknown';
    }
  };

  const getConnectionColor = () => {
    switch (connectionState) {
      case 'online': return '#4ade80';
      case 'offline': return '#f87171';
      case 'server unreachable': return '#f87171';
      default: return '#fbbf24';
    }
  };

  const getConnectionLabel = () => {
    switch (connectionState) {
      case 'online': return 'Online';
      case 'offline': return 'Offline';
      case 'server unreachable': return 'Server Unreachable';
      default: return 'Checking connection...';
    }
  };

  return (
    <>
      <Box
        sx={{
          height: 44,
          width: '100%',
          // bgcolor: '#f3f4f6', // light grey background
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 1,
          boxSizing: 'border-box'
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <IconButton
            onClick={onMenuClick}
            onMouseEnter={onMenuClick}
            sx={{
              width: 44,
              height: 44,
              // borderRadius: 2, // rounded corners
              // border: '1px solid #d1d5db',
              mr: 2,
              '&:focus': { outline: '2px solid #1f2d3d' } // visible focus ring
            }}
            aria-label="open drawer"
          >
            <MenuIcon sx={{ color: '#1f2d3d' }} />
          </IconButton>
          <Typography
            variant="subtitle1"
            sx={{ color: '#1f2d3d', fontWeight: 600, userSelect: 'none' }}
          >
            Family Mart POS
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0 }}>
          <Box
            component="button"
            onClick={handlePrinterClick}
            aria-live="polite"
            sx={{
              display: 'flex',
              alignItems: 'center',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#1f2d3d',
              padding: '4px 8px',
              borderRadius: 1,
              '&:focus': { outline: '2px solid #1f2d3d' }
            }}
          >
            <StatusDot color={getPrinterColor()} />
            <Typography variant="body2" sx={{ display: { xs: 'none', sm: 'block' } }}>
              {getPrinterLabel()}
            </Typography>
          </Box>

          <Box
            aria-live="polite"
            sx={{
              display: 'flex',
              alignItems: 'center',
              color: '#1f2d3d',
              padding: '4px 8px',
            }}
          >
            <StatusDot color={getConnectionColor()} />
            <Typography variant="body2" sx={{ display: { xs: 'none', sm: 'block' } }}>
              {getConnectionLabel()}
            </Typography>
          </Box>
        </Box>
      </Box>

      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
      >
        <Box sx={{ p: 2, width: 250 }}>
          <Typography variant="subtitle2" gutterBottom>
            Printer Status
          </Typography>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Last checked: {lastChecked ? lastChecked.toLocaleTimeString() : 'Never'}
          </Typography>
          {printerError && (
            <Typography variant="body2" color="error" gutterBottom>
              Error: {printerError}
            </Typography>
          )}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 2 }}>
            <Button variant="outlined" size="small" onClick={checkNow}>
              Check Now
            </Button>
            <Button variant="contained" size="small" onClick={testPrint} color="primary">
              Print test receipt
            </Button>
          </Box>
        </Box>
      </Popover>

      <Snackbar 
        open={Boolean(toastMessage)} 
        autoHideDuration={6000} 
        onClose={clearToast}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={clearToast} severity="warning" sx={{ width: '100%' }}>
          {toastMessage}
        </Alert>
      </Snackbar>
    </>
  );
};

export default StatusBar;
