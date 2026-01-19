import { Context, Next } from 'hono';
import { Env } from '../types';

export type EntityType = 'project' | 'issue' | 'version' | 'member' | 'comment';
export type Action =
  | 'created'
  | 'updated'
  | 'deleted'
  | 'closed'
  | 'reopened'
  | 'assigned'
  | 'commented'
  | 'joined'
  | 'left'
  | 'role_changed';

export interface LogActivityOptions {
  project_id?: number;
  entity_type: EntityType;
  entity_id: number;
  action: Action;
  description?: string;
}

/**
 * Extract project ID from various sources
 */
function extractProjectId(c: Context<{ Bindings: Env }>): number | null {
  // Try route params
  const idParam = c.req.param('id');
  const projectIdParam = c.req.param('projectId');

  if (idParam) {
    const id = parseInt(idParam);
    if (!isNaN(id)) return id;
  }

  if (projectIdParam) {
    const projectId = parseInt(projectIdParam);
    if (!isNaN(projectId)) return projectId;
  }

  // Try from request body (for create operations)
  return null;
}

/**
 * Extract project ID for issues and versions
 */
async function getProjectIdFromEntity(
  env: Env,
  entityType: EntityType,
  entityId: number
): Promise<number | null> {
  switch (entityType) {
    case 'issue':
      const issue = await env.DB.prepare(
        'SELECT project_id FROM issues WHERE id = ?'
      )
        .bind(entityId)
        .first();
      return issue?.project_id as number | null;

    case 'version':
      const version = await env.DB.prepare(
        'SELECT project_id FROM versions WHERE name = ?'
      )
        .bind(String(entityId))
        .first();
      return version?.project_id as number | null;

    case 'project':
      return entityId;

    default:
      return null;
  }
}

/**
 * Generate description based on action and entity type
 */
function generateDescription(
  action: Action,
  entityType: EntityType,
  entityName?: string
): string {
  const entityLabels: Record<EntityType, string> = {
    project: '项目',
    issue: 'Issue',
    version: '版本',
    member: '成员',
    comment: '评论',
  };

  const actionLabels: Record<Action, string> = {
    created: '创建了',
    updated: '更新了',
    deleted: '删除了',
    closed: '关闭了',
    reopened: '重新打开了',
    assigned: '分配了',
    commented: '评论了',
    joined: '加入了',
    left: '离开了',
    role_changed: '更改了角色',
  };

  const entityLabel = entityLabels[entityType];
  const actionLabel = actionLabels[action];

  if (entityName) {
    return `${actionLabel}${entityLabel}: ${entityName}`;
  }

  return `${actionLabel}${entityLabel}`;
}

/**
 * Log activity to database
 */
export async function logActivity(
  env: Env,
  userId: number,
  options: LogActivityOptions
): Promise<void> {
  const { project_id, entity_type, entity_id, action, description } = options;

  // If project_id not provided, try to extract it
  let finalProjectId = project_id;
  if (!finalProjectId) {
    finalProjectId = await getProjectIdFromEntity(env, entity_type, entity_id);
  }

  if (!finalProjectId) {
    console.warn('Cannot log activity: project_id not found', {
      entity_type,
      entity_id,
    });
    return;
  }

  // Generate description if not provided
  const finalDescription = description || generateDescription(action, entity_type);

  try {
    await env.DB.prepare(
      `INSERT INTO activities (project_id, user_id, action, entity_type, entity_id, description)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
      .bind(finalProjectId, userId, action, entity_type, entity_id, finalDescription)
      .run();
  } catch (error) {
    console.error('Failed to log activity:', error);
  }
}

/**
 * Middleware to automatically log activities
 * Usage: Apply this middleware to routes that should be logged
 *
 * The middleware will automatically:
 * 1. Detect the action from HTTP method and route
 * 2. Extract entity info from params/body
 * 3. Log the activity with appropriate description
 */
export const autoLogActivity = (
  entityType: EntityType,
  getEntityId: (c: Context<{ Bindings: Env }>) => number,
  getEntityName?: (c: Context<{ Bindings: Env }>) => string | Promise<string>,
  getProjectId?: (c: Context<{ Bindings: Env }>) => number | Promise<number>
) => {
  return async (c: Context<{ Bindings: Env }>, next: Next) => {
    const user = c.get('user');
    if (!user) {
      await next();
      return;
    }

    // Store original response to capture entity ID after creation
    await next();

    // Only log successful operations
    if (c.res.status < 200 || c.res.status >= 300) {
      return;
    }

    const method = c.req.method;
    const entityId = getEntityId(c);

    // Determine action based on HTTP method
    let action: Action;
    switch (method) {
      case 'POST':
        action = 'created';
        break;
      case 'PUT':
      case 'PATCH':
        action = 'updated';
        break;
      case 'DELETE':
        action = 'deleted';
        break;
      default:
        return; // Don't log GET requests
    }

    // Extract or generate description
    let description: string | undefined;
    if (getEntityName) {
      const name = await getEntityName(c);
      description = generateDescription(action, entityType, name);
    }

    // Get project ID
    let projectId: number | undefined;
    if (getProjectId) {
      projectId = await getProjectId(c);
    } else {
      projectId = extractProjectId(c);
    }

    // Log the activity
    await logActivity(c.env, user.id, {
      project_id: projectId,
      entity_type: entityType,
      entity_id: entityId,
      action,
      description,
    });
  };
};

/**
 * Helper middleware to log custom activities
 * Use this in route handlers for more control
 */
export const logCustomActivity = (
  entityType: EntityType,
  action: Action,
  getEntityId: (c: Context<{ Bindings: Env }>) => number,
  getDescription?: (c: Context<{ Bindings: Env }>) => string,
  getProjectId?: (c: Context<{ Bindings: Env }>) => number | Promise<number>
) => {
  return async (c: Context<{ Bindings: Env }>, next: Next) => {
    await next();

    if (c.res.status < 200 || c.res.status >= 300) {
      return;
    }

    const user = c.get('user');
    if (!user) return;

    const entityId = getEntityId(c);
    const description = getDescription?.(c);
    let projectId = getProjectId ? await getProjectId(c) : extractProjectId(c);

    await logActivity(c.env, user.id, {
      project_id: projectId,
      entity_type: entityType,
      entity_id: entityId,
      action,
      description,
    });
  };
};
