import { GoogleGenAI } from '@google/genai';
import { all, get } from '../db/database.ts';

let aiClient: GoogleGenAI | null = null;

function getAiClient(): GoogleGenAI | null {
  if (!process.env.GEMINI_API_KEY) {
    return null;
  }
  if (!aiClient) {
    try {
      aiClient = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });
    } catch (e) {
      console.warn('Failed to initialize GoogleGenAI client:', e);
      return null;
    }
  }
  return aiClient;
}

export interface CustomerSummaryResult {
  summary: string;
  background: string;
  recentInteractions: string[];
  requirements: string[];
  purchaseHistory: string;
  activeOpportunities: string;
  pendingFollowups: string[];
  openSupportIssues: string[];
  recommendedNextActions: string[];
  isAiGenerated: boolean;
}

export async function generateCustomerSummary(customerId: number): Promise<CustomerSummaryResult> {
  const customer = get<any>(
    `SELECT c.*, u.full_name as assigned_name 
     FROM customers c 
     LEFT JOIN users u ON c.assigned_user_id = u.id 
     WHERE c.id = ?`,
    [customerId]
  );

  if (!customer) {
    throw new Error('Customer not found');
  }

  const communications = all<any>(
    `SELECT * FROM communications WHERE customer_id = ? ORDER BY date DESC LIMIT 8`,
    [customerId]
  );

  const opportunities = all<any>(
    `SELECT * FROM opportunities WHERE customer_id = ? ORDER BY created_at DESC`,
    [customerId]
  );

  const followups = all<any>(
    `SELECT * FROM followups WHERE customer_id = ? ORDER BY date ASC`,
    [customerId]
  );

  const orders = all<any>(
    `SELECT * FROM orders WHERE customer_id = ? ORDER BY order_date DESC`,
    [customerId]
  );

  const tickets = all<any>(
    `SELECT * FROM support_tickets WHERE customer_id = ? ORDER BY created_at DESC`,
    [customerId]
  );

  const feedbackList = all<any>(
    `SELECT * FROM feedback WHERE customer_id = ? ORDER BY date DESC`,
    [customerId]
  );

  const totalSpent = orders.reduce((sum, o) => sum + (o.status === 'Completed' ? o.total : 0), 0);
  const openTickets = tickets.filter(t => t.status === 'Open' || t.status === 'In Progress');
  const pendingFollowups = followups.filter(f => f.status === 'Pending' || f.status === 'Overdue');

  const contextData = {
    customer: {
      name: customer.name,
      company: customer.company,
      email: customer.email,
      industry: customer.industry,
      status: customer.status,
      assigned: customer.assigned_name,
      notes: customer.notes
    },
    totalSpent,
    ordersCount: orders.length,
    recentOrders: orders.slice(0, 3).map(o => `${o.order_number} (${o.status}): $${o.total}`),
    openTickets: openTickets.map(t => `${t.ticket_number} [${t.priority}]: ${t.subject}`),
    pendingFollowups: pendingFollowups.map(f => `${f.date} (${f.type}) - ${f.notes}`),
    opportunities: opportunities.map(o => `${o.opp_code}: ${o.title} ($${o.value}, Stage: ${o.stage})`),
    recentInteractions: communications.map(c => `[${c.type} - ${c.date.slice(0, 10)}] ${c.subject}: ${c.content}`),
    feedback: feedbackList.map(fb => `${fb.rating}/5 stars (${fb.category}): "${fb.comments}"`)
  };

  const ai = getAiClient();
  if (ai) {
    try {
      const prompt = `
You are an executive CRM and Sales Operations AI Assistant.
Analyze this Customer 360 profile and generate a concise, high-impact Customer Summary.

Customer Data:
${JSON.stringify(contextData, null, 2)}

Return your answer strictly in the following JSON structure:
{
  "summary": "2-3 sentences executive summary of the customer status and strategic value.",
  "background": "Brief overview of company, industry, and relationship stage.",
  "recentInteractions": ["item 1", "item 2", ...],
  "requirements": ["requirement 1", "requirement 2"],
  "purchaseHistory": "Summary of orders and total revenue to date.",
  "activeOpportunities": "Overview of pipeline opportunities and values.",
  "pendingFollowups": ["followup 1", "followup 2"],
  "openSupportIssues": ["issue 1", ...],
  "recommendedNextActions": ["action 1 with specific rationale", "action 2", "action 3"]
}
`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          temperature: 0.2,
        },
      });

      if (response.text) {
        const parsed = JSON.parse(response.text);
        return {
          ...parsed,
          isAiGenerated: true,
        };
      }
    } catch (err) {
      console.warn('Gemini API call failed, falling back to analytical engine:', err);
    }
  }

  // Analytical engine fallback
  const recActions: string[] = [];
  if (pendingFollowups.some(f => f.status === 'Overdue')) {
    recActions.push('URGENT: Clear overdue follow-up tasks before end of day to prevent customer churn.');
  }
  if (opportunities.some(o => o.stage === 'Negotiation')) {
    recActions.push('Finalize legal/pricing negotiations for high-probability active deals in pipeline.');
  } else if (opportunities.some(o => o.stage === 'Proposal')) {
    recActions.push('Schedule proposal walkthrough meeting with executive decision makers.');
  }
  if (openTickets.length > 0) {
    recActions.push(`Coordinate with technical support to expedite resolution of ticket ${openTickets[0].ticket_number}.`);
  }
  if (recActions.length < 3) {
    recActions.push('Schedule quarterly executive business review and propose additional enterprise licenses.');
  }

  return {
    summary: `${customer.company} (${customer.name}) is an ${customer.status} account in the ${customer.industry || 'General'} sector, managed by ${customer.assigned_name || 'Unassigned'}. With $${totalSpent.toLocaleString()} in realized revenue across ${orders.length} order(s) and active pipeline value of $${opportunities.reduce((s, o) => s + o.value, 0).toLocaleString()}, this represents a high-priority relationship.`,
    background: `${customer.company} operates within ${customer.industry || 'Enterprise Markets'}. Key contact is ${customer.name} (${customer.email}).`,
    recentInteractions: communications.length > 0 
      ? communications.slice(0, 4).map(c => `[${c.type} on ${c.date.slice(0, 10)}] ${c.subject}`)
      : ['No recorded interaction logs in the last 30 days.'],
    requirements: [
      customer.notes || 'Enterprise grade workflow, automated quotes, and seamless onboarding.',
      'SLA guarantee and continuous team enablement.'
    ],
    purchaseHistory: orders.length > 0 
      ? `Completed ${orders.filter(o => o.status === 'Completed').length} purchase(s) with total lifetime value of $${totalSpent.toLocaleString()}. Last order date: ${orders[0]?.order_date || 'N/A'}.`
      : 'No completed orders yet. Customer is currently progressing through sales evaluation.',
    activeOpportunities: opportunities.length > 0
      ? `${opportunities.length} deal(s) active worth $${opportunities.reduce((s, o) => s + o.value, 0).toLocaleString()} (Stages: ${[...new Set(opportunities.map(o => o.stage))].join(', ')}).`
      : 'No active sales opportunities currently open.',
    pendingFollowups: pendingFollowups.length > 0
      ? pendingFollowups.map(f => `${f.date} [${f.status.toUpperCase()}]: ${f.type} - ${f.notes}`)
      : ['No pending follow-ups scheduled.'],
    openSupportIssues: openTickets.length > 0
      ? openTickets.map(t => `${t.ticket_number} (${t.priority} Priority): ${t.subject} [${t.status}]`)
      : ['No open support tickets. Account is in healthy operational standing.'],
    recommendedNextActions: recActions,
    isAiGenerated: false
  };
}

