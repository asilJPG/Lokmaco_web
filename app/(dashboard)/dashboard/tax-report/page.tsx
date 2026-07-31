import { requireAccess } from '@/lib/access';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth-session';
import { toURLSearchParams } from '@/lib/search-params';
import { parsePeriod } from '@/lib/period';
import { PeriodPicker } from '@/components/period-picker';
import { TaxReportClient } from './tax-report-client';

export const metadata = { title: 'Налоговый отчёт' };
export const dynamic = 'force-dynamic';

export default async function TaxReportPage({ searchParams }: { searchParams: { [k: string]: string | string[] | undefined } }) {
  const session = await getSession();
  requireAccess(session?.role, 'taxReport', '/dashboard/finance');

  const sp = toURLSearchParams(searchParams);
  const period = parsePeriod(sp);

  return (
    <div className="grid">
      <div>
        <h1 className="page-title">Налоговый отчёт</h1>
        <p className="page-subtitle">Реализация, расход сырья по техкартам и списания — выгрузка для 1С.</p>
      </div>
      <PeriodPicker from={period.from} to={period.to} activePreset={sp.get('preset') || 'this_month'} />
      <TaxReportClient from={period.from} to={period.to} />
    </div>
  );
}
