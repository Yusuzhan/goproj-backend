import { Hono } from 'hono';
import { ImageService } from '../services/image.service';
import { Env } from '../types';

const app = new Hono<{ Bindings: Env }>();

// Generate upload URL
app.post('/upload-url', async (c) => {
  const service = new ImageService(c.env);
  const { filename, contentType } = await c.req.json();

  if (!filename || !contentType) {
    return c.json({ error: 'filename and contentType are required' }, 400);
  }

  const result = await service.generateUploadUrl(filename, contentType);
  return c.json(result);
});

// Upload image directly
app.post('/upload', async (c) => {
  const service = new ImageService(c.env);

  try {
    const formData = await c.req.formData();
    const file = formData.get('file') as File;
    const issueId = parseInt(formData.get('issueId') as string);

    if (!file || !issueId) {
      return c.json({ error: 'file and issueId are required' }, 400);
    }

    // Generate key with 'images/' prefix for R2
    const timestamp = Date.now();
    const key = `images/${timestamp}-${file.name}`;

    // Upload to R2
    await c.env.R2.put(key, file);

    // Generate public URL for R2
    // Return full URL for frontend to access
    const url = `https://goproj-backend.yusuzhan.workers.dev/api/images/${key}`;
    const size = file.size;
    const contentType = file.type;

    // Save attachment metadata to database (without image_data for R2)
    const attachment = await service.saveAttachment(
      issueId,
      file.name,
      url,
      size,
      contentType,
      key
    );

    return c.json({
      id: attachment.id,
      filename: file.name,
      url,
      size,
      contentType,
    });
  } catch (error: any) {
    return c.json({ error: error.message || 'Upload failed' }, 500);
  }
});

// Get attachments for issue
app.get('/issue/:issueId', async (c) => {
  const service = new ImageService(c.env);
  const issueId = parseInt(c.req.param('issueId'));
  const attachments = await service.getAttachments(issueId);
  return c.json(attachments);
});

// Delete attachment
app.delete('/:id', async (c) => {
  const service = new ImageService(c.env);
  const id = parseInt(c.req.param('id'));

  try {
    await service.deleteAttachment(id);
    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ error: error.message }, 404);
  }
});

// Get storage stats
app.get('/stats', async (c) => {
  const service = new ImageService(c.env);
  const stats = await service.getStats();
  return c.json(stats);
});

// Serve uploaded images from R2
app.get('/*', async (c) => {
  const service = new ImageService(c.env);

  try {
    // Extract the key from the URL path
    // URL format: /api/images/{key}
    const path = c.req.path;
    const key = path.replace('/api/images/', '');

    console.log(`Fetching image with key: ${key}`);
    console.log(`Request path: ${path}`);

    // Get image from R2
    const object = await c.env.R2.get(key);

    if (!object) {
      console.log(`Image not found in R2: ${key}`);
      return c.json({ error: 'Image not found', key }, 404);
    }

    // Get metadata to determine content type
    const attachment = await service.getAttachmentByKey(key);
    const contentType = attachment?.content_type || 'image/jpeg';

    // Return image with proper headers
    return new Response(object.body, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000', // Cache for 1 year
      },
    });
  } catch (error: any) {
    return c.text('Error loading image', 500);
  }
});

export default app;
