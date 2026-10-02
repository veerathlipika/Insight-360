export type UserRole = 'Sales Manager' | 'Sales Executive' | 'Customer';

export interface User {
  id: number;
  email: string;
  full_name: string;
  role: UserRole;
  status: 'Active' | 'Inactive';
  phone?: string;
  customer_id?: number | null;
  subscription_plan?: 'trial' | 'paid';
  company?: string;
  avatar?: string;
  created_at?: string;
  assigned_leads?: number;
  assigned_customers?: number;
  assigned_opps?: number;
}

export interface Customer {
  id: number;
  customer_code: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  address?: string;
  industry?: string;
  status: 'Active' | 'Lead' | 'Churned' | 'VIP';
  assigned_user_id?: number | null;
  assigned_name?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  total_orders?: number;
  total_revenue?: number;
  last_interaction?: string | null;
}

export type LeadStatus = 'New' | 'Contacted' | 'Qualified' | 'Unqualified' | 'Converted' | 'Lost';
export type PriorityLevel = 'Low' | 'Medium' | 'High' | 'Urgent';

export interface Lead {
  id: number;
  lead_code: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  source: string;
  requirement: string;
  estimated_value: number;
  priority: PriorityLevel;
  assigned_user_id?: number | null;
  assigned_name?: string;
  status: LeadStatus;
  customer_id?: number | null;
  opportunity_id?: number | null;
  last_contacted_at?: string | null;
  next_followup_at?: string | null;
  attention_score: number;
  created_at: string;
  updated_at: string;
}

export type PipelineStage = 'New' | 'Contacted' | 'Proposal' | 'Negotiation' | 'Converted';

export interface Opportunity {
  id: number;
  opp_code: string;
  title: string;
  customer_id: number;
  customer_name?: string;
  customer_company?: string;
  customer_email?: string;
  lead_id?: number | null;
  value: number;
  stage: PipelineStage;
  probability: number;
  priority: PriorityLevel;
  assigned_user_id?: number | null;
  assigned_name?: string;
  expected_close_date?: string | null;
  notes?: string;
  stage_changed_at: string;
  created_at: string;
  updated_at: string;
  pending_followups_count?: number;
  next_followup_date?: string | null;
}

export type FollowupType = 'Call' | 'Email' | 'Meeting' | 'Note' | 'Other';
export type FollowupStatus = 'Pending' | 'Completed' | 'Overdue' | 'Cancelled';

export interface Followup {
  id: number;
  customer_id?: number | null;
  customer_name?: string;
  customer_company?: string;
  customer_email?: string;
  customer_phone?: string;
  lead_id?: number | null;
  opportunity_id?: number | null;
  opp_title?: string;
  opp_value?: number;
  date: string;
  time: string;
  type: FollowupType;
  status: FollowupStatus;
  priority: PriorityLevel;
  notes: string;
  assigned_user_id?: number | null;
  assigned_name?: string;
  completed_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: number;
  name: string;
  sku: string;
  category: string;
  unit_price: number;
  description?: string;
  is_active: number;
  created_at: string;
}

export type QuotationStatus = 'Draft' | 'Sent' | 'Accepted' | 'Rejected' | 'Expired';

export interface QuotationItem {
  id?: number;
  quotation_id?: number;
  product_id?: number | null;
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
}

export interface Quotation {
  id: number;
  quotation_number: string;
  customer_id: number;
  customer_name?: string;
  customer_company?: string;
  customer_email?: string;
  customer_phone?: string;
  customer_address?: string;
  opportunity_id?: number | null;
  date: string;
  valid_until: string;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  terms?: string;
  status: QuotationStatus;
  notes?: string;
  items_count?: number;
  items?: QuotationItem[];
  created_at: string;
  updated_at: string;
}

export type OrderStatus = 'Pending' | 'Confirmed' | 'Processing' | 'Completed' | 'Cancelled';

export interface OrderItem {
  id?: number;
  order_id?: number;
  product_id?: number | null;
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
}

