import { Env } from '../types';

export class IssueService {
  constructor(private env: Env) {}

  async list(filters: {
    type?: string;
    status?: string;
    priority?: string;
    version?: string;
    limit?: number;
    offset?: number;
  }) {
    const conditions: string[] = [];
    const params: any[] = [];

    if (filters.type) {
      conditions.push('type = ?');
      params.push(filters.type);
    }
    if (filters.status) {
      conditions.push('status = ?');
      params.push(filters.status);
    }
    if (filters.priority) {
      conditions.push('priority = ?');
      params.push(filters.priority);
    }
    if (filters.version) {
      conditions.push('version = ?');
      params.push(filters.version);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = filters.limit || 50;
    const offset = filters.offset || 0;

    const { results } = await this.env.DB.prepare(
      `SELECT * FROM issues ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`
    )
      .bind(...params, limit, offset)
      .all();

    return results;
  }

  async getById(id: number) {
    const result = await this.env.DB.prepare('SELECT * FROM issues WHERE id = ?')
      .bind(id)
      .first();

    return result;
  }

  async create(data: any) {
    const result = await this.env.DB.prepare(
      `INSERT INTO issues (type, title, status, priority, version, assignee, description)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        data.type,
        data.title,
        data.status || 'open',
        data.priority || 'medium',
        data.version || null,
        data.assignee || null,
        data.description || ''
      )
      .run();

    if (!result.success) {
      throw new Error('Failed to create issue');
    }

    return this.getById(result.meta.last_row_id);
  }

  async update(id: number, data: any) {
    const fields: string[] = [];
    const params: any[] = [];

    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined && key !== 'id') {
        fields.push(`${key} = ?`);
        params.push(value);
      }
    });

    if (fields.length === 0) {
      return this.getById(id);
    }

    params.push(id);

    await this.env.DB.prepare(
      `UPDATE issues SET ${fields.join(', ')} WHERE id = ?`
    )
      .bind(...params)
      .run();

    return this.getById(id);
  }

  async delete(id: number) {
    await this.env.DB.prepare('DELETE FROM issues WHERE id = ?')
      .bind(id)
      .run();
  }

  async getComments(issueId: number) {
    const { results } = await this.env.DB.prepare(
      'SELECT * FROM comments WHERE issue_id = ? ORDER BY created_at ASC'
    )
      .bind(issueId)
      .all();

    return results;
  }

  async addComment(issueId: number, author: string, content: string) {
    const result = await this.env.DB.prepare(
      'INSERT INTO comments (issue_id, author, content) VALUES (?, ?, ?)'
    )
      .bind(issueId, author, content)
      .run();

    if (!result.success) {
      throw new Error('Failed to create comment');
    }

    return this.getById(issueId);
  }
}
