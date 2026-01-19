import { Hono } from 'hono';
import { ActivityService } from '../services/activity.service';
import { auth } from '../middleware/auth';
import { Env } from '../types';

const app = new Hono<{ Bindings: Env }>();

/**
 * GET /api/activities
 * Get recent activities for all projects
 */
app.get('/', auth, async (c) => {
  const service = new ActivityService(c.env);

  const limit = parseInt(c.req.query('limit') || '20');

  try {
    const activities = await service.getAllActivities(limit);
    return c.json(activities);
  } catch (error: any) {
    return c.json({ error: error.message || 'Failed to get activities' }, 500);
  }
});

/**
 * GET /api/activities/project/:projectId
 * Get activities for a specific project
 */
app.get('/project/:projectId', auth, async (c) => {
  const projectId = parseInt(c.req.param('projectId'));
  const service = new ActivityService(c.env);

  const limit = parseInt(c.req.query('limit') || '50');
  const offset = parseInt(c.req.query('offset') || '0');

  try {
    const activities = await service.getProjectActivities(
      projectId,
      limit,
      offset
    );
    return c.json(activities);
  } catch (error: any) {
    return c.json({ error: error.message || 'Failed to get activities' }, 500);
  }
});

/**
 * GET /api/activities/project/:projectId/stats
 * Get activity statistics for a project
 */
app.get('/project/:projectId/stats', auth, async (c) => {
  const projectId = parseInt(c.req.param('projectId'));
  const service = new ActivityService(c.env);

  try {
    const stats = await service.getActivityStats(projectId);
    return c.json(stats);
  } catch (error: any) {
    return c.json({ error: error.message || 'Failed to get stats' }, 500);
  }
});

/**
 * GET /api/activities/project/:projectId/:entityType/:entityId
 * Get activities for a specific entity
 */
app.get(
  '/project/:projectId/:entityType/:entityId',
  auth,
  async (c) => {
    const projectId = parseInt(c.req.param('projectId'));
    const entityType = c.req.param('entityType');
    const entityId = parseInt(c.req.param('entityId'));
    const service = new ActivityService(c.env);

    try {
      const activities = await service.getEntityActivities(
        projectId,
        entityType,
        entityId
      );
      return c.json(activities);
    } catch (error: any) {
      return c.json({ error: error.message || 'Failed to get activities' }, 500);
    }
  }
);

export default app;
