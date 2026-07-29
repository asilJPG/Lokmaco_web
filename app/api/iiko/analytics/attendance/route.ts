import { parseStringPromise } from 'xml2js';
import { withIikoSession, iikoGetText } from '@/lib/iiko';
import { requireSession } from '@/lib/auth-session';
import { getCurrentFilialIds } from '@/lib/current-filial';
import { resolveIikoCreds } from '@/lib/filial-iiko';

export const dynamic = 'force-dynamic';

export type AttendanceShift = {
  dateFrom: string;
  dateTo: string;
  departmentName: string;
  attendanceType: string;
  comment: string;
};

export type AttendanceEmployee = {
  id: string;
  name: string;
  role: string;
  shifts: AttendanceShift[];
};

export async function GET(req: Request) {
  const session = await requireSession();
  if (session.role.split(':')[0] !== 'admin') {
    return Response.json({ error: 'Доступ запрещен' }, { status: 403 });
  }

  const sp = new URL(req.url).searchParams;
  const from = sp.get('from');
  const to = sp.get('to');
  if (!from || !to) return Response.json({ error: 'from, to required' }, { status: 400 });

  const filialIds = await getCurrentFilialIds();
  if (filialIds.length === 0) return Response.json({ data: [] });

  const { xml: creds } = await resolveIikoCreds(filialIds[0]);

  try {
    const employees = await withIikoSession(async (token) => {
      const empXml = await iikoGetText('employees', token, creds);
      const attXml = await iikoGetText(`employees/attendance?from=${from}&to=${to}`, token, creds);

      const allEmployees: { id: string; name: string; role: string }[] = [];
      if (empXml) {
        const empParsed = await parseStringPromise(empXml);
        for (const emp of empParsed?.employees?.employee ?? []) {
          const id = emp.id?.[0];
          const name = emp.name?.[0];
          const deleted = emp.deleted?.[0] === 'true';
          const isEmployee = emp.employee?.[0] === 'true';
          const role = emp.mainRoleCode?.[0] || 'STAFF';
          if (id && name && !deleted && isEmployee) allEmployees.push({ id, name, role });
        }
      }

      const attendanceMap = new Map<string, AttendanceShift[]>();
      if (attXml) {
        const attParsed = await parseStringPromise(attXml);
        for (const att of attParsed?.attendances?.attendance ?? []) {
          const empId = att.employeeId?.[0];
          if (!empId) continue;
          const shift: AttendanceShift = {
            dateFrom: att.dateFrom?.[0] || '',
            dateTo: att.dateTo?.[0] || '',
            departmentName: att.departmentName?.[0] || '',
            attendanceType: att.attendanceType?.[0] || 'Р',
            comment: att.comment?.[0] || '',
          };
          const list = attendanceMap.get(empId) || [];
          list.push(shift);
          attendanceMap.set(empId, list);
        }
      }

      const result: AttendanceEmployee[] = allEmployees
        .map((emp) => ({ ...emp, shifts: (attendanceMap.get(emp.id) || []).sort((a, b) => a.dateFrom.localeCompare(b.dateFrom)) }))
        .filter((emp) => emp.shifts.length > 0);

      result.sort((a, b) => a.name.localeCompare(b.name, 'ru'));
      return result;
    }, creds);

    return Response.json({ data: employees });
  } catch (e) {
    return Response.json({ data: [], error: e instanceof Error ? e.message : 'iiko request failed' });
  }
}
