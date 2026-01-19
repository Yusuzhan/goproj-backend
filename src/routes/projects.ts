import { Hono } from 'hono';
import { ProjectService } from '../services/project.service';
import { auth } from '../middleware/auth';
import { Env } from '../types';

const app = new Hono<{ Bindings: Env }>();

/**
 * DEBUG: List all projects with members
 */
app.get('/debug/all', async (c) => {
  try {
    const projects = await c.env.DB.prepare(
      `SELECT p.*,
        (SELECT COUNT(*) FROM project_members WHERE project_id = p.id) as member_count
       FROM projects p`
    ).all();

    const members = await c.env.DB.prepare(
      `SELECT pm.*, u.email, u.name
       FROM project_members pm
       JOIN users u ON pm.user_id = u.id`
    ).all();

    return c.json({
      projects: projects.results,
      members: members.results,
    });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

/**
 * GET /api/projects
 * Get all projects for authenticated user
 */
app.get('/', auth, async (c) => {
  const user = c.get('user');
  const service = new ProjectService(c.env);

  const projects = await service.getUserProjects(user.id);
  return c.json(projects);
});

/**
 * GET /api/projects/:id
 * Get project by ID
 */
app.get('/:id', auth, async (c) => {
  const projectId = parseInt(c.req.param('id'));
  const service = new ProjectService(c.env);

  const project = await service.getProjectById(projectId);

  if (!project) {
    return c.json({ error: 'Project not found' }, 404);
  }

  return c.json(project);
});

/**
 * POST /api/projects
 * Create new project
 */
app.post('/', auth, async (c) => {
  const user = c.get('user');
  const service = new ProjectService(c.env);

  try {
    const input = await c.req.json();

    if (!input.name) {
      return c.json({ error: 'Project name is required' }, 400);
    }

    const project = await service.createProject(user.id, input);
    return c.json(project, 201);
  } catch (error: any) {
    return c.json({ error: error.message || 'Failed to create project' }, 500);
  }
});

/**
 * PUT /api/projects/:id
 * Update project
 */
app.put('/:id', auth, async (c) => {
  const projectId = parseInt(c.req.param('id'));
  const user = c.get('user');
  const service = new ProjectService(c.env);

  try {
    const input = await c.req.json();
    const project = await service.updateProject(projectId, user.id, input);

    if (!project) {
      return c.json({ error: 'Project not found' }, 404);
    }

    return c.json(project);
  } catch (error: any) {
    return c.json({ error: error.message || 'Failed to update project' }, 500);
  }
});

/**
 * DELETE /api/projects/:id
 * Delete project
 */
app.delete('/:id', auth, async (c) => {
  const projectId = parseInt(c.req.param('id'));
  const user = c.get('user');
  const service = new ProjectService(c.env);

  try {
    await service.deleteProject(projectId, user.id);
    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ error: error.message || 'Failed to delete project' }, 500);
  }
});

export default app;
