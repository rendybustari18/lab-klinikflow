// T22: metadata paginasi yang dikirim endpoint daftar.
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
}
