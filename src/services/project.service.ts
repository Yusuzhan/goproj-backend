import { Env } from '../types';

export interface Project {
  id: number;
  name: string;
  description: string;
  icon: string;
  color: string;
  created_by: number;
  created_at: string;
  updated_at: string;
}

export interface CreateProjectInput {
  name: string;
  description?: string;
  icon?: string;
  color?: string;
}

export class ProjectService {
  constructor(private env: Env) {}

  /**
   * Create a new project
   * User becomes owner automatically
   */
  async createProject(userId: number, input: CreateProjectInput): Promise<Project> {
    const { name, description = '', icon = 'folder', color = '#1976D2' } = input;

    // Create project
    const result = await this.env.DB.prepare(
      `INSERT INTO projects (name, description, icon, color, created_by)
       VALUES (?, ?, ?, ?, ?)
       RETURNING id, name, description, icon, color, created_by, created_at, updated_at`
    )
      .bind(name, description, icon, color, userId)
      .first();

    if (!result) {
      throw new Error('Failed to create project');
    }

    const project = result as Project;

    // Add creator as owner
    await this.env.DB.prepare(
      `INSERT INTO project_members (project_id, user_id, role)
       VALUES (?, ?, 'owner')`
    ).bind(project.id, userId).run();

    return project;
  }

  /**
   * Get all projects for user
   */
  async getUserProjects(userId: number): Promise<Project[]> {
    const projects = await this.env.DB.prepare(
      `SELECT DISTINCT p.*
       FROM projects p
       INNER JOIN project_members pm ON p.id = pm.project_id
       WHERE pm.user_id = ?
       ORDER BY p.updated_at DESC`
    )
      .bind(userId)
      .all();

    return projects.results as Project[];
  }

  /**
   * Get project by ID
   */
  async getProjectById(projectId: number): Promise<Project | null> {
    const result = await this.env.DB.prepare(
      'SELECT * FROM projects WHERE id = ?'
    )
      .bind(projectId)
      .first();

    return result as Project | null;
  }

  /**
   * Update project
   */
  async updateProject(
    projectId: number,
    userId: number,
    input: Partial<CreateProjectInput>
  ): Promise<Project | null> {
    const updates: string[] = [];
    const values: any[] = [];

    if (input.name !== undefined) {
      updates.push('name = ?');
      values.push(input.name);
    }
    if (input.description !== undefined) {
      updates.push('description = ?');
      values.push(input.description);
    }
    if (input.icon !== undefined) {
      updates.push('icon = ?');
      values.push(input.icon);
    }
    if (input.color !== undefined) {
      updates.push('color = ?');
      values.push(input.color);
    }

    if (updates.length === 0) {
      return this.getProjectById(projectId);
    }

    values.push(projectId);

    const result = await this.env.DB.prepare(
      `UPDATE projects SET ${updates.join(', ')} WHERE id = ? RETURNING *`
    )
      .bind(...values)
      .first();

    return result as Project | null;
  }

  /**
   * Delete project
   */
  async deleteProject(projectId: number, userId: number): Promise<boolean> {
    // Check if user is owner
    const member = await this.env.DB.prepare(
      'SELECT role FROM project_members WHERE project_id = ? AND user_id = ?'
    )
      .bind(projectId, userId)
      .first();

    if (!member || member.role !== 'owner') {
      throw new Error('Only project owner can delete the project');
    }

    const result = await this.env.DB.prepare('DELETE FROM projects WHERE id = ?')
      .bind(projectId)
      .run();

    return (result.meta.changes || 0) > 0;
  }
}
