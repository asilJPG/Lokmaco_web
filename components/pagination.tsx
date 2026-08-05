'use client';

/**
 * Листалка для клиентских списков.
 *
 * На телефоне это единственный способ дойти до конца длинной таблицы: без неё
 * страница остатков рисовала полторы тысячи строк разом — прокрутка на пол-часа
 * и заметный тормоз при каждом вводе в поиск.
 */
export function Pagination({
  page, total, pageSize, onPage,
}: { page: number; total: number; pageSize: number; onPage: (p: number) => void }) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="pagination">
      <div className="pagination__side">
        <button type="button" className="btn btn--sm" onClick={() => onPage(1)} disabled={page === 1} title="Первая страница">«</button>
        <button type="button" className="btn btn--sm" onClick={() => onPage(page - 1)} disabled={page === 1}>← Назад</button>
      </div>
      <span className="pagination__status">{from}–{to} из {total} · стр. {page}/{totalPages}</span>
      <div className="pagination__side">
        <button type="button" className="btn btn--sm" onClick={() => onPage(page + 1)} disabled={page >= totalPages}>Дальше →</button>
        <button type="button" className="btn btn--sm" onClick={() => onPage(totalPages)} disabled={page >= totalPages} title="Последняя страница">»</button>
      </div>
    </div>
  );
}
