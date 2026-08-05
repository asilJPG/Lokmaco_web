'use client';

import { useState } from 'react';
import { InventoryClient } from './inventory-client';
import { DiscrepanciesReport } from './discrepancies';

/**
 * Пересчёт и его результат живут рядом, как в легаси: вкладка «Расхождения»
 * появляется только у админа — суммы недостач по складам не для тех ролей,
 * которые эти пересчёты и проводят.
 */
export function InventoryTabs({ canSeeDiscrepancies }: { canSeeDiscrepancies: boolean }) {
  const [view, setView] = useState<'count' | 'discrepancies'>('count');

  if (!canSeeDiscrepancies) return <InventoryClient />;

  return (
    <div className="grid">
      <div className="segmented" role="tablist">
        <button type="button" role="tab" aria-selected={view === 'count'} className="segmented__item" onClick={() => setView('count')}>
          📋 Новый пересчёт
        </button>
        <button type="button" role="tab" aria-selected={view === 'discrepancies'} className="segmented__item" onClick={() => setView('discrepancies')}>
          📊 Расхождения
        </button>
      </div>
      {view === 'count' ? <InventoryClient /> : <DiscrepanciesReport />}
    </div>
  );
}
