import pool from './db';
import { extractAuthUser, type UserPayload } from './auth';
import { writeAudit } from './audit';
import { paginationMeta, parsePagination } from './pagination';
import { randomUUID } from 'node:crypto';

// Handler Kunjungan & Pemeriksaan Pasien
export async function handleListVisits(req: Request): Promise<Response> {
  const user = await extractAuthUser(req);
  if (!user) return Response.json({ success: false, error: 'Akses ditolak' }, { status: 401 });
  const pagination = parsePagination(new URL(req.url));
  if (pagination instanceof Response) return pagination;
  const [countRows] = await pool.query<any[]>('SELECT COUNT(*) AS total FROM visits WHERE clinic_id = ?', [user.clinic_id]);
  const [rows] = await pool.query<any[]>(
    `SELECT v.id, v.visit_uuid, v.doctor_name, v.visit_date, v.status, v.notes,
            p.full_name as patient_name, p.mrn, c.name as clinic_name
     FROM visits v
     JOIN patients p ON v.patient_id = p.id
     JOIN clinics c ON v.clinic_id = c.id
    WHERE v.clinic_id = ? ORDER BY v.id DESC LIMIT ? OFFSET ?`, [user.clinic_id, pagination.limit, pagination.offset]
  );

  return Response.json({ success: true, data: rows, pagination: paginationMeta(pagination, Number(countRows[0].total)) });
}

export async function handleCreateVisit(req: Request): Promise<Response> {
  let connection;
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

    connection = await pool.getConnection();
    await connection.beginTransaction();
    const [res] = await connection.query<any>(
      `INSERT INTO visits (visit_uuid, clinic_id, patient_id, doctor_name, visit_date, status, notes)
       VALUES (?, ?, ?, ?, COALESCE(?, CURDATE()), 'registered', ?)`,
      [visitUuid, user.clinic_id, patient_id, doctor_name, visit_date || null, notes || '']
    );
    // T20: pembuatan kunjungan tercatat bersama datanya (catatan klinis tidak disalin ke audit).
    await writeAudit({ actorId: user.id, clinicId: user.clinic_id, action: 'visit.create', entityType: 'visit',
      entityId: res.insertId, details: { visit_uuid: visitUuid, patient_id: patients[0].id } }, connection);
    await connection.commit();

    return Response.json({
      success: true,
      message: 'Jadwal kunjungan baru berhasil dicatat',
      visit_id: res.insertId,
      visit_uuid: visitUuid,
    });
  } catch (err: any) {
    if (connection) await connection.rollback();
    return Response.json({ success: false, error: 'Pendaftaran kunjungan gagal' }, { status: 500 });
  } finally {
    connection?.release();
  }
}

export async function handleGetVisitByUuid(uuid: string, user: UserPayload): Promise<Response> {
  const [rows] = await pool.query<any[]>(
    `SELECT v.id, v.visit_uuid, v.doctor_name, v.visit_date, v.status, v.notes,
            p.full_name as patient_name, p.mrn, c.name as clinic_name
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

