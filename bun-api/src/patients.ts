import pool from './db';
import { extractAuthUser } from './auth';
import { randomBytes } from 'node:crypto';

// Handler Manajemen Data Pasien
export async function handleListPatients(req: Request): Promise<Response> {
  const user = await extractAuthUser(req);
  if (!user) return Response.json({ success: false, error: 'Akses ditolak' }, { status: 401 });
  const url = new URL(req.url);
  const search = url.searchParams.get('search') || '';

  let query = `SELECT p.*, c.name as clinic_name 
               FROM patients p
               JOIN clinics c ON p.clinic_id = c.id
               WHERE p.clinic_id = ?`;
  const params: any[] = [user.clinic_id];

  if (search) {
    query += ` AND (p.full_name LIKE ? OR p.mrn LIKE ? OR p.phone LIKE ?)`;
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  query += ` ORDER BY p.id ASC`;

  const [rows] = await pool.query<any[]>(query, params);

  return Response.json({ success: true, data: rows });
}

export async function handleCreatePatient(req: Request): Promise<Response> {
  try {
    const user = await extractAuthUser(req);
    if (!user) return Response.json({ success: false, error: 'Akses ditolak' }, { status: 401 });
    const body = await req.json();
    const { full_name, birth_date, gender, phone, address } = body;

    if (!full_name || !birth_date || !gender || !phone) {
      return Response.json({ success: false, error: 'Data identitas pasien wajib diisi lengkap' }, { status: 400 });
    }

    const mrn = `MRN-${randomBytes(12).toString('hex').toUpperCase()}`;

    const [res] = await pool.query<any>(
      `INSERT INTO patients (clinic_id, mrn, full_name, birth_date, gender, phone, address)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [user.clinic_id, mrn, full_name, birth_date, gender, phone, address || '']
    );

    return Response.json({
      success: true,
      message: 'Registrasi pasien baru berhasil',
      patient_id: res.insertId,
      mrn,
    });
  } catch (err: any) {
    return Response.json({ success: false, error: 'Pendaftaran pasien gagal' }, { status: 500 });
  }
}

