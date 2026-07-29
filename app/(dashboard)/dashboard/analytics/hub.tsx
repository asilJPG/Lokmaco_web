'use client';

import { useEffect } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { OverviewTab } from './overview-tab';
import { IikoTabs } from './iiko-tabs';
import { DishesTab } from './dishes-tab';
import { LiquidityTab } from './liquidity-tab';
import { PricesTab } from './prices-tab';

export type TabId = 'overview' | 'pl' | 'abc' | 'liquidity' | 'sales' | 'purchases' | 'waiters';

const TABS: { id: TabId; label: string }[] = [
  { id: 'overview', label: 'Обзор' },
  { id: 'pl', label: 'ОПиУ' },
  { id: 'abc', label: 'ABC-анализ блюд' },
  { id: 'liquidity', label: 'Ликвидность' },
  { id: 'sales', label: 'Продажи по группам' },
  { id: 'purchases', label: 'Закупки' },
  { id: 'waiters', label: 'Официанты' },
];

/** Явки и Сверка уехали в «Смену» и «Финансы» — старые ссылки не должны ломаться. */
const MOVED: Record<string, string> = {
  attendance: '/dashboard/attendance',
  reconciliation: '/dashboard/reconciliation',
};

export function AnalyticsHub({ from, to }: { from: string; to: string }) {
  const router = useRouter();
  const path = usePathname();
  const sp = useSearchParams();

  const raw = sp?.get('tab');
  const moved = raw ? MOVED[raw] : undefined;

  useEffect(() => {
    if (moved) router.replace(moved);
  }, [moved, router]);

  const visible = TABS;
  const tab: TabId = visible.some((t) => t.id === raw) ? (raw as TabId) : 'overview';

  // The tab lives in the URL so the sidebar can deep-link and the view survives
  // a reload or a shared link.
  function select(id: TabId) {
    const next = new URLSearchParams(sp?.toString() || '');
    if (id === 'overview') next.delete('tab');
    else next.set('tab', id);
    router.replace(`${path}?${next.toString()}`, { scroll: false });
  }

  return (
    <div className="grid">
      <div className="segmented" role="tablist">
        {visible.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className="segmented__item"
            onClick={() => select(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && <OverviewTab from={from} to={to} />}
      {tab === 'abc' && <DishesTab from={from} to={to} />}
      {tab === 'liquidity' && <LiquidityTab />}
      {tab === 'purchases' && <PricesTab from={from} to={to} />}
      {(tab === 'pl' || tab === 'sales' || tab === 'waiters') && (
        <IikoTabs from={from} to={to} tab={tab} />
      )}
    </div>
  );
}
