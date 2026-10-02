import React, { useState, useEffect } from 'react';
import { Star, Plus, MessageSquare, ThumbsUp, X } from 'lucide-react';
import { api } from '../services/api.ts';
import { useToast } from '../context/ToastContext.tsx';
import { Feedback, Customer } from '../types/index.ts';

interface FeedbackPageProps {
  onNavigate: (page: string, params?: any) => void;
}

export const FeedbackPage: React.FC<FeedbackPageProps> = ({ onNavigate }) => {
  const { success, error } = useToast();

  const [feedbackList, setFeedbackList] = useState<Feedback[]>([]);
  const [avgRating, setAvgRating] = useState<number>(5.0);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    customer_id: '',
    rating: 5,
    comments: '',
    category: 'Product Quality',
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const [fbRes, custRes] = await Promise.all([
        api.getFeedback(),
        api.getCustomers(),
      ]);
      setFeedbackList(fbRes.feedback);
      setAvgRating(fbRes.averageRating || 5.0);
      setCustomers(custRes.customers);
    } catch (err: any) {
      error('Failed to load feedback', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSaveFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.customer_id || !formData.comments.trim()) {
      error('Customer and Comments are required.');
      return;
    }

    try {
      await api.submitFeedback({
        ...formData,
        customer_id: parseInt(formData.customer_id, 10),
      });
      success('Customer feedback recorded');
      setShowModal(false);
      setFormData({ customer_id: '', rating: 5, comments: '', category: 'Product Quality' });
      loadData();
    } catch (err: any) {
      error('Failed to submit feedback', err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Stats Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            Customer Feedback &amp; CSAT
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Capture satisfaction scores, testimonials, onboarding reviews, and product sentiment.
          </p>
        </div>

        <button
          onClick={() => {
            setFormData({
              customer_id: customers[0]?.id ? String(customers[0].id) : '',
              rating: 5,
              comments: '',
              category: 'Sales Experience',
            });
            setShowModal(true);
          }}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/20 transition-all self-start sm:self-auto"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Record Feedback</span>
        </button>
      </div>

      {/* Satisfaction Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-slate-800 p-6 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <Star className="w-8 h-8 fill-amber-400" />
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-white">{avgRating}</span>
              <span className="text-xs text-slate-400">/ 5.0 Average Rating</span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Based on {feedbackList.length} verified customer submissions
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {['Product Quality', 'Sales Experience', 'Onboarding', 'Customer Service'].map((cat) => {
            const count = feedbackList.filter((fb) => fb.category === cat).length;
            return (
              <div key={cat} className="p-2 rounded-lg bg-slate-950/60 border border-slate-800 text-center min-w-[90px]">
                <div className="text-[10px] text-slate-400 truncate">{cat}</div>
                <div className="text-xs font-bold text-slate-200 mt-0.5">{count} reviews</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Feedback Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full py-12 text-center text-slate-400 text-xs">Loading feedback...</div>
        ) : feedbackList.length === 0 ? (
          <div className="col-span-full py-12 text-center text-slate-500 text-xs">No feedback recorded yet.</div>
        ) : (
          feedbackList.map((fb) => (
            <div
              key={fb.id}
              className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col justify-between text-xs space-y-3"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex text-amber-400 text-sm">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <span key={i}>{i < fb.rating ? '★' : '☆'}</span>
                    ))}
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 font-medium">
                    {fb.category}
                  </span>
                </div>

                <p className="text-slate-200 leading-relaxed italic bg-slate-950/40 p-3 rounded-xl border border-slate-800/80">
                  "{fb.comments}"
                </p>
              </div>

              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                <button
                  onClick={() => onNavigate('customer-360', { customerId: fb.customer_id })}
                  className="font-semibold text-slate-200 hover:text-indigo-400 transition-colors"
                >
                  {fb.customer_company}
                </button>
                <span>{new Date(fb.date).toLocaleDateString()}</span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Record Feedback Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-white">Record Customer Feedback</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveFeedback} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Customer Account *</label>
                <select
                  required
                  value={formData.customer_id}
                  onChange={(e) => setFormData({ ...formData, customer_id: e.target.value })}
                  className="w-full bg-slate-800 text-white px-3 py-2 rounded-lg border border-slate-700"
                >
                  <option value="">Select customer</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.company} ({c.name})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Rating (1 to 5 Stars)</label>
                  <select
                    value={formData.rating}
                    onChange={(e) => setFormData({ ...formData, rating: parseInt(e.target.value, 10) })}
                    className="w-full bg-slate-800 text-white px-3 py-2 rounded-lg border border-slate-700"
                  >
                    <option value={5}>★★★★★ (5 Stars - Exceptional)</option>
                    <option value={4}>★★★★☆ (4 Stars - Satisfied)</option>
                    <option value={3}>★★★☆☆ (3 Stars - Neutral)</option>
                    <option value={2}>★★☆☆☆ (2 Stars - Disappointed)</option>
                    <option value={1}>★☆☆☆☆ (1 Star - Poor)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Category</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full bg-slate-800 text-white px-3 py-2 rounded-lg border border-slate-700"
                  >
                    <option value="Product Quality">Product Quality</option>
                    <option value="Customer Service">Customer Service</option>
                    <option value="Onboarding">Onboarding</option>
                    <option value="Pricing">Pricing</option>
                    <option value="Sales Experience">Sales Experience</option>
                    <option value="General">General</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Comments &amp; Testimonial *</label>
                <textarea
                  rows={3}
                  required
                  value={formData.comments}
                  onChange={(e) => setFormData({ ...formData, comments: e.target.value })}
                  placeholder="What did the customer highlight regarding their experience?"
                  className="w-full bg-slate-800 text-white px-3 py-2 rounded-lg border border-slate-700"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shadow-md"
                >
                  Submit Feedback
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
