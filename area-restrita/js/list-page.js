export function paginate(rows, page, pageSize = 20) {
  const list = Array.isArray(rows) ? rows : [];
  const total = list.length;
  const pages = Math.max(1, Math.ceil(total / pageSize) || 1);
  const current = Math.min(Math.max(1, Number(page) || 1), pages);
  const start = (current - 1) * pageSize;
  return {
    total,
    pages,
    page: current,
    rows: list.slice(start, start + pageSize),
  };
}

export function sortByDate(rows, field = "criado_em", direction = "desc") {
  const dir = direction === "asc" ? 1 : -1;
  return [...(rows || [])].sort((a, b) => {
    const av = new Date(a?.[field] || 0).getTime();
    const bv = new Date(b?.[field] || 0).getTime();
    return (av - bv) * dir;
  });
}
