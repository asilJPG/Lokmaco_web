'use client';

import { useEffect, useRef, type ReactNode } from 'react';

/**
 * Обёртка вокруг таблицы: на телефоне строки становятся карточками.
 *
 * Раньше широкая таблица пряталась в `overflow-x: auto`, и страницу листали
 * вбок — самое неприятное место в интерфейсе по отзыву. Просто дать таблице
 * сжаться нельзя: десять колонок на 375px — это 35px на колонку.
 *
 * Поэтому каждой ячейке проставляется подпись из шапки (`data-label`), и на
 * узком экране строка разворачивается в столбик «подпись → значение». Подписи
 * снимаются с живого DOM, а не пишутся руками в каждой из двух десятков
 * таблиц: иначе половина из них разъехалась бы с шапкой при первой же правке.
 */
export function StackTable({ children, className = '' }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;

    const apply = () => {
      const table = root.querySelector('table');
      if (!table) return;
      const heads = Array.from(table.querySelectorAll('thead th')).map((th) => (th.textContent || '').trim());
      if (heads.length === 0) return;

      for (const row of Array.from(table.querySelectorAll('tbody tr'))) {
        Array.from(row.children).forEach((cell, i) => {
          const el = cell as HTMLTableCellElement;
          // Ячейки на всю ширину — это «ничего не найдено» и раскрытые
          // детали: подпись из шапки им не подходит и только мешает.
          if (el.colSpan > 1) { delete el.dataset.label; return; }
          const label = heads[i];
          if (label) el.dataset.label = label;
        });
      }
    };

    apply();
    // Таблицы перерисовываются от фильтров и сортировки — подписи должны
    // переезжать вместе со строками.
    const mo = new MutationObserver(apply);
    mo.observe(root, { childList: true, subtree: true });
    return () => mo.disconnect();
  });

  return (
    <div ref={ref} className={`table-stack ${className}`.trim()}>
      {children}
    </div>
  );
}
