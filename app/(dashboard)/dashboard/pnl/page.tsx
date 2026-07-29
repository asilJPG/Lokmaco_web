import { getSession } from '@/lib/auth-session';
import { getCurrentFilialIds } from '@/lib/current-filial';
import { toURLSearchParams } from '@/lib/search-params';
import { parsePeriod, fmtMoney, fmtDate, todayTashkent } from '@/lib/period';
import { getPnLStats } from '@/lib/pnl';
import { PeriodPicker } from '@/components/period-picker';

export const metadata = { title: 'P&L' };
export const dynamic = 'force-dynamic';

export default async function PnLPage({ searchParams }: { searchParams: { [k: string]: string | string[] | undefined } }) {
  const session = await getSession();
  const filialIds = await getCurrentFilialIds();
  const sp = toURLSearchParams(searchParams);
  const period = parsePeriod(sp);
  const today = todayTashkent();
  const stats = await getPnLStats(filialIds, period.from, period.to);

  return (
    <div className="grid">
      <div>
        <h1 className="page-title">Прибыли и убытки</h1>
        <p className="page-subtitle">Доходы минус все категории расходов за выбранный период.</p>
      </div>

      <PeriodPicker from={period.from} to={period.to} activePreset={sp.get('preset') || 'this_month'} />

      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-card__label">💰 Выручка</div>
          <div className="stat-card__value" style={{ color: 'var(--success)' }}>{fmtMoney(stats.revenue)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card__label">🛒 Расходы кассира</div>
          <div className="stat-card__value">{fmtMoney(stats.cashierExpenses)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card__label">👥 ЗП</div>
          <div className="stat-card__value">{fmtMoney(stats.wages)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card__label">🏦 Админ-расходы</div>
          <div className="stat-card__value">{fmtMoney(stats.adminExpenses)}</div>
        </div>
        <div className="stat-card" style={{ background: stats.netProfit >= 0 ? 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)' : 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)', borderColor: stats.netProfit >= 0 ? '#86efac' : '#fca5a5', gridColumn: 'span 2' }}>
          <div className="stat-card__label" style={{ color: stats.netProfit >= 0 ? '#166534' : '#b91c1c' }}>📈 Чистая прибыль {stats.revenue > 0 ? `· маржа ${(stats.netProfit / stats.revenue * 100).toFixed(1)}%` : ''}</div>
          <div className="stat-card__value" style={{ color: stats.netProfit >= 0 ? '#064e3b' : '#7f1d1d' }}>{fmtMoney(stats.netProfit)}</div>
        </div>
      </div>

      <section className="card">
        <div className="card__title"><span className="card__title-text">📅 По дням</span></div>
        {stats.daily.length === 0 ? (
          <div className="empty-state">За выбранный период данных нет</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase' }}>
                  <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Дата</th>
                  <th style={{ padding: '8px', textAlign: 'right', borderBottom: '1px solid var(--border)' }}>Выручка</th>
                  <th style={{ padding: '8px', textAlign: 'right', borderBottom: '1px solid var(--border)' }}>Расходы</th>
                  <th style={{ padding: '8px', textAlign: 'right', borderBottom: '1px solid var(--border)' }}>ЗП</th>
                  <th style={{ padding: '8px', textAlign: 'right', borderBottom: '1px solid var(--border)' }}>Админ</th>
                  <th style={{ padding: '8px', textAlign: 'right', borderBottom: '1px solid var(--border)' }}>Прибыль</th>
                </tr>
              </thead>
              <tbody>
                {stats.daily.map((d) => {
                  const profit = d.revenue - d.expenses - d.wages - d.admin;
                  return (
                    <tr key={d.date} data-today={d.date === today || undefined}>
                      <td style={{ padding: '8px', borderBottom: '1px solid var(--border)' }}>{fmtDate(d.date)}</td>
                      <td style={{ padding: '8px', textAlign: 'right', borderBottom: '1px solid var(--border)', fontVariantNumeric: 'tabular-nums' }}>{fmtMoney(d.revenue)}</td>
                      <td style={{ padding: '8px', textAlign: 'right', borderBottom: '1px solid var(--border)', fontVariantNumeric: 'tabular-nums' }}>{fmtMoney(d.expenses)}</td>
                      <td style={{ padding: '8px', textAlign: 'right', borderBottom: '1px solid var(--border)', fontVariantNumeric: 'tabular-nums' }}>{fmtMoney(d.wages)}</td>
                      <td style={{ padding: '8px', textAlign: 'right', borderBottom: '1px solid var(--border)', fontVariantNumeric: 'tabular-nums' }}>{fmtMoney(d.admin)}</td>
                      <td style={{ padding: '8px', textAlign: 'right', borderBottom: '1px solid var(--border)', fontVariantNumeric: 'tabular-nums', color: profit >= 0 ? 'var(--success)' : 'var(--danger)', fontWeight: 600 }}>{profit > 0 ? '+' : ''}{fmtMoney(profit)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