export interface Order {
  id: number;
  order_number: string;
  customer_id: number;
  customer_name?: string;
  customer_company?: string;
  customer_email?: string;
  customer_phone?: string;
  customer_address?: string;
  opportunity_id?: number | null;
  quotation_id?: number | null;
  order_date: string;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  status: OrderStatus;
  notes?: string;
  items_count?: number;
  items?: OrderItem[];
  created_at: string;
  updated_at: string;
}

export type CommunicationType = 'Call' | 'Email' | 'Meeting' | 'Message' | 'Note';

export interface Communication {
  id: number;
  customer_id: number;
  customer_company?: string;
  lead_id?: number | null;
  opportunity_id?: number | null;
  user_id?: number | null;
  user_name?: string;
  type: CommunicationType;
  subject: string;
  content: string;
  date: string;
  created_at: string;
}

export interface Feedback {
  id: number;
  customer_id: number;
  customer_name?: string;
  customer_company?: string;
  rating: number;
  comments: string;
  category: string;
  date: string;
  created_at: string;
}

export type TicketPriority = 'Low' | 'Medium' | 'High' | 'Urgent';
export type TicketStatus = 'Open' | 'In Progress' | 'Resolved' | 'Closed';

export interface SupportTicket {
  id: number;
  ticket_number: string;
  customer_id: number;
  customer_name?: string;
  customer_company?: string;
  subject: string;
  description: string;
  priority: TicketPriority;
  assigned_user_id?: number | null;
  assigned_name?: string;
  status: TicketStatus;
  resolution?: string | null;
  created_at: string;
  updated_at: string;
  resolved_at?: string | null;
}

export interface NotificationItem {
  id: number;
  user_id?: number | null;
  title: string;
  message: string;
  type: string;
  link?: string | null;
  is_read: number;
  created_at: string;
}

export interface AuditLog {
  id: number;
  user_id?: number | null;
  user_name?: string;
  action: string;
  entity: string;
  entity_id: string;
  details?: string;
  created_at: string;
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

export interface AnalyticsData {
  kpi: {
    totalLeads: number;
    activeOpportunities: number;
    pipelineValue: number;
    convertedLeads: number;
    conversionRate: string | number;
    pendingFollowups: number;
    overdueFollowups: number;
    totalCustomers: number;
    totalSales: number;
    averageDealSize: number;
    openTickets: number;
    followupCompletionRate: number;
    retentionRate: string | number;
    atRiskCustomersCount?: number;
  };
  pipelineStages: Array<{ stage: PipelineStage; count: number; value: number }>;
  leadSources: Array<{ source: string; count: number }>;
  salesByRep: Array<{
    id: number;
    name: string;
    role: string;
    leads_count: number;
    opps_count: number;
    won_value: number;
    completed_followups: number;
  }>;
  productPerf: Array<{
    name: string;
    category: string;
    quantity_sold: number;
    revenue: number;
    orders_count: number;
  }>;
  retention: {
    activeCustomers: number;
    churnedCustomers: number;
    retentionRate: string | number;
  };
  customerSentiment?: {
    positive: number;
    neutral: number;
    negative: number;
    positivePercent: number;
    neutralPercent: number;
    negativePercent: number;
    total: number;
  };
  atRiskCustomers?: Array<{
    id: number;
    customer_code: string;
    name: string;
    company: string;
    status: string;
    assigned_name?: string;
    overdue_count: number;
    open_tickets_count: number;
    last_contact?: string;
  }>;
  customerSegmentation?: Array<{
    segment: string;
    count: number;
    color: string;
  }>;
  revenueTrends?: Array<{
    month: string;
    revenue: number;
    orders_count: number;
  }>;
  executiveMetrics?: {
    myCustomersCount: number;
    myLeadsCount: number;
    myActiveOppsCount: number;
    myPipelineValue: number;
    myRevenue: number;
    myConversionRate: string | number;
    myPendingFollowups: number;
    myOverdueFollowups: number;
    myRiskAlerts: Array<{
      id: number;
      name: string;
      company: string;
      status: string;
      overdue_fups: number;
      open_tickets: number;
    }>;
    myRecentActivity: Array<{
      id: number;
      customer_id: number;
      company: string;
      type: string;
      subject: string;
      date: string;
    }>;
    myNextActions: Array<{
      id: string;
      priority: string;
      action: string;
      link: string;
    }>;
  };
}
