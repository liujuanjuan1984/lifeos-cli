export interface Pagination {
  page: number;
  size: number;
  total: number;
  pages: number;
}

export interface ListResponse<TItem, TMeta> {
  items: TItem[];
  pagination: Pagination;
  meta: TMeta;
}
