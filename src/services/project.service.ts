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

    return result as Project;
  }

  /**
   * Get all projects
   */
  async getAllProjects(): Promise<Project[]> {
    const projects = await this.env.DB.prepare(
      'SELECT * FROM projects ORDER BY updated_at DESC'
    ).all();

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
  async deleteProject(projectId: number): Promise<boolean> {
    const result = await this.env.DB.prepare('DELETE FROM projects WHERE id = ?')
      .bind(projectId)
      .run();

    return (result.meta.changes || 0) > 0;
  }
}
