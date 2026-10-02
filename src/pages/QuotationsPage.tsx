import React, { useState, useEffect } from 'react';
import {
  FileSpreadsheet,
  Plus,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  Send,
  Eye,
  ArrowRight,
  ShoppingBag,
  Printer,
  X,
  Trash2,
} from 'lucide-react';
import { api } from '../services/api.ts';
import { useToast } from '../context/ToastContext.tsx';
import { Quotation, Customer, Product, Opportunity } from '../types/index.ts';

interface QuotationsPageProps {
  onNavigate: (page: string, params?: any) => void;
}

export const QuotationsPage: React.FC<QuotationsPageProps> = ({ onNavigate }) => {
  const { success, error, info } = useToast();

  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [previewQuote, setPreviewQuote] = useState<{ quotation: any; items: any[] } | null>(null);

  // Form State
  const [customerId, setCustomerId] = useState('');
  const [opportunityId, setOpportunityId] = useState('');
  const [validUntil, setValidUntil] = useState(
    new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]
  );
  const [discount, setDiscount] = useState('0');
  const [tax, setTax] = useState('0');
  const [terms, setTerms] = useState('Payment 30 days net from invoice date. Standard 1-year service SLA.');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<Array<{ product_id: number; description: string; quantity: number; unit_price: number }>>([]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [qRes, cRes, pRes, oRes] = await Promise.all([
        api.getQuotations(),
        api.getCustomers(),
        api.getProducts(),
        api.getOpportunities(),
      ]);
      setQuotations(qRes.quotations);
      setCustomers(cRes.customers);
      setProducts(pRes.products);
      setOpportunities(oRes.opportunities);
    } catch (err: any) {
      error('Failed to load quotations', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenCreate = () => {
    setCustomerId(customers[0]?.id ? String(customers[0].id) : '');
    setOpportunityId('');
    setDiscount('0');
    setTax('0');
    setNotes('');
    if (products.length > 0) {
      setItems([
        {
          product_id: products[0].id,
          description: products[0].name,
          quantity: 1,
          unit_price: products[0].unit_price,
        },
      ]);
    } else {
      setItems([]);
    }
    setShowCreateModal(true);
  };

  const handleAddItem = () => {
    const prod = products[0];
    if (prod) {
      setItems([
        ...items,
        { product_id: prod.id, description: prod.name, quantity: 1, unit_price: prod.unit_price },
      ]);
    }
  };

  const handleItemProductChange = (index: number, prodId: number) => {
    const prod = products.find((p) => p.id === prodId);
    if (!prod) return;
    const newItems = [...items];
    newItems[index] = {
      product_id: prod.id,
      description: prod.name,
      quantity: newItems[index].quantity,
      unit_price: prod.unit_price,
    };
    setItems(newItems);
  };

  const handleItemQuantityChange = (index: number, quantity: number) => {
    const newItems = [...items];
    newItems[index].quantity = Math.max(1, quantity);
    setItems(newItems);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const subtotal = items.reduce((acc, item) => acc + item.quantity * item.unit_price, 0);
  const total = subtotal - (parseFloat(discount) || 0) + (parseFloat(tax) || 0);

  const handleSaveQuotation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerId || items.length === 0) {
      error('Customer and at least one item are required.');
      return;
    }

    try {
      await api.createQuotation({
        customer_id: parseInt(customerId, 10),
        opportunity_id: opportunityId ? parseInt(opportunityId, 10) : null,
        valid_until: validUntil,
        discount: parseFloat(discount) || 0,
        tax: parseFloat(tax) || 0,
        terms,
        notes,
        status: 'Sent',
        items,
      });

      success('Quotation generated and marked Sent');
      setShowCreateModal(false);
      loadData();
    } catch (err: any) {
      error('Failed to create quotation', err.message);
    }
  };

  const handleStatusChange = async (id: number, status: string) => {
    try {
      await api.updateQuotationStatus(id, status);
      success(`Quotation status changed to ${status}`);
      loadData();
    } catch (err: any) {
      error('Failed to update quotation status', err.message);
    }
  };

  // WORKFLOW 5: Quotation accepted -> Convert to Order
  const handleConvertToOrder = async (quoteId: number) => {
    try {
      const res = await api.convertQuotationToOrder(quoteId);
      success(res.message);
      loadData();
      onNavigate('orders');
    } catch (err: any) {
      error('Failed to convert quotation to order', err.message);
    }
  };

  const handleViewPreview = async (quoteId: number) => {
    try {
      const res = await api.getQuotationById(quoteId);
      setPreviewQuote(res);
    } catch (err: any) {
      error('Failed to load quotation details', err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            Quotation &amp; Proposal Management
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Build multi-item price quotes, manage expiration dates, send proposals, and convert accepted quotes to official orders.
          </p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/20 transition-all self-start sm:self-auto"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Quotation</span>
        </button>
      </div>

      {/* Quotations Table */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-xs">Loading quotations...</div>
        ) : quotations.length === 0 ? (
          <div className="p-12 text-center">
            <FileSpreadsheet className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <p className="text-sm font-semibold text-slate-300">No quotations found</p>
            <p className="text-xs text-slate-500 mt-1">Click "New Quotation" to create one.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">Quotation #</th>
                  <th className="py-3 px-4">Customer Account</th>
                  <th className="py-3 px-4">Issued Date</th>
                  <th className="py-3 px-4">Valid Until</th>
                  <th className="py-3 px-4">Line Items</th>
                  <th className="py-3 px-4">Total Amount</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Workflow Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {quotations.map((q) => (
                  <tr key={q.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4">
                      <span className="font-mono font-bold text-indigo-400">{q.quotation_number}</span>
                    </td>

                    <td className="py-3 px-4 font-semibold text-slate-200">
                      <button
                        onClick={() => onNavigate('customer-360', { customerId: q.customer_id })}
                        className="hover:text-indigo-400 text-left transition-colors"
                      >
                        {q.customer_company}
                      </button>
                      <div className="text-[11px] text-slate-400 font-normal">{q.customer_name}</div>
                    </td>

                    <td className="py-3 px-4 text-slate-400">{q.date}</td>
                    <td className="py-3 px-4 text-slate-300">{q.valid_until}</td>
                    <td className="py-3 px-4 text-slate-400">{q.items_count || 1} item(s)</td>

                    <td className="py-3 px-4">
                      <div className="font-bold text-white text-sm">${q.total?.toLocaleString()}</div>
                      {q.discount > 0 && (
                        <div className="text-[10px] text-emerald-400">-${q.discount} discount</div>
                      )}
                    </td>

                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                          q.status === 'Accepted'
                            ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800'
                            : q.status === 'Sent'
                            ? 'bg-sky-950/60 text-sky-300 border-sky-800'
                            : q.status === 'Draft'
                            ? 'bg-slate-800 text-slate-300 border-slate-700'
                            : 'bg-rose-950/60 text-rose-300 border-rose-800'
                        }`}
                      >
                        {q.status}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5 flex-wrap">
                        {/* Status switcher */}
                        {q.status === 'Sent' && (
                          <button
                            onClick={() => handleStatusChange(q.id, 'Accepted')}
                            className="px-2 py-1 rounded bg-emerald-600/30 hover:bg-emerald-600/60 text-emerald-300 border border-emerald-700 font-semibold text-[11px] transition-colors"
                          >
                            Accept
                          </button>
                        )}

                        {/* WORKFLOW 5: 1-Click Convert to Order */}
                        {q.status === 'Accepted' && (
                          <button
                            onClick={() => handleConvertToOrder(q.id)}
                            className="px-2.5 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-[11px] shadow-sm flex items-center gap-1 transition-all"
                            title="Convert Accepted Quotation into Official Order"
                          >
                            <ShoppingBag className="w-3 h-3" />
                            <span>Create Order</span>
                          </button>
                        )}

                        {/* Preview */}
                        <button
                          onClick={() => handleViewPreview(q.id)}
                          className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800"
                          title="Preview Quotation"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Quotation Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-white">Create Official Price Quotation</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveQuotation} className="space-y-4 text-xs">
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
                  <label className="block text-slate-300 font-medium mb-1">Valid Until Date *</label>
                  <input
                    type="date"
                    required
                    value={validUntil}
                    onChange={(e) => setValidUntil(e.target.value)}
                    className="w-full bg-slate-800 text-white px-3 py-2 rounded-lg border border-slate-700"
                  />
                </div>
              </div>

              {/* Dynamic Line Items */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-slate-300 font-bold uppercase tracking-wider text-[11px]">
                    Products &amp; Services Line Items
                  </label>
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold"
                  >
                    + Add Item
                  </button>
                </div>

                <div className="space-y-2">
                  {items.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 grid grid-cols-12 gap-2 items-center"
                    >
                      <div className="col-span-6">
                        <select
                          value={item.product_id}
                          onChange={(e) => handleItemProductChange(idx, parseInt(e.target.value, 10))}
                          className="w-full bg-slate-800 text-white px-2 py-1.5 rounded-lg border border-slate-700 text-xs"
                        >
                          {products.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} (${p.unit_price})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="col-span-2">
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => handleItemQuantityChange(idx, parseInt(e.target.value, 10) || 1)}
                          className="w-full bg-slate-800 text-white px-2 py-1.5 rounded-lg border border-slate-700 text-xs text-center"
                          title="Quantity"
                        />
                      </div>

                      <div className="col-span-3 text-right font-bold text-white text-xs">
                        ${(item.quantity * item.unit_price).toLocaleString()}
                      </div>

                      <div className="col-span-1 text-right">
                        {items.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(idx)}
                            className="text-slate-500 hover:text-rose-400 p-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Subtotal, Discount, Tax calculation */}
              <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Subtotal</label>
                  <div className="text-sm font-bold text-white">${subtotal.toLocaleString()}</div>
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Discount ($)</label>
                  <input
                    type="number"
                    value={discount}
                    onChange={(e) => setDiscount(e.target.value)}
                    className="w-full bg-slate-800 text-white px-2 py-1 rounded border border-slate-700"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Total Quotation</label>
                  <div className="text-base font-bold text-emerald-400">${total.toLocaleString()}</div>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Terms &amp; Conditions</label>
                <textarea
                  rows={2}
                  value={terms}
                  onChange={(e) => setTerms(e.target.value)}
                  className="w-full bg-slate-800 text-white px-3 py-2 rounded-lg border border-slate-700"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shadow-md shadow-indigo-600/30"
                >
                  Generate Quotation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Printable Preview Modal */}
      {previewQuote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-4 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-indigo-400" />
                <span className="font-bold text-white text-base">
                  {previewQuote.quotation.quotation_number}
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-700 font-semibold">
                  {previewQuote.quotation.status}
                </span>
              </div>
              <button onClick={() => setPreviewQuote(null)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-slate-950 p-5 rounded-xl border border-slate-800 text-xs space-y-4">
              <div className="flex justify-between border-b border-slate-800 pb-3">
                <div>
                  <p className="font-bold text-slate-200 text-sm">{previewQuote.quotation.customer_company}</p>
                  <p className="text-slate-400">Attn: {previewQuote.quotation.customer_name}</p>
                  <p className="text-slate-500">{previewQuote.quotation.customer_email}</p>
                </div>
                <div className="text-right">
                  <p className="text-slate-400">Issue Date: <strong>{previewQuote.quotation.date}</strong></p>
                  <p className="text-slate-400">Valid Until: <strong>{previewQuote.quotation.valid_until}</strong></p>
                </div>
              </div>

              <div>
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-500 text-[10px] uppercase">
                      <th className="py-1">Description</th>
                      <th className="py-1 text-center">Qty</th>
                      <th className="py-1 text-right">Unit Price</th>
                      <th className="py-1 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {previewQuote.items.map((item: any) => (
                      <tr key={item.id}>
                        <td className="py-2 text-slate-200 font-medium">{item.description}</td>
                        <td className="py-2 text-center text-slate-400">{item.quantity}</td>
                        <td className="py-2 text-right text-slate-400">${item.unit_price?.toLocaleString()}</td>
                        <td className="py-2 text-right text-white font-bold">${item.total?.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="border-t border-slate-800 pt-3 flex justify-between font-bold text-sm">
                <span className="text-slate-300">Grand Total:</span>
                <span className="text-emerald-400">${previewQuote.quotation.total?.toLocaleString()}</span>
              </div>

              <div className="p-3 bg-slate-900 rounded-lg text-slate-400 text-[11px] leading-relaxed">
                <strong>Terms:</strong> {previewQuote.quotation.terms}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => window.print()}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Document</span>
              </button>
              <button
                onClick={() => setPreviewQuote(null)}
                className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
