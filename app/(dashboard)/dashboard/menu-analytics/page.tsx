import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth-session';
import { toURLSearchParams } from '@/lib/search-params';
import { parsePeriod } from '@/lib/period';
import { PeriodPicker } from '@/components/period-picker';
import { MenuAnalyticsClient } from './client';

export const metadata = { title: 'Аналитика меню' };
export const dynamic = 'force-dynamic';

export default async function MenuAnalyticsPage({ searchParams }: { searchParams: { [k: string]: string | string[] | undefined } }) {
  const session = await getSession();
  if (!['admin', 'director', 'manager'].includes((session?.role || '').split(':')[0])) redirect('/dashboard');

  const sp = toURLSearchParams(searchParams);
  const period = parsePeriod(sp);

  return (
    <div className="grid">
      <div>
        <h1 className="page-title">Аналитика меню</h1>
        <p className="page-subtitle">Food cost и наценка по каждому блюду, ABC-анализ — прямо из себестоимости iiko.</p>
      </div>
      <PeriodPicker from={period.from} to={period.to} activePreset={sp.get('preset') || 'this_month'} />
      <MenuAnalyticsClient from={period.from} to={period.to} />
    </div>
  );
}
