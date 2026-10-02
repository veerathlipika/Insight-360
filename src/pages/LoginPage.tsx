import React, { useState } from 'react';
import { Workflow, Eye, EyeOff, Lock, Mail, ArrowRight, UserPlus, LogIn, Phone, ChevronDown, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { useToast } from '../context/ToastContext.tsx';

interface LoginPageProps {
  initialTab?: 'login' | 'register';
  onBackToLanding?: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ initialTab = 'login', onBackToLanding }) => {
  const { login, register } = useAuth();
  const { success, error: toastError } = useToast();

  const [activeTab, setActiveTab] = useState<'login' | 'register'>(initialTab);

  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  // Register form state
  const [fullName, setFullName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regRole, setRegRole] = useState<'Sales Manager' | 'Sales Executive' | 'Customer'>('Sales Executive');
  const [regPassword, setRegPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);

  // Status & loading
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!loginEmail.trim() || !loginPassword.trim()) {
      setErrorMessage('Please enter your email or phone number and password.');
      return;
    }

    setIsLoading(true);
    try {
      await login(loginEmail.trim(), loginPassword);
      success('Logged in successfully!');
    } catch (err: any) {
      setErrorMessage(err.message || 'Incorrect email or password.');
      toastError('Authentication failed', err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!fullName.trim()) {
      setErrorMessage('Please enter your full name.');
      return;
    }
    if (!regEmail.trim() || !regEmail.includes('@')) {
      setErrorMessage('Please enter a valid work email address.');
      return;
    }
    if (!regPhone.trim()) {
      setErrorMessage('A phone number is required to keep accounts unique.');
      return;
    }
    if (!regPassword || regPassword.length < 6) {
      setErrorMessage('Password must be at least 6 characters long.');
      return;
    }
    if (regPassword !== confirmPassword) {
      setErrorMessage('Passwords do not match. Please verify.');
      return;
    }

    setIsLoading(true);
    try {
      await register({
        full_name: fullName.trim(),
        email: regEmail.trim(),
        password: regPassword,
        role: regRole,
        phone: regPhone.trim(),
        plan: 'trial',
      });
      success(`Account created successfully! Welcome, ${fullName.trim()}.`);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to register account.');
      toastError('Registration error', err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f3f7f1] flex flex-col justify-center py-10 sm:px-6 lg:px-8 font-sans">

      {/* Brand Header */}
      <div className="sm:mx-auto sm:w-full sm:max-w-lg px-4">
        {onBackToLanding && (
          <button
            type="button"
            onClick={onBackToLanding}
            className="mb-4 text-xs font-semibold text-[#52675a] hover:text-[#17382b]"
          >
            ← Back to Insight360
          </button>
        )}
        <div className="flex justify-center">
          <img
            src="/insight360-logo.jpg"
            alt="Insight360 Logo"
            className="w-16 h-16 object-contain rounded-2xl bg-white p-1 shadow-lg shadow-[#174d3b]/15 border border-[#d4dfd5]"
          />
        </div>
        <h1 className="mt-4 text-center text-2xl font-bold tracking-tight text-[#17382b]">
          Insight360 Customer Intelligence
        </h1>
        <p className="mt-1 text-center text-xs text-[#647168] max-w-sm mx-auto leading-relaxed">
          Customer relationships, sales activity, and account insights in one clear workspace.
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-lg px-4 sm:px-0">
        <div className="bg-white shadow-[0_18px_55px_-34px_rgba(23,56,43,0.5)] rounded-xl border border-[#d7e2d8] overflow-hidden">
          
          {/* Tab Selector: Sign In vs Create Account */}
          <div className="grid grid-cols-2 border border-[#dce6de] bg-[#edf3ed] p-1.5 gap-1.5 m-3 rounded-lg">
            <button
              type="button"
              onClick={() => {
                setActiveTab('login');
                setErrorMessage('');
              }}
              className={`flex items-center justify-center gap-2 py-2.5 text-xs font-semibold rounded-md transition-all ${
                activeTab === 'login'
                  ? 'bg-[#174d3b] text-white shadow-sm'
                  : 'text-[#617168] hover:text-[#17382b] hover:bg-white'
              }`}
            >
              <LogIn className="w-3.5 h-3.5" />
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('register');
                setErrorMessage('');
              }}
              className={`flex items-center justify-center gap-2 py-2.5 text-xs font-semibold rounded-md transition-all ${
                activeTab === 'register'
                  ? 'bg-[#174d3b] text-white shadow-sm'
                  : 'text-[#617168] hover:text-[#17382b] hover:bg-white'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              Create Account
            </button>
          </div>

          <div className="p-6 pt-3 sm:px-8">
            {errorMessage && (
              <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                <span className="font-semibold">Notice:</span> {errorMessage}
              </div>
            )}

            {/* TAB 1: SIGN IN FORM */}
            {activeTab === 'login' && (
              <form onSubmit={handleLoginSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[#405248] mb-1">
                      Email or Phone Number
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-[#829087] absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      placeholder="name@company.com or phone number"
                      className="w-full bg-white text-sm text-[#17382b] pl-9 pr-3 py-2.5 rounded-lg border border-[#cbd8ce] focus:outline-none focus:border-[#398660] focus:ring-2 focus:ring-[#398660]/15 placeholder-[#98a29b]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#405248] mb-1">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-[#829087] absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type={showLoginPassword ? 'text' : 'password'}
                      required
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full bg-white text-sm text-[#17382b] pl-9 pr-10 py-2.5 rounded-lg border border-[#cbd8ce] focus:outline-none focus:border-[#398660] focus:ring-2 focus:ring-[#398660]/15 placeholder-[#98a29b]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowLoginPassword(!showLoginPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#829087] hover:text-[#17382b]"
                    >
                      {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs pt-1">
                  <label className="flex items-center gap-2 cursor-pointer text-[#68776e] hover:text-[#405248]">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="rounded border-[#b9c8bd] text-[#174d3b] focus:ring-[#398660] bg-white"
                    />
                    Keep me signed in
                  </label>
                  <button
                    type="button"
                    onClick={() => setActiveTab('register')}
                    className="text-[#27704c] hover:text-[#174d3b] hover:underline font-medium"
                  >
                    Need an account?
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full mt-2 py-3 px-4 rounded-lg bg-[#ed7653] hover:bg-[#d85f40] text-white text-sm font-semibold shadow-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
                >
                  {isLoading ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>Sign In to Dashboard</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>

              </form>
            )}

            {/* TAB 2: REGISTER ACCOUNT FORM */}
            {activeTab === 'register' && (
              <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-[#405248] mb-1">
                    Full Name <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Bhavya Varati"
                    className="w-full bg-white text-sm text-[#17382b] px-3 py-2.5 rounded-lg border border-[#cbd8ce] focus:outline-none focus:border-[#398660] focus:ring-2 focus:ring-[#398660]/15 placeholder-[#98a29b]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#405248] mb-1">
                    Email Address <span className="text-rose-400">*</span>
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-[#829087] absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      required
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      placeholder="e.g. yourname@company.com"
                      className="w-full bg-white text-sm text-[#17382b] pl-9 pr-3 py-2.5 rounded-lg border border-[#cbd8ce] focus:outline-none focus:border-[#398660] focus:ring-2 focus:ring-[#398660]/15 placeholder-[#98a29b]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#405248] mb-1">
                      Phone Number <span className="text-rose-400">*</span>
                    </label>
                    <div className="relative">
                      <Phone className="w-4 h-4 text-[#829087] absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="tel"
                        required
                        value={regPhone}
                        onChange={(e) => setRegPhone(e.target.value)}
                        placeholder="+1 (555) 012-3456"
                        className="w-full bg-white text-sm text-[#17382b] pl-9 pr-3 py-2.5 rounded-lg border border-[#cbd8ce] focus:outline-none focus:border-[#398660] focus:ring-2 focus:ring-[#398660]/15 placeholder-[#98a29b]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#405248] mb-1">
                      Role / Permission
                    </label>
                    <select
                      value={regRole}
                      onChange={(e) => setRegRole(e.target.value as 'Sales Manager' | 'Sales Executive' | 'Customer')}
                      className="w-full bg-white text-sm text-[#17382b] px-3 py-2.5 rounded-lg border border-[#cbd8ce] focus:outline-none focus:border-[#398660] focus:ring-2 focus:ring-[#398660]/15"
                    >
                      <option value="Sales Manager">Sales Manager</option>
                      <option value="Sales Executive">Sales Executive</option>
                      <option value="Customer">Customer</option>
                    </select>
                  </div>
                </div>

                {regRole === 'Customer' ? (
                  <div className="rounded-lg border border-[#d4dfd5] bg-[#f3f7f1] px-3 py-2.5 text-xs leading-5 text-[#52675a]">
                    Customer access is free. Use the phone number already saved on your customer profile to connect your account.
                  </div>
                ) : (
                  <div className="rounded-lg border border-[#d4dfd5] bg-[#f3f7f1] px-3 py-2.5 text-xs leading-5 text-[#52675a]">
                    New workspaces start with the free 7-day tier. Insight360 Plus billing is handled separately through secure checkout.
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-[#405248] mb-1">
                    Password <span className="text-rose-400">*</span>
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-[#829087] absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type={showRegPassword ? 'text' : 'password'}
                      required
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      placeholder="Minimum 6 characters"
                      className="w-full bg-white text-sm text-[#17382b] pl-9 pr-10 py-2.5 rounded-lg border border-[#cbd8ce] focus:outline-none focus:border-[#398660] focus:ring-2 focus:ring-[#398660]/15 placeholder-[#98a29b]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowRegPassword(!showRegPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#829087] hover:text-[#17382b]"
                    >
                      {showRegPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#405248] mb-1">
                    Confirm Password <span className="text-rose-400">*</span>
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-[#829087] absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type={showRegPassword ? 'text' : 'password'}
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter password"
                      className="w-full bg-white text-sm text-[#17382b] pl-9 pr-3 py-2.5 rounded-lg border border-[#cbd8ce] focus:outline-none focus:border-[#398660] focus:ring-2 focus:ring-[#398660]/15 placeholder-[#98a29b]"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full mt-2 py-3 px-4 rounded-lg bg-[#ed7653] hover:bg-[#d85f40] text-white text-sm font-semibold shadow-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
                >
                  {isLoading ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>Register &amp; Create Account</span>
                      <CheckCircle2 className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            )}

            {/* Enterprise RBAC Security Notice */}
            <div className="mt-5 pt-4 border-t border-[#e1e8e1] text-center">
              <div className="flex items-center justify-center gap-1.5 text-xs font-semibold text-[#405248]">
                <Lock className="w-3.5 h-3.5 text-[#398660]" />
                <span>Role-Based Access Control (RBAC) Enforced</span>
              </div>
              <p className="mt-1 text-[11px] text-[#748078] leading-normal max-w-xs mx-auto">
                User roles and permissions are permanently bound to your account and authenticated through JWT tokens.
              </p>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};
