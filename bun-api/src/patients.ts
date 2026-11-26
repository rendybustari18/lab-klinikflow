import pool from './db';
import { extractAuthUser } from './auth';
import { writeAudit } from './audit';
import { paginationMeta, parsePagination } from './pagination';
import { randomBytes } from 'node:crypto';

// Handler Manajemen Data Pasien
export async function handleListPatients(req: Request): Promise<Response> {
  const user = await extractAuthUser(req);
  if (!user) return Response.json({ success: false, error: 'Akses ditolak' }, { status: 401 });
  const url = new URL(req.url);
  const search = url.searchParams.get('search') || '';
  const pagination = parsePagination(url);
  if (pagination instanceof Response) return pagination;

  let where = 'WHERE p.clinic_id = ?';
  const params: any[] = [user.clinic_id];

  if (search) {
    where += ` AND (p.full_name LIKE ? OR p.mrn LIKE ? OR p.phone LIKE ?)`;
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  const [countRows] = await pool.query<any[]>(`SELECT COUNT(*) AS total FROM patients p ${where}`, params);
  const [rows] = await pool.query<any[]>(
    `SELECT p.id, p.mrn, p.full_name, p.gender, p.birth_date, p.phone, p.address, c.name as clinic_name
     FROM patients p
     JOIN clinics c ON p.clinic_id = c.id
     ${where}
     ORDER BY p.id ASC LIMIT ? OFFSET ?`,
    [...params, pagination.limit, pagination.offset]
  );

  return Response.json({ success: true, data: rows, pagination: paginationMeta(pagination, Number(countRows[0].total)) });
}

export async function handleCreatePatient(req: Request): Promise<Response> {
  let connection;
  try {
    const user = await extractAuthUser(req);
    if (!user) return Response.json({ success: false, error: 'Akses ditolak' }, { status: 401 });
    const body = await req.json();
    const { full_name, birth_date, gender, phone, address } = body;

    if (!full_name || !birth_date || !gender || !phone) {
      return Response.json({ success: false, error: 'Data identitas pasien wajib diisi lengkap' }, { status: 400 });
    }
    // Validasi nama di server: 1-150 karakter setelah trim, tanpa karakter < atau >.
    const fullName = typeof full_name === 'string' ? full_name.trim() : '';
    if (fullName.length < 1 || fullName.length > 150 || /[<>]/.test(fullName)) {
      return Response.json({ success: false, error: 'Nama pasien wajib 1-150 karakter dan tidak boleh mengandung < atau >' }, { status: 400 });
    }

    const mrn = `MRN-${randomBytes(12).toString('hex').toUpperCase()}`;

    connection = await pool.getConnection();
    await connection.beginTransaction();
    const [res] = await connection.query<any>(
      `INSERT INTO patients (clinic_id, mrn, full_name, birth_date, gender, phone, address)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [user.clinic_id, mrn, fullName, birth_date, gender, phone, address || '']
    );
    // T20: registrasi pasien tercatat bersama datanya (tanpa menyalin PII ke audit).
    await writeAudit({ actorId: user.id, clinicId: user.clinic_id, action: 'patient.create', entityType: 'patient',
      entityId: res.insertId, details: { mrn } }, connection);
    await connection.commit();

    return Response.json({
      success: true,
      message: 'Registrasi pasien baru berhasil',
      patient_id: res.insertId,
      mrn,
    });
  } catch (err: any) {
    if (connection) await connection.rollback();
    return Response.json({ success: false, error: 'Pendaftaran pasien gagal' }, { status: 500 });
  } finally {
    connection?.release();
  }
}

