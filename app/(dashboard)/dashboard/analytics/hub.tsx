'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { OverviewTab } from './overview-tab';
import { IikoTabs } from './iiko-tabs';
import { DishesTab } from './dishes-tab';
import { LiquidityTab } from './liquidity-tab';
import { PricesTab } from './prices-tab';
import { ReconciliationTab } from './reconciliation-tab';

export type TabId = 'overview' | 'pl' | 'abc' | 'liquidity' | 'sales' | 'purchases' | 'waiters' | 'attendance' | 'reconciliation';

const TABS: { id: TabId; label: string; adminOnly?: boolean }[] = [
  { id: 'overview', label: 'Обзор' },
  { id: 'pl', label: 'ОПиУ' },
  { id: 'abc', label: 'ABC-анализ блюд' },
  { id: 'liquidity', label: 'Ликвидность' },
  { id: 'sales', label: 'Продажи по группам' },
  { id: 'purchases', label: 'Закупки' },
  { id: 'waiters', label: 'Официанты' },
  { id: 'attendance', label: 'Явки', adminOnly: true },
  { id: 'reconciliation', label: 'Сверка', adminOnly: true },
];

export function AnalyticsHub({ from, to, isAdmin }: { from: string; to: string; isAdmin: boolean }) {
  const router = useRouter();
  const path = usePathname();
  const sp = useSearchParams();

  const raw = sp?.get('tab') as TabId | null;
  const visible = TABS.filter((t) => !t.adminOnly || isAdmin);
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
      {tab === 'reconciliation' && <ReconciliationTab from={from} to={to} />}
      {(tab === 'pl' || tab === 'sales' || tab === 'waiters' || tab === 'attendance') && (
        <IikoTabs from={from} to={to} tab={tab} isAdmin={isAdmin} />
      )}
    </div>
  );
}