export function computeLeadAttentionScore(lead: any): { score: number; factors: string[] } {
  let score = 40;
  const factors: string[] = [];

  // 1. Estimated Value factor
  if (lead.estimated_value >= 50000) {
    score += 25;
    factors.push(`High estimated deal value ($${lead.estimated_value.toLocaleString()}) (+25 pts)`);
  } else if (lead.estimated_value >= 25000) {
    score += 15;
    factors.push(`Mid-market deal value ($${lead.estimated_value.toLocaleString()}) (+15 pts)`);
  } else if (lead.estimated_value >= 10000) {
    score += 8;
    factors.push(`Standard deal value ($${lead.estimated_value.toLocaleString()}) (+8 pts)`);
  }

  // 2. Priority factor
  if (lead.priority === 'Urgent') {
    score += 20;
    factors.push('Urgent priority tag flagged (+20 pts)');
  } else if (lead.priority === 'High') {
    score += 12;
    factors.push('High priority classification (+12 pts)');
  }

  // 3. Status factor
  if (lead.status === 'New') {
    score += 10;
    factors.push('New untouched inbound lead requiring initial contact (+10 pts)');
  } else if (lead.status === 'Qualified') {
    score += 15;
    factors.push('Qualified budget and intent; ready for opportunity conversion (+15 pts)');
  } else if (lead.status === 'Lost' || lead.status === 'Unqualified') {
    score -= 30;
    factors.push('Marked as unqualified or lost (-30 pts)');
  }

  // 4. Followup urgency
  const today = new Date().toISOString().split('T')[0];
  if (lead.next_followup_at) {
    if (lead.next_followup_at < today) {
      score += 15;
      factors.push(`Follow-up overdue since ${lead.next_followup_at} (+15 urgency pts)`);
    } else if (lead.next_followup_at === today) {
      score += 10;
      factors.push('Follow-up scheduled for TODAY (+10 pts)');
    }
  }

  // 5. Inactivity penalty
  if (lead.last_contacted_at) {
    const daysSinceContact = Math.floor((Date.now() - new Date(lead.last_contacted_at).getTime()) / 86400000);
    if (daysSinceContact > 7 && lead.status !== 'Converted' && lead.status !== 'Lost') {
      score += 10;
      factors.push(`Lacks contact for ${daysSinceContact} days; attention needed (+10 pts)`);
    }
  }

  const finalScore = Math.max(5, Math.min(100, Math.round(score)));
  return { score: finalScore, factors };
}

