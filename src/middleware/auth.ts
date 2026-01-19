import { MiddlewareHandler } from 'hono';
import { Env } from '../types';
import { AuthService } from '../services/auth.service';

export interface AuthContext {
  user: {
    id: number;
    email: string;
    name: string;
  };
  token: string;
}

/**
 * Authentication middleware
 * Verifies JWT token and adds user to context
 */
export const auth: MiddlewareHandler<{ Bindings: Env }> = async (c, next) => {
  // Get token from Authorization header or cookie
  const token = c.req.header('Authorization')?.replace('Bearer ', '') || c.req.cookie('token');

  if (!token) {
    return c.json({ error: 'Not authenticated' }, 401);
  }

  // Verify token
  const service = new AuthService(c.env);
  const user = await service.getUserByToken(token);

  if (!user) {
    return c.json({ error: 'Invalid or expired token' }, 401);
  }

  // Add user to context
  c.set('user', user);
  c.set('token', token);

  await next();
};

/**
 * Optional authentication middleware
 * Doesn't fail if no token, but adds user if valid
 */
export const optionalAuth: MiddlewareHandler<{ Bindings: Env }> = async (c, next) => {
  const token = c.req.header('Authorization')?.replace('Bearer ', '') || c.req.cookie('token');

  if (token) {
    const service = new AuthService(c.env);
    const user = await service.getUserByToken(token);

    if (user) {
      c.set('user', user);
      c.set('token', token);
    }
  }

  await next();
};
