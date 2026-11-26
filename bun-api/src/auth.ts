import jwt from 'jsonwebtoken';
import { password as bunPassword } from 'bun';
import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import pool from './db';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || Buffer.byteLength(JWT_SECRET) < 32) {
  throw new Error('JWT_SECRET harus memiliki sedikitnya 32 byte');
}
const secret: string = JWT_SECRET;
const secureCookie = process.env.COOKIE_SECURE === 'true' ? '; Secure' : '';

export interface UserPayload {
  id: number;
  clinic_id: number;
  name: string;
  email: string;
  role: 'admin' | 'manager' | 'staff' | 'cashier' | 'patient';
  phone?: string;
  clinic_name?: string;
  session_id: string;
}

interface SessionToken {
  sid: string;
  csrf: string;
}

function getCookie(req: Request, name: string): string | null {
  const cookies = req.headers.get('Cookie')?.split(';') || [];
  const cookie = cookies.map(value => value.trim()).find(value => value.startsWith(`${name}=`));
  return cookie ? cookie.slice(name.length + 1) : null;
}

function verifySessionToken(req: Request): SessionToken | null {
  const token = getCookie(req, 'klinikflow_session');
  if (!token) return null;
  try {
    const payload = jwt.verify(token, secret, {
      algorithms: ['HS256'], issuer: 'klinikflow', audience: 'klinikflow-web',
    }) as jwt.JwtPayload;
    if (typeof payload.sid !== 'string' || typeof payload.csrf !== 'string' || typeof payload.exp !== 'number') return null;
    return { sid: payload.sid, csrf: payload.csrf };
  } catch {
    return null;
  }
}

export async function extractAuthUser(req: Request): Promise<UserPayload | null> {
  const token = verifySessionToken(req);
  if (!token) return null;
  const [rows] = await pool.query<any[]>(
    `SELECT u.id, u.clinic_id, u.name, u.email, u.role, u.phone, c.name AS clinic_name
     FROM auth_sessions s JOIN users u ON u.id = s.user_id
     JOIN clinics c ON c.id = u.clinic_id
     WHERE s.id = ? AND s.expires_at > NOW()`, [token.sid]
  );
  return rows.length ? { ...rows[0], session_id: token.sid } : null;
}

export function validateCsrf(req: Request): boolean {
  const token = verifySessionToken(req);
  const header = req.headers.get('X-CSRF-Token');
  const cookie = getCookie(req, 'klinikflow_csrf');
  if (!token || !header || !cookie || header !== cookie) return false;
  const expected = Buffer.from(token.csrf);
  const actual = Buffer.from(header);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function sessionCookies(session: string, csrf: string, maxAge: number): Headers {
  const headers = new Headers();
  headers.append('Set-Cookie', `klinikflow_session=${session}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secureCookie}`);
  headers.append('Set-Cookie', `klinikflow_csrf=${csrf}; Path=/; SameSite=Strict; Max-Age=${maxAge}${secureCookie}`);
  return headers;
}

export async function handleLogin(req: Request): Promise<Response> {
  try {
    const { email, password } = await req.json();
    if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) {
      return Response.json({ success: false, error: 'Email dan password wajib diisi' }, { status: 400 });
    }
    const [rows] = await pool.query<any[]>(
      `SELECT u.*, c.name AS clinic_name FROM users u JOIN clinics c ON u.clinic_id = c.id WHERE u.email = ?`, [email]
    );
    if (!rows.length || !await bunPassword.verify(password, rows[0].password)) {
      return Response.json({ success: false, error: 'Kredensial login klinik tidak valid' }, { status: 401 });
    }
    const user = rows[0];
    const sessionId = randomUUID();
    const csrf = randomBytes(32).toString('hex');
    await pool.query('INSERT INTO auth_sessions (id, user_id, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 1 HOUR))', [sessionId, user.id]);
    const token = jwt.sign({ sid: sessionId, csrf }, secret, {
      algorithm: 'HS256', expiresIn: '1h', issuer: 'klinikflow', audience: 'klinikflow-web',
    });
    return Response.json({ success: true, message: 'Login berhasil', user: {
      id: user.id, clinic_id: user.clinic_id, name: user.name, email: user.email,
      role: user.role, phone: user.phone, clinic_name: user.clinic_name,
    } }, { headers: sessionCookies(token, csrf, 3600) });
  } catch {
    return Response.json({ success: false, error: 'Login tidak dapat diproses' }, { status: 500 });
  }
}

export async function handleGetMe(req: Request): Promise<Response> {
  const user = await extractAuthUser(req);
  if (!user) return Response.json({ success: false, error: 'Sesi tidak valid atau telah berakhir' }, { status: 401 });
  const { session_id, ...publicUser } = user;
  return Response.json({ success: true, user: publicUser });
}

export async function handleLogout(user: UserPayload): Promise<Response> {
  await pool.query('DELETE FROM auth_sessions WHERE id = ?', [user.session_id]);
  return Response.json({ success: true, message: 'Logout berhasil' }, { headers: sessionCookies('', '', 0) });
}