import { requireAccess } from '@/lib/access';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth-session';
import { toURLSearchParams } from '@/lib/search-params';
import { parsePeriod } from '@/lib/period';
import { PeriodPicker } from '@/components/period-picker';
import { AttendanceClient } from './attendance-client';

export const metadata = { title: 'Явки' };
export const dynamic = 'force-dynamic';

export default async function AttendancePage({ searchParams }: { searchParams: { [k: string]: string | string[] | undefined } }) {
  const session = await getSession();
  requireAccess(session?.role, 'attendance', '/dashboard/operations');

  const sp = toURLSearchParams(searchParams);
  const period = parsePeriod(sp);

  return (
    <div className="grid">
      <div>
        <h1 className="page-title">Явки</h1>
        <p className="page-subtitle">Отметки прихода и ухода сотрудников из iiko за выбранный период.</p>
      </div>
      <PeriodPicker from={period.from} to={period.to} activePreset={sp.get('preset') || 'this_month'} />
      <AttendanceClient from={period.from} to={period.to} />
    </div>
  );
}
