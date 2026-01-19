import { Hono } from 'hono';
import { AuthService } from '../services/auth.service';
import { Env } from '../types';

const app = new Hono<{ Bindings: Env }>();

/**
 * POST /api/auth/register
 * Register a new user (requires admin approval)
 */
app.post('/register', async (c) => {
  try {
    const { email, name, password } = await c.req.json();

    if (!email || !name || !password) {
      return c.json({ error: 'Email, name, and password are required' }, 400);
    }

    const service = new AuthService(c.env);
    const result = await service.register({ email, name, password });

    return c.json({
      message: 'Registration successful. Please wait for admin approval.',
      user: result.user,
    }, 201);
  } catch (error: any) {
    return c.json({ error: error.message || 'Registration failed' }, 400);
  }
});

/**
 * POST /api/auth/login
 * Login user
 */
app.post('/login', async (c) => {
  try {
    const { email, password } = await c.req.json();

    if (!email || !password) {
      return c.json({ error: 'Email and password are required' }, 400);
    }

    // Debug: Check if user exists
    const service = new AuthService(c.env);
    const userCheck = await c.env.DB.prepare(
      'SELECT id, email, name FROM users WHERE email = ?'
    ).bind(email).first();

    if (!userCheck) {
      console.log('User not found:', email);
      return c.json({ error: 'User not found' }, 404);
    }

    console.log('User found:', userCheck);

    const result = await service.login({ email, password });

    // Set token in HTTP-only cookie
    c.header('Set-Cookie', `token=${result.token}; HttpOnly; Secure; SameSite=Lax; Max-Age=3600; Path=/`);

    return c.json({
      user: result.user,
      token: result.token,
    });
  } catch (error: any) {
    console.log('Login error:', error.message);
    return c.json({ error: error.message || 'Login failed' }, 401);
  }
});

/**
 * POST /api/auth/logout
 * Logout user
 */
app.post('/logout', async (c) => {
  try {
    const token = c.req.header('Authorization')?.replace('Bearer ', '') || c.req.cookie('token');

    if (token) {
      const service = new AuthService(c.env);
      await service.logout(token);
    }

    // Clear cookie
    c.header('Set-Cookie', 'token=; HttpOnly; Secure; SameSite=Lax; Max-Age=0; Path=/');

    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ error: error.message || 'Logout failed' }, 500);
  }
});

/**
 * GET /api/auth/me
 * Get current user
 */
app.get('/me', async (c) => {
  try {
    const token = c.req.header('Authorization')?.replace('Bearer ', '') || c.req.cookie('token');

    if (!token) {
      return c.json({ error: 'Not authenticated' }, 401);
    }

    const service = new AuthService(c.env);
    const user = await service.getUserByToken(token);

    if (!user) {
      return c.json({ error: 'Invalid token' }, 401);
    }

    return c.json({ user });
  } catch (error: any) {
    return c.json({ error: error.message || 'Failed to get user' }, 500);
  }
});

/**
 * POST /api/auth/refresh
 * Refresh token
 */
app.post('/refresh', async (c) => {
  try {
    const token = c.req.header('Authorization')?.replace('Bearer ', '') || c.req.cookie('token');

    if (!token) {
      return c.json({ error: 'Not authenticated' }, 401);
    }

    const service = new AuthService(c.env);
    const user = await service.getUserByToken(token);

    if (!user) {
      return c.json({ error: 'Invalid token' }, 401);
    }

    // Generate new token
    const { generateToken } = await import('../utils/jwt');
    const newToken = await generateToken({
      userId: user.id,
      email: user.email,
    });

    // Delete old session and create new one
    await service.logout(token);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await c.env.DB.prepare(
      'INSERT INTO sessions (user_id, token, expires_at) VALUES (?, ?, ?)'
    ).bind(user.id, newToken, expiresAt.toISOString()).run();

    // Set new token in cookie
    c.header('Set-Cookie', `token=${newToken}; HttpOnly; Secure; SameSite=Lax; Max-Age=3600; Path=/`);

    return c.json({ token: newToken });
  } catch (error: any) {
    return c.json({ error: error.message || 'Failed to refresh token' }, 500);
  }
});

/**
 * DEBUG: List all users (remove in production)
 */
app.get('/debug/users', async (c) => {
  try {
    const users = await c.env.DB.prepare('SELECT id, email, name FROM users').all();
    return c.json({ count: users.results.length, users: users.results });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

/**
 * DEBUG: Test password verification (remove in production)
 */
app.post('/debug/test-password', async (c) => {
  try {
    const { email, password } = await c.req.json();

    // Get user with password hash
    const user = await c.env.DB.prepare(
      'SELECT id, email, name, password_hash FROM users WHERE email = ?'
    ).bind(email).first();

    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }

    // Test password verification
    const { verifyPassword } = await import('../utils/password');
    const isValid = await verifyPassword(password, user.password_hash as string);

    return c.json({
      email: user.email,
      hashLength: user.password_hash?.length,
      passwordLength: password.length,
      isValid,
    });
  } catch (error: any) {
    return c.json({ error: error.message, stack: error.stack }, 500);
  }
});

/**
 * DEBUG: Delete all users (WARNING: removes all user data)
 */
app.post('/debug/clear-users', async (c) => {
  try {
    await c.env.DB.prepare('DELETE FROM project_members').run();
    await c.env.DB.prepare('DELETE FROM projects').run();
    await c.env.DB.prepare('DELETE FROM sessions').run();
    await c.env.DB.prepare('DELETE FROM users').run();
    return c.json({ success: true, message: 'All user data cleared' });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

/**
 * GET /api/auth/pending
 * Get pending users (admin only)
 */
app.get('/pending', auth, async (c) => {
  try {
    const user = c.get('user');
    if (!user || user.is_admin !== 1) {
      return c.json({ error: 'Admin access required' }, 403);
    }

    const service = new AuthService(c.env);
    const pendingUsers = await service.getPendingUsers();

    return c.json({ users: pendingUsers });
  } catch (error: any) {
    return c.json({ error: error.message || 'Failed to get pending users' }, 500);
  }
});

/**
 * POST /api/auth/approve/:userId
 * Approve a pending user (admin only)
 */
app.post('/approve/:userId', auth, async (c) => {
  try {
    const user = c.get('user');
    if (!user || user.is_admin !== 1) {
      return c.json({ error: 'Admin access required' }, 403);
    }

    const userId = parseInt(c.req.param('userId'));
    if (isNaN(userId)) {
      return c.json({ error: 'Invalid user ID' }, 400);
    }

    const service = new AuthService(c.env);
    const success = await service.approveUser(userId);

    if (!success) {
      return c.json({ error: 'User not found' }, 404);
    }

    return c.json({ success: true, message: 'User approved successfully' });
  } catch (error: any) {
    return c.json({ error: error.message || 'Failed to approve user' }, 500);
  }
});

export default app;
