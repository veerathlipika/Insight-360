import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Send,
  AlertTriangle,
  Clock,
  Target,
  ArrowRight,
  TrendingUp,
  ShieldCheck,
  CheckCircle2,
  HelpCircle,
  Lightbulb,
} from 'lucide-react';
import { api } from '../services/api.ts';
import { useToast } from '../context/ToastContext.tsx';

interface Message {
  sender: 'user' | 'assistant';
  text: string;
  time: string;
}

interface AiAssistantPageProps {
  onNavigate: (page: string, params?: any) => void;
}

export const AiAssistantPage: React.FC<AiAssistantPageProps> = ({ onNavigate }) => {
  const { error } = useToast();

  const [inputQuery, setInputQuery] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    {
      sender: 'assistant',
      text: 'Hello! I am your AI Sales Operations Assistant powered by Gemini 3.8 Flash. I have real-time access to the entire CRM database—including customer records, deals in pipeline, follow-ups, and support tickets. How can I help you accelerate sales today?',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [loading, setLoading] = useState(false);
  const [insights, setInsights] = useState<any>(null);

  const quickPrompts = [
    'Which customers are at risk?',
    'Which leads need follow-up?',
    'Which customers have not been contacted recently?',
    'Show my highest-value customers.',
    'Which opportunities are likely to need attention?',
    'What follow-ups are due today?',
  ];

  useEffect(() => {
    loadInsights();
  }, []);

  const loadInsights = async () => {
    try {
      const res = await api.getFollowupAiInsights();
      setInsights(res);
    } catch (e) {
      console.error('Failed to load insights', e);
    }
  };

  const handleSend = async (queryText?: string) => {
    const textToSend = queryText || inputQuery;
    if (!textToSend.trim() || loading) return;

    const userMsg: Message = {
      sender: 'user',
      text: textToSend,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputQuery('');
    setLoading(true);

    try {
      const res = await api.askAiAssistant(textToSend);
      const assistantMsg: Message = {
        sender: 'assistant',
        text: res.answer,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      error('AI Query failed', err.message);
      setMessages((prev) => [
        ...prev,
        {
          sender: 'assistant',
          text: 'I encountered an error querying the database. Please try another question.',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-gradient-to-r from-violet-500/20 to-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-xs font-semibold mb-2">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span>Interactive Sales Intelligence</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            AI Sales Operations Assistant
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Ask natural language questions about deals, prospects, and follow-ups. All answers are grounded strictly in your live database.
          </p>
        </div>
      </div>

      {/* Actionable Follow-up AI Insights Banner */}
      {insights && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-amber-400" />
              <h3 className="text-sm font-bold text-white tracking-tight">
                AI Proactive Recommendations &amp; Deal Warnings
              </h3>
            </div>
            <span className="text-[10px] text-slate-400 font-mono">Live CRM Scan</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
            {insights.recommendations?.map((rec: any) => (
              <div
                key={rec.id}
                className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 flex flex-col justify-between text-xs space-y-2"
              >
                <div>
                  <div className="font-semibold text-slate-200 flex items-center gap-1.5">
                    {rec.severity === 'high' ? (
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                    ) : (
                      <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    )}
                    <span>{rec.title}</span>
                  </div>
                  <p className="text-slate-400 text-[11px] leading-relaxed mt-1">
                    {rec.text}
                  </p>
                </div>

                <button
                  onClick={() => onNavigate(rec.actionLink.replace('/', ''))}
                  className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 pt-1 self-start"
                >
                  <span>Resolve in {rec.title.split(' ')[0]}</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Chat Window */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl shadow-xl flex flex-col h-[560px] overflow-hidden">
        {/* Messages list */}
        <div className="flex-1 p-5 overflow-y-auto space-y-4 text-xs">
          {messages.map((m, idx) => (
            <div
              key={idx}
              className={`flex items-start gap-3 ${
                m.sender === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              {m.sender === 'assistant' && (
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center text-white shrink-0 shadow-md shadow-indigo-600/30">
                  <Sparkles className="w-4 h-4" />
                </div>
              )}

              <div
                className={`max-w-xl rounded-2xl p-4 shadow-sm leading-relaxed ${
                  m.sender === 'user'
                    ? 'bg-indigo-600 text-white font-medium rounded-tr-none'
                    : 'bg-slate-950/80 border border-slate-800 text-slate-200 rounded-tl-none'
                }`}
              >
                <div className="whitespace-pre-line">{m.text}</div>
                <div
                  className={`text-[9px] mt-1.5 ${
                    m.sender === 'user' ? 'text-indigo-200 text-right' : 'text-slate-500'
                  }`}
                >
                  {m.time}
                </div>
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex items-start gap-3 justify-start">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center text-white shrink-0 shadow-md">
                <Sparkles className="w-4 h-4 animate-spin" />
              </div>
              <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 text-slate-400 text-xs flex items-center gap-2">
                <div className="w-3.5 h-3.5 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
                <span>Querying live relational database &amp; generating insights...</span>
              </div>
            </div>
          )}
        </div>

        {/* Quick Suggestion Chips */}
        <div className="p-3 bg-slate-950/70 border-t border-slate-800 flex items-center gap-2 overflow-x-auto text-xs">
          <span className="text-[10px] text-slate-500 uppercase font-semibold shrink-0">Try asking:</span>
          {quickPrompts.map((q) => (
            <button
              key={q}
              onClick={() => handleSend(q)}
              disabled={loading}
              className="px-2.5 py-1 rounded-full bg-slate-800/80 hover:bg-indigo-950 hover:text-indigo-300 border border-slate-700 hover:border-indigo-700 text-slate-300 text-[11px] whitespace-nowrap transition-colors"
            >
              {q}
            </button>
          ))}
        </div>

        {/* Query Input Form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="p-3 bg-slate-950 border-t border-slate-800 flex items-center gap-2"
        >
          <input
            type="text"
            value={inputQuery}
            onChange={(e) => setInputQuery(e.target.value)}
            placeholder="Ask questions about your leads, deals, customers, or follow-ups..."
            disabled={loading}
            className="flex-1 bg-slate-900 text-white text-xs px-4 py-2.5 rounded-xl border border-slate-700 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          />
          <button
            type="submit"
            disabled={loading || !inputQuery.trim()}
            className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/20 flex items-center gap-1.5 transition-all disabled:opacity-40"
          >
            <span>Ask</span>
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>
    </div>
  );
};
