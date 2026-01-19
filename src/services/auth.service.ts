import { generateToken, generateRefreshToken, verifyToken, JWTPayload } from '../utils/jwt';
import { hashPassword, verifyPassword, validatePassword } from '../utils/password';
import { Env } from '../types';

export interface User {
  id: number;
  email: string;
  name: string;
}

export interface RegisterInput {
  email: string;
  name: string;
  password: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export class AuthService {
  constructor(private env: Env) {}

  /**
   * Register a new user
   */
  async register(input: RegisterInput): Promise<{ user: User; token: string } | null> {
    const { email, name, password } = input;

    // Validate password
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      throw new Error(passwordValidation.message);
    }

    // Check if user already exists
    const existingUser = await this.env.DB.prepare(
      'SELECT id FROM users WHERE email = ?'
    ).bind(email).first();

    if (existingUser) {
      throw new Error('User already exists');
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create user
    const result = await this.env.DB.prepare(
      'INSERT INTO users (email, name, password_hash) VALUES (?, ?, ?) RETURNING id, email, name'
    ).bind(email, name, passwordHash).first();

    if (!result) {
      throw new Error('Failed to create user');
    }

    const user: User = {
      id: result.id as number,
      email: result.email as string,
      name: result.name as string,
    };

    // Generate token
    const token = await generateToken({
      userId: user.id,
      email: user.email,
    });

    // Store session
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await this.env.DB.prepare(
      'INSERT INTO sessions (user_id, token, expires_at) VALUES (?, ?, ?)'
    ).bind(user.id, token, expiresAt.toISOString()).run();

    return { user, token };
  }

  /**
   * Login user
   */
  async login(input: LoginInput): Promise<{ user: User; token: string } | null> {
    const { email, password } = input;

    // Get user
    const userResult = await this.env.DB.prepare(
      'SELECT id, email, name, password_hash FROM users WHERE email = ?'
    ).bind(email).first();

    if (!userResult) {
      throw new Error('Invalid credentials');
    }

    // Verify password
    const isValid = await verifyPassword(password, userResult.password_hash as string);
    if (!isValid) {
      throw new Error('Invalid credentials');
    }

    const user: User = {
      id: userResult.id as number,
      email: userResult.email as string,
      name: userResult.name as string,
    };

    // Generate token
    const token = await generateToken({
      userId: user.id,
      email: user.email,
    });

    // Store session
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await this.env.DB.prepare(
      'INSERT INTO sessions (user_id, token, expires_at) VALUES (?, ?, ?)'
    ).bind(user.id, token, expiresAt.toISOString()).run();

    return { user, token };
  }

  /**
   * Get user by token
   */
  async getUserByToken(token: string): Promise<User | null> {
    const payload = await verifyToken(token);
    if (!payload) {
      return null;
    }

    // Check if session exists and is not expired
    const session = await this.env.DB.prepare(
      'SELECT s.*, u.id, u.email, u.name FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.token = ? AND s.expires_at > datetime("now")'
    ).bind(token).first();

    if (!session) {
      return null;
    }

    return {
      id: session.id as number,
      email: session.email as string,
      name: session.name as string,
    };
  }

  /**
   * Logout user (delete session)
   */
  async logout(token: string): Promise<void> {
    await this.env.DB.prepare(
      'DELETE FROM sessions WHERE token = ?'
    ).bind(token).run();
  }

  /**
   * Clean up expired sessions
   */
  async cleanupExpiredSessions(): Promise<void> {
    await this.env.DB.prepare(
      'DELETE FROM sessions WHERE expires_at < datetime("now")'
    ).run();
  }
}
