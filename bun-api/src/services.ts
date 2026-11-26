import { extractAuthUser } from './auth';
import pool from './db';

// Handler Katalog Layanan Klinik
export async function handleListServices(req: Request): Promise<Response> {
  const user = await extractAuthUser(req);
  if (!user) return Response.json({ success: false, error: 'Akses ditolak' }, { status: 401 });
  const [rows] = await pool.query<any[]>(
    `SELECT s.*, c.name as clinic_name 
     FROM services s
     JOIN clinics c ON s.clinic_id = c.id
    WHERE s.is_active = 1 AND s.clinic_id = ?
    ORDER BY s.id ASC`, [user.clinic_id]
  );

  return Response.json({ success: true, data: rows });
}

export async function handleUpdateServiceFee(req: Request): Promise<Response> {
  const user = await extractAuthUser(req);
  if (!user) {
    return Response.json({ success: false, error: 'Akses ditolak: Belum terautentikasi' }, { status: 401 });
  }

  let connection;
  try {
    const body = await req.json();
    const serviceId = Number(body.id);
    const feeText = String(body.fee);
    const newFee = Number(feeText);

    if (!Number.isSafeInteger(serviceId) || serviceId <= 0 || !/^\d{1,10}(\.\d{1,2})?$/.test(feeText)) {
      return Response.json({ success: false, error: 'ID layanan dan tarif biaya baru tidak valid' }, { status: 400 });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();
    const [prevRows] = await connection.query<any[]>('SELECT * FROM services WHERE id = ? AND clinic_id = ? FOR UPDATE', [serviceId, user.clinic_id]);
    if (prevRows.length === 0) {
      await connection.rollback();
      return Response.json({ success: false, error: 'Layanan tidak ditemukan' }, { status: 404 });
    }

    const prevService = prevRows[0];

    await connection.query('UPDATE services SET fee = ? WHERE id = ? AND clinic_id = ?', [newFee, serviceId, user.clinic_id]);
    await connection.query("INSERT INTO audit_log (actor_id, clinic_id, action, entity_type, entity_id, details) VALUES (?, ?, 'service.fee.update', 'service', ?, ?)",
      [user.id, user.clinic_id, serviceId, JSON.stringify({ previous_fee: prevService.fee, updated_fee: newFee })]);

    const [updatedRows] = await connection.query<any[]>('SELECT * FROM services WHERE id = ? AND clinic_id = ?', [serviceId, user.clinic_id]);
    await connection.commit();

    return Response.json({
      success: true,
      message: `Tarif layanan ${prevService.name} berhasil diperbarui menjadi Rp ${newFee.toLocaleString('id-ID')}`,
      data: updatedRows[0],
      previous_fee: parseFloat(prevService.fee),
      updated_fee: newFee,
    });
  } catch (err: any) {
    if (connection) await connection.rollback();
    return Response.json({ success: false, error: 'Perubahan tarif gagal' }, { status: 500 });
  } finally {
    connection?.release();
  }
}

