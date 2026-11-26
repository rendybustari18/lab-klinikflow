// T22: paginasi daftar. ?page (mulai 1) dan ?limit (default 20, maksimum 100).
export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;

export interface Pagination {
  page: number;
  limit: number;
  offset: number;
}

export function parsePagination(url: URL): Pagination | Response {
  const pageRaw = url.searchParams.get('page') ?? '1';
  const limitRaw = url.searchParams.get('limit') ?? String(DEFAULT_LIMIT);
  if (!/^\d{1,6}$/.test(pageRaw) || !/^\d{1,6}$/.test(limitRaw) || Number(pageRaw) < 1 || Number(limitRaw) < 1) {
    return Response.json({ success: false, error: 'Parameter page dan limit harus bilangan bulat positif' }, { status: 400 });
  }
  const page = Number(pageRaw);
  const limit = Math.min(Number(limitRaw), MAX_LIMIT);
  return { page, limit, offset: (page - 1) * limit };
}

export function paginationMeta(pagination: Pagination, total: number) {
  return {
    page: pagination.page,
    limit: pagination.limit,
    total,
    total_pages: Math.max(1, Math.ceil(total / pagination.limit)),
  };
}
