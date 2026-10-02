const API_BASE = '/api';

export function getAuthToken(): string | null {
  return localStorage.getItem('crm_token');
}

export function setAuthToken(token: string): void {
  localStorage.setItem('crm_token', token);
}

export function removeAuthToken(): void {
  localStorage.removeItem('crm_token');
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json();

  if (!response.ok) {
    if (response.status === 401 && !endpoint.includes('/auth/login')) {
      removeAuthToken();
      window.dispatchEvent(new Event('auth_expired'));
    }
    throw new Error(data.error || 'Request failed');
  }

  return data;
}

async function openReceipt(endpoint: string): Promise<void> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    headers: { Authorization: `Bearer ${getAuthToken() || ''}` },
  });
  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || 'Could not open receipt.');
  }
  const fileUrl = URL.createObjectURL(await response.blob());
  window.open(fileUrl, '_blank', 'noopener,noreferrer');
  window.setTimeout(() => URL.revokeObjectURL(fileUrl), 60_000);
}

export const api = {
  // Auth
  login: (credentials: { email: string; password: string }) =>
    request<{ token: string; user: any }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    }),
  register: (data: { full_name: string; email: string; password: string; role?: string; phone?: string; plan?: 'trial' | 'paid' }) =>
    request<{ token: string; user: any; message: string }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getMe: () => request<{ user: any }>('/auth/me'),
  updateProfile: (data: { full_name?: string; phone?: string; current_password?: string; new_password?: string }) =>
    request<{ user: any; message: string }>('/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  logout: () => request<{ message: string }>('/auth/logout', { method: 'POST' }),

  // Customer Submission / Requests
  getCustomerRequestForm: (token: string) =>
    request<{ manager: { email: string; name: string }; executives: any[]; token: string }>(`/customer-requests/public/${encodeURIComponent(token)}`),
  submitPublicCustomerRequest: (token: string, data: any) =>
    request<{ message: string; request_code: string; id: number; status: string }>(`/customer-requests/public/${encodeURIComponent(token)}`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  submitCustomerRequest: (data: any) =>
    request<{ message: string; request_code: string; id: number; status: string }>('/customer-requests', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getCustomerRequests: () =>
    request<{ requests: any[]; total: number }>('/customer-requests'),
  createCustomerRequestShareLink: () =>
    request<{ token: string; url: string; manager_email: string }>('/customer-requests/share-link', { method: 'POST' }),
  checkCustomerImport: (rows: any[]) =>
    request<{ rows: any[] }>('/customer-requests/import-check', {
      method: 'POST',
      body: JSON.stringify({ rows }),
    }),
  importCustomers: (rows: any[]) =>
    request<{ message: string; imported: any[]; skipped: any[] }>('/customer-requests/import', {
      method: 'POST',
      body: JSON.stringify({ rows }),
    }),

  // Customers
  getCustomers: (params?: { search?: string; status?: string; sort?: string }) => {
    const query = new URLSearchParams(params as any).toString();
    return request<{ customers: any[]; total: number }>(`/customers${query ? `?${query}` : ''}`);
  },
  getCustomerById: (id: number | string) => request<any>(`/customers/${id}`),
  createCustomer: (data: any) => request<any>('/customers', { method: 'POST', body: JSON.stringify(data) }),
  updateCustomer: (id: number | string, data: any) =>
    request<any>(`/customers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteCustomer: (id: number | string) =>
    request<{ message: string }>(`/customers/${id}`, { method: 'DELETE' }),

  // Leads
  getLeads: (params?: { search?: string; status?: string; priority?: string; source?: string }) => {
    const query = new URLSearchParams(params as any).toString();
    return request<{ leads: any[]; total: number }>(`/leads${query ? `?${query}` : ''}`);
  },
  createLead: (data: any) => request<any>('/leads', { method: 'POST', body: JSON.stringify(data) }),
  updateLead: (id: number | string, data: any) =>
    request<any>(`/leads/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  qualifyLead: (id: number | string) =>
    request<{ message: string }>(`/leads/${id}/qualify`, { method: 'POST' }),
  convertLead: (id: number | string) =>
    request<{ message: string; customerId: number; opportunityId: number }>(`/leads/${id}/convert`, { method: 'POST' }),
  deleteLead: (id: number | string) =>
    request<{ message: string }>(`/leads/${id}`, { method: 'DELETE' }),

  // Opportunities
  getOpportunities: () => request<{ opportunities: any[] }>('/opportunities'),
  createOpportunity: (data: any) => request<any>('/opportunities', { method: 'POST', body: JSON.stringify(data) }),
  updateOpportunityStage: (id: number | string, stage: string) =>
    request<{ message: string; stage: string; probability: number }>(`/opportunities/${id}/stage`, {
      method: 'PUT',
      body: JSON.stringify({ stage }),
    }),

  // Follow-ups
  getFollowups: (params?: { status?: string; type?: string; priority?: string }) => {
    const query = new URLSearchParams(params as any).toString();
    return request<{
      all: any[];
      today: any[];
      overdue: any[];
      upcoming: any[];
      completed: any[];
      stats: any;
    }>(`/followups${query ? `?${query}` : ''}`);
  },
  createFollowup: (data: any) => request<any>('/followups', { method: 'POST', body: JSON.stringify(data) }),
  completeFollowup: (id: number | string, outcomeNotes?: string) =>
    request<{ message: string }>(`/followups/${id}/complete`, {
      method: 'POST',
      body: JSON.stringify({ outcomeNotes }),
    }),
  deleteFollowup: (id: number | string) =>
    request<{ message: string }>(`/followups/${id}`, { method: 'DELETE' }),

  // Quotations
  getQuotations: () => request<{ quotations: any[] }>('/quotations'),
  getQuotationById: (id: number | string) => request<{ quotation: any; items: any[] }>(`/quotations/${id}`),
  createQuotation: (data: any) => request<any>('/quotations', { method: 'POST', body: JSON.stringify(data) }),
  updateQuotationStatus: (id: number | string, status: string) =>
    request<{ message: string }>(`/quotations/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    }),
  convertQuotationToOrder: (id: number | string) =>
    request<{ message: string; orderId: number; order_number: string }>(
      `/quotations/${id}/convert-to-order`,
      { method: 'POST' }
    ),

  // Orders
  getOrders: () => request<{ orders: any[] }>('/orders'),
  getOrderById: (id: number | string) => request<{ order: any; items: any[] }>(`/orders/${id}`),
  createOrder: (data: any) => request<any>('/orders', { method: 'POST', body: JSON.stringify(data) }),
  updateOrderStatus: (id: number | string, status: string) =>
    request<{ message: string }>(`/orders/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    }),

  // Communications
  getCommunications: (customerId?: number | string) => {
    const query = customerId ? `?customer_id=${customerId}` : '';
    return request<{ communications: any[] }>(`/communications${query}`);
  },
  logCommunication: (data: any) =>
    request<{ message: string }>('/communications', { method: 'POST', body: JSON.stringify(data) }),

  // Feedback & Support
  getFeedback: () => request<{ feedback: any[]; averageRating: number }>('/feedback'),
  submitFeedback: (data: any) => request<any>('/feedback', { method: 'POST', body: JSON.stringify(data) }),
  getSupportTickets: () => request<{ tickets: any[] }>('/support'),
  createSupportTicket: (data: any) => request<any>('/support', { method: 'POST', body: JSON.stringify(data) }),
  updateSupportTicket: (id: number | string, data: any) =>
    request<any>(`/support/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  // Products
  getProducts: () => request<{ products: any[] }>('/products'),

  // AI Assistant & Summaries
  askAiAssistant: (query: string) =>
    request<{ answer: string; relatedData?: any }>('/ai/query', {
      method: 'POST',
      body: JSON.stringify({ query }),
    }),
  getCustomerAiSummary: (customerId: number | string) =>
    request<any>(`/ai/customer-summary/${customerId}`),
  getFollowupAiInsights: () => request<any>('/ai/followup-insights'),

  // Analytics
  getAnalytics: (period?: string) =>
    request<any>(`/analytics${period ? `?period=${period}` : ''}`),

  // Global Search
  search: (q: string) => request<any>(`/search?q=${encodeURIComponent(q)}`),

  // Notifications
  getNotifications: () => request<{ notifications: any[]; unreadCount: number }>('/notifications'),
  markNotificationRead: (id: number | string) =>
    request<{ message: string }>(`/notifications/${id}/read`, { method: 'POST' }),
  markAllNotificationsRead: () =>
    request<{ message: string }>('/notifications/read-all', { method: 'POST' }),

  // Users & Team
  getUsers: () => request<{ users: any[] }>('/users'),
  createUser: (data: any) => request<any>('/users', { method: 'POST', body: JSON.stringify(data) }),
  updateUser: (id: number | string, data: any) =>
    request<any>(`/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  // Audit Logs
  getAuditLogs: () => request<{ logs: any[] }>('/audit-logs'),

  // Customer portal
  getCustomerDashboard: () => request<any>('/customer/dashboard'),
  updateCustomerPortalProfile: (data: { name: string; email: string; phone: string; address: string }) =>
    request<any>('/customer/profile', { method: 'PUT', body: JSON.stringify(data) }),
  updateCustomerPassword: (data: { currentPassword: string; newPassword: string }) =>
    request<any>('/customer/password', { method: 'PUT', body: JSON.stringify(data) }),
  getCustomerInvoices: () => request<{ invoices: any[] }>('/customer/invoices'),
  getCustomerPayments: () => request<{ payments: any[] }>('/customer/payments'),
  submitCustomerPayment: (data: any) => request<any>('/customer/payments', { method: 'POST', body: JSON.stringify(data) }),
  openCustomerReceipt: (paymentId: number | string) => openReceipt(`/customer/payments/${paymentId}/receipt`),
  getCustomerUsage: () => request<{ usage: any[] }>('/customer/usage'),
  getCustomerTimeline: () => request<{ activities: any[] }>('/customer/timeline'),
  getCustomerSupport: () => request<{ tickets: any[] }>('/customer/support'),
  createCustomerSupport: (data: { subject: string; description: string }) =>
    request<any>('/customer/support', { method: 'POST', body: JSON.stringify(data) }),
  getCustomerNotifications: () => request<{ notifications: any[] }>('/customer/notifications'),
  markCustomerNotificationRead: (id: number | string) =>
    request<any>(`/customer/notifications/${id}/read`, { method: 'PUT' }),
  getCustomerProducts: () => request<{ products: any[] }>('/customer/products'),
  createCustomerOrderRequest: (data: { items: Array<{ product_id: number; quantity: number }>; notes?: string }) =>
    request<any>('/customer/order-requests', { method: 'POST', body: JSON.stringify(data) }),

  // Assigned sales order request review
  getSalesOrderRequests: () => request<{ requests: any[] }>('/sales/order-requests'),
  getSalesOrderRequest: (id: number | string) => request<any>(`/sales/order-requests/${id}`),
  approveSalesOrderRequest: (id: number | string, salesTerms: string, resolutionNote?: string) =>
    request<any>(`/sales/order-requests/${id}/approve`, { method: 'PUT', body: JSON.stringify({ salesTerms, resolutionNote }) }),
  rejectSalesOrderRequest: (id: number | string, reason: string) =>
    request<any>(`/sales/order-requests/${id}/reject`, { method: 'PUT', body: JSON.stringify({ reason }) }),

  // Manager payment verification
  getManagerPayments: () => request<{ payments: any[] }>('/manager/payments'),
  getManagerPayment: (id: number | string) => request<any>(`/manager/payments/${id}`),
  openManagerReceipt: (paymentId: number | string) => openReceipt(`/manager/payments/${paymentId}/receipt`),
  approveManagerPayment: (id: number | string) =>
    request<any>(`/manager/payments/${id}/approve`, { method: 'PUT' }),
  rejectManagerPayment: (id: number | string, reason: string) =>
    request<any>(`/manager/payments/${id}/reject`, { method: 'PUT', body: JSON.stringify({ reason }) }),
  sendCustomerDueReminder: (customerId: number | string) =>
    request<any>(`/manager/customers/${customerId}/due-reminder`, { method: 'POST' }),
  getOverdueReminders: () => request<{ reminders: any[]; count: number } >('/manager/overdue-reminders'),
  sendOverdueReminderEmail: (data: { customer_id: number; invoice_id: number; customSubject?: string; customMessage?: string }) =>
    request<any>('/manager/send-overdue-reminder', { method: 'POST', body: JSON.stringify(data) }),
};
