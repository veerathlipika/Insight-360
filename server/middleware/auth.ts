import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { get } from '../db/database.ts';

const JWT_SECRET = process.env.JWT_SECRET || 'crm_sales_workflow_jwt_secret_2026_dev_key';

export interface AuthenticatedUser {
  id: number;
  email: string;
  full_name: string;
  role: 'Sales Manager' | 'Sales Executive' | 'Customer';
  status: string;
  avatar?: string;
  customer_id?: number | null;
  subscription_plan?: 'trial' | 'paid';
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

export function generateToken(user: AuthenticatedUser): string {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      full_name: user.full_name
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

export function authenticate(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required. Please log in.' });
    return;
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    const user = get<AuthenticatedUser>(
      'SELECT id, email, full_name, role, status, avatar, customer_id, subscription_plan FROM users WHERE id = ?',
      [decoded.id]
    );

    if (!user || user.status !== 'Active') {
      res.status(401).json({ error: 'User account is inactive or not found.' });
      return;
    }

    if (user.role === 'Customer') {
      const isSessionRequest = req.path === '/auth/me' || req.path === '/auth/logout';
      const profileMatch = req.path.match(/^\/customers\/(\d+)$/);
      const isOwnProfileRequest = req.method === 'GET'
        && profileMatch
        && Number(profileMatch[1]) === user.customer_id;
      const isCustomerPortalRequest = req.path.startsWith('/customer/');
      if (!isSessionRequest && !isOwnProfileRequest && !isCustomerPortalRequest) {
        res.status(403).json({ error: 'Customer accounts can only view their own customer profile.' });
        return;
      }
    }

    req.user = user;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired token.' });
  }
}

export function requireRoles(roles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: `Access denied. Requires one of roles: ${roles.join(', ')}` });
      return;
    }

    next();
  };
}
