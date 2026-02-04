import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Grid,
  TextField,
  Stack,
  Chip,
  Paper,
  Alert,
} from '@mui/material';
import {
  CalendarToday as CalendarIcon,
  DateRange as RangeIcon,
} from '@mui/icons-material';

const DateRangeSelector = ({ onApply }) => {
  const [selectedPreset, setSelectedPreset] = useState('This Month');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [error, setError] = useState('');

  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  const presets = [
    { label: 'Today', value: 'Today' },
    { label: 'Yesterday', value: 'Yesterday' },
    { label: 'This Week', value: 'This Week' },
    { label: 'This Month', value: 'This Month' },
    { label: 'Last Month', value: 'Last Month' },
    { label: 'Custom', value: 'Custom' },
  ];

  const calculateDateRange = (preset) => {
    const now = new Date();
    let start = new Date();
    let end = new Date();

    switch (preset) {
      case 'Today':
        start = now;
        end = now;
        break;
      case 'Yesterday':
        start = new Date(now);
        start.setDate(now.getDate() - 1);
        end = new Date(start);
        break;
      case 'This Week':
        start = new Date(now);
        start.setDate(now.getDate() - now.getDay()); // Sunday
        end = now;
        break;
      case 'This Month':
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = now;
        break;
      case 'Last Month':
        start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        end = new Date(now.getFullYear(), now.getMonth(), 0); // Last day of previous month
        break;
      default:
        return null;
    }

    return {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0],
    };
  };

  useEffect(() => {
    if (selectedPreset !== 'Custom') {
      const range = calculateDateRange(selectedPreset);
      if (range) {
        setStartDate(range.start);
        setEndDate(range.end);
        setError('');
      }
    }
  }, [selectedPreset]);

  // Initial load
  useEffect(() => {
    const range = calculateDateRange('This Month');
    setStartDate(range.start);
    setEndDate(range.end);
  }, []);

  const handleApply = () => {
    if (startDate > endDate) {
      setError('From Date cannot be greater than To Date');
      return;
    }
    if (startDate > todayStr || endDate > todayStr) {
      setError('Future dates are not allowed');
      return;
    }
    setError('');
    onApply({ startDate, endDate });
  };

  return (
    <Paper
      elevation={0}
      sx={{ p: 3, border: '1px solid', borderColor: 'divider', mb: 4 }}
    >
      <Grid container spacing={3} alignItems="center">
        <Grid item xs={12} md={5}>
          <Typography variant="subtitle2" fontWeight={700} gutterBottom>
            Quick Presets
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {presets.map((preset) => (
              <Chip
                key={preset.value}
                label={preset.label}
                onClick={() => setSelectedPreset(preset.value)}
                color={selectedPreset === preset.value ? 'primary' : 'default'}
                variant={
                  selectedPreset === preset.value ? 'contained' : 'outlined'
                }
                clickable
                sx={{ borderRadius: 1.5, fontWeight: 600 }}
              />
            ))}
          </Box>
        </Grid>

        <Grid item xs={12} md={5}>
          <Typography variant="subtitle2" fontWeight={700} gutterBottom>
            Custom Range
          </Typography>
          <Stack direction="row" spacing={2} alignItems="center">
            <TextField
              fullWidth
              label="From"
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setSelectedPreset('Custom');
              }}
              InputLabelProps={{ shrink: true }}
              inputProps={{ max: todayStr }}
              size="small"
            />
            <Typography color="text.secondary">to</Typography>
            <TextField
              fullWidth
              label="To"
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setSelectedPreset('Custom');
              }}
              InputLabelProps={{ shrink: true }}
              inputProps={{ max: todayStr }}
              size="small"
            />
          </Stack>
        </Grid>

        <Grid item xs={12} md={2}>
          <Box
            sx={{ height: { md: 25 }, display: { xs: 'none', md: 'block' } }}
          />{' '}
          {/* Spacer for alignment */}
          <Button
            fullWidth
            variant="contained"
            onClick={handleApply}
            sx={{ height: 40, fontWeight: 700 }}
            startIcon={<RangeIcon />}
          >
            Apply
          </Button>
        </Grid>

        {error && (
          <Grid item xs={12}>
            <Alert severity="error" variant="outlined" sx={{ py: 0 }}>
              {error}
            </Alert>
          </Grid>
        )}
      </Grid>
    </Paper>
  );
};

export default DateRangeSelector;
