import { getSession } from '@/lib/auth-session';
import { getCurrentFilialIds } from '@/lib/current-filial';
import { toURLSearchParams } from '@/lib/search-params';
import { parsePeriod, fmtMoney, fmtDate, todayTashkent } from '@/lib/period';
import { getSafeStats } from '@/lib/safe';
import { listAdminExpenses } from '@/lib/admin-expense';
import { PeriodPicker } from '@/components/period-picker';
import { AdminExpenseForm, DeleteExpenseButton } from '@/components/admin-expense-form';

export const metadata = { title: 'Сейф' };
export const dynamic = 'force-dynamic';

export default async function SafePage({ searchParams }: { searchParams: { [k: string]: string | string[] | undefined } }) {
  const session = await getSession();
  const filialIds = await getCurrentFilialIds();
  const sp = toURLSearchParams(searchParams);
  const period = parsePeriod(sp);
  const today = todayTashkent();
  const [stats, expenses] = await Promise.all([
    getSafeStats(filialIds, period.from, period.to),
    listAdminExpenses(filialIds, period.from, period.to),
  ]);
  const canEdit = ['admin', 'director'].includes((session?.role || '').split(':')[0]);
  const primaryFilial = filialIds[0] || 0;

  return (
    <div className="grid">
      <div>
        <h1 className="page-title">Сейф</h1>
        <p className="page-subtitle">Все наличные минус административные расходы. Зелёная карточка — на конец выбранного периода.</p>
      </div>

      <PeriodPicker from={period.from} to={period.to} activePreset={sp.get('preset') || 'this_month'} />

      <div className="stat-grid">
        <div className="stat-card" style={{ background: 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)', borderColor: '#86efac' }}>
          <div className="stat-card__label" style={{ color: '#166534' }}>💰 Остаток сейфа на {period.to}</div>
          <div className="stat-card__value" style={{ color: '#064e3b' }}>{fmtMoney(stats.allTimeBalance)} сум</div>
        </div>
        <div className="stat-card" style={{ background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)', borderColor: '#93c5fd' }}>
          <div className="stat-card__label" style={{ color: '#1d4ed8' }}>💵 Сдано налом за период</div>
          <div className="stat-card__value" style={{ color: '#1e3a8a' }}>{fmtMoney(stats.periodCashIn)} сум</div>
        </div>
        <div className="stat-card" style={{ background: 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)', borderColor: '#fca5a5' }}>
          <div className="stat-card__label" style={{ color: '#b91c1c' }}>💸 Расходы из сейфа за период</div>
          <div className="stat-card__value" style={{ color: '#7f1d1d' }}>{fmtMoney(stats.periodAdminExpenses)} сум</div>
        </div>
      </div>

      {canEdit && primaryFilial > 0 && (
        <AdminExpenseForm defaultDate={todayTashkent()} defaultFilialId={primaryFilial} />
      )}

      <section className="card">
        <div className="card__title"><span className="card__title-text">🏦 Расходы из сейфа за период</span></div>
        {expenses.length === 0 ? (
          <div className="empty-state">За период расходов нет</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase' }}>
                  <th style={{ padding: '10px 8px', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Дата</th>
                  <th style={{ padding: '10px 8px', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Название</th>
                  <th style={{ padding: '10px 8px', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Кто</th>
                  <th style={{ padding: '10px 8px', textAlign: 'right', borderBottom: '1px solid var(--border)' }}>Сумма</th>
                  {canEdit && <th style={{ padding: '10px 8px', width: 40, borderBottom: '1px solid var(--border)' }}></th>}
                </tr>
              </thead>
              <tbody>
                {expenses.map((e) => (
                  <tr key={e.id}>
                    <td style={{ padding: '8px', borderBottom: '1px solid var(--border)' }}>{fmtDate(e.date)}</td>
                    <td style={{ padding: '8px', borderBottom: '1px solid var(--border)' }}>{e.name}</td>
                    <td style={{ padding: '8px', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>{e.userName || '—'}</td>
                    <td style={{ padding: '8px', textAlign: 'right', borderBottom: '1px solid var(--border)', fontVariantNumeric: 'tabular-nums', color: 'var(--danger)', fontWeight: 600 }}>{fmtMoney(e.amount)}</td>
                    {canEdit && <td style={{ padding: '8px', borderBottom: '1px solid var(--border)' }}><DeleteExpenseButton id={e.id} /></td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card">
        <div className="card__title"><span className="card__title-text">📊 Движение по дням</span></div>
        {stats.daily.length === 0 ? (
          <div className="empty-state">За выбранный период данных нет</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  <th style={{ padding: '10px 8px', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Дата</th>
                  <th style={{ padding: '10px 8px', textAlign: 'right', borderBottom: '1px solid var(--border)' }}>Сдано налом</th>
                  <th style={{ padding: '10px 8px', textAlign: 'right', borderBottom: '1px solid var(--border)' }}>Расход из сейфа</th>
                </tr>
              </thead>
              <tbody>
                {stats.daily.map((d) => (
                  <tr key={d.date} data-today={d.date === today || undefined}>
                    <td style={{ padding: '8px', borderBottom: '1px solid var(--border)' }}>{fmtDate(d.date)}</td>
                    <td style={{ padding: '8px', textAlign: 'right', borderBottom: '1px solid var(--border)', fontVariantNumeric: 'tabular-nums' }}>{fmtMoney(d.cashIn)}</td>
                    <td style={{ padding: '8px', textAlign: 'right', borderBottom: '1px solid var(--border)', fontVariantNumeric: 'tabular-nums', color: d.expense > 0 ? 'var(--danger)' : 'var(--text-faint)' }}>{d.expense > 0 ? fmtMoney(d.expense) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
