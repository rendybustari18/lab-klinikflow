import { extractAuthUser } from './auth';
import pool from './db';
import { createHash, randomBytes } from 'node:crypto';
import { password as bunPassword } from 'bun';

// Handler Manajemen & Undangan Staf Klinik
export async function handleListStaff(req: Request): Promise<Response> {
  const user = await extractAuthUser(req);
  if (!user || (user.role !== 'admin' && user.role !== 'manager')) {
    return Response.json({ success: false, error: 'Akses ditolak: Hanya admin atau manager yang diizinkan' }, { status: 403 });
  }

  const [rows] = await pool.query<any[]>(
    `SELECT u.id, u.name, u.email, u.role, u.phone, c.name as clinic_name, u.created_at
     FROM users u
     JOIN clinics c ON u.clinic_id = c.id
    WHERE u.role IN ('admin', 'manager', 'staff', 'cashier') AND u.clinic_id = ?
    ORDER BY u.id ASC`, [user.clinic_id]
  );

  return Response.json({ success: true, data: rows });
}

export async function handleListInvitations(req: Request): Promise<Response> {
  const user = await extractAuthUser(req);
  if (!user || !['admin', 'manager'].includes(user.role)) return Response.json({ success: false, error: 'Akses ditolak' }, { status: 403 });
  const [rows] = await pool.query<any[]>(
    `SELECT si.id, si.email, si.role, si.created_at, c.name as clinic_name
     FROM staff_invitations si
     JOIN clinics c ON si.clinic_id = c.id
     WHERE si.is_accepted = 0 AND si.clinic_id = ? AND si.created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)`, [user.clinic_id]
  );
  return Response.json({ success: true, data: rows });
}

export async function handleCreateInvitation(req: Request): Promise<Response> {
  const user = await extractAuthUser(req);
  if (!user || !['admin', 'manager'].includes(user.role)) return Response.json({ success: false, error: 'Akses ditolak' }, { status: 403 });
  let connection;
  try {
    const { email, role } = await req.json();
    if (typeof email !== 'string' || email.length > 150 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !['staff', 'cashier'].includes(role)) {
      return Response.json({ success: false, error: 'Email atau role undangan tidak valid' }, { status: 400 });
    }
    const token = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    connection = await pool.getConnection();
    await connection.beginTransaction();
    const [result] = await connection.query<any>('INSERT INTO staff_invitations (clinic_id, email, role, token) VALUES (?, ?, ?, ?)',
      [user.clinic_id, email.trim().toLowerCase(), role, tokenHash]);
    await connection.query("INSERT INTO audit_log (actor_id, clinic_id, action, entity_type, entity_id) VALUES (?, ?, 'invitation.create', 'invitation', ?)",
      [user.id, user.clinic_id, result.insertId]);
    await connection.commit();
    return Response.json({ success: true, token, expires_in_hours: 24 });
  } catch {
    if (connection) await connection.rollback();
    return Response.json({ success: false, error: 'Undangan tidak dapat dibuat' }, { status: 500 });
  } finally {
    connection?.release();
  }
}

export async function handleAcceptInvitation(req: Request): Promise<Response> {
  let connection;
  try {
    const body = await req.json();
    const { token, name, password, phone } = body;

    if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token) || typeof name !== 'string' ||
        !name.trim() || name.length > 150 || typeof password !== 'string' || password.length < 12 ||
        ('role' in body) || (phone != null && (typeof phone !== 'string' || phone.length > 30))) {
      return Response.json({ success: false, error: 'Data undangan tidak valid; password minimal 12 karakter' }, { status: 400 });
    }
    connection = await pool.getConnection();
    await connection.beginTransaction();
    const [invRows] = await connection.query<any[]>(
      `SELECT id, clinic_id, email, role FROM staff_invitations WHERE token = ? AND is_accepted = 0
       AND created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR) FOR UPDATE`,
      [createHash('sha256').update(token).digest('hex')]
    );

    if (invRows.length === 0) {
      await connection.rollback();
      return Response.json({ success: false, error: 'Token undangan tidak valid atau sudah digunakan' }, { status: 404 });
    }

    const invitation = invRows[0];
    if (!['staff', 'cashier'].includes(invitation.role)) {
      await connection.rollback();
      return Response.json({ success: false, error: 'Role undangan tidak diizinkan' }, { status: 400 });
    }
    const hashedPassword = await bunPassword.hash(password);
    const [userRes] = await connection.query<any>(
      `INSERT INTO users (clinic_id, name, email, password, role, phone)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [invitation.clinic_id, name.trim(), invitation.email, hashedPassword, invitation.role, phone || null]
    );
    await connection.query(`UPDATE staff_invitations SET is_accepted = 1 WHERE id = ?`, [invitation.id]);
    await connection.query("INSERT INTO audit_log (actor_id, clinic_id, action, entity_type, entity_id) VALUES (?, ?, 'invitation.accept', 'invitation', ?)",
      [userRes.insertId, invitation.clinic_id, invitation.id]);
    await connection.commit();

    return Response.json({
      success: true,
      message: `Akun staf berhasil didaftarkan dengan hak akses [${invitation.role}]`,
      user_id: userRes.insertId,
      assigned_role: invitation.role,
      clinic_id: invitation.clinic_id,
    });
  } catch {
    if (connection) await connection.rollback();
    return Response.json({ success: false, error: 'Undangan tidak dapat diaktifkan' }, { status: 400 });
  } finally {
    connection?.release();
  }
}

