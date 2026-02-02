const API_URL = import.meta.env.VITE_API_URL;

/**
 * Centralized fetch wrapper
 * @param {string} endpoint - API endpoint
 * @param {object} options - Fetch options
 * @returns {Promise<any>} - Response data
 */
export const apiFetch = async (endpoint, options = {}) => {
  const token = localStorage.getItem("token");

  const headers = {
    "Content-Type": "application/json",
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
      if (endpoint !== "/auth/login") {
        localStorage.removeItem("token");
        window.location.href = "/login";
        throw new Error("Unauthorized");
      }
    }

    const data = await response.json();

    if (!response.ok) {
      throw data || { message: "Something went wrong" };
    }

    return data.data;
  } catch (error) {
    console.error("API Error:", error);
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
      method: "DELETE",
    }),
  getBillsHistory: (page = 1, limit = 10) =>
    apiFetch(`/bills/bill-history?page=${page}&limit=${limit}`),
  create: (billData) =>
    apiFetch("/bills", {
      method: "POST",
      body: JSON.stringify(billData),
    }),
  void: (id) => apiFetch(`/bills/${id}/void`, { method: "PATCH" }),
  refund: (id, refundData) =>
    apiFetch(`/bills/${id}/refund`, {
      method: "POST",
      body: JSON.stringify(refundData),
    }),
  createReturn: (id, returnData) =>
    apiFetch(`/bills/${id}/return`, {
      method: "POST",
      body: JSON.stringify(returnData),
    }),
  search: (params) => {
    let url = "/bills/search?";
    if (params.bill_number) url += `bill_number=${params.bill_number}`;
    else if (params.business_date && params.invoice_number)
      url += `business_date=${params.business_date}&invoice_number=${params.invoice_number}`;
    return apiFetch(url);
  },
};

export const productsApi = {
  getAll: (page = 1, limit = 10, search = "") => {
    let url = `/products?page=${page}&limit=${limit}`;
    if (search) url += `&search=${encodeURIComponent(search)}`;
    return apiFetch(url);
  },
  getById: (id) => apiFetch(`/products/${id}`),
  create: (productData) =>
    apiFetch("/products", {
      method: "POST",
      body: JSON.stringify(productData),
    }),
  update: (id, productData) =>
    apiFetch(`/products/${id}`, {
      method: "PUT",
      body: JSON.stringify(productData),
    }),
};

export const authApi = {
  login: (credentials) =>
    apiFetch("/auth/login", {
      method: "POST",
      body: JSON.stringify(credentials),
    }),
  logout: () =>
    apiFetch("/auth/logout", {
      method: "POST",
    }),
};

export const usersApi = {
  getAll: () => apiFetch("/users"),
  create: (userData) =>
    apiFetch("/users", {
      method: "POST",
      body: JSON.stringify(userData),
    }),
};
