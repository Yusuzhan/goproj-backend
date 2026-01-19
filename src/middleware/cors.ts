import { MiddlewareHandler } from 'hono';
import { Env } from '../types';

export const cors: MiddlewareHandler<{ Bindings: Env }> = async (c, next) => {
  const origin = c.req.header('Origin') || '';
  const allowedOrigins = c.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:5173'];

  if (allowedOrigins.includes(origin)) {
    c.header('Access-Control-Allow-Origin', origin);
  }

  c.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  c.header('Access-Control-Allow-Credentials', 'true');
  c.header('Access-Control-Max-Age', '86400');

  if (c.req.method === 'OPTIONS') {
    return c.text('', 204);
  }

  await next();
};
