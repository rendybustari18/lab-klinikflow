import pool from './db';

// T20: pencatatan audit terpusat. Gunakan koneksi transaksi yang sama dengan
// operasi bisnisnya agar audit dan perubahan data berhasil/gagal bersamaan.

interface Queryable {
  query: (sql: string, values?: any[]) => Promise<any>;
}

export interface AuditEntry {
  actorId: number | null;
  clinicId: number | null;
  action: string;
  entityType: string;
  entityId: number | null;
  details?: Record<string, unknown>;
}

export interface ClientInfo {
  // Alamat peer TCP langsung (nginx bila lewat :8080, klien bila lewat :3000).
  ip: string | null;
  // X-Real-IP yang dipasang nginx. Hanya bermakna untuk request lewat nginx;
  // pada akses langsung ke :3000 nilainya dikendalikan klien.
  forwardedIp: string | null;
}

export function clientDetails(client: ClientInfo): Record<string, string> {
  const details: Record<string, string> = {};
  if (client.ip) details.ip = client.ip;
  if (client.forwardedIp) details.forwarded_ip = client.forwardedIp;
  return details;
}

export async function writeAudit(entry: AuditEntry, db: Queryable = pool): Promise<void> {
  await db.query(
    'INSERT INTO audit_log (actor_id, clinic_id, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?, ?)',
    [entry.actorId, entry.clinicId, entry.action, entry.entityType, entry.entityId,
      entry.details ? JSON.stringify(entry.details) : null]
  );
}
