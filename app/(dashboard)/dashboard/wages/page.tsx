import { getSession } from '@/lib/auth-session';
import { getCurrentFilialIds } from '@/lib/current-filial';
import { toURLSearchParams } from '@/lib/search-params';
import { parsePeriod, fmtMoney, fmtDate, todayTashkent } from '@/lib/period';
import { getWagesStats } from '@/lib/wages';
import { PeriodPicker } from '@/components/period-picker';
import { EmployeeWagesTable } from '@/components/employee-wages-table';

export const metadata = { title: 'Зарплаты' };
export const dynamic = 'force-dynamic';

export default async function WagesPage({ searchParams }: { searchParams: { [k: string]: string | string[] | undefined } }) {
  const session = await getSession();
  const filialIds = await getCurrentFilialIds();
  const sp = toURLSearchParams(searchParams);
  const period = parsePeriod(sp);
  const today = todayTashkent();
  const stats = await getWagesStats(filialIds, period.from, period.to);

  return (
    <div className="grid">
      <div>
        <h1 className="page-title">Заработная плата сотрудников</h1>
        {stats.latestWageDate ? (() => {
          const daysAgo = Math.round((new Date(today).getTime() - new Date(stats.latestWageDate).getTime()) / 86400000);
          const stale = daysAgo > 1;
          return (
            <p className="page-subtitle">
              📅 Последние данные за: <b>{fmtDate(stats.latestWageDate)}</b>
              {' '}
              <span style={{ marginLeft: 8, padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: stale ? '#fef3c7' : '#dcfce7', color: stale ? '#92400e' : '#166534' }}>
                {daysAgo === 0 ? 'сегодня' : daysAgo === 1 ? 'вчера' : `${daysAgo} дн. назад`}
              </span>
            </p>
          );
        })() : (
          <p className="page-subtitle">Данных по ЗП пока нет</p>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, alignItems: 'center' }}>
        {stats.periodTotalPaid > 0 && (
          <a href={`/api/wages/export?from=${period.from}&to=${period.to}`} className="btn btn--sm">⬇ Экспорт CSV</a>
        )}
      </div>

      <PeriodPicker from={period.from} to={period.to} activePreset={sp.get('preset') || 'this_month'} />

      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-card__label">Всего выплачено</div>
          <div className="stat-card__value">{fmtMoney(stats.periodTotalPaid)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card__label">Средняя выплата за смену</div>
          <div className="stat-card__value">{fmtMoney(stats.avgDailyPaid)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card__label">Смен с выплатами</div>
          <div className="stat-card__value">{stats.daysCount}</div>
        </div>
      </div>

      <div className="grid grid--2">
        <section className="card">
          <div className="card__title"><span className="card__title-text">📅 По дням</span></div>
          {stats.days.length === 0 ? (
            <div className="empty-state">Данных нет</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase' }}>
                  <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Дата</th>
                  <th style={{ padding: '8px', textAlign: 'right', borderBottom: '1px solid var(--border)' }}>Чел.</th>
                  <th style={{ padding: '8px', textAlign: 'right', borderBottom: '1px solid var(--border)' }}>Сумма</th>
                </tr>
              </thead>
              <tbody>
                {stats.days.map((d) => (
                  <tr key={d.date} data-today={d.date === today || undefined}>
                    <td style={{ padding: '8px', borderBottom: '1px solid var(--border)' }}>{fmtDate(d.date)}</td>
                    <td style={{ padding: '8px', textAlign: 'right', borderBottom: '1px solid var(--border)' }}>{d.count}</td>
                    <td style={{ padding: '8px', textAlign: 'right', borderBottom: '1px solid var(--border)', fontVariantNumeric: 'tabular-nums' }}>{fmtMoney(d.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="card">
          <div className="card__title"><span className="card__title-text">👤 По сотрудникам</span></div>
          {stats.byEmployee.length === 0 ? (
            <div className="empty-state">Данных нет</div>
          ) : (
            <EmployeeWagesTable rows={stats.byEmployee} />
          )}
        </section>
      </div>
    </div>
  );
}
