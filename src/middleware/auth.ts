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

/**
 * Check if user is a member of the project
 * Project ID must be in route params as :id or :projectId
 */
export const requireProjectAccess: MiddlewareHandler<{ Bindings: Env }> = async (c, next) => {
  const user = c.get('user');
  if (!user) {
    return c.json({ error: 'Not authenticated' }, 401);
  }

  // Try both :id and :projectId params
  let projectId = c.req.param('id');
  if (!projectId) {
    projectId = c.req.param('projectId');
  }

  if (!projectId) {
    return c.json({ error: 'Project ID required' }, 400);
  }

  // Check if user is a member
  const member = await c.env.DB.prepare(
    'SELECT role FROM project_members WHERE project_id = ? AND user_id = ?'
  )
    .bind(projectId, user.id)
    .first();

  if (!member) {
    return c.json({ error: 'Not a member of this project' }, 403);
  }

  // Store role in context
  c.set('userRole', member.role);

  await next();
};
