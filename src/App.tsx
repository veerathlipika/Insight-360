import React, { Suspense, useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import { ToastProvider } from './context/ToastContext.tsx';
import { MainLayout } from './components/layout/MainLayout.tsx';

import { LoginPage } from './pages/LoginPage.tsx';
import { CustomersPage } from './pages/CustomersPage.tsx';
import { CustomerRequestsPage } from './pages/CustomerRequestsPage.tsx';
import { CustomerSubmissionPage } from './pages/CustomerSubmissionPage.tsx';
import { CustomerImportPage } from './pages/CustomerImportPage.tsx';
import { Customer360Page } from './pages/Customer360Page.tsx';
import { LeadsPage } from './pages/LeadsPage.tsx';
import { SalesPipelinePage } from './pages/SalesPipelinePage.tsx';
import { FollowupsPage } from './pages/FollowupsPage.tsx';
import { QuotationsPage } from './pages/QuotationsPage.tsx';
import { OrdersPage } from './pages/OrdersPage.tsx';
import { CommunicationsPage } from './pages/CommunicationsPage.tsx';
import { FeedbackPage } from './pages/FeedbackPage.tsx';
import { SupportPage } from './pages/SupportPage.tsx';
import { AiAssistantPage } from './pages/AiAssistantPage.tsx';
import { AnalyticsPage } from './pages/AnalyticsPage.tsx';
import { NotificationsPage } from './pages/NotificationsPage.tsx';
import { LandingPage } from './pages/LandingPage.tsx';
import { PlusCheckoutPage } from './pages/PlusCheckoutPage.tsx';

const CustomerPortalPage = React.lazy(() =>
  import('./pages/CustomerPortalPage.tsx').then(({ CustomerPortalPage: Portal }) => ({ default: Portal }))
);
const PaymentVerificationPage = React.lazy(() =>
  import('./pages/PaymentVerificationPage.tsx').then(({ PaymentVerificationPage: Page }) => ({ default: Page }))
);
const DashboardPage = React.lazy(() =>
  import('./pages/DashboardPage.tsx').then(({ DashboardPage: Page }) => ({ default: Page }))
);

function AppContent() {
  const { user, loading, isCustomer } = useAuth();
  const [currentPage, setCurrentPage] = useState<string>('dashboard');
  const [pageParams, setPageParams] = useState<any>({});
  const [showLogin, setShowLogin] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [authTab, setAuthTab] = useState<'login' | 'register'>('login');
  const publicCustomerFormMatch = window.location.pathname.match(/^\/customer-form\/([^/]+)\/?$/);
  if (publicCustomerFormMatch) {
    return <CustomerSubmissionPage token={decodeURIComponent(publicCustomerFormMatch[1])} />;
  }

  const handleNavigate = (page: string, params?: any) => {
    setCurrentPage(page);
    if (params) {
      setPageParams(params);
    } else {
      setPageParams({});
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-3 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
          <p className="text-xs text-slate-400 font-medium tracking-wide">
            Loading Insight360...
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    if (showCheckout) {
      return (
        <PlusCheckoutPage
          onBack={() => setShowCheckout(false)}
          onStartTrial={() => {
            setShowCheckout(false);
            setAuthTab('register');
            setShowLogin(true);
          }}
        />
      );
    }

    if (!showLogin) {
      return (
        <LandingPage
          onGetStarted={(plan) => {
            if (plan === 'paid') {
              setShowCheckout(true);
              return;
            }
            setAuthTab('register');
            setShowLogin(true);
          }}
          onSignIn={() => {
            setAuthTab('login');
            setShowLogin(true);
          }}
        />
      );
    }

    return <LoginPage initialTab={authTab} onBackToLanding={() => setShowLogin(false)} />;
  }

  if (isCustomer) {
    return (
      <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-[#f3f7f1] text-sm text-[#52675a]">Loading your account...</div>}>
        <CustomerPortalPage customerId={user.customer_id || 0} />
      </Suspense>
    );
  }

  return (
    <MainLayout currentPage={currentPage} onNavigate={handleNavigate}>
      {currentPage === 'dashboard' && (
        <Suspense fallback={<div className="py-12 text-center text-xs text-slate-400">Loading dashboard...</div>}>
          <DashboardPage onNavigate={handleNavigate} />
        </Suspense>
      )}
      {currentPage === 'customers' && <CustomersPage onNavigate={handleNavigate} />}
      {currentPage === 'customer-requests' && <CustomerRequestsPage onNavigate={handleNavigate} />}
      {currentPage === 'customer-submission' && <CustomerSubmissionPage onNavigate={handleNavigate} />}
      {currentPage === 'customer-import' && <CustomerImportPage onNavigate={handleNavigate} />}
      {currentPage === 'customer-360' && (
        <Customer360Page customerId={pageParams.customerId || 1} onNavigate={handleNavigate} />
      )}
      {currentPage === 'leads' && <LeadsPage onNavigate={handleNavigate} />}
      {currentPage === 'pipeline' && <SalesPipelinePage onNavigate={handleNavigate} />}
      {currentPage === 'followups' && <FollowupsPage onNavigate={handleNavigate} />}
      {currentPage === 'quotations' && <QuotationsPage onNavigate={handleNavigate} />}
      {currentPage === 'orders' && <OrdersPage onNavigate={handleNavigate} />}
      {currentPage === 'communications' && <CommunicationsPage onNavigate={handleNavigate} />}
      {currentPage === 'feedback' && <FeedbackPage onNavigate={handleNavigate} />}
      {currentPage === 'support' && <SupportPage onNavigate={handleNavigate} />}
      {currentPage === 'ai-assistant' && <AiAssistantPage onNavigate={handleNavigate} />}
      {currentPage === 'analytics' && <AnalyticsPage />}
      {currentPage === 'notifications' && <NotificationsPage onNavigate={handleNavigate} />}
      {currentPage === 'payment-verification' && (
        <Suspense fallback={<div className="py-12 text-center text-xs text-slate-400">Loading payment verification...</div>}>
          <PaymentVerificationPage />
        </Suspense>
      )}
    </MainLayout>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <AppContent />
      </ToastProvider>
    </AuthProvider>
  );
}
