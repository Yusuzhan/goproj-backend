import { Env } from '../types';

export class VersionService {
  constructor(private env: Env) {}

  async list() {
    const { results } = await this.env.DB.prepare(
      'SELECT * FROM versions ORDER BY created_at DESC'
    ).all();

    return results;
  }

  async getByName(name: string) {
    const result = await this.env.DB.prepare(
      'SELECT * FROM versions WHERE name = ?'
    )
      .bind(name)
      .first();

    return result;
  }

  async create(data: {
    name: string;
    status?: string;
    description?: string;
  }) {
    const result = await this.env.DB.prepare(
      `INSERT INTO versions (name, status, description)
       VALUES (?, ?, ?)`
    )
      .bind(
        data.name,
        data.status || 'planned',
        data.description || ''
      )
      .run();

    if (!result.success) {
      throw new Error('Failed to create version');
    }

    return this.getByName(data.name);
  }

  async update(name: string, data: {
    status?: string;
    description?: string;
    released_at?: string;
  }) {
    const fields: string[] = [];
    const params: any[] = [];

    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined) {
        fields.push(`${key} = ?`);
        params.push(value);
      }
    });

    if (fields.length === 0) {
      return this.getByName(name);
    }

    params.push(name);

    await this.env.DB.prepare(
      `UPDATE versions SET ${fields.join(', ')} WHERE name = ?`
    )
      .bind(...params)
      .run();

    return this.getByName(name);
  }

  async delete(name: string) {
    await this.env.DB.prepare('DELETE FROM versions WHERE name = ?')
      .bind(name)
      .run();
  }

  async getStats(name: string) {
    const version = await this.getByName(name);

    if (!version) {
      return null;
    }

    // Get issue counts by status
    const { results: statusStats } = await this.env.DB.prepare(
      `SELECT status, COUNT(*) as count
       FROM issues
       WHERE version = ?
       GROUP BY status`
    )
      .bind(name)
      .all();

    // Get issue counts by type
    const { results: typeStats } = await this.env.DB.prepare(
      `SELECT type, COUNT(*) as count
       FROM issues
       WHERE version = ?
       GROUP BY type`
    )
      .bind(name)
      .all();

    // Get total issues
    const totalResult = await this.env.DB.prepare(
      'SELECT COUNT(*) as total FROM issues WHERE version = ?'
    )
      .bind(name)
      .first();

    return {
      version,
      stats: {
        total: totalResult?.total || 0,
        byStatus: statusStats,
        byType: typeStats,
      },
    };
  }
}
