import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth-session';
import { toURLSearchParams } from '@/lib/search-params';
import { parsePeriod } from '@/lib/period';
import { PeriodPicker } from '@/components/period-picker';
import { IikoAnalyticsClient } from './client';

export const metadata = { title: 'Аналитика iiko' };
export const dynamic = 'force-dynamic';

export default async function IikoAnalyticsPage({ searchParams }: { searchParams: { [k: string]: string | string[] | undefined } }) {
  const session = await getSession();
  if (!['admin', 'director', 'manager'].includes((session?.role || '').split(':')[0])) redirect('/dashboard');

  const sp = toURLSearchParams(searchParams);
  const period = parsePeriod(sp);
  const isAdmin = (session?.role || '').split(':')[0] === 'admin';

  return (
    <div className="grid">
      <div>
        <h1 className="page-title">Аналитика iiko</h1>
        <p className="page-subtitle">Топ блюд и KPI официантов прямо из iiko.</p>
      </div>
      <PeriodPicker from={period.from} to={period.to} activePreset={sp.get('preset') || 'this_month'} />
      <IikoAnalyticsClient from={period.from} to={period.to} isAdmin={isAdmin} />
    </div>
  );
}
