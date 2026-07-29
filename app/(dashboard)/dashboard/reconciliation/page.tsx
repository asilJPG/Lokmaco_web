import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth-session';
import { toURLSearchParams } from '@/lib/search-params';
import { parsePeriod } from '@/lib/period';
import { PeriodPicker } from '@/components/period-picker';
import { ReconciliationClient } from './client';

export const metadata = { title: 'Сверка iiko vs касса' };
export const dynamic = 'force-dynamic';

export default async function ReconciliationPage({ searchParams }: { searchParams: { [k: string]: string | string[] | undefined } }) {
  const session = await getSession();
  if ((session?.role || '').split(':')[0] !== 'admin') redirect('/dashboard');

  const sp = toURLSearchParams(searchParams);
  const period = parsePeriod(sp);

  return (
    <div className="grid">
      <div>
        <h1 className="page-title">Сверка iiko vs касса</h1>
        <p className="page-subtitle">Сумма по типу оплаты из iiko против того, что сдал кассир, по каждому типу отдельно.</p>
      </div>
      <PeriodPicker from={period.from} to={period.to} activePreset={sp.get('preset') || 'today'} />
      <ReconciliationClient from={period.from} to={period.to} />
    </div>
  );
}