export async function askSalesAiAssistant(query: string, user: any): Promise<{ answer: string; relatedData?: any }> {
  // Aggregate real system statistics and records for context
  const totalLeads = get<any>('SELECT count(*) as c FROM leads')?.c || 0;
  const overdueFollowups = all<any>(
    `SELECT f.*, c.name as cust_name, c.company, u.full_name as rep 
     FROM followups f 
     LEFT JOIN customers c ON f.customer_id = c.id 
     LEFT JOIN users u ON f.assigned_user_id = u.id 
     WHERE f.status = 'Overdue' OR (f.status = 'Pending' AND f.date < date('now'))`
  );
  const todayFollowups = all<any>(
    `SELECT f.*, c.name as cust_name, c.company, u.full_name as rep 
     FROM followups f 
     LEFT JOIN customers c ON f.customer_id = c.id 
     LEFT JOIN users u ON f.assigned_user_id = u.id 
     WHERE f.status = 'Pending' AND f.date = date('now')`
  );
  const negotiationOpps = all<any>(
    `SELECT o.*, c.company, c.name as contact, u.full_name as rep 
     FROM opportunities o 
     LEFT JOIN customers c ON o.customer_id = c.id 
     LEFT JOIN users u ON o.assigned_user_id = u.id 
     WHERE o.stage = 'Negotiation'`
  );
  const highValueOpps = all<any>(
    `SELECT o.*, c.company, c.name as contact, u.full_name as rep 
     FROM opportunities o 
     LEFT JOIN customers c ON o.customer_id = c.id 
     LEFT JOIN users u ON o.assigned_user_id = u.id 
     WHERE o.value >= 30000 
     ORDER BY o.value DESC LIMIT 6`
  );
  const inactiveLeads = all<any>(
    `SELECT l.*, u.full_name as rep 
     FROM leads l 
     LEFT JOIN users u ON l.assigned_user_id = u.id 
     WHERE l.status NOT IN ('Converted', 'Lost') 
       AND (l.last_contacted_at IS NULL OR l.last_contacted_at < date('now', '-5 days'))
     ORDER BY l.estimated_value DESC LIMIT 6`
  );
  const leadsNeedingFollowup = all<any>(
    `SELECT l.*, u.full_name as rep
     FROM leads l
     LEFT JOIN users u ON l.assigned_user_id = u.id
     WHERE l.status NOT IN ('Converted', 'Lost')
       AND (l.next_followup_at <= date('now') OR l.next_followup_at IS NULL)
     ORDER BY l.estimated_value DESC LIMIT 6`
  );
  const topCustomers = all<any>(
    `SELECT c.*, COALESCE(SUM(o.total), 0) as total_spent, COUNT(o.id) as order_count, u.full_name as rep
     FROM customers c
     LEFT JOIN orders o ON c.id = o.customer_id AND o.status != 'Cancelled'
     LEFT JOIN users u ON c.assigned_user_id = u.id
     GROUP BY c.id
     ORDER BY total_spent DESC LIMIT 6`
  );
  const atRiskCustomers = all<any>(
    `SELECT c.*, u.full_name as rep,
       (SELECT COUNT(*) FROM support_tickets st WHERE st.customer_id = c.id AND st.status IN ('Open', 'In Progress')) as open_tickets,
       (SELECT COUNT(*) FROM followups fu WHERE fu.customer_id = c.id AND fu.status = 'Overdue') as overdue_count
     FROM customers c
     LEFT JOIN users u ON c.assigned_user_id = u.id
     WHERE c.status = 'Churned' 
        OR (SELECT COUNT(*) FROM support_tickets st WHERE st.customer_id = c.id AND st.status IN ('Open', 'In Progress')) > 0
        OR (SELECT COUNT(*) FROM followups fu WHERE fu.customer_id = c.id AND fu.status = 'Overdue') > 0
     LIMIT 6`
  );
  const recentOrders = all<any>(
    `SELECT ord.*, c.company, c.name as contact 
     FROM orders ord 
     JOIN customers c ON ord.customer_id = c.id 
     ORDER BY ord.order_date DESC LIMIT 5`
  );
  const openSupportTickets = all<any>(
    `SELECT t.*, c.company 
     FROM support_tickets t 
     JOIN customers c ON t.customer_id = c.id 
     WHERE t.status IN ('Open', 'In Progress')`
  );

  const crmContext = {
    currentUser: { name: user.full_name, role: user.role },
    overdueFollowupsCount: overdueFollowups.length,
    overdueFollowupsSample: overdueFollowups.map(f => ({ customer: f.company, type: f.type, date: f.date, notes: f.notes, rep: f.rep })),
    todayFollowupsCount: todayFollowups.length,
    todayFollowupsSample: todayFollowups.map(f => ({ customer: f.company, time: f.time, type: f.type, notes: f.notes, rep: f.rep })),
    negotiationOppsCount: negotiationOpps.length,
    negotiationOppsSample: negotiationOpps.map(o => ({ opp: o.title, company: o.company, value: o.value, probability: `${o.probability}%`, rep: o.rep })),
    highValueOppsSample: highValueOpps.map(o => ({ title: o.title, company: o.company, value: `$${o.value.toLocaleString()}`, stage: o.stage, rep: o.rep })),
    inactiveLeadsSample: inactiveLeads.map(l => ({ name: l.name, company: l.company, value: `$${l.estimated_value.toLocaleString()}`, source: l.source, status: l.status, rep: l.rep })),
    leadsNeedingFollowupSample: leadsNeedingFollowup.map(l => ({ name: l.name, company: l.company, value: `$${l.estimated_value.toLocaleString()}`, next_followup: l.next_followup_at || 'None scheduled', rep: l.rep })),
    topCustomersSample: topCustomers.map(c => ({ company: c.company, contact: c.name, total_spent: `$${Number(c.total_spent).toLocaleString()}`, orders: c.order_count, rep: c.rep })),
    atRiskCustomersSample: atRiskCustomers.map(c => ({ company: c.company, status: c.status, open_tickets: c.open_tickets, overdue_followups: c.overdue_count, rep: c.rep })),
    recentOrdersSample: recentOrders.map(o => ({ number: o.order_number, company: o.company, total: `$${o.total.toLocaleString()}`, status: o.status })),
    openTicketsCount: openSupportTickets.length
  };

  const ai = getAiClient();
  if (ai) {
    try {
      const prompt = `
You are the AI Sales Operations Assistant for the Customer & Sales Workflow CRM.
The user is asking: "${query}"

Here is the exact, real-time database state from the CRM:
${JSON.stringify(crmContext, null, 2)}

Provide a direct, highly professional, insight-driven answer based strictly on the CRM data above. Mention specific companies, dollar values, dates, and sales reps where relevant. Provide clear actionable advice.
`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
      });

      if (response.text) {
        return {
          answer: response.text,
          relatedData: crmContext
        };
      }
    } catch (e) {
      console.warn('Gemini chat assistant failed, using intelligent analytical fallback:', e);
    }
  }

  // Analytical fallbacks based on keywords in query
  const q = query.toLowerCase();

  if (q.includes('overdue')) {
    if (overdueFollowups.length === 0) {
      return { answer: 'Great news! There are currently no overdue follow-ups in the system.', relatedData: [] };
    }
    const list = overdueFollowups.map(f => `• **${f.company}** (${f.cust_name}) - ${f.type} was due on ${f.date}. Notes: "${f.notes}" (Assigned: ${f.rep || 'Unassigned'})`).join('\n');
    return {
      answer: `You currently have **${overdueFollowups.length} overdue follow-up(s)** requiring immediate sales attention:\n\n${list}\n\n**Action Item:** Call or email these contacts today to prevent deals from slipping.`,
      relatedData: overdueFollowups
    };
  }

  if (q.includes('today')) {
    if (todayFollowups.length === 0) {
      return { answer: 'There are no follow-ups scheduled specifically for today. You can focus on proactive outreach or review pipeline opportunities.', relatedData: [] };
    }
    const list = todayFollowups.map(f => `• **${f.time}** - **${f.company}** [${f.type}] - ${f.notes} (Rep: ${f.rep})`).join('\n');
    return {
      answer: `Here are the **${todayFollowups.length} follow-up(s) scheduled for today**:\n\n${list}\n\nMake sure to review the customer 360 profile before each scheduled interaction.`,
      relatedData: todayFollowups
    };
  }

  if (q.includes('negotiat')) {
    const totalVal = negotiationOpps.reduce((s, o) => s + o.value, 0);
    const list = negotiationOpps.map(o => `• **${o.company}**: "${o.title}" valued at **$${o.value.toLocaleString()}** (${o.probability}% close confidence, managed by ${o.rep})`).join('\n');
    return {
      answer: `There are **${negotiationOpps.length} opportunities currently in the Negotiation stage**, representing a total pipeline value of **$${totalVal.toLocaleString()}**:\n\n${list}\n\n**Recommendation:** Prioritize legal and procurement sign-offs to convert these into orders.`,
      relatedData: negotiationOpps
    };
  }

  if (q.includes('risk') || q.includes('churn')) {
    if (atRiskCustomers.length === 0) {
      return { answer: 'All customer accounts are currently healthy with no overdue follow-ups or critical open support tickets!', relatedData: [] };
    }
    const list = atRiskCustomers.map(c => `• **${c.company}** (${c.name}) - Status: **${c.status}** | Open Tickets: ${c.open_tickets} | Overdue Follow-ups: ${c.overdue_count} (Managed by: ${c.rep || 'Unassigned'})`).join('\n');
    return {
      answer: `Identified **${atRiskCustomers.length} customer(s) showing churn or relationship risk factors**:\n\n${list}\n\n**Next Best Action:** Prioritize resolving open support escalations and schedule executive check-in calls with these accounts.`,
      relatedData: atRiskCustomers
    };
  }

  if (q.includes('highest') && (q.includes('customer') || q.includes('client'))) {
    const list = topCustomers.map((c, i) => `**${i + 1}. ${c.company}** (${c.name}) - Total Spend: **$${Number(c.total_spent).toLocaleString()}** across ${c.order_count} order(s) (Executive: ${c.rep || 'Unassigned'})`).join('\n');
    return {
      answer: `Here are your **highest-value customers** ranked by cumulative revenue:\n\n${list}\n\n**Next Best Action:** Schedule quarterly executive reviews and explore expansion opportunities for premium SLA tiers.`,
      relatedData: topCustomers
    };
  }

  if ((q.includes('lead') && q.includes('follow')) || (q.includes('leads') && q.includes('need'))) {
    const list = leadsNeedingFollowup.map(l => `• **${l.name}** (${l.company}) - Est. Value: **$${l.estimated_value.toLocaleString()}** | Next Follow-up: **${l.next_followup_at || 'None scheduled'}** (Rep: ${l.rep || 'Unassigned'})`).join('\n');
    return {
      answer: `Here are the **${leadsNeedingFollowup.length} leads requiring active follow-up**:\n\n${list}\n\n**Recommendation:** Complete follow-ups promptly to maintain buyer engagement.`,
      relatedData: leadsNeedingFollowup
    };
  }

  if (q.includes('attention')) {
    const list = highValueOpps.map(o => `• **${o.company}**: "${o.title}" ($${o.value.toLocaleString()} - ${o.stage}) - Expected Close: ${o.expected_close_date || 'Pending'} (Rep: ${o.rep})`).join('\n');
    return {
      answer: `Here are key deals and accounts currently requiring priority attention:\n\n${list}\n\n**Suggested Strategy:** Review roadblock notes and align with assigned executives to secure commitment.`,
      relatedData: highValueOpps
    };
  }

  if (q.includes('high') || q.includes('value')) {
    const list = highValueOpps.map(o => `• **$${o.value.toLocaleString()}** - **${o.company}**: ${o.title} [Stage: ${o.stage}] (Assigned: ${o.rep})`).join('\n');
    return {
      answer: `Here are the top high-value opportunities across the sales pipeline:\n\n${list}\n\nMaintaining weekly touchpoints on these accounts is critical to hitting quarterly revenue targets.`,
      relatedData: highValueOpps
    };
  }

  if (q.includes('inactive') || q.includes('recent') || q.includes('not been contacted')) {
    const list = inactiveLeads.map(l => `• **${l.name}** from **${l.company}** ($${l.estimated_value.toLocaleString()} est. value, Source: ${l.source}) - Status: ${l.status}, Assigned to ${l.rep}`).join('\n');
    return {
      answer: `We identified **${inactiveLeads.length} leads requiring attention** due to a lack of recent sales activity:\n\n${list}\n\n**Recommendation:** Re-engage these prospects with a personalized check-in or update on new features.`,
      relatedData: inactiveLeads
    };
  }

  // General executive summary
  return {
    answer: `Here is a quick snapshot of the current CRM operations:\n\n` +
      `• **Active Opportunities in Negotiation:** ${negotiationOpps.length} deals totaling $${negotiationOpps.reduce((s, o) => s + o.value, 0).toLocaleString()}.\n` +
      `• **Overdue Follow-ups:** ${overdueFollowups.length} task(s) needing resolution.\n` +
      `• **Today's Follow-ups:** ${todayFollowups.length} scheduled interactions.\n` +
      `• **Open Support Issues:** ${openSupportTickets.length} tickets currently open.\n\n` +
      `You can ask me specific questions like: *"Show me customers with overdue follow-ups"*, *"Which opportunities are in negotiation?"*, or *"Which leads have not been contacted recently?"*.`,
    relatedData: crmContext
  };
}

