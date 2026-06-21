import { parseStringPromise } from "xml2js";
import { iikoAuth, iikoLogout, iikoGetRaw } from "@/lib/iiko.js";

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const requesterRole = request.headers.get("x-user-role") || "";
    const [baseRole] = requesterRole.split(":");
    if (!["admin", "director", "manager"].includes(baseRole)) {
      return Response.json({ error: "Доступ запрещен" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date");

    if (!date) {
      return Response.json({ error: "Укажите дату" }, { status: 400 });
    }

    // 1. Auth iiko XML Server
    const token = await iikoAuth();
    if (!token) {
      return Response.json({ error: "Ошибка авторизации iiko" }, { status: 500 });
    }

    let allEmployees = [];
    let attendanceRecords = [];

    try {
      // 2. Fetch all employees
      const xmlEmployees = await iikoGetRaw("employees", token);
      const empParsed = await parseStringPromise(xmlEmployees);
      
      const empMap = {};
      if (empParsed?.employees?.employee) {
        for (const emp of empParsed.employees.employee) {
          const id = emp.id?.[0];
          const name = emp.name?.[0];
          const deleted = emp.deleted?.[0] === "true";
          const isEmployee = emp.employee?.[0] === "true";
          const mainRoleCode = emp.mainRoleCode?.[0] || "STAFF";

          if (id && name && !deleted && isEmployee) {
            allEmployees.push({
              id,
              name,
              role: mainRoleCode
            });
            empMap[id] = { name, role: mainRoleCode };
          }
        }
      }

      // 3. Fetch attendance for the date
      const xmlAttendance = await iikoGetRaw(`employees/attendance?from=${date}&to=${date}`, token);
      const attParsed = await parseStringPromise(xmlAttendance);
      if (attParsed?.attendances?.attendance) {
        attendanceRecords = attParsed.attendances.attendance;
      }
    } finally {
      // Always logout from XML Server
      await iikoLogout(token);
    }

    // 4. Map attendance records by employeeId
    const attendanceMap = {};
    for (const att of attendanceRecords) {
      const empId = att.employeeId?.[0];
      if (empId) {
        if (!attendanceMap[empId]) {
          attendanceMap[empId] = [];
        }
        attendanceMap[empId].push({
          dateFrom: att.dateFrom?.[0] || "",
          dateTo: att.dateTo?.[0] || "",
          departmentName: att.departmentName?.[0] || "",
          attendanceType: att.attendanceType?.[0] || "Р",
          comment: att.comment?.[0] || ""
        });
      }
    }

    // 5. Combine data
    const result = allEmployees.map(emp => {
      const atts = attendanceMap[emp.id];
      if (atts && atts.length > 0) {
        return {
          ...emp,
          isActive: true,
          shifts: atts
        };
      } else {
        return {
          ...emp,
          isActive: false,
          shifts: []
        };
      }
    });

    // Sort: first active ones (by name), then inactive ones (by name)
    result.sort((a, b) => {
      if (a.isActive !== b.isActive) {
        return a.isActive ? -1 : 1;
      }
      return a.name.localeCompare(b.name, "ru");
    });

    return Response.json({
      success: true,
      date,
      employees: result
    });
  } catch (e) {
    console.error("[/api/iiko/analytics/attendance GET]", e.message);
    return Response.json({ error: "Внутренняя ошибка сервера" }, { status: 500 });
  }
}
