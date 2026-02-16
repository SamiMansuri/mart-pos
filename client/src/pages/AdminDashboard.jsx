import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { billsApi, productsApi } from '../api/api';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  CircularProgress,
  Button,
} from '@mui/material';
import {
  TrendingUp as RevenueIcon,
  Receipt as BillIcon,
  Inventory as InventoryIcon,
  CheckCircle as HealthIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import BillsList from './BillsList';

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalSales: 0,
    billCount: 0,
    productCount: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const [billsResponse, productsResponse] = await Promise.all([
        billsApi.getAll(1, 100), // Fetch recent 100 for stats
        productsApi.getAll(),
      ]);

      const bills = billsResponse.bills || billsResponse || [];
      const total = bills.reduce(
        (sum, b) => sum + parseFloat(b.total_amount || 0),
        0,
      );

      setStats({
        totalSales: total,
        billCount: billsResponse.meta?.total || bills.length,
        productCount:
          productsResponse.meta?.total ||
          productsResponse.products?.length ||
          0,
      });
    } catch (err) {
      console.error('Failed to load dashboard stats', err);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    // {
    //   title: "Total Revenue",
    //   value: `₹${stats.totalSales.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    //   icon: RevenueIcon,
    //   color: "primary.main",
    // },
    {
      title: 'Transactions',
      value: stats.billCount,
      icon: BillIcon,
      color: 'success.main',
    },
    {
      title: 'Products',
      value: stats.productCount,
      icon: InventoryIcon,
      color: 'warning.main',
    },
    {
      title: 'System Status',
      value: 'Online',
      icon: HealthIcon,
      color: 'info.main',
    },
  ];

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box
        sx={{
          mb: 4,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: 2,
        }}
      >
        <Box>
          <Typography variant="h4" fontWeight={700} gutterBottom>
            Admin Dashboard
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Overview and transaction management
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => navigate('/admin/products/add')}
          sx={{ whiteSpace: 'nowrap' }}
        >
          Add Product
        </Button>
      </Box>

      <Grid container spacing={3} sx={{ mb: 4 }}>
        {statCards.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <Grid item xs={12} sm={6} md={3} key={i}>
              <Card>
                <CardContent>
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 2,
                      mb: 2,
                    }}
                  >
                    <Box
                      sx={{
                        width: 48,
                        height: 48,
                        borderRadius: 2,
                        bgcolor: `${stat.color}15`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Icon sx={{ color: stat.color, fontSize: 24 }} />
                    </Box>
                  </Box>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: 'block', mb: 0.5 }}
                  >
                    {stat.title}
                  </Typography>
                  <Typography variant="h5" fontWeight={700}>
                    {stat.value}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>

      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" fontWeight={700} gutterBottom>
          Transaction History
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Recent bills and transactions
        </Typography>
      </Box>

      <BillsList />
    </Box>
  );
};

export default AdminDashboard;
