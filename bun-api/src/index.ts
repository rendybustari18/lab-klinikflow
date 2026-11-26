import { extractAuthUser, handleGetMe, handleLogin, handleLogout, validateCsrf, type UserPayload } from './auth';
import { handleListServices, handleUpdateServiceFee } from './services';
import { handleAcceptInvitation, handleCreateInvitation, handleListInvitations, handleListStaff } from './staff';
import { handleCreatePatient, handleListPatients } from './patients';
import { handleCreateVisit, handleGetVisitByUuid, handleListVisits } from './visits';
import { handleGetInvoiceDetail, handleListInvoices, handleProcessPayment } from './invoices';
import { proxyToPhp } from './proxy';
import pool from './db';
import type { ClientInfo } from './audit';

const PORT = parseInt(process.env.PORT || '3000', 10);

const APP_ORIGIN = process.env.APP_ORIGIN || 'http://localhost:8080';

function allowedRoles(path: string, method: string): UserPayload['role'][] | null {
  if (path === '/api/auth/me' || path === '/api/auth/logout') return ['admin', 'manager', 'staff', 'cashier', 'patient'];
  if (path === '/api/dashboard/stats') return ['admin', 'manager', 'staff', 'cashier'];
  if (path === '/api/patients') return method === 'POST' ? ['admin', 'manager', 'staff'] : ['admin', 'manager', 'staff', 'cashier'];
  if (path === '/api/visits' || path.startsWith('/api/visits/')) return ['admin', 'manager', 'staff'];
  if (path === '/api/services' || path.startsWith('/api/services/')) return ['admin', 'manager'];
  if (path === '/api/invoices' || path.startsWith('/api/invoices/') || path === '/api/payments/process') return ['admin', 'manager', 'cashier'];
  if (path === '/api/claims/approve') return ['admin', 'manager'];
  if (path === '/api/claims' || path.startsWith('/api/claims/') || path === '/api/attachments' || path.startsWith('/api/attachments/')) return ['admin', 'manager', 'staff', 'cashier'];
  if (path === '/api/reports' || path === '/api/reports/export' || path === '/api/staff' || path === '/api/staff/invitations') return ['admin', 'manager'];
  return null;
}

// T23: tabel auth_sessions, audit_log, dan payment_requests dibuat oleh
// database/01_schema.sql; akun DB aplikasi tidak memiliki hak CREATE.

