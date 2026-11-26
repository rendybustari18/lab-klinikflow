import jwt from 'jsonwebtoken';
import { password as bunPassword } from 'bun';
import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import pool from './db';
import { clientDetails, writeAudit, type ClientInfo } from './audit';

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

// T02: lockout per email. Setelah LOGIN_MAX_FAILURES kegagalan dalam jendela
// LOGIN_WINDOW_MINUTES, login ditolak 429 selama LOGIN_LOCK_MINUTES.
const LOGIN_MAX_FAILURES = 5;
const LOGIN_WINDOW_MINUTES = 15;
const LOGIN_LOCK_MINUTES = 15;

function tooManyAttempts(retryAfterSeconds: number): Response {
  const retryAfter = Math.max(1, Math.ceil(retryAfterSeconds));
  return Response.json(
    { success: false, error: 'Terlalu banyak percobaan login gagal. Akun dikunci sementara, coba lagi nanti.' },
    { status: 429, headers: { 'Retry-After': String(retryAfter) } }
  );
}

// Mencatat percobaan secara atomik SEBELUM verifikasi password, sehingga
// request paralel tidak dapat melewati batas. Mengembalikan nomor percobaan
// dalam jendela berjalan, atau retryAfter bila email sedang terkunci.
async function reserveLoginAttempt(key: string): Promise<{ attempt: number } | { retryAfter: number }> {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.query(
      'INSERT INTO login_attempts (email, failed_count, window_start) VALUES (?, 0, NOW()) ON DUPLICATE KEY UPDATE email = email', [key]
    );
    const [rows] = await connection.query<any[]>(
      `SELECT failed_count,
              locked_until IS NOT NULL AND locked_until > NOW() AS locked,
              TIMESTAMPDIFF(SECOND, NOW(), locked_until) AS lock_remaining,
              window_start <= NOW() - INTERVAL ${LOGIN_WINDOW_MINUTES} MINUTE AS window_expired,
              TIMESTAMPDIFF(SECOND, NOW(), window_start + INTERVAL ${LOGIN_WINDOW_MINUTES} MINUTE) AS window_remaining
       FROM login_attempts WHERE email = ? FOR UPDATE`, [key]
    );
    const state = rows[0];
    if (Number(state.locked)) {
      await connection.commit();
      return { retryAfter: Number(state.lock_remaining) };
    }
    const expired = Boolean(Number(state.window_expired));
    const attempt = (expired ? 0 : Number(state.failed_count)) + 1;
    await connection.query(
      'UPDATE login_attempts SET failed_count = ?, window_start = IF(?, NOW(), window_start), locked_until = NULL WHERE email = ?',
      [attempt, expired, key]
    );
    await connection.commit();
    if (attempt > LOGIN_MAX_FAILURES) {
      return { retryAfter: expired ? LOGIN_WINDOW_MINUTES * 60 : Number(state.window_remaining) };
    }
    return { attempt };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function handleLogin(req: Request, client: ClientInfo): Promise<Response> {
  try {
    const { email, password } = await req.json();
    if (typeof email !== 'string' || typeof password !== 'string' || !email || !password || email.length > 254) {
      return Response.json({ success: false, error: 'Email dan password wajib diisi' }, { status: 400 });
    }
    // Kunci lockout dinormalisasi: kolasi MySQL tidak membedakan huruf besar/kecil
    // dan mengabaikan spasi di akhir, jadi variasi tersebut tidak boleh memberi kuota baru.
    const attemptKey = email.trim().toLowerCase();
    // T20: login gagal belum memiliki actor; email dan IP disimpan di details.
    const failureDetails = (reason: string) => ({ email: attemptKey, reason, ...clientDetails(client) });
    const reservation = await reserveLoginAttempt(attemptKey);
    if ('retryAfter' in reservation) {
      await writeAudit({ actorId: null, clinicId: null, action: 'auth.login.failed', entityType: 'user', entityId: null,
        details: failureDetails('locked') });
      return tooManyAttempts(reservation.retryAfter);
    }
    const [rows] = await pool.query<any[]>(
      `SELECT u.id, u.clinic_id, u.name, u.email, u.password, u.role, u.phone, c.name AS clinic_name FROM users u JOIN clinics c ON u.clinic_id = c.id WHERE u.email = ?`, [email]
    );
    if (!rows.length || !await bunPassword.verify(password, rows[0].password)) {
      const locking = reservation.attempt >= LOGIN_MAX_FAILURES;
      if (locking) {
        await pool.query(
          `UPDATE login_attempts SET locked_until = NOW() + INTERVAL ${LOGIN_LOCK_MINUTES} MINUTE WHERE email = ?`, [attemptKey]
        );
      }
      await writeAudit({ actorId: null, clinicId: rows[0]?.clinic_id ?? null, action: 'auth.login.failed', entityType: 'user',
        entityId: rows[0]?.id ?? null,
        details: { ...failureDetails('invalid_credentials'), attempt: reservation.attempt, locked: locking } });
      return Response.json({ success: false, error: 'Kredensial login klinik tidak valid' }, { status: 401 });
    }
    await pool.query('DELETE FROM login_attempts WHERE email = ?', [attemptKey]);
    const user = rows[0];
    const sessionId = randomUUID();
    const csrf = randomBytes(32).toString('hex');
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      await connection.query('INSERT INTO auth_sessions (id, user_id, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 1 HOUR))', [sessionId, user.id]);
      await writeAudit({ actorId: user.id, clinicId: user.clinic_id, action: 'auth.login.success', entityType: 'user', entityId: user.id,
        details: clientDetails(client) }, connection);
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
    const token = jwt.sign({ sid: sessionId, csrf }, secret, {
      algorithm: 'HS256', expiresIn: '1h', issuer: 'klinikflow', audience: 'klinikflow-web',
    });
    return Response.json({ success: true, message: 'Login berhasil', user: {
      id: user.id, clinic_id: user.clinic_id, name: user.name, email: user.email,
      role: user.role, phone: user.phone, clinic_name: user.clinic_name,
    } }, { headers: sessionCookies(token, csrf, 3600) });
  } catch (error) {
    console.error('Login gagal diproses', error);
    return Response.json({ success: false, error: 'Login tidak dapat diproses' }, { status: 500 });
  }
}

export async function handleGetMe(req: Request): Promise<Response> {
  const user = await extractAuthUser(req);
  if (!user) return Response.json({ success: false, error: 'Sesi tidak valid atau telah berakhir' }, { status: 401 });
  const { session_id, ...publicUser } = user;
  return Response.json({ success: true, user: publicUser });
}

export async function handleLogout(user: UserPayload, client: ClientInfo): Promise<Response> {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.query('DELETE FROM auth_sessions WHERE id = ?', [user.session_id]);
    await writeAudit({ actorId: user.id, clinicId: user.clinic_id, action: 'auth.logout', entityType: 'user', entityId: user.id,
      details: clientDetails(client) }, connection);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
  return Response.json({ success: true, message: 'Logout berhasil' }, { headers: sessionCookies('', '', 0) });
}