import pool from './db';
import { extractAuthUser, type UserPayload } from './auth';
import { randomUUID } from 'node:crypto';
import { paginationMeta, parsePagination } from './pagination';

// Handler Tagihan Medis & Simulasi Pembayaran
export async function handleListInvoices(req: Request): Promise<Response> {
  const user = await extractAuthUser(req);
  if (!user) return Response.json({ success: false, error: 'Akses ditolak' }, { status: 401 });
  const pagination = parsePagination(new URL(req.url));
  if (pagination instanceof Response) return pagination;
  const [countRows] = await pool.query<any[]>('SELECT COUNT(*) AS total FROM invoices WHERE clinic_id = ?', [user.clinic_id]);
  const [rows] = await pool.query<any[]>(
    `SELECT i.id, i.invoice_number, i.amount, i.status, i.issued_at,
            p.full_name as patient_name, c.name as clinic_name, v.doctor_name,
          i.amount - COALESCE((SELECT SUM(pay.amount) FROM payments pay WHERE pay.invoice_id = i.id AND pay.settlement_status = 'settled'), 0) AS outstanding_amount
     FROM invoices i
     JOIN patients p ON i.patient_id = p.id
     JOIN clinics c ON i.clinic_id = c.id
     JOIN visits v ON i.visit_id = v.id
    WHERE i.clinic_id = ? ORDER BY i.id DESC LIMIT ? OFFSET ?`, [user.clinic_id, pagination.limit, pagination.offset]
  );

  return Response.json({ success: true, data: rows, pagination: paginationMeta(pagination, Number(countRows[0].total)) });
}

export async function handleGetInvoiceDetail(invoiceId: number, user: UserPayload): Promise<Response> {
  const [invRows] = await pool.query<any[]>(
    `SELECT i.id, i.invoice_number, i.amount, i.status, i.issued_at, i.paid_at,
            p.full_name as patient_name, p.mrn, c.name as clinic_name, v.doctor_name, v.visit_date
     FROM invoices i
     JOIN patients p ON i.patient_id = p.id
     JOIN clinics c ON i.clinic_id = c.id
     JOIN visits v ON i.visit_id = v.id
    WHERE i.id = ? AND i.clinic_id = ?`,
      [invoiceId, user.clinic_id]
  );

  if (invRows.length === 0) {
    return Response.json({ success: false, error: 'Tagihan tidak ditemukan' }, { status: 404 });
  }

  const invoice = invRows[0];

  const [items] = await pool.query<any[]>(
    `SELECT ii.id, ii.quantity, ii.unit_price, ii.total_price, s.name as service_name, s.code as service_code, s.category
     FROM invoice_items ii
     JOIN services s ON ii.service_id = s.id
     WHERE ii.invoice_id = ?`,
    [invoiceId]
  );
  invoice.items = items;

  const [payments] = await pool.query<any[]>(
    `SELECT id, payment_ref, amount, method, settlement_status, paid_at FROM payments WHERE invoice_id = ? ORDER BY id DESC`,
    [invoiceId]
  );
  invoice.payments = payments;

  return Response.json({ success: true, data: invoice });
}

export async function handleProcessPayment(req: Request): Promise<Response> {
  const user = await extractAuthUser(req);
  if (!user) return Response.json({ success: false, error: 'Akses ditolak' }, { status: 401 });
  let connection;
  try {
    const body = await req.json();
    const { invoice_id, amount, method, request_id } = body;
    const amountText = String(amount);
    if (!Number.isSafeInteger(invoice_id) || invoice_id <= 0 || !/^\d{1,10}(\.\d{1,2})?$/.test(amountText) ||
        !['cash', 'qris', 'bank_transfer'].includes(method) ||
        typeof request_id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(request_id)) {
      return Response.json({ success: false, error: 'Parameter pembayaran tidak valid' }, { status: 400 });
    }
    connection = await pool.getConnection();
    await connection.beginTransaction();
    const [invRows] = await connection.query<any[]>('SELECT id, invoice_number, amount, status FROM invoices WHERE id = ? AND clinic_id = ? FOR UPDATE', [invoice_id, user.clinic_id]);
    if (!invRows.length) {
      await connection.rollback();
      return Response.json({ success: false, error: 'Tagihan tidak ditemukan' }, { status: 404 });
    }
    const invoice = invRows[0];
    const [previous] = await connection.query<any[]>(
      `SELECT r.invoice_id, r.user_id, p.id, p.payment_ref, p.amount, p.method FROM payment_requests r
       JOIN payments p ON p.id = r.payment_id WHERE r.request_id = ?`, [request_id]
    );
    if (previous.length) {
      await connection.rollback();
        if (previous[0].invoice_id !== invoice_id || previous[0].user_id !== user.id ||
          Math.round(Number(previous[0].amount) * 100) !== Math.round(Number(amountText) * 100) || previous[0].method !== method) {
        return Response.json({ success: false, error: 'ID request telah digunakan' }, { status: 409 });
      }
      return Response.json({ success: true, message: 'Pembayaran sudah diproses', payment_id: previous[0].id,
        payment_ref: previous[0].payment_ref, invoice_number: invoice.invoice_number, current_status: invoice.status });
    }
    if (!['unpaid', 'partially_paid'].includes(invoice.status)) {
      await connection.rollback();
      return Response.json({ success: false, error: 'Status tagihan tidak dapat dibayar' }, { status: 409 });
    }
    const [totals] = await connection.query<any[]>(
      "SELECT COALESCE(SUM(amount), 0) AS paid FROM payments WHERE invoice_id = ? AND settlement_status = 'settled'", [invoice_id]
    );
    const outstandingCents = Math.round(Number(invoice.amount) * 100) - Math.round(Number(totals[0].paid) * 100);
    if (outstandingCents <= 0 || Math.round(Number(amountText) * 100) !== outstandingCents) {
      await connection.rollback();
      return Response.json({ success: false, error: 'Nominal harus sama dengan sisa tagihan' }, { status: 400 });
    }
    const paymentRef = `PAY-${randomUUID()}`;
    const [payRes] = await connection.query<any>(
      `INSERT INTO payments (payment_ref, invoice_id, amount, method, settlement_status, paid_at)
       VALUES (?, ?, ?, ?, 'settled', NOW())`,
      [paymentRef, invoice_id, amountText, method]
    );
    await connection.query(
      `UPDATE invoices SET status = 'paid', paid_at = NOW() WHERE id = ?`,
      [invoice_id]
    );
    await connection.query('INSERT INTO payment_requests (request_id, invoice_id, user_id, payment_id) VALUES (?, ?, ?, ?)',
      [request_id, invoice_id, user.id, payRes.insertId]);
    await connection.query("INSERT INTO audit_log (actor_id, clinic_id, action, entity_type, entity_id) VALUES (?, ?, 'payment.process', 'invoice', ?)",
      [user.id, user.clinic_id, invoice_id]);
    await connection.commit();
    return Response.json({
      success: true,
      message: `Pembayaran sebesar Rp ${Number(amount).toLocaleString('id-ID')} berhasil diproses`,
      payment_id: payRes.insertId,
      payment_ref: paymentRef,
      invoice_number: invoice.invoice_number,
      previous_status: invoice.status,
      current_status: 'paid',
    });
  } catch (err: any) {
    if (connection) await connection.rollback();
    if (err?.code === 'ER_DUP_ENTRY') return Response.json({ success: false, error: 'ID request telah digunakan' }, { status: 409 });
    return Response.json({ success: false, error: 'Pembayaran gagal diproses' }, { status: 500 });
  } finally {
    connection?.release();
  }
}

