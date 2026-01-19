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

export interface ProjectMember {
  id: number;
  project_id: number;
  user_id: number;
  role: string;
  joined_at: string;
  email?: string;
  name?: string;
}

export interface AddMemberInput {
  user_id: number;
  role: 'owner' | 'admin' | 'member' | 'viewer';
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

  /**
   * Get all members of a project
   */
  async getProjectMembers(projectId: number): Promise<ProjectMember[]> {
    const members = await this.env.DB.prepare(
      `SELECT pm.id, pm.project_id, pm.user_id, pm.role, pm.joined_at,
              u.email, u.name
       FROM project_members pm
       JOIN users u ON pm.user_id = u.id
       WHERE pm.project_id = ?
       ORDER BY pm.joined_at ASC`
    )
      .bind(projectId)
      .all();

    return members.results as ProjectMember[];
  }

  /**
   * Get a user's role in a project
   */
  async getMemberRole(projectId: number, userId: number): Promise<string | null> {
    const result = await this.env.DB.prepare(
      'SELECT role FROM project_members WHERE project_id = ? AND user_id = ?'
    )
      .bind(projectId, userId)
      .first();

    return (result?.role as string) || null;
  }

  /**
   * Add a member to a project
   */
  async addMember(
    projectId: number,
    userId: number,
    input: AddMemberInput
  ): Promise<ProjectMember> {
    // Check if user is already a member
    const existing = await this.env.DB.prepare(
      'SELECT id FROM project_members WHERE project_id = ? AND user_id = ?'
    )
      .bind(projectId, input.user_id)
      .first();

    if (existing) {
      throw new Error('User is already a member of this project');
    }

    // Check if target user exists
    const targetUser = await this.env.DB.prepare(
      'SELECT id, email, name FROM users WHERE id = ?'
    )
      .bind(input.user_id)
      .first();

    if (!targetUser) {
      throw new Error('User not found');
    }

    // Add member
    const result = await this.env.DB.prepare(
      `INSERT INTO project_members (project_id, user_id, role)
       VALUES (?, ?, ?)
       RETURNING id, project_id, user_id, role, joined_at`
    )
      .bind(projectId, input.user_id, input.role)
      .first();

    if (!result) {
      throw new Error('Failed to add member');
    }

    return {
      ...result,
      email: targetUser.email,
      name: targetUser.name,
    } as ProjectMember;
  }

  /**
   * Remove a member from a project
   */
  async removeMember(
    projectId: number,
    userId: number,
    targetUserId: number
  ): Promise<boolean> {
    // Check if requester is owner or admin
    const requesterRole = await this.getMemberRole(projectId, userId);

    if (!requesterRole || !['owner', 'admin'].includes(requesterRole)) {
      throw new Error('Only project owners and admins can remove members');
    }

    // Owners cannot remove themselves
    if (userId === targetUserId && requesterRole === 'owner') {
      throw new Error('Owners cannot remove themselves. Transfer ownership first.');
    }

    // Admins cannot remove owners or other admins
    if (requesterRole === 'admin') {
      const targetRole = await this.getMemberRole(projectId, targetUserId);
      if (targetRole === 'owner' || targetRole === 'admin') {
        throw new Error('Admins cannot remove owners or other admins');
      }
    }

    const result = await this.env.DB.prepare(
      'DELETE FROM project_members WHERE project_id = ? AND user_id = ?'
    )
      .bind(projectId, targetUserId)
      .run();

    return (result.meta.changes || 0) > 0;
  }

  /**
   * Update a member's role
   */
  async updateMemberRole(
    projectId: number,
    userId: number,
    targetUserId: number,
    newRole: string
  ): Promise<ProjectMember | null> {
    // Check if requester is owner
    const requesterRole = await this.getMemberRole(projectId, userId);

    if (requesterRole !== 'owner') {
      throw new Error('Only project owners can change member roles');
    }

    // Cannot change own role
    if (userId === targetUserId) {
      throw new Error('Cannot change your own role');
    }

    // Validate role
    const validRoles = ['owner', 'admin', 'member', 'viewer'];
    if (!validRoles.includes(newRole)) {
      throw new Error('Invalid role');
    }

    // Update role
    const result = await this.env.DB.prepare(
      `UPDATE project_members
       SET role = ?
       WHERE project_id = ? AND user_id = ?
       RETURNING id, project_id, user_id, role, joined_at`
    )
      .bind(newRole, projectId, targetUserId)
      .first();

    if (!result) {
      return null;
    }

    // Get user info
    const user = await this.env.DB.prepare(
      'SELECT email, name FROM users WHERE id = ?'
    )
      .bind(targetUserId)
      .first();

    return {
      ...result,
      email: user?.email,
      name: user?.name,
    } as ProjectMember | null;
  }
}