const server = Bun.serve({
  port: PORT,
  // T22: batasi ukuran body (gateway juga terekspos langsung di :3000, tidak hanya lewat nginx).
  maxRequestBodySize: 1024 * 1024,
  async fetch(req: Request, server) {
    const url = new URL(req.url);
    const client: ClientInfo = {
      ip: server.requestIP(req)?.address ?? null,
      forwardedIp: req.headers.get('X-Real-IP')?.slice(0, 64) || null,
    };
    const path = url.pathname;
    const method = req.method;

    try {
      const origin = req.headers.get('Origin');
      if (origin && origin !== APP_ORIGIN) {
        return Response.json({ success: false, error: 'Origin tidak diizinkan' }, { status: 403 });
      }
      if (method === 'OPTIONS') return new Response(null, { status: 204 });
      const isMutation = !['GET', 'HEAD'].includes(method);
      if (isMutation && !req.headers.get('Content-Type')?.toLowerCase().startsWith('application/json')) {
        return Response.json({ success: false, error: 'Content-Type harus application/json' }, { status: 415 });
      }
      const publicRoute = (path === '/api/auth/login' || path === '/api/staff/accept-invitation') && method === 'POST';
      const user = publicRoute ? null : await extractAuthUser(req);
      if (!publicRoute && !user) {
        return Response.json({ success: false, error: 'Sesi tidak valid atau telah berakhir' }, { status: 401 });
      }
      if (!publicRoute && isMutation && !validateCsrf(req)) {
        return Response.json({ success: false, error: 'Token CSRF tidak valid' }, { status: 403 });
      }
      const roles = allowedRoles(path, method);
      if (!publicRoute && roles && !roles.includes(user!.role)) {
        return Response.json({ success: false, error: 'Akses ditolak' }, { status: 403 });
      }
      let response: Response;

      // 1. Auth routes
      if (path === '/api/auth/login' && method === 'POST') {
        response = await handleLogin(req, client);
      } else if (path === '/api/auth/me' && method === 'GET') {
        response = await handleGetMe(req);
      } else if (path === '/api/auth/logout' && method === 'POST') {
        response = await handleLogout(user!, client);
      }

      // 2. Services catalog & fee adjustment
      else if (path === '/api/services' && method === 'GET') {
        response = await handleListServices(req);
      } else if ((path === '/api/services/fee' || path === '/api/services/update-fee') && (method === 'POST' || method === 'PUT')) {
        response = await handleUpdateServiceFee(req);
      }

      // 3. Staff & invitation routes
      else if (path === '/api/staff' && method === 'GET') {
        response = await handleListStaff(req);
      } else if (path === '/api/staff/invitations' && method === 'GET') {
        response = await handleListInvitations(req);
      } else if (path === '/api/staff/invitations' && method === 'POST') {
        response = await handleCreateInvitation(req);
      } else if (path === '/api/staff/accept-invitation' && method === 'POST') {
        response = await handleAcceptInvitation(req);
      }

      // 4. Patients routes
      else if (path === '/api/patients' && method === 'GET') {
        response = await handleListPatients(req);
      } else if (path === '/api/patients' && method === 'POST') {
        response = await handleCreatePatient(req);
      }

      // 5. Visits routes
      else if (path === '/api/visits' && method === 'GET') {
        response = await handleListVisits(req);
      } else if (path === '/api/visits' && method === 'POST') {
        response = await handleCreateVisit(req);
      } else if (path.startsWith('/api/visits/') && method === 'GET') {
        const uuid = path.split('/')[3];
        response = await handleGetVisitByUuid(uuid, user!);
      }

      // 6. Invoices & payments
      else if (path === '/api/invoices' && method === 'GET') {
        response = await handleListInvoices(req);
      } else if (path.startsWith('/api/invoices/') && method === 'GET') {
        const invId = parseInt(path.split('/')[3], 10);
        response = await handleGetInvoiceDetail(invId, user!);
      } else if (path === '/api/payments/process' && method === 'POST') {
        response = await handleProcessPayment(req);
      }

      // 7. Dashboard Stats
      else if (path === '/api/dashboard/stats' && method === 'GET') {
        response = await handleDashboardStats(req);
      }

      // 8. PHP Legacy Service Proxy Routes
      // Report export
      else if (path === '/api/reports/export') {
        response = await proxyToPhp(req, 'export_report.php');
      }
      // Report viewing
      else if (path === '/api/reports' && method === 'GET') {
        response = await proxyToPhp(req, 'reports.php');
      }
      // Claims
      else if (path === '/api/claims' && method === 'GET') {
        response = await proxyToPhp(req, 'claims.php', 'list');
      } else if (path === '/api/claims/approve' && method === 'POST') {
        response = await proxyToPhp(req, 'claims.php', 'approve');
      } else if (path.startsWith('/api/claims/') && method === 'GET') {
        const claimId = path.split('/')[3];
        response = await proxyToPhp(req, 'claims.php', 'detail', { id: claimId });
      }
      // Attachments
      else if (path === '/api/attachments' && method === 'GET') {
        response = await proxyToPhp(req, 'attachments.php', 'list');
      } else if (path.startsWith('/api/attachments/') && method === 'GET') {
        const attUuid = path.split('/')[3];
        response = await proxyToPhp(req, 'attachments.php', 'get', { uuid: attUuid });
      }

      // 404
      else {
        response = Response.json({ success: false, error: 'Endpoint KlinikFlow tidak ditemukan' }, { status: 404 });
      }

      response.headers.set('X-Content-Type-Options', 'nosniff');
      response.headers.set('Cache-Control', 'no-store');
      return response;
    } catch (err: any) {
      console.error(err);
      return Response.json({ success: false, error: 'Kesalahan internal server' }, { status: 500 });
    }
  },
});

console.log(`[KlinikFlow BFF] Gateway berjalan di port ${PORT}`);

async function handleDashboardStats(req: Request): Promise<Response> {
  const user = await extractAuthUser(req);
  if (!user) {
    return Response.json({ success: false, error: 'Akses ditolak' }, { status: 401 });
  }

  const [patientCount] = await pool.query<any[]>('SELECT COUNT(*) as count FROM patients WHERE clinic_id = ?', [user.clinic_id]);
  const [visitCount] = await pool.query<any[]>('SELECT COUNT(*) as count FROM visits WHERE clinic_id = ?', [user.clinic_id]);
  const [invoiceCount] = await pool.query<any[]>('SELECT COUNT(*) as count FROM invoices WHERE status IN ("unpaid", "partially_paid") AND clinic_id = ?', [user.clinic_id]);
  const [claimCount] = await pool.query<any[]>('SELECT COUNT(*) as count FROM claims WHERE status = "submitted" AND clinic_id = ?', [user.clinic_id]);

  const [recentVisits] = await pool.query<any[]>(
    `SELECT v.id, v.visit_uuid, v.doctor_name, v.visit_date, v.status, v.clinic_id, p.full_name as patient_name, c.name as clinic_name
     FROM visits v
     JOIN patients p ON v.patient_id = p.id
     JOIN clinics c ON v.clinic_id = c.id
    WHERE v.clinic_id = ? ORDER BY v.id DESC LIMIT 5`, [user.clinic_id]
  );

  return Response.json({
    success: true,
    data: {
      total_patients: patientCount[0].count,
      total_visits: visitCount[0].count,
      unpaid_invoices: invoiceCount[0].count,
      pending_claims: claimCount[0].count,
      recent_visits: recentVisits,
    },
  });
}

