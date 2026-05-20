const API_URL = import.meta.env.VITE_API_URL;

/**
 * Centralized fetch wrapper
 * @param {string} endpoint - API endpoint
 * @param {object} options - Fetch options
 * @returns {Promise<any>} - Response data
 */
export const apiFetch = async (endpoint, options = {}) => {
  const token = localStorage.getItem('token');

  const headers = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  };

  const config = {
    ...options,
    headers,
  };

  try {
    const response = await fetch(`${API_URL}${endpoint}`, config);

    if (response.status === 401) {
      // Global logout handle - skip redirect if we are already logging in
      if (endpoint !== '/auth/login') {
        localStorage.removeItem('token');
        window.location.href = '/login';
        throw new Error('Unauthorized');
      }
    }

    const data = await response.json();

    if (!response.ok) {
      throw data || { message: 'Something went wrong' };
    }

    return data.data;
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
};

export const billsApi = {
  getAll: (page = 1, limit = 10) =>
    apiFetch(`/bills?page=${page}&limit=${limit}`),
  getById: (id) => apiFetch(`/bills/${id}`),
  getDetails: (id) => apiFetch(`/bills/${id}/details`),
  deleteBill: (id) =>
    apiFetch(`/bills/${id}`, {
      method: 'DELETE',
    }),
  getBillsHistory: (page = 1, limit = 10, search = '', date = '') => {
    let url = `/bills/bill-history?page=${page}&limit=${limit}`;
    if (search) url += `&search=${encodeURIComponent(search)}`;
    if (date) url += `&date=${date}`;
    return apiFetch(url);
  },
  create: (billData) =>
    apiFetch('/bills', {
      method: 'POST',
      body: JSON.stringify(billData),
    }),
  void: (id) => apiFetch(`/bills/${id}/void`, { method: 'PATCH' }),
  refund: (id, refundData) =>
    apiFetch(`/bills/${id}/refund`, {
      method: 'POST',
      body: JSON.stringify(refundData),
    }),
  createReturn: (id, returnData) =>
    apiFetch(`/bills/${id}/return`, {
      method: 'POST',
      body: JSON.stringify(returnData),
    }),
  search: (params) => {
    const searchParams = new URLSearchParams(params);
    return apiFetch(`/bills/search?${searchParams.toString()}`);
  },
  editBill: (id, billData) =>
    apiFetch(`/bills/${id}/edit`, {
      method: 'PATCH',
      body: JSON.stringify(billData),
    }),
  getByCustomer: (id, page = 1, limit = 10) =>
    apiFetch(`/bills/customer/${id}?page=${page}&limit=${limit}`),
};

export const productsApi = {
  getAll: (page = 1, limit = 10, search = '') => {
    let url = `/products?page=${page}&limit=${limit}`;
    if (search) url += `&search=${encodeURIComponent(search)}`;
    return apiFetch(url);
  },
  getByBarcode: (barcode) => apiFetch(`/products/by-barcode/${barcode}`),
  getById: (id) => apiFetch(`/products/${id}`),
  create: (productData) =>
    apiFetch('/products', {
      method: 'POST',
      body: JSON.stringify(productData),
    }),
  update: (id, productData) =>
    apiFetch(`/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(productData),
    }),
  disable: (id) =>
    apiFetch(`/products/${id}/disable`, {
      method: 'PATCH',
    }),
};

export const stockApi = {
  addStock: (stockData) =>
    apiFetch('/stock/add', {
      method: 'POST',
      body: JSON.stringify(stockData),
    }),
};

export const luckyDrawApi = {
  getActiveCampaign: () => apiFetch('/lucky-draw/campaigns/active'),
  createCampaign: (data) =>
    apiFetch('/lucky-draw/campaigns', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateCampaign: (id, data) =>
    apiFetch(`/lucky-draw/campaigns/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  getExcludedProducts: (id) =>
    apiFetch(`/lucky-draw/campaigns/${id}/excluded-products`),
  addExcludedProduct: (id, productId) =>
    apiFetch(`/lucky-draw/campaigns/${id}/excluded-products/${productId}`, {
      method: 'POST',
    }),
  removeExcludedProduct: (id, productId) =>
    apiFetch(`/lucky-draw/campaigns/${id}/excluded-products/${productId}`, {
      method: 'DELETE',
    }),
  getEntriesByBill: (billNumber) =>
    apiFetch(`/lucky-draw/entries/${billNumber}`),
  createManualEntry: (data) =>
    apiFetch('/lucky-draw/campaigns/manual-entry', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

export const authApi = {
  login: (credentials) =>
    apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    }),
  logout: () =>
    apiFetch('/auth/logout', {
      method: 'POST',
    }),
  changePassword: (passwords) =>
    apiFetch('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify(passwords),
    }),
};

export const usersApi = {
  getAll: () => apiFetch('/users'),
  create: (userData) =>
    apiFetch('/users', {
      method: 'POST',
      body: JSON.stringify(userData),
    }),
};

export const customersApi = {
  getAll: (search = '') => {
    let url = '/customers';
    if (search) url += `?q=${encodeURIComponent(search)}`;
    return apiFetch(url);
  },
  getById: (id) => apiFetch(`/customers/${id}`),
  create: (customerData) =>
    apiFetch('/customers', {
      method: 'POST',
      body: JSON.stringify(customerData),
    }),
  update: (id, customerData) =>
    apiFetch(`/customers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(customerData),
    }),
  updatePartial: (id, data) =>
    apiFetch(`/customers/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  getLedger: (id, page, limit) => {
    let url = `/customers/${id}/ledger`;
    if (page && limit) url += `?page=${page}&limit=${limit}`;
    return apiFetch(url);
  },
};

export const paymentsApi = {
  create: (customerId, paymentData) =>
    apiFetch(`/customers/${customerId}/payments`, {
      method: 'POST',
      body: JSON.stringify(paymentData),
    }),
};

export const reportsApi = {
  getStats: (startDate, endDate) =>
    apiFetch(`/reports?startDate=${startDate}&endDate=${endDate}`),
  getCashierReport: (date) => apiFetch(`/reports/cashier?date=${date}`),
};
