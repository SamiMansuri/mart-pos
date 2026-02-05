import React from 'react';
import {
  Box,
  Typography,
  Grid,
  Paper,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  LinearProgress,
  Chip,
  Divider,
  Alert,
} from '@mui/material';
import {
  TrendingUp as SalesIcon,
  Inventory as InventoryIcon,
  People as PerformanceIcon,
  BarChart as AnalyticsIcon,
  ArrowUpward as UpIcon,
  ArrowDownward as DownIcon,
  DateRange as RangeIcon,
} from '@mui/icons-material';
import { reportsApi } from '../api/api';
import DateRangeSelector from '../components/DateRangeSelector';

const Reports = () => {
  const [dateRange, setDateRange] = React.useState({
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
      .toISOString()
      .split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  });

  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);
  const [data, setData] = React.useState({
    summary: {
      total_revenue: 0,
      total_profit: 0,
      total_bills: 0,
      total_cost: 0,
    },
    topProducts: [],
  });

  const fetchReports = async (range) => {
    setLoading(true);
    setError(null);
    try {
      const res = await reportsApi.getStats(range.startDate, range.endDate);
      setData(res);
    } catch (err) {
      console.error('Failed to fetch reports:', err);
      setError('Failed to load reporting data');
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchReports(dateRange);
  }, [dateRange]);

  const handleDateApply = (range) => {
    setDateRange(range);
  };

  const formatCurrency = (val) =>
    `₹${parseFloat(val || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

  const stats = [
    {
      title: 'Total Revenue',
      value: formatCurrency(data.summary?.total_revenue),
      change: `From ${data.summary?.total_bills || 0} bills`,
      trending: 'none',
      icon: <SalesIcon />,
      color: 'primary.main',
    },
    {
      title: 'Net Profit',
      value: formatCurrency(data.summary?.total_profit),
      change:
        data.summary?.total_revenue > 0
          ? `${((data.summary.total_profit / data.summary.total_revenue) * 100).toFixed(1)}% Margin`
          : '0% Margin',
      trending: 'up',
      icon: <AnalyticsIcon />,
      color: 'success.main',
    },
    {
      title: 'Inventory Cost',
      value: formatCurrency(data.summary?.total_cost),
      change: 'Outgoing capital',
      trending: 'none',
      icon: <InventoryIcon />,
      color: 'warning.main',
    },
  ];

  const topProducts = data.topProducts;

  return (
    <Box>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" fontWeight={800} gutterBottom>
          Management Reports
        </Typography>
        <Typography variant="body2" color="text.secondary">
          High-level operational overview and performance analytics
        </Typography>
      </Box>

      <DateRangeSelector onApply={handleDateApply} />

      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
        <RangeIcon fontSize="small" color="action" />
        <Typography variant="body2" color="text.secondary" fontWeight={600}>
          Reporting Period:{' '}
          <Box component="span" sx={{ color: 'primary.main' }}>
            {new Date(dateRange.startDate).toLocaleDateString()} -{' '}
            {new Date(dateRange.endDate).toLocaleDateString()}
          </Box>
        </Typography>
      </Box>

      {loading && <LinearProgress sx={{ mb: 4, borderRadius: 1 }} />}
      {error && (
        <Alert severity="error" sx={{ mb: 4 }}>
          {error}
        </Alert>
      )}

      <Grid container spacing={3} sx={{ mb: 4 }}>
        {stats.map((stat, idx) => (
          <Grid item xs={12} sm={4} key={idx}>
            <Card
              elevation={0}
              sx={{ border: '1px solid', borderColor: 'divider' }}
            >
              <CardContent>
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    mb: 2,
                  }}
                >
                  <Box
                    sx={{
                      p: 1,
                      borderRadius: 1.5,
                      bgcolor: `${stat.color}15`,
                      color: stat.color,
                      display: 'flex',
                    }}
                  >
                    {stat.icon}
                  </Box>
                  <Chip
                    label={stat.change}
                    size="small"
                    color={
                      stat.trending === 'up'
                        ? 'success'
                        : stat.trending === 'down'
                          ? 'error'
                          : 'default'
                    }
                    sx={{ fontWeight: 700 }}
                  />
                </Box>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  fontWeight={600}
                >
                  {stat.title}
                </Typography>
                <Typography variant="h5" fontWeight={800}>
                  {stat.value}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={3}>
        {/* Sales Performance Visualization Placeholder */}
        <Grid item xs={12} lg={12}>
          <Paper
            elevation={0}
            sx={{
              p: 3,
              border: '1px solid',
              borderColor: 'divider',
              height: '100%',
            }}
          >
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                mb: 4,
              }}
            >
              <Typography variant="h6" fontWeight={700}>
                Sales Volume Analysis
              </Typography>
              <Typography variant="caption" color="text.secondary">
                LAST 7 DAYS
              </Typography>
            </Box>

            <Box
              sx={{
                display: 'flex',
                alignItems: 'flex-end',
                gap: 2,
                height: 280,
                mb: 2,
                px: 2,
              }}
            >
              {[40, 65, 30, 85, 55, 90, 70].map((h, i) => (
                <Box key={i} sx={{ flex: 1, position: 'relative' }}>
                  <Box
                    sx={{
                      height: `${h}%`,
                      bgcolor: i === 5 ? 'primary.main' : 'primary.light',
                      borderRadius: '4px 4px 0 0',
                      transition: 'height 0.3s ease-in-out',
                      '&:hover': { bgcolor: 'primary.dark' },
                    }}
                  />
                  <Typography
                    variant="caption"
                    align="center"
                    display="block"
                    sx={{ mt: 1, color: 'text.secondary' }}
                  >
                    {['M', 'T', 'W', 'T', 'F', 'S', 'S'][i]}
                  </Typography>
                </Box>
              ))}
            </Box>
            <Divider sx={{ my: 2 }} />
            <Typography variant="body2" color="text.secondary" align="center">
              Peak trading hours identified between <b>18:00 - 21:00</b>
            </Typography>
          </Paper>
        </Grid>

        {/* Top Products Table */}
        <Grid item xs={12}>
          <Paper
            elevation={0}
            sx={{ border: '1px solid', borderColor: 'divider' }}
          >
            <Box sx={{ p: 3 }}>
              <Typography variant="h6" fontWeight={700}>
                Velocity Tracking
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Product movement speed and stock efficiency
              </Typography>
            </Box>
            <TableContainer>
              <Table>
                <TableHead sx={{ bgcolor: 'action.hover' }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>PRODUCT</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>
                      SALES VOL
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>
                      REVENUE
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>
                      PROFIT
                    </TableCell>
                    <TableCell align="center" sx={{ fontWeight: 700 }}>
                      STATUS
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {topProducts.map((p, idx) => (
                    <TableRow key={idx} hover>
                      <TableCell sx={{ fontWeight: 600 }}>{p.name}</TableCell>
                      <TableCell align="right">{p.sales} units</TableCell>
                      <TableCell align="right">
                        {formatCurrency(p.revenue)}
                      </TableCell>
                      <TableCell align="right">
                        {formatCurrency(p.profit)}
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          label={p.profit > 0 ? 'Profitable' : 'No Margin'}
                          size="small"
                          variant="outlined"
                          color={p.profit > 0 ? 'success' : 'default'}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Reports;
