import React, { useState, useEffect } from 'react';
import {
  ShoppingBag,
  Plus,
  Eye,
  CheckCircle2,
  Clock,
  Package,
  DollarSign,
  X,
  FileSpreadsheet,
  AlertCircle,
  Truck,
} from 'lucide-react';
import { api } from '../services/api.ts';
import { useToast } from '../context/ToastContext.tsx';
import { Order, Customer, Product, OrderStatus } from '../types/index.ts';

interface OrdersPageProps {
  onNavigate: (page: string, params?: any) => void;
}

const ORDER_STATUSES: OrderStatus[] = ['Pending', 'Confirmed', 'Processing', 'Completed', 'Cancelled'];

export const OrdersPage: React.FC<OrdersPageProps> = ({ onNavigate }) => {
  const { success, error } = useToast();

  const [activeTab, setActiveTab] = useState<'orders' | 'requests'>('orders');
  const [orders, setOrders] = useState<Order[]>([]);
  const [orderRequests, setOrderRequests] = useState<any[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [viewingOrder, setViewingOrder] = useState<{ order: any; items: any[] } | null>(null);
  const [approvingRequest, setApprovingRequest] = useState<any | null>(null);
  const [salesTerms, setSalesTerms] = useState('');
  const [resolutionNote, setResolutionNote] = useState('');
  const [rejectingRequest, setRejectingRequest] = useState<any | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // Form State
  const [customerId, setCustomerId] = useState('');
  const [discount, setDiscount] = useState('0');
  const [tax, setTax] = useState('0');
  const [status, setStatus] = useState<OrderStatus>('Confirmed');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<Array<{ product_id: number; description: string; quantity: number; unit_price: number }>>([]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [ordRes, custRes, prodRes, reqRes] = await Promise.all([
        api.getOrders(),
        api.getCustomers(),
        api.getProducts(),
        api.getSalesOrderRequests().catch(() => ({ requests: [] })),
      ]);
      setOrders(ordRes.orders);
      setCustomers(custRes.customers);
      setProducts(prodRes.products);
      setOrderRequests(reqRes.requests || []);
    } catch (err: any) {
      error('Failed to load orders', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenCreate = () => {
    setCustomerId(customers[0]?.id ? String(customers[0].id) : '');
    setDiscount('0');
    setTax('0');
    setStatus('Confirmed');
    setNotes('');
    if (products.length > 0) {
      setItems([
        { product_id: products[0].id, description: products[0].name, quantity: 1, unit_price: products[0].unit_price },
      ]);
    } else {
      setItems([]);
    }
    setShowCreateModal(true);
  };

  const handleAddItem = () => {
    const prod = products[0];
    if (prod) {
      setItems([...items, { product_id: prod.id, description: prod.name, quantity: 1, unit_price: prod.unit_price }]);
    }
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const subtotal = items.reduce((acc, item) => acc + item.quantity * item.unit_price, 0);
  const total = subtotal - (parseFloat(discount) || 0) + (parseFloat(tax) || 0);

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerId || items.length === 0) {
      error('Customer and at least one item are required.');
      return;
    }

    try {
      await api.createOrder({
        customer_id: parseInt(customerId, 10),
        discount: parseFloat(discount) || 0,
        tax: parseFloat(tax) || 0,
        status,
        notes,
        items,
      });

      success('Order created and customer revenue updated!');
      setShowCreateModal(false);
      loadData();
    } catch (err: any) {
      error('Failed to create order', err.message);
    }
  };

  const handleUpdateStatus = async (orderId: number, newStatus: string) => {
    try {
      await api.updateOrderStatus(orderId, newStatus);
      success(`Order status updated to ${newStatus}`);
      loadData();
    } catch (err: any) {
      error('Failed to update status', err.message);
    }
  };

  const handleViewOrder = async (id: number) => {
    try {
      const res = await api.getOrderById(id);
      setViewingOrder(res);
    } catch (err: any) {
      error('Failed to fetch order details', err.message);
    }
  };

  const handleApproveRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!approvingRequest) return;
    try {
      await api.approveSalesOrderRequest(approvingRequest.id, salesTerms, resolutionNote);
      success(`Order request ${approvingRequest.request_number} approved and converted to confirmed order!`);
      setApprovingRequest(null);
      setSalesTerms('');
      setResolutionNote('');
      loadData();
    } catch (err: any) {
      error('Failed to approve order request', err.message);
    }
  };

  const handleRejectRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectingRequest) return;
    try {
      await api.rejectSalesOrderRequest(rejectingRequest.id, rejectReason);
      success(`Order request ${rejectingRequest.request_number} marked as rejected.`);
      setRejectingRequest(null);
      setRejectReason('');
      loadData();
    } catch (err: any) {
      error('Failed to reject order request', err.message);
    }
  };

  const pendingRequestsCount = orderRequests.filter((r) => r.status === 'Pending Approval').length;
  const totalRevenue = orders.reduce((sum, o) => sum + (o.status === 'Completed' ? o.total : 0), 0);

  return (
    <div className="space-y-6">
      {/* Header & Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            Order Fulfillment &amp; Billing
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Total Realized Revenue: <strong className="text-emerald-400">${totalRevenue.toLocaleString()}</strong> across {orders.length} orders.
          </p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/20 transition-all self-start sm:self-auto"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Create Order</span>
        </button>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
        <button
          onClick={() => setActiveTab('orders')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeTab === 'orders'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <ShoppingBag className="w-4 h-4" />
          <span>Fulfilled Orders ({orders.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('requests')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeTab === 'requests'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Customer Order Requests</span>
          {pendingRequestsCount > 0 && (
            <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
              {pendingRequestsCount} Pending
            </span>
          )}
        </button>
      </div>

      {/* Main Content Area */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-xs">Loading data...</div>
        ) : activeTab === 'orders' ? (
          orders.length === 0 ? (
            <div className="p-12 text-center">
              <ShoppingBag className="w-10 h-10 text-slate-600 mx-auto mb-3" />
              <p className="text-sm font-semibold text-slate-300">No orders yet</p>
              <p className="text-xs text-slate-500 mt-1">Convert accepted quotes or create a direct order.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-4">Order ID</th>
                    <th className="py-3 px-4">Customer Account</th>
                    <th className="py-3 px-4">Order Date</th>
                    <th className="py-3 px-4">Line Items</th>
                    <th className="py-3 px-4">Total Amount</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {orders.map((ord) => (
                    <tr key={ord.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4">
                        <span className="font-mono font-bold text-indigo-400">{ord.order_number}</span>
                      </td>

                      <td className="py-3 px-4 font-semibold text-slate-200">
                        <button
                          onClick={() => onNavigate('customer-360', { customerId: ord.customer_id })}
                          className="hover:text-indigo-400 text-left transition-colors"
                        >
                          {ord.customer_company}
                        </button>
                        <div className="text-[11px] text-slate-400 font-normal">{ord.customer_name}</div>
                      </td>

                      <td className="py-3 px-4 text-slate-400">{ord.order_date}</td>
                      <td className="py-3 px-4 text-slate-300">{ord.items_count || 1} item(s)</td>

                      <td className="py-3 px-4">
                        <div className="font-bold text-emerald-400 text-sm">${ord.total?.toLocaleString()}</div>
                        {ord.discount > 0 && <div className="text-[10px] text-slate-500">Includes discount</div>}
                      </td>

                      <td className="py-3 px-4">
                        <select
                          value={ord.status}
                          onChange={(e) => handleUpdateStatus(ord.id, e.target.value)}
                          className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg border focus:outline-none cursor-pointer ${
                            ord.status === 'Completed'
                              ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800'
                              : ord.status === 'Processing'
                              ? 'bg-sky-950/60 text-sky-300 border-sky-800'
                              : ord.status === 'Confirmed'
                              ? 'bg-indigo-950/60 text-indigo-300 border-indigo-800'
                              : 'bg-slate-800 text-slate-300 border-slate-700'
                          }`}
                        >
                          {ORDER_STATUSES.map((st) => (
                            <option key={st} value={st} className="bg-slate-900 text-white">
                              {st}
                            </option>
                          ))}
                        </select>
                      </td>

                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => handleViewOrder(ord.id)}
                          className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                          title="View Order Details"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : (
          orderRequests.length === 0 ? (
            <div className="p-12 text-center">
              <Clock className="w-10 h-10 text-slate-600 mx-auto mb-3" />
              <p className="text-sm font-semibold text-slate-300">No customer order requests</p>
              <p className="text-xs text-slate-500 mt-1">When customers submit order requests from their portal, they will appear here for review.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-4">Request #</th>
                    <th className="py-3 px-4">Customer</th>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Total Amount</th>
                    <th className="py-3 px-4">Customer Notes</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {orderRequests.map((req) => (
                    <tr key={req.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4">
                        <span className="font-mono font-bold text-indigo-400">{req.request_number}</span>
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-200">
                        <div>{req.customer_company}</div>
                        <div className="text-[11px] text-slate-400 font-normal">{req.customer_name} ({req.customer_email})</div>
                      </td>
                      <td className="py-3 px-4 text-slate-400">{new Date(req.created_at).toLocaleDateString()}</td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-emerald-400 text-sm">₹{req.total?.toLocaleString()}</div>
                        <div className="text-[10px] text-slate-400">Tax: ₹{req.tax}</div>
                      </td>
                      <td className="py-3 px-4 text-slate-300 max-w-xs truncate">
                        {req.customer_notes || <span className="text-slate-600 italic">No notes</span>}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-semibold border ${
                            req.status === 'Approved'
                              ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800'
                              : req.status === 'Rejected'
                              ? 'bg-rose-950/60 text-rose-300 border-rose-800'
                              : 'bg-amber-950/60 text-amber-300 border-amber-800'
                          }`}
                        >
                          {req.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        {req.status === 'Pending Approval' ? (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => { setApprovingRequest(req); setSalesTerms(''); setResolutionNote(''); }}
                              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-[11px] shadow transition-all"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => { setRejectingRequest(req); setRejectReason(''); }}
                              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-rose-600 text-slate-300 hover:text-white font-semibold text-[11px] border border-slate-700 transition-all"
                            >
                              Reject
                            </button>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-500">Reviewed</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>

      {/* View Order Modal */}
      {viewingOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-indigo-400" />
                <span className="font-bold text-white text-base">{viewingOrder.order.order_number}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-semibold">
                  {viewingOrder.order.status}
                </span>
              </div>
              <button onClick={() => setViewingOrder(null)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-xs space-y-3">
              <div className="flex justify-between border-b border-slate-800 pb-2">
                <div>
                  <p className="font-bold text-slate-200">{viewingOrder.order.customer_company}</p>
                  <p className="text-slate-400">{viewingOrder.order.customer_name}</p>
                </div>
                <div className="text-right text-slate-400">
                  <p>Date: {viewingOrder.order.order_date}</p>
                </div>
              </div>

              <div>
                <p className="font-semibold text-slate-400 uppercase text-[10px] mb-1">Purchased Products</p>
                <div className="space-y-1.5">
                  {viewingOrder.items.map((item: any) => (
                    <div key={item.id} className="flex justify-between text-xs py-1 border-b border-slate-800/40">
                      <span className="text-slate-200 font-medium">
                        {item.description} (x{item.quantity})
                      </span>
                      <span className="font-bold text-white">${item.total?.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t border-slate-800 pt-2 flex justify-between font-bold text-sm">
                <span className="text-slate-300">Total Fulfilled:</span>
                <span className="text-emerald-400">${viewingOrder.order.total?.toLocaleString()}</span>
              </div>

              {viewingOrder.order.notes && (
                <p className="text-[11px] text-slate-400 bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                  Notes: {viewingOrder.order.notes}
                </p>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setViewingOrder(null)}
                className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Order Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-4 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-white">Create Purchase Order</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateOrder} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Customer Account *</label>
                  <select
                    required
                    value={customerId}
                    onChange={(e) => setCustomerId(e.target.value)}
                    className="w-full bg-slate-800 text-white px-3 py-2 rounded-lg border border-slate-700"
                  >
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.company} ({c.name})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Order Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as OrderStatus)}
                    className="w-full bg-slate-800 text-white px-3 py-2 rounded-lg border border-slate-700"
                  >
                    {ORDER_STATUSES.map((st) => (
                      <option key={st} value={st}>{st}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Items */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-slate-300 uppercase tracking-wider text-[11px]">Items</span>
                  <button type="button" onClick={handleAddItem} className="text-indigo-400 hover:underline">
                    + Add Item
                  </button>
                </div>
                {items.map((item, idx) => (
                  <div key={idx} className="p-2.5 bg-slate-950/60 rounded-xl border border-slate-800 flex items-center gap-2">
                    <select
                      value={item.product_id}
                      onChange={(e) => {
                        const prod = products.find((p) => p.id === parseInt(e.target.value, 10));
                        if (!prod) return;
                        const newIt = [...items];
                        newIt[idx] = { product_id: prod.id, description: prod.name, quantity: 1, unit_price: prod.unit_price };
                        setItems(newIt);
                      }}
                      className="flex-1 bg-slate-800 text-white px-2 py-1 rounded border border-slate-700 text-xs"
                    >
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>{p.name} (${p.unit_price})</option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(e) => {
                        const newIt = [...items];
                        newIt[idx].quantity = parseInt(e.target.value, 10) || 1;
                        setItems(newIt);
                      }}
                      className="w-16 bg-slate-800 text-white px-2 py-1 rounded border border-slate-700 text-center text-xs"
                    />
                    <span className="font-bold text-white text-xs w-20 text-right">
                      ${(item.quantity * item.unit_price).toLocaleString()}
                    </span>
                    {items.length > 1 && (
                      <button type="button" onClick={() => handleRemoveItem(idx)} className="text-slate-500 hover:text-rose-400 p-1">
                        ×
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex justify-between items-center">
                <span className="font-semibold text-slate-300">Total Order Amount:</span>
                <span className="text-base font-bold text-emerald-400">${total.toLocaleString()}</span>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Fulfillment Notes</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="License key provision info, deployment date..."
                  className="w-full bg-slate-800 text-white px-3 py-2 rounded-lg border border-slate-700"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shadow-md"
                >
                  Confirm &amp; Place Order
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Approve Request Modal */}
      {approvingRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h3 className="text-base font-bold text-white">Approve Order Request</h3>
                <p className="text-xs text-slate-400">{approvingRequest.request_number} · {approvingRequest.customer_company}</p>
              </div>
              <button onClick={() => setApprovingRequest(null)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleApproveRequest} className="space-y-3.5 text-xs">
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1.5">
                <div className="flex justify-between font-bold">
                  <span className="text-slate-300">Requested Amount:</span>
                  <span className="text-emerald-400">₹{approvingRequest.total?.toLocaleString()}</span>
                </div>
                {approvingRequest.customer_notes && (
                  <p className="text-[11px] text-slate-400 border-t border-slate-800/80 pt-1.5">
                    Customer Note: &quot;{approvingRequest.customer_notes}&quot;
                  </p>
                )}
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Approved Terms &amp; Conditions (Optional)</label>
                <input
                  type="text"
                  value={salesTerms}
                  onChange={(e) => setSalesTerms(e.target.value)}
                  placeholder="e.g. Standard 30-day payment terms, 5% annual SLA discount applied."
                  className="w-full bg-slate-800 text-white px-3 py-2 rounded-lg border border-slate-700"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Resolution Note for Customer</label>
                <textarea
                  rows={2}
                  value={resolutionNote}
                  onChange={(e) => setResolutionNote(e.target.value)}
                  placeholder="Your order request has been approved! Invoice INV-... is generated."
                  className="w-full bg-slate-800 text-white px-3 py-2 rounded-lg border border-slate-700"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setApprovingRequest(null)}
                  className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-md"
                >
                  Approve &amp; Generate Order + Invoice
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reject Request Modal */}
      {rejectingRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h3 className="text-base font-bold text-white">Reject Order Request</h3>
                <p className="text-xs text-slate-400">{rejectingRequest.request_number} · {rejectingRequest.customer_company}</p>
              </div>
              <button onClick={() => setRejectingRequest(null)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleRejectRequest} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Reason for Rejection *</label>
                <textarea
                  required
                  rows={3}
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Please state why the request cannot be fulfilled at this time..."
                  className="w-full bg-slate-800 text-white px-3 py-2 rounded-lg border border-slate-700"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setRejectingRequest(null)}
                  className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold shadow-md"
                >
                  Confirm Rejection
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
