import { Hono } from 'hono';
import { AuthService } from '../services/auth.service';
import { Env } from '../types';

const app = new Hono<{ Bindings: Env }>();

/**
 * POST /api/auth/register
 * Register a new user
 */
app.post('/register', async (c) => {
  try {
    const { email, name, password } = await c.req.json();

    if (!email || !name || !password) {
      return c.json({ error: 'Email, name, and password are required' }, 400);
    }

    const service = new AuthService(c.env);
    const result = await service.register({ email, name, password });

    // Set token in HTTP-only cookie
    c.header('Set-Cookie', `token=${result.token}; HttpOnly; Secure; SameSite=Lax; Max-Age=3600; Path=/`);

    return c.json({
      user: result.user,
      token: result.token,
    });
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

    const service = new AuthService(c.env);
    const result = await service.login({ email, password });

    // Set token in HTTP-only cookie
    c.header('Set-Cookie', `token=${result.token}; HttpOnly; Secure; SameSite=Lax; Max-Age=3600; Path=/`);

    return c.json({
      user: result.user,
      token: result.token,
    });
  } catch (error: any) {
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

export default app;
