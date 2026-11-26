import pool from './db';
import { extractAuthUser, type UserPayload } from './auth';
import { randomUUID } from 'node:crypto';

// Handler Kunjungan & Pemeriksaan Pasien
export async function handleListVisits(req: Request): Promise<Response> {
  const user = await extractAuthUser(req);
  if (!user) return Response.json({ success: false, error: 'Akses ditolak' }, { status: 401 });
  const [rows] = await pool.query<any[]>(
    `SELECT v.*, p.full_name as patient_name, p.mrn, c.name as clinic_name
     FROM visits v
     JOIN patients p ON v.patient_id = p.id
     JOIN clinics c ON v.clinic_id = c.id
    WHERE v.clinic_id = ? ORDER BY v.id DESC`, [user.clinic_id]
  );

  return Response.json({ success: true, data: rows });
}

export async function handleCreateVisit(req: Request): Promise<Response> {
  try {
    const user = await extractAuthUser(req);
    if (!user) return Response.json({ success: false, error: 'Akses ditolak' }, { status: 401 });
    const body = await req.json();
    const { patient_id, doctor_name = 'dr. Aris Wibowo', visit_date, notes } = body;

    if (!patient_id) {
      return Response.json({ success: false, error: 'Pasien wajib dipilih' }, { status: 400 });
    }

    const [patients] = await pool.query<any[]>('SELECT id FROM patients WHERE id = ? AND clinic_id = ?', [patient_id, user.clinic_id]);
    if (!patients.length) return Response.json({ success: false, error: 'Pasien tidak ditemukan' }, { status: 404 });
    const visitUuid = randomUUID();

    const [res] = await pool.query<any>(
      `INSERT INTO visits (visit_uuid, clinic_id, patient_id, doctor_name, visit_date, status, notes)
       VALUES (?, ?, ?, ?, COALESCE(?, CURDATE()), 'registered', ?)`,
      [visitUuid, user.clinic_id, patient_id, doctor_name, visit_date || null, notes || '']
    );

    return Response.json({
      success: true,
      message: 'Jadwal kunjungan baru berhasil dicatat',
      visit_id: res.insertId,
      visit_uuid: visitUuid,
    });
  } catch (err: any) {
    return Response.json({ success: false, error: 'Pendaftaran kunjungan gagal' }, { status: 500 });
  }
}

export async function handleGetVisitByUuid(uuid: string, user: UserPayload): Promise<Response> {
  const [rows] = await pool.query<any[]>(
    `SELECT v.*, p.full_name as patient_name, p.mrn, p.phone as patient_phone, p.address as patient_address, c.name as clinic_name
     FROM visits v
     JOIN patients p ON v.patient_id = p.id
     JOIN clinics c ON v.clinic_id = c.id
    WHERE v.visit_uuid = ? AND v.clinic_id = ?`,
      [uuid, user.clinic_id]
  );

  if (rows.length === 0) {
    return Response.json({ success: false, error: 'Kunjungan tidak ditemukan' }, { status: 404 });
  }

  return Response.json({ success: true, data: rows[0] });
}