export function getAiFollowupInsights() {
  const overdueFollowups = all<any>(
    `SELECT f.*, c.name as customer_name, c.company, u.full_name as rep 
     FROM followups f 
     LEFT JOIN customers c ON f.customer_id = c.id 
     LEFT JOIN users u ON f.assigned_user_id = u.id 
     WHERE f.status = 'Overdue' OR (f.status = 'Pending' AND f.date < date('now'))
     ORDER BY f.date ASC LIMIT 5`
  );

  const inactiveLeads = all<any>(
    `SELECT l.*, u.full_name as rep 
     FROM leads l 
     LEFT JOIN users u ON l.assigned_user_id = u.id 
     WHERE l.status NOT IN ('Converted', 'Lost') 
       AND (l.last_contacted_at IS NULL OR l.last_contacted_at < date('now', '-5 days'))
     ORDER BY l.estimated_value DESC LIMIT 5`
  );

  const stalledOpportunities = all<any>(
    `SELECT o.*, c.company, u.full_name as rep 
     FROM opportunities o 
     LEFT JOIN customers c ON o.customer_id = c.id 
     LEFT JOIN users u ON o.assigned_user_id = u.id 
     WHERE o.stage NOT IN ('Converted') 
       AND o.stage_changed_at < date('now', '-10 days')
     ORDER BY o.value DESC LIMIT 5`
  );

  return {
    overdueFollowups,
    inactiveLeads,
    stalledOpportunities,
    recommendations: [
      {
        id: 'rec-1',
        title: 'Clear Overdue Outreach',
        severity: 'high',
        text: `${overdueFollowups.length} scheduled sales follow-ups are overdue. Reaching out within 24 hours increases win probability by 38%.`,
        actionLink: '/followups'
      },
      {
        id: 'rec-2',
        title: 'Revitalize High-Value Inactive Leads',
        severity: 'medium',
        text: `${inactiveLeads.length} qualified leads have had no touchpoint in over 5 business days. Send a targeted product deck or demo invitation.`,
        actionLink: '/leads'
      },
      {
        id: 'rec-3',
        title: 'Accelerate Negotiation Stage Deals',
        severity: 'high',
        text: 'Multiple enterprise opportunities are in late-stage negotiation. Request executive sponsorship or custom discount approval to close before quarter end.',
        actionLink: '/pipeline'
      }
    ]
  };
}
