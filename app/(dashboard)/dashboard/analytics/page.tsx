import { getSession } from '@/lib/auth-session';
import { requireAccess } from '@/lib/access';
import { toURLSearchParams } from '@/lib/search-params';
import { parsePeriod } from '@/lib/period';
import { PeriodPicker } from '@/components/period-picker';
import { AnalyticsHub } from './hub';

export const metadata = { title: 'Аналитика' };
export const dynamic = 'force-dynamic';

export default async function AnalyticsPage({ searchParams }: { searchParams: { [k: string]: string | string[] | undefined } }) {
  const session = await getSession();
  requireAccess(session?.role, 'analytics', '/dashboard/finance');

  const sp = toURLSearchParams(searchParams);
  const period = parsePeriod(sp);

  return (
    <div className="grid">
      <div>
        <h1 className="page-title">Аналитика</h1>
        <p className="page-subtitle">Продажи, меню, склад и закупки — всё из iiko за выбранный период.</p>
      </div>
      <PeriodPicker from={period.from} to={period.to} activePreset={sp.get('preset') || 'this_month'} />
      <AnalyticsHub from={period.from} to={period.to} role={session?.role || ''} />
    </div>
  );
}
