import { Env } from '../types';

export class ImageService {
  constructor(private env: Env) {}

  async generateUploadUrl(filename: string, contentType: string) {
    // Generate unique key
    const timestamp = Date.now();
    const key = `${timestamp}-${filename}`;

    // In production, you would generate a presigned URL here
    // For local development, we'll return a mock URL
    return {
      uploadUrl: null, // Will be filled with presigned URL in production
      key,
      publicUrl: `/api/uploads/${key}`,
    };
  }

  async saveAttachment(
    issueId: number,
    filename: string,
    url: string,
    size: number,
    contentType: string,
    r2Key: string
  ) {
    const result = await this.env.DB.prepare(
      `INSERT INTO attachments (issue_id, filename, url, size, content_type, r2_key)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
      .bind(issueId, filename, url, size, contentType, r2Key)
      .run();

    if (!result.success) {
      throw new Error('Failed to save attachment');
    }

    return { id: result.meta.last_row_id };
  }

  async saveAttachmentWithData(
    issueId: number,
    filename: string,
    url: string,
    size: number,
    contentType: string,
    r2Key: string,
    imageData: string
  ) {
    const result = await this.env.DB.prepare(
      `INSERT INTO attachments (issue_id, filename, url, size, content_type, r2_key, image_data)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(issueId, filename, url, size, contentType, r2Key, imageData)
      .run();

    if (!result.success) {
      throw new Error('Failed to save attachment');
    }

    return { id: result.meta.last_row_id };
  }

  async getAttachmentByKey(key: string) {
    const result = await this.env.DB.prepare(
      'SELECT * FROM attachments WHERE r2_key = ?'
    )
      .bind(key)
      .first();

    return result;
  }

  async getAttachments(issueId: number) {
    const { results } = await this.env.DB.prepare(
      'SELECT * FROM attachments WHERE issue_id = ? ORDER BY created_at DESC'
    )
      .bind(issueId)
      .all();

    return results;
  }

  async deleteAttachment(id: number) {
    // Get attachment info first
    const attachment = await this.env.DB.prepare(
      'SELECT * FROM attachments WHERE id = ?'
    )
      .bind(id)
      .first();

    if (!attachment) {
      throw new Error('Attachment not found');
    }

    // Delete from R2 (in production)
    // await this.env.R2.delete(attachment.r2_key);

    // Delete from database
    await this.env.DB.prepare('DELETE FROM attachments WHERE id = ?')
      .bind(id)
      .run();

    return { success: true };
  }

  async uploadToR2(key: string, file: File): Promise<string> {
    // Upload to R2
    await this.env.R2.put(key, file);

    // Return public URL
    // In production, this would be your R2 public URL
    return `/api/images/${key}`;
  }

  async getStats() {
    const totalResult = await this.env.DB.prepare(
      'SELECT COUNT(*) as total FROM attachments'
    ).first();

    const sizeResult = await this.env.DB.prepare(
      'SELECT SUM(size) as total_size FROM attachments'
    ).first();

    return {
      total: totalResult?.total || 0,
      totalSize: sizeResult?.total_size || 0,
    };
  }
}
