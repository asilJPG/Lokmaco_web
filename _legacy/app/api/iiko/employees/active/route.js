import { parseStringPromise } from "xml2js";
import { iikoAuth, iikoLogout, iikoGetRaw, http1Fetch } from "@/lib/iiko.js";
import { withIikoWebSession } from "@/lib/iiko-web.js";

const IIKO_WEB_URL = (process.env.IIKO_WEB_URL || "https://the-lokmako.iikoweb.ru").replace(/\/+$/, "");

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date");

    if (!date) {
      return Response.json({ success: false, error: "Укажите дату" }, { status: 400 });
    }

    // 1. Auth iiko XML Server
    const token = await iikoAuth();
    if (!token) {
      return Response.json({ success: false, error: "Ошибка авторизации iiko" }, { status: 500 });
    }

    let activeEmployeeIds = new Set();
    let empMap = {};
    let wages = [];

    try {
      // 2. Fetch all employees to map id -> name
      const xmlEmployees = await iikoGetRaw("employees", token);
      const empParsed = await parseStringPromise(xmlEmployees);
      if (empParsed?.employees?.employee) {
        for (const emp of empParsed.employees.employee) {
          const id = emp.id?.[0];
          const name = emp.name?.[0];
          const deleted = emp.deleted?.[0] === "true";
          if (id && name && !deleted) {
            empMap[id] = name;
          }
        }
      }

      // 3. Fetch attendance for the date
      const xmlAttendance = await iikoGetRaw(`employees/attendance?from=${date}&to=${date}`, token);
      const attParsed = await parseStringPromise(xmlAttendance);
      if (attParsed?.attendances?.attendance) {
        for (const att of attParsed.attendances.attendance) {
          const empId = att.employeeId?.[0];
          if (empId) {
            activeEmployeeIds.add(empId);
          }
        }
      }
    } finally {
      // Always logout from XML Server
      await iikoLogout(token);
    }

    // 4. Fetch default wages from iikoWeb
    try {
      wages = await withIikoWebSession(async (cookies) => {
        const url = `${IIKO_WEB_URL}/api/labor/employee/wage/list?from=${date}&to=${date}`;
        const res = await http1Fetch(url, {
          method: "GET",
          headers: { Cookie: cookies },
        });
        if (res.ok) {
          const json = await res.json();
          return json.data || [];
        }
        return [];
      });
    } catch (webErr) {
      console.error("[active employees] failed to fetch wages from iikoWeb:", webErr.message);
      // We can continue even if wages fail, default to 0
    }

    const wageMap = {};
    for (const w of wages) {
      if (w.employeeId) {
        wageMap[w.employeeId] = w.payment;
      }
    }

    // 5. Combine and build response list
    const resultEmployees = [];
    for (const empId of activeEmployeeIds) {
      const name = empMap[empId];
      if (name) {
        resultEmployees.push({
          id: empId,
          name: name,
          defaultWage: wageMap[empId] || 0,
        });
      }
    }

    // Sort by name for neat rendering in UI
    resultEmployees.sort((a, b) => a.name.localeCompare(b.name, "ru"));

    return Response.json({ success: true, employees: resultEmployees });
  } catch (e) {
    console.error("[/api/iiko/employees/active] GET error:", e.message);
    return Response.json({ success: false, error: "Внутренняя ошибка сервера" }, { status: 500 });
  }
}
