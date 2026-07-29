import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth-session';
import { toURLSearchParams } from '@/lib/search-params';
import { parsePeriod } from '@/lib/period';
import { PeriodPicker } from '@/components/period-picker';
import { AnalyticsHub } from './hub';

export const metadata = { title: 'Аналитика' };
export const dynamic = 'force-dynamic';

export default async function AnalyticsPage({ searchParams }: { searchParams: { [k: string]: string | string[] | undefined } }) {
  const session = await getSession();
  const baseRole = (session?.role || '').split(':')[0];
  if (!['admin', 'director', 'manager'].includes(baseRole)) redirect('/dashboard/finance');

  const sp = toURLSearchParams(searchParams);
  const period = parsePeriod(sp);

  return (
    <div className="grid">
      <div>
        <h1 className="page-title">Аналитика</h1>
        <p className="page-subtitle">Продажи, меню, склад и закупки — всё из iiko за выбранный период.</p>
      </div>
      <PeriodPicker from={period.from} to={period.to} activePreset={sp.get('preset') || 'this_month'} />
      <AnalyticsHub from={period.from} to={period.to} isAdmin={baseRole === 'admin'} />
    </div>
  );
}
