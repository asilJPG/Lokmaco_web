'use client';

import { useEffect, useState } from 'react';
import { LineChart, ShareBars, Heatmap, KpiCard, type SeriesPoint } from '@/components/charts';

type DayPoint = { date: string; revenue: number; guests: number; orders: number };
type SharePoint = { name: string; value: number; share: number };
type HeatCell = { weekday: number; hour: number; value: number };
type Kpi = { value: number; deltaPercent: number | null };
type WeakDay = { weekday: number; label: string; avgRevenue: number; gap: number };

type Data = {
  days: DayPoint[];
  prevDays: DayPoint[];
  kpi: {
    revenue: Kpi; guests: Kpi; orders: Kpi;
    avgPerGuest: Kpi; avgPerOrder: Kpi; revenuePerDay: Kpi;
  };
  categories: SharePoint[];
  payTypes: SharePoint[];
  stores: SharePoint[];
  heatmap: HeatCell[];
  peak: { weekday: number; hour: number; value: number } | null;
  weakDays: WeakDay[];
  weakDayPotential: number;
};

const WEEKDAY_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

function fmt(n: number) {
  return Math.round(n).toLocaleString('ru-RU');
}

function dayLabel(iso: string) {
  return iso.slice(8, 10) + '.' + iso.slice(5, 7);
}

type Metric = 'revenue' | 'guests' | 'orders';

const METRICS: { key: Metric; label: string; unit: string }[] = [
  { key: 'revenue', label: 'Выручка', unit: 'сум' },
  { key: 'guests', label: 'Гости', unit: '' },
  { key: 'orders', label: 'Заказы', unit: '' },
];

export function OverviewTab({ from, to }: { from: string; to: string }) {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [metric, setMetric] = useState<Metric>('revenue');
  const [structure, setStructure] = useState<'categories' | 'payTypes' | 'stores'>('categories');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/iiko/analytics/overview?from=${from}&to=${to}`);
        const json = await res.json();
        if (cancelled) return;
        setData(json.data || null);
        if (json.error) setError(json.error);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'fetch failed');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [from, to]);

  if (loading) return <div className="card"><div className="empty-state">Загрузка из iiko…</div></div>;
  if (!data) return <div className="banner banner--error">{error || 'Нет данных'}</div>;

  const series: SeriesPoint[] = data.days.map((d) => ({ label: dayLabel(d.date), value: d[metric] }));
  // The comparison line is aligned by position, not by date: the previous period
  // is the same number of days immediately before this one.
  const compare: SeriesPoint[] = data.prevDays.map((d) => ({ label: dayLabel(d.date), value: d[metric] }));
  const activeMetric = METRICS.find((m) => m.key === metric)!;

  return (
    <div className="grid">
      {error && <div className="banner banner--warn">{error}</div>}

      <div className="stat-grid">
        <KpiCard label="💰 Выручка" value={fmt(data.kpi.revenue.value)} deltaPercent={data.kpi.revenue.deltaPercent} />
        <KpiCard label="📅 Выручка / день" value={fmt(data.kpi.revenuePerDay.value)} deltaPercent={data.kpi.revenuePerDay.deltaPercent} hint="среднее за дни с продажами" />
        <KpiCard label="👥 Гости" value={fmt(data.kpi.guests.value)} deltaPercent={data.kpi.guests.deltaPercent} />
        <KpiCard label="🧾 Заказы" value={fmt(data.kpi.orders.value)} deltaPercent={data.kpi.orders.deltaPercent} />
        <KpiCard label="🍽 Ср. чек / гость" value={fmt(data.kpi.avgPerGuest.value)} deltaPercent={data.kpi.avgPerGuest.deltaPercent} />
        <KpiCard label="🧮 Ср. чек / заказ" value={fmt(data.kpi.avgPerOrder.value)} deltaPercent={data.kpi.avgPerOrder.deltaPercent} />
      </div>

      {data.weakDayPotential > 0 && data.weakDays.length > 0 && (
        <section className="insight">
          <div className="insight__body">
            <div className="insight__title">📈 Потенциальный эффект: подтянуть слабые дни недели</div>
            <div className="insight__desc">
              Средняя выручка дня за период — {fmt(data.kpi.revenuePerDay.value)}, но {data.weakDays.length}{' '}
              {data.weakDays.length === 1 ? 'день' : 'дня(-ей)'} недели стабильно ниже. Акции, брони и события в слабые дни подтянут их к среднему.
            </div>
            <div className="insight__chips">
              {data.weakDays.slice(0, 4).map((w) => (
                <span key={w.weekday} className="insight__chip">{w.label} <b>+{fmt(w.gap)}</b></span>
              ))}
            </div>
          </div>
          <div className="insight__total">
            <div className="insight__amount">+{fmt(data.weakDayPotential)}</div>
            <div className="insight__caption">в неделю</div>
            <div className="insight__amount" style={{ fontSize: 15, marginTop: 6 }}>≈ +{fmt(data.weakDayPotential * 4.33)}</div>
            <div className="insight__caption">в месяц</div>
          </div>
        </section>
      )}

      <section className="card">
        <div className="card__title">
          <span className="card__title-text">📊 Динамика по дням</span>
          <div className="segmented" role="tablist">
            {METRICS.map((m) => (
              <button key={m.key} type="button" role="tab" aria-selected={metric === m.key} className="segmented__item" onClick={() => setMetric(m.key)}>
                {m.label}
              </button>
            ))}
          </div>
        </div>
        <LineChart points={series} compare={compare} valueLabel={activeMetric.unit} />
        <div style={{ display: 'flex', gap: 16, fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 14, height: 2, background: 'var(--accent)', display: 'inline-block' }} /> Факт
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 14, height: 0, borderTop: '2px dashed var(--text-faint)', display: 'inline-block' }} /> Пред. период
          </span>
        </div>
      </section>

      <div className="grid grid--2">
        <section className="card">
          <div className="card__title">
            <span className="card__title-text">🥧 Структура выручки</span>
            <div className="segmented" role="tablist">
              <button type="button" role="tab" aria-selected={structure === 'categories'} className="segmented__item" onClick={() => setStructure('categories')}>Группы блюд</button>
              <button type="button" role="tab" aria-selected={structure === 'payTypes'} className="segmented__item" onClick={() => setStructure('payTypes')}>Оплаты</button>
              <button type="button" role="tab" aria-selected={structure === 'stores'} className="segmented__item" onClick={() => setStructure('stores')}>Цеха</button>
            </div>
          </div>
          <ShareBars items={data[structure]} />
        </section>

        <section className="card">
          <div className="card__title">
            <span className="card__title-text">🔥 Загрузка: день недели × час</span>
            {data.peak && (
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Пик: {WEEKDAY_SHORT[data.peak.weekday]} {data.peak.hour}:00 · {fmt(data.peak.value)} блюд
              </span>
            )}
          </div>
          <Heatmap cells={data.heatmap} />
        </section>
      </div>
    </div>
  );
}
