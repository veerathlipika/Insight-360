import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types/index.ts';
import { api, getAuthToken, setAuthToken, removeAuthToken } from '../services/api.ts';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: { full_name: string; email: string; password: string; role?: string; phone?: string; plan?: 'trial' | 'paid' }) => Promise<void>;
  updateProfile: (data: { full_name?: string; phone?: string; current_password?: string; new_password?: string }) => Promise<void>;
  refreshUser: () => Promise<void>;
  logout: () => Promise<void>;
  isManager: boolean;
  isExecutive: boolean;
  isCustomer: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchCurrentUser = async () => {
    const token = getAuthToken();
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }

    try {
      const data = await api.getMe();
      setUser(data.user);
    } catch (err) {
      removeAuthToken();
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCurrentUser();

    const handleExpired = () => {
      setUser(null);
    };
    window.addEventListener('auth_expired', handleExpired);
    return () => window.removeEventListener('auth_expired', handleExpired);
  }, []);

  const login = async (email: string, password: string) => {
    const data = await api.login({ email, password });
    setAuthToken(data.token);
    setUser(data.user);
  };

  const register = async (userData: { full_name: string; email: string; password: string; role?: string; phone?: string; plan?: 'trial' | 'paid' }) => {
    const data = await api.register(userData);
    setAuthToken(data.token);
    setUser(data.user);
  };

  const updateProfile = async (profileData: { full_name?: string; phone?: string; current_password?: string; new_password?: string }) => {
    const data = await api.updateProfile(profileData);
    setUser(data.user);
  };

  const refreshUser = async () => {
    await fetchCurrentUser();
  };

  const logout = async () => {
    try {
      await api.logout();
    } catch (e) {
      // Ignore logout failure
    } finally {
      removeAuthToken();
      setUser(null);
    }
  };

  const isManager = user?.role === 'Sales Manager';
  const isExecutive = user?.role === 'Sales Executive';
  const isCustomer = user?.role === 'Customer';

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        register,
        updateProfile,
        refreshUser,
        logout,
        isManager,
        isExecutive,
        isCustomer,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
