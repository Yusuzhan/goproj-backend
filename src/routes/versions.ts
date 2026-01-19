import { Hono } from 'hono';
import { VersionService } from '../services/version.service';
import { Env } from '../types';

const app = new Hono<{ Bindings: Env }>();

// List all versions
app.get('/', async (c) => {
  const service = new VersionService(c.env);
  const versions = await service.list();
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
app.post('/', async (c) => {
  const service = new VersionService(c.env);
  const data = await c.req.json();

  if (!data.name) {
    return c.json({ error: 'name is required' }, 400);
  }

  try {
    const version = await service.create(data);
    return c.json(version, 201);
  } catch (error) {
    return c.json({ error: 'Failed to create version' }, 500);
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
