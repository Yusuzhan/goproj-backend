import { Hono } from 'hono';
import { cors } from './middleware/cors';
import issuesRouter from './routes/issues';
import versionsRouter from './routes/versions';
import imagesRouter from './routes/images';
import authRouter from './routes/auth';
import projectsRouter from './routes/projects';
import activitiesRouter from './routes/activities';
import { Env } from './types';

const app = new Hono<{ Bindings: Env }>();

// Middleware
app.use('*', cors);

// Health check
app.get('/', (c) => c.json({ message: 'GoProj API', version: '1.0.0' }));

// Initialize database (for local development)
app.post('/api/init-db', async (c) => {
  try {
    const statements = [
      'CREATE TABLE IF NOT EXISTS issues (id INTEGER PRIMARY KEY AUTOINCREMENT, type TEXT NOT NULL CHECK(type IN (\'bug\', \'requirement\', \'task\')), title TEXT NOT NULL, status TEXT NOT NULL DEFAULT \'open\' CHECK(status IN (\'open\', \'in_progress\', \'resolved\', \'closed\')), priority TEXT NOT NULL DEFAULT \'medium\' CHECK(priority IN (\'low\', \'medium\', \'high\', \'critical\')), version TEXT, assignee TEXT, description TEXT DEFAULT \'\', created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (version) REFERENCES versions(name) ON DELETE SET NULL);',
      'CREATE TABLE IF NOT EXISTS comments (id INTEGER PRIMARY KEY AUTOINCREMENT, issue_id INTEGER NOT NULL, author TEXT NOT NULL, content TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (issue_id) REFERENCES issues(id) ON DELETE CASCADE);',
      'CREATE TABLE IF NOT EXISTS attachments (id INTEGER PRIMARY KEY AUTOINCREMENT, issue_id INTEGER NOT NULL, filename TEXT NOT NULL, url TEXT NOT NULL, size INTEGER NOT NULL, content_type TEXT NOT NULL, r2_key TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (issue_id) REFERENCES issues(id) ON DELETE CASCADE);',
      'CREATE TABLE IF NOT EXISTS versions (name TEXT PRIMARY KEY, status TEXT NOT NULL DEFAULT \'planned\' CHECK(status IN (\'planned\', \'in_progress\', \'released\')), description TEXT DEFAULT \'\', created_at DATETIME DEFAULT CURRENT_TIMESTAMP, released_at DATETIME);',
      'CREATE INDEX IF NOT EXISTS idx_issues_type ON issues(type);',
      'CREATE INDEX IF NOT EXISTS idx_issues_status ON issues(status);',
      'CREATE INDEX IF NOT EXISTS idx_issues_priority ON issues(priority);',
      'CREATE INDEX IF NOT EXISTS idx_issues_version ON issues(version);',
      'CREATE INDEX IF NOT EXISTS idx_issues_created_at ON issues(created_at DESC);',
      'CREATE INDEX IF NOT EXISTS idx_comments_issue_id ON comments(issue_id);',
      'CREATE INDEX IF NOT EXISTS idx_attachments_issue_id ON attachments(issue_id);',
      'CREATE TRIGGER IF NOT EXISTS update_issues_timestamp AFTER UPDATE ON issues BEGIN UPDATE issues SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id; END;'
    ];

    for (const statement of statements) {
      await c.env.DB.exec(statement);
    }

    return c.json({ success: true, message: 'Database initialized successfully' });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Routes
app.route('/api/auth', authRouter);
app.route('/api/projects', projectsRouter);
app.route('/api/issues', issuesRouter);
app.route('/api/versions', versionsRouter);
app.route('/api/images', imagesRouter);
app.route('/api/activities', activitiesRouter);

export default app;
