import { Hono } from 'hono';
import { IssueService } from '../services/issue.service';
import { Env } from '../types';

const app = new Hono<{ Bindings: Env }>();

// List issues
app.get('/', async (c) => {
  const service = new IssueService(c.env);
  const type = c.req.query('type');
  const status = c.req.query('status');
  const priority = c.req.query('priority');
  const version = c.req.query('version');
  const limit = parseInt(c.req.query('limit') || '50');
  const offset = parseInt(c.req.query('offset') || '0');

  const issues = await service.list({ type, status, priority, version, limit, offset });
  return c.json(issues);
});

// Get issue by ID
app.get('/:id', async (c) => {
  const service = new IssueService(c.env);
  const id = parseInt(c.req.param('id'));
  const issue = await service.getById(id);

  if (!issue) {
    return c.json({ error: 'Issue not found' }, 404);
  }

  return c.json(issue);
});

// Create issue
app.post('/', async (c) => {
  const service = new IssueService(c.env);
  const data = await c.req.json();

  try {
    const issue = await service.create(data);
    return c.json(issue, 201);
  } catch (error) {
    return c.json({ error: 'Failed to create issue' }, 500);
  }
});

// Update issue
app.put('/:id', async (c) => {
  const service = new IssueService(c.env);
  const id = parseInt(c.req.param('id'));
  const data = await c.req.json();

  try {
    const issue = await service.update(id, data);
    if (!issue) {
      return c.json({ error: 'Issue not found' }, 404);
    }
    return c.json(issue);
  } catch (error) {
    return c.json({ error: 'Failed to update issue' }, 500);
  }
});

// Patch issue (partial update)
app.patch('/:id', async (c) => {
  const service = new IssueService(c.env);
  const id = parseInt(c.req.param('id'));
  const data = await c.req.json();

  try {
    const issue = await service.update(id, data);
    if (!issue) {
      return c.json({ error: 'Issue not found' }, 404);
    }
    return c.json(issue);
  } catch (error) {
    return c.json({ error: 'Failed to update issue' }, 500);
  }
});

// Delete issue
app.delete('/:id', async (c) => {
  const service = new IssueService(c.env);
  const id = parseInt(c.req.param('id'));

  await service.delete(id);
  return c.json({ success: true });
});

// Get comments
app.get('/:id/comments', async (c) => {
  const service = new IssueService(c.env);
  const id = parseInt(c.req.param('id'));
  const comments = await service.getComments(id);
  return c.json(comments);
});

// Add comment
app.post('/:id/comments', async (c) => {
  const service = new IssueService(c.env);
  const id = parseInt(c.req.param('id'));
  const { author, content } = await c.req.json();

  if (!author || !content) {
    return c.json({ error: 'author and content are required' }, 400);
  }

  try {
    const issue = await service.addComment(id, author, content);
    return c.json(issue);
  } catch (error) {
    return c.json({ error: 'Failed to add comment' }, 500);
  }
});

export default app;
