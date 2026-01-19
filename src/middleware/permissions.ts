import { Context, Next } from 'hono';
import { Env } from '../types';
import { auth } from './auth';

export type Role = 'owner' | 'admin' | 'member' | 'viewer';

const ROLE_LEVELS: Record<Role, number> = {
  owner: 4,
  admin: 3,
  member: 2,
  viewer: 1,
};

/**
 * Check if user has required role or higher in the project
 * Project ID must be in route params as :id
 */
export const requireRole = (minRole: Role) => {
  return async (c: Context<{ Bindings: Env }>, next: Next) => {
    const user = c.get('user');
    if (!user) {
      return c.json({ error: 'Not authenticated' }, 401);
    }

    const projectId = parseInt(c.req.param('id'));
    if (!projectId) {
      return c.json({ error: 'Project ID required' }, 400);
    }

    // Get user's role in this project
    const member = await c.env.DB.prepare(
      'SELECT role FROM project_members WHERE project_id = ? AND user_id = ?'
    )
      .bind(projectId, user.id)
      .first();

    if (!member) {
      return c.json({ error: 'Not a member of this project' }, 403);
    }

    const userRole = member.role as Role;

    // Check if user's role meets the minimum requirement
    if (ROLE_LEVELS[userRole] < ROLE_LEVELS[minRole]) {
      return c.json({
        error: `Insufficient permissions. Required: ${minRole}, Your role: ${userRole}`
      }, 403);
    }

    // Store role in context for later use
    c.set('userRole', userRole);

    await next();
  };
};

/**
 * Check if user is owner or admin
 */
export const requireAdmin = requireRole('admin');

/**
 * Check if user is owner
 */
export const requireOwner = requireRole('owner');

/**
 * Check if user is at least a member (can write)
 */
export const requireMember = requireRole('member');

/**
 * Check if user is a viewer (can read)
 */
export const requireViewer = requireRole('viewer');

/**
 * Check if user is member of project (any role)
 * Project ID must be in route params as :id or :projectId
 */
export const requireProjectAccess = async (c: Context<{ Bindings: Env }>, next: Next) => {
  const user = c.get('user');
  if (!user) {
    return c.json({ error: 'Not authenticated' }, 401);
  }

  // Try both :id and :projectId params
  let projectId = parseInt(c.req.param('id'));
  if (!projectId) {
    projectId = parseInt(c.req.param('projectId'));
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

/**
 * Get user's role in a project
 * Returns null if not a member
 */
export async function getUserRole(
  env: Env,
  projectId: number,
  userId: number
): Promise<Role | null> {
  const result = await env.DB.prepare(
    'SELECT role FROM project_members WHERE project_id = ? AND user_id = ?'
  )
    .bind(projectId, userId)
    .first();

  return (result?.role as Role) || null;
}

/**
 * Check if user can perform action based on role
 */
export function hasPermission(userRole: Role, requiredRole: Role): boolean {
  return ROLE_LEVELS[userRole] >= ROLE_LEVELS[requiredRole];
}
