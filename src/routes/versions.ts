import { Hono } from 'hono';
import { VersionService } from '../services/version.service';
import { auth } from '../middleware/auth';
import { Env } from '../types';

const app = new Hono<{ Bindings: Env }>();

// List all versions
app.get('/', auth, async (c) => {
  const service = new VersionService(c.env);
  const projectId = c.req.query('project_id');
  const versions = await service.list(projectId ? parseInt(projectId) : undefined);
  return c.json(versions);
});

// Get version by name
app.get('/:name', async (c) => {
  const service = new VersionService(c.env);
  const name = c.req.param('name');
  const version = await service.getByName(name);

  if (!version) {
    return c.json({ error: 'Version not found' }, 404);
  }

  return c.json(version);
});

// Get version statistics
app.get('/:name/stats', async (c) => {
  const service = new VersionService(c.env);
  const name = c.req.param('name');
  const stats = await service.getStats(name);

  if (!stats) {
    return c.json({ error: 'Version not found' }, 404);
  }

  return c.json(stats);
});

// Create version
app.post('/', auth, async (c) => {
  const user = c.get('user');
  const service = new VersionService(c.env);
  const data = await c.req.json();

  if (!data.name || !data.project_id) {
    return c.json({ error: 'name and project_id are required' }, 400);
  }

  try {
    const versionData = {
      ...data,
      created_by: user.id,
    };
    const version = await service.create(versionData);
    return c.json(version, 201);
  } catch (error: any) {
    return c.json({ error: error.message || 'Failed to create version' }, 500);
  }
});

// Update version
app.put('/:name', async (c) => {
  const service = new VersionService(c.env);
  const name = c.req.param('name');
  const data = await c.req.json();

  try {
    const version = await service.update(name, data);
    if (!version) {
      return c.json({ error: 'Version not found' }, 404);
    }
    return c.json(version);
  } catch (error) {
    return c.json({ error: 'Failed to update version' }, 500);
  }
});

// Patch version (partial update)
app.patch('/:name', async (c) => {
  const service = new VersionService(c.env);
  const name = c.req.param('name');
  const data = await c.req.json();

  try {
    const version = await service.update(name, data);
    if (!version) {
      return c.json({ error: 'Version not found' }, 404);
    }
    return c.json(version);
  } catch (error) {
    return c.json({ error: 'Failed to update version' }, 500);
  }
});

// Delete version
app.delete('/:name', async (c) => {
  const service = new VersionService(c.env);
  const name = c.req.param('name');

  await service.delete(name);
  return c.json({ success: true });
});

export default app;
