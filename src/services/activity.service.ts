import { Env } from '../types';

export interface Activity {
  id: number;
  project_id: number;
  user_id: number;
  action: string;
  entity_type: string;
  entity_id: number;
  description: string;
  created_at: string;
  user_email?: string;
  user_name?: string;
}

export class ActivityService {
  constructor(private env: Env) {}

  /**
   * Get activities for a project
   */
  async getProjectActivities(
    projectId: number,
    limit: number = 50,
    offset: number = 0
  ): Promise<Activity[]> {
    const activities = await this.env.DB.prepare(
      `SELECT a.*,
              u.email as user_email,
              u.name as user_name
       FROM activities a
       JOIN users u ON a.user_id = u.id
       WHERE a.project_id = ?
       ORDER BY a.created_at DESC
       LIMIT ? OFFSET ?`
    )
      .bind(projectId, limit, offset)
      .all();

    return activities.results as Activity[];
  }

  /**
   * Get all recent activities
   */
  async getAllActivities(limit: number = 20): Promise<Activity[]> {
    const activities = await this.env.DB.prepare(
      `SELECT a.*,
              u.email as user_email,
              u.name as user_name
       FROM activities a
       JOIN users u ON a.user_id = u.id
       ORDER BY a.created_at DESC
       LIMIT ?`
    )
      .bind(limit)
      .all();

    return activities.results as Activity[];
  }

  /**
   * Get activities for a specific entity
   */
  async getEntityActivities(
    projectId: number,
    entityType: string,
    entityId: number
  ): Promise<Activity[]> {
    const activities = await this.env.DB.prepare(
      `SELECT a.*,
              u.email as user_email,
              u.name as user_name
       FROM activities a
       JOIN users u ON a.user_id = u.id
       WHERE a.project_id = ?
         AND a.entity_type = ?
         AND a.entity_id = ?
       ORDER BY a.created_at DESC`
    )
      .bind(projectId, entityType, entityId)
      .all();

    return activities.results as Activity[];
  }

  /**
   * Get activity count by type for a project
   */
  async getActivityStats(projectId: number): Promise<{
    total: number;
    by_type: Record<string, number>;
    by_action: Record<string, number>;
  }> {
    // Get total count
    const totalResult = await this.env.DB.prepare(
      'SELECT COUNT(*) as count FROM activities WHERE project_id = ?'
    )
      .bind(projectId)
      .first();

    const total = (totalResult?.count as number) || 0;

    // Get count by entity type
    const byTypeResult = await this.env.DB.prepare(
      'SELECT entity_type, COUNT(*) as count FROM activities WHERE project_id = ? GROUP BY entity_type'
    )
      .bind(projectId)
      .all();

    const by_type: Record<string, number> = {};
    for (const row of byTypeResult.results || []) {
      by_type[row.entity_type] = row.count;
    }

    // Get count by action
    const byActionResult = await this.env.DB.prepare(
      'SELECT action, COUNT(*) as count FROM activities WHERE project_id = ? GROUP BY action'
    )
      .bind(projectId)
      .all();

    const by_action: Record<string, number> = {};
    for (const row of byActionResult.results || []) {
      by_action[row.action] = row.count;
    }

    return {
      total,
      by_type,
      by_action,
    };
  }
}
