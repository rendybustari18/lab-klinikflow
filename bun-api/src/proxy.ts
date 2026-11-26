import { extractAuthUser } from './auth';
import { createHash, createHmac } from 'node:crypto';

const PHP_API_BASE = process.env.PHP_API_URL || 'http://php-api';
const INTERNAL_AUTH_SECRET = process.env.INTERNAL_AUTH_SECRET;
if (!INTERNAL_AUTH_SECRET || Buffer.byteLength(INTERNAL_AUTH_SECRET) < 32 || INTERNAL_AUTH_SECRET === process.env.JWT_SECRET) {
  throw new Error('INTERNAL_AUTH_SECRET harus berbeda dari JWT_SECRET dan memiliki sedikitnya 32 byte');
}
const internalSecret: string = INTERNAL_AUTH_SECRET;

export async function proxyToPhp(
  req: Request,
  targetScript: string,
  actionOverride?: string,
  extraParams?: Record<string, string>
): Promise<Response> {
  const url = new URL(req.url);
  const user = await extractAuthUser(req);
  if (!user) return Response.json({ success: false, error: 'Akses ditolak' }, { status: 401 });

  const targetUrl = new URL(`${PHP_API_BASE}/${targetScript}`);
  url.searchParams.forEach((val, key) => {
    targetUrl.searchParams.set(key, val);
  });

  if (actionOverride) {
    targetUrl.searchParams.set('action', actionOverride);
  }

  if (extraParams) {
    for (const [k, v] of Object.entries(extraParams)) {
      targetUrl.searchParams.set(k, v);
    }
  }

  const headers = new Headers();
  headers.set('Content-Type', req.headers.get('Content-Type') || 'application/json');

  headers.set('X-User-Id', String(user.id));
  headers.set('X-User-Role', user.role);
  headers.set('X-Clinic-Id', String(user.clinic_id));

  const method = req.method;
  let body = '';

  if (method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS') {
    try {
      body = await req.text();
    } catch {
      return Response.json({ success: false, error: 'Request tidak valid' }, { status: 400 });
    }
  }

  const timestamp = String(Math.floor(Date.now() / 1000));
  const bodyHash = createHash('sha256').update(body).digest('hex');
  const canonical = [method, targetUrl.pathname + targetUrl.search, timestamp, String(user.id), user.role, String(user.clinic_id), bodyHash].join('\n');
  headers.set('X-Internal-Timestamp', timestamp);
  headers.set('X-Internal-Signature', createHmac('sha256', internalSecret).update(canonical).digest('hex'));

  try {
    const phpRes = await fetch(targetUrl.toString(), {
      method,
      headers,
      body: method === 'GET' || method === 'HEAD' ? undefined : body,
    });

    const resBody = await phpRes.text();
    const contentType = phpRes.headers.get('Content-Type') || 'application/json';

    return new Response(resBody, {
      status: phpRes.status,
      headers: {
        'Content-Type': contentType,
      },
    });
  } catch (error: any) {
    return Response.json({
      success: false,
      error: 'Gagal meneruskan request ke layanan laporan',
    }, { status: 502 });
  }
}

