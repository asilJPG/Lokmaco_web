import { http1Fetch } from "@/lib/iiko.js";
import ExcelJS from "exceljs";

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_KEY = process.env.SUPABASE_KEY || "";

function getHeaders() {
  return {
    "Content-Type": "application/json",
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
  };
}

export const dynamic = "force-dynamic";

// Canonicalization alias map
const DB_TO_EXCEL_MAP = {
  "Аббосхон": "Азамхонов Аббосхон",
  "Абдумуталипов Зиёбек": "Абдумуталипов З",
  "Зиёдуллаев Жасур": "Зиедуллаев Ж",
  "Косимжонов Нажмиддин": "Косимжонов Н",
  "Мухаммадов М": "Мухаммадов  М",
  "Стажер": "Стажер ",
  "Умархожаева": "Умархожаева ",
  "Умиджон": "Умиджон ",
  "Абдукодиров Ш": "Абдукобулов Ш",
  "Абдукодилов Ш": "Абдукобулов Ш",
  "Абдукодилов Шахзод": "Абдукобулов Ш",
  "Аминжовон Асиль": "Аминжонов А",
  "Азимхонов Аббосхон": "Азамхонов Аббосхон",
  "Мухторов МухаммадДийор": "Мухтаров М",
  "Мухторов М": "Мухтаров М"
};

// String normalization for robust matching
function normalizeForMatch(str) {
  if (!str) return "";
  return str.trim()
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/\s+/g, " ");
}

// Canonical Employee List Template
const TEMPLATE_EMPLOYEES = [
  // Бар
  { name: "Бойматов Шохрух", role: "ст.Бар", dept: "Бар" },
  { name: "Мухтаров Д", role: "Бар", dept: "Бар" },
  { name: "Набиев К", role: "Бар", dept: "Бар" },
  { name: "Каримов М", role: "Бар", dept: "Бар" },
  { name: "Мухтаров М", role: "Бар", dept: "Бар" },

  // Кухня
  { name: "Бабаев Достон", role: "кухня", dept: "Кухня" },
  { name: "Мойдинов Диёрбек", role: "кухня", dept: "Кухня" },
  { name: "Холматов Ш", role: "кухня", dept: "Кухня" },
  { name: "Кобулов П", role: "кухня", dept: "Кухня" },
  { name: "Зокиров Хожиакбар", role: "кухня", dept: "Кухня" },
  { name: "Абдукобулов Ш", role: "морож", dept: "Кухня" },
  { name: "Масаидов З", role: "кухня", dept: "Кухня" },
  { name: "Хамралиев А", role: "кухня", dept: "Кухня" },
  { name: "Рахматова Ф", role: "кухня", dept: "Кухня" },
  { name: "Хакимова Д", role: "фрукта", dept: "Кухня" },
  { name: "Каримова М", role: "фрукта", dept: "Кухня", specialCheck: (wage) => wage <= 150000 },
  { name: "Холматов Б", role: "кухня", dept: "Кухня" },
  { name: "Хасанов Х", role: "кухня", dept: "Кухня" },

  // Менеджер и официанты
  { name: "Машрабжанов О", role: "Менеджер", dept: "Менеджер и официанты" },
  { name: "Шарафидинов С", role: "Менеджер", dept: "Менеджер и официанты" },
  { name: "Абдумуталипов З", role: "офф", dept: "Менеджер и официанты" },
  { name: "Кобулов Ш", role: "офф", dept: "Менеджер и официанты" },
  { name: "Косимжонов Н", role: "офф", dept: "Менеджер и официанты" },
  { name: "Зиедуллаев Ж", role: "офф", dept: "Менеджер и официанты" },
  { name: "Исаков Ж", role: "офф", dept: "Менеджер и официанты" },
  { name: "Носиров М", role: "офф", dept: "Менеджер и официанты" },
  { name: "Омонов С", role: "офф", dept: "Менеджер и официанты" },
  { name: "Шерматова Д", role: "офф", dept: "Менеджер и официанты" },
  { name: "Икромжонова Ш", role: "офф", dept: "Менеджер и официанты" },
  { name: "Олимова М", role: "офф", dept: "Менеджер и официанты" },
  { name: "Хасанов А", role: "офф", dept: "Менеджер и официанты" },
  { name: "Эркинов Б", role: "офф", dept: "Менеджер и официанты" },
  { name: "Мухаммадов  М", role: "офф", dept: "Менеджер и официанты" },
  { name: "Сатторова К", role: "офф", dept: "Менеджер и официанты" },
  { name: "Азамов Асадбек", role: "офф", dept: "Менеджер и официанты" },
  { name: "Арзиев Жасур", role: "офф", dept: "Менеджер и официанты" },
  { name: "Олтибеков А", role: "офф", dept: "Менеджер и официанты" },
  { name: "Кидирбоев С", role: "офф", dept: "Менеджер и официанты" },
  { name: "Стажер ", role: "офф", dept: "Менеджер и официанты" },
  { name: "Абдумуталипов Х", role: "офф", dept: "Менеджер и официанты" },

  // Мойка
  { name: "Кадирова Киммат", role: "мойка", dept: "Мойка" },
  { name: "Юлдашева Сабохат", role: "мойка", dept: "Мойка" },
  { name: "Юлдашева Садокат", role: "мойка", dept: "Мойка" },
  { name: "Маматова Ирода", role: "мойка", dept: "Мойка" },
  { name: "Умархожаева ", role: "мойка", dept: "Мойка" },
  { name: "Хасанова З", role: "мойка", dept: "Мойка" },
  { name: "Каримова М", role: "смесь", dept: "Мойка", specialCheck: (wage) => wage > 150000 },

  // Администрация
  { name: "Аминжонов А", role: "бухгалтер ", dept: "Администрация" },
  { name: "Акбаралиев М", role: "Снабженец", dept: "Администрация" },
  { name: "Азамхонов Аббосхон", role: "кассир", dept: "Администрация" },
  { name: "Толиб ака", role: "", dept: "Администрация" },
  { name: "Умиджон ", role: "", dept: "Администрация" }
];

// Robust matching logic
function findTemplateEmployee(dbName, wageAmt) {
  const normalizedDb = normalizeForMatch(dbName);
  if (!normalizedDb) return null;

  // 1. Resolve alias first if defined
  let resolvedName = dbName.trim().replace(/\s+/g, " ");
  if (DB_TO_EXCEL_MAP[resolvedName]) {
    resolvedName = DB_TO_EXCEL_MAP[resolvedName];
  }
  const normResolved = normalizeForMatch(resolvedName);

  // Try exact match first
  let matches = TEMPLATE_EMPLOYEES.filter(item => {
    const normTemplate = normalizeForMatch(item.name);
    return normTemplate === normResolved;
  });

  if (matches.length > 0) {
    if (matches.length === 1) {
      return matches[0];
    }
    // Handle duplicates (like Karimova M)
    const specialMatch = matches.find(item => item.specialCheck && item.specialCheck(wageAmt));
    if (specialMatch) return specialMatch;
    return matches[0];
  }

  // 2. Fuzzy part match (Last Name + Initial)
  const dbParts = normResolved.split(" ");
  if (dbParts.length >= 1) {
    const dbLastName = dbParts[0];
    const dbInitial = dbParts[1] ? dbParts[1][0] : null;

    const fuzzyMatches = TEMPLATE_EMPLOYEES.filter(item => {
      const tParts = normalizeForMatch(item.name).split(" ");
      const tLastName = tParts[0];
      const tInitial = tParts[1] ? tParts[1][0] : null;

      // Last name must match exactly
      if (tLastName !== dbLastName) return false;

      // If database contains an initial, verify that first letters match
      if (dbInitial && tInitial) {
        return tInitial === dbInitial;
      }
      return true;
    });

    if (fuzzyMatches.length > 0) {
      if (fuzzyMatches.length === 1) {
        return fuzzyMatches[0];
      }
      // Handle duplicates (like Karimova M)
      const specialMatch = fuzzyMatches.find(item => item.specialCheck && item.specialCheck(wageAmt));
      if (specialMatch) return specialMatch;
      return fuzzyMatches[0];
    }
  }

  return null;
}

function getColLetter(col) {
  let temp, letter = "";
  while (col > 0) {
    temp = (col - 1) % 26;
    letter = String.fromCharCode(65 + temp) + letter;
    col = (col - temp - 1) / 26;
  }
  return letter;
}

export async function GET(request) {
  try {
    const requesterRole = request.headers.get("x-user-role") || "";
    const [baseRole] = requesterRole.split(":");
    if (baseRole !== "admin" && baseRole !== "director") {
      return Response.json({ error: "Доступ запрещен" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const dateFrom = searchParams.get("from");
    const dateTo = searchParams.get("to");

    if (!dateFrom || !dateTo) {
      return Response.json({ error: "Укажите даты from и to" }, { status: 400 });
    }

    // Fetch records from Supabase
    const url = `${SUPABASE_URL}/rest/v1/bot_actions?action_type=eq.cash&order=created_at.desc&limit=1500`;
    const res = await http1Fetch(url, {
      method: "GET",
      headers: getHeaders(),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Supabase query failed: ${res.status} ${errText}`);
    }

    const records = await res.json();
    
    // Generate dates list
    const datesList = [];
    let curr = new Date(dateFrom);
    const end = new Date(dateTo);
    while (curr <= end) {
      datesList.push(curr.toISOString().split("T")[0]);
      curr.setDate(curr.getDate() + 1);
    }

    // Map: groupedWages[key][date] = wage
    const groupedWages = {};
    const outOfTemplateEmployees = {};

    // Process wages
    for (const rec of records) {
      const createdAt = rec.created_at || "";
      const dateKey = rec.details?.selected_date || createdAt.split("T")[0] || "";

      if (dateKey >= dateFrom && dateKey <= dateTo) {
        const wages = rec.details?.employee_wages || [];
        for (const w of wages) {
          const rawName = w.name || "";
          const wageAmt = parseFloat(w.wage) || 0;

          const matchedItem = findTemplateEmployee(rawName, wageAmt);

          if (matchedItem) {
            const key = `${matchedItem.name}_${matchedItem.dept}`;
            if (!groupedWages[key]) {
              groupedWages[key] = {
                name: matchedItem.name,
                role: matchedItem.role,
                dept: matchedItem.dept,
                wages: {}
              };
            }
            groupedWages[key].wages[dateKey] = wageAmt;
          } else {
            // Out of Template employee
            const canonicalName = rawName.trim().replace(/\s+/g, " ");
            if (!outOfTemplateEmployees[canonicalName]) {
              outOfTemplateEmployees[canonicalName] = {
                name: canonicalName,
                role: "",
                dept: "Вне шаблона",
                wages: {}
              };
            }
            outOfTemplateEmployees[canonicalName].wages[dateKey] = wageAmt;
          }
        }
      }
    }

    // Build rows
    const rowsToExport = [];
    const depts = ["Бар", "Кухня", "Менеджер и официанты", "Мойка", "Администрация"];
    
    for (const deptName of depts) {
      const deptItems = TEMPLATE_EMPLOYEES.filter(item => item.dept === deptName);
      
      if (deptName !== "Администрация") {
        rowsToExport.push({ isHeader: true, name: deptName });
      } else {
        rowsToExport.push({ isSpacer: true });
      }
      
      deptItems.forEach(item => {
        const key = `${item.name}_${item.dept}`;
        const wagesObj = groupedWages[key] ? groupedWages[key].wages : {};
        rowsToExport.push({
          isHeader: false,
          name: item.name,
          role: item.role,
          dept: item.dept,
          wages: wagesObj
        });
      });
    }

    // Append out-of-template
    const outOfTemplateList = Object.values(outOfTemplateEmployees);
    if (outOfTemplateList.length > 0) {
      rowsToExport.push({ isHeader: true, name: "Вне шаблона" });
      outOfTemplateList.forEach(item => {
        rowsToExport.push({
          isHeader: false,
          name: item.name,
          role: "",
          dept: "Вне шаблона",
          wages: item.wages
        });
      });
    }

    // Create Excel
    const workbook = new ExcelJS.Workbook();
    const formatDateShort = (dStr) => {
      const parts = dStr.split("-");
      if (parts.length === 3) {
        return `${parts[2]}.${parts[1]}`;
      }
      return dStr;
    };
    const sheetName = `${formatDateShort(dateFrom)}-${formatDateShort(dateTo)}`;
    const worksheet = workbook.addWorksheet(sheetName);
    worksheet.views = [{ showGridLines: true }];

    const titleRange = `${formatDateShort(dateFrom)}.${dateFrom.split("-")[0].slice(2)}-${formatDateShort(dateTo)}.${dateTo.split("-")[0].slice(2)}`;
    worksheet.getCell("C3").value = `The Lokmaco Fergana -ЗП таблица ${titleRange}`;
    worksheet.getCell("C3").font = { name: "Calibri", size: 16, bold: true };

    const headerRowIdx = 5;
    const colNoIdx = 3; // C
    const colFioIdx = 4; // D
    const colRoleIdx = 5; // E
    const colWagesStartIdx = 6; // F
    
    const totalDays = datesList.length;
    const colAccruedIdx = colWagesStartIdx + totalDays;
    const colAdvanceIdx = colAccruedIdx + 1;
    const colNetIdx = colAdvanceIdx + 1;
    const colPaidIdx = colNetIdx + 1;
    const colSpacerIdx = colPaidIdx + 1;
    const colSignatureIdx = colSpacerIdx + 1;

    worksheet.getCell(headerRowIdx, colNoIdx).value = "";
    worksheet.getCell(headerRowIdx, colFioIdx).value = "Ф.И.О.";
    worksheet.getCell(headerRowIdx, colRoleIdx).value = "Должность";
    
    datesList.forEach((dateStr, idx) => {
      const cell = worksheet.getCell(headerRowIdx, colWagesStartIdx + idx);
      cell.value = new Date(dateStr);
      cell.numFmt = "dd.mm";
    });

    worksheet.getCell(headerRowIdx, colAccruedIdx).value = "итого начислено";
    worksheet.getCell(headerRowIdx, colAdvanceIdx).value = "Аванс";
    worksheet.getCell(headerRowIdx, colNetIdx).value = "Итого на руки";
    worksheet.getCell(headerRowIdx, colPaidIdx).value = "Оплачено";
    worksheet.getCell(headerRowIdx, colSignatureIdx).value = "Подпись";

    const thinBorder = {
      top: { style: "thin", color: { argb: "BFBFBF" } },
      left: { style: "thin", color: { argb: "BFBFBF" } },
      bottom: { style: "thin", color: { argb: "BFBFBF" } },
      right: { style: "thin", color: { argb: "BFBFBF" } }
    };

    for (let c = colNoIdx; c <= colSignatureIdx; c++) {
      if (c === colSpacerIdx) continue;
      const cell = worksheet.getCell(headerRowIdx, c);
      cell.font = { name: "Calibri", size: 11, bold: true };
      cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
      cell.border = thinBorder;
    }

    worksheet.getRow(headerRowIdx).height = 25;

    let currentDeptRowNo = 0;
    let currentRowIdx = 6;

    rowsToExport.forEach(row => {
      if (row.isSpacer) {
        worksheet.getRow(currentRowIdx).height = 20;
        currentRowIdx++;
      } else if (row.isHeader) {
        worksheet.mergeCells(currentRowIdx, colNoIdx, currentRowIdx, colSignatureIdx);
        const cell = worksheet.getCell(currentRowIdx, colNoIdx);
        cell.value = row.name;
        cell.font = { name: "Calibri", size: 11, bold: true };
        cell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
        
        for (let c = colNoIdx; c <= colSignatureIdx; c++) {
          worksheet.getCell(currentRowIdx, c).border = thinBorder;
        }
        worksheet.getRow(currentRowIdx).height = 22;
        currentDeptRowNo = 0;
        currentRowIdx++;
      } else {
        currentDeptRowNo++;
        
        const cellNo = worksheet.getCell(currentRowIdx, colNoIdx);
        cellNo.value = currentDeptRowNo;
        cellNo.numFmt = "0.0";
        cellNo.alignment = { vertical: "middle", horizontal: "center" };
        
        const cellFio = worksheet.getCell(currentRowIdx, colFioIdx);
        cellFio.value = row.name;
        cellFio.alignment = { vertical: "middle", horizontal: "left" };
        
        let colorHex = null;
        if (row.dept === "Бар") {
          colorHex = "FFFFF2CC";
        } else if (row.dept === "Кухня") {
          colorHex = "FFF8CBAD";
        } else if (row.dept === "Менеджер и официанты") {
          if (row.role === "Менеджер") {
            colorHex = "FFFFFF00";
          } else {
            colorHex = "FFE2EFDA";
          }
        } else if (row.dept === "Мойка") {
          colorHex = "FFBDD7EE";
        }

        if (colorHex) {
          cellFio.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: colorHex }
          };
        }
        
        const cellRole = worksheet.getCell(currentRowIdx, colRoleIdx);
        cellRole.value = row.role;
        cellRole.alignment = { vertical: "middle", horizontal: "left" };

        datesList.forEach((dateStr, idx) => {
          const cellWage = worksheet.getCell(currentRowIdx, colWagesStartIdx + idx);
          const wageVal = row.wages[dateStr];
          
          cellWage.value = (wageVal && wageVal > 0) ? wageVal : 0;
          cellWage.numFmt = "#,##0.00";
          cellWage.alignment = { vertical: "middle", horizontal: "right" };
          cellWage.border = thinBorder;
        });

        const startLetter = getColLetter(colWagesStartIdx);
        const endLetter = getColLetter(colWagesStartIdx + totalDays - 1);
        const cellAccrued = worksheet.getCell(currentRowIdx, colAccruedIdx);
        cellAccrued.value = {
          formula: `SUM(${startLetter}${currentRowIdx}:${endLetter}${currentRowIdx})`
        };
        cellAccrued.numFmt = "#,##0.00";
        cellAccrued.alignment = { vertical: "middle", horizontal: "right" };

        const cellAdvance = worksheet.getCell(currentRowIdx, colAdvanceIdx);
        cellAdvance.value = 0;
        cellAdvance.numFmt = "#,##0.00";
        cellAdvance.alignment = { vertical: "middle", horizontal: "right" };

        const accruedLetter = getColLetter(colAccruedIdx);
        const advanceLetter = getColLetter(colAdvanceIdx);
        const cellNet = worksheet.getCell(currentRowIdx, colNetIdx);
        cellNet.value = {
          formula: `${accruedLetter}${currentRowIdx}-${advanceLetter}${currentRowIdx}`
        };
        cellNet.numFmt = "#,##0.00";
        cellNet.alignment = { vertical: "middle", horizontal: "right" };

        const cellPaid = worksheet.getCell(currentRowIdx, colPaidIdx);
        cellPaid.alignment = { vertical: "middle", horizontal: "right" };
        cellPaid.numFmt = "#,##0.00";

        for (let c = colNoIdx; c <= colSignatureIdx; c++) {
          if (c === colSpacerIdx) continue;
          const cell = worksheet.getCell(currentRowIdx, c);
          cell.border = thinBorder;
          cell.font = { name: "Calibri", size: 11 };
        }

        worksheet.getRow(currentRowIdx).height = 20;
        currentRowIdx++;
      }
    });

    const sumRowIdx = currentRowIdx;
    
    for (let c = colNoIdx; c <= colRoleIdx; c++) {
      worksheet.getCell(sumRowIdx, c).border = thinBorder;
    }

    const firstDataRowIdx = 7;
    const lastDataRowIdx = sumRowIdx - 1;

    datesList.forEach((_, idx) => {
      const colIdx = colWagesStartIdx + idx;
      const colLetter = getColLetter(colIdx);
      const cellSum = worksheet.getCell(sumRowIdx, colIdx);
      cellSum.value = {
        formula: `SUM(${colLetter}${firstDataRowIdx}:${colLetter}${lastDataRowIdx})`
      };
      cellSum.font = { name: "Calibri", size: 11, bold: true };
      cellSum.alignment = { vertical: "middle", horizontal: "right" };
      cellSum.numFmt = "#,##0.00";
      cellSum.border = thinBorder;
    });

    const sumCols = [colAccruedIdx, colAdvanceIdx, colNetIdx, colPaidIdx];
    sumCols.forEach(c => {
      const colLetter = getColLetter(c);
      const cellSum = worksheet.getCell(sumRowIdx, c);
      cellSum.value = {
        formula: `SUM(${colLetter}${firstDataRowIdx}:${colLetter}${lastDataRowIdx})`
      };
      cellSum.font = { name: "Calibri", size: 11, bold: true };
      cellSum.alignment = { vertical: "middle", horizontal: "right" };
      cellSum.numFmt = "#,##0.00";
      cellSum.border = thinBorder;
    });

    worksheet.getCell(sumRowIdx, colSpacerIdx).value = "";
    const cellSigSum = worksheet.getCell(sumRowIdx, colSignatureIdx);
    cellSigSum.value = "";
    cellSigSum.border = thinBorder;

    worksheet.getRow(sumRowIdx).height = 22;

    worksheet.getColumn(1).width = 2;
    worksheet.getColumn(2).width = 2;
    worksheet.getColumn(colNoIdx).width = 4;
    worksheet.getColumn(colFioIdx).width = 25;
    worksheet.getColumn(colRoleIdx).width = 15;
    
    datesList.forEach((_, idx) => {
      worksheet.getColumn(colWagesStartIdx + idx).width = 9;
    });

    worksheet.getColumn(colAccruedIdx).width = 16;
    worksheet.getColumn(colAdvanceIdx).width = 10;
    worksheet.getColumn(colNetIdx).width = 16;
    worksheet.getColumn(colPaidIdx).width = 12;
    worksheet.getColumn(colSpacerIdx).width = 2;
    worksheet.getColumn(colSignatureIdx).width = 12;

    const buffer = await workbook.xlsx.writeBuffer();
    return new Response(buffer, {
      headers: {
        "Content-Disposition": `attachment; filename="wages_report_${dateFrom}_to_${dateTo}.xlsx"`,
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        "Pragma": "no-cache",
        "Expires": "0",
      }
    });

  } catch (e) {
    console.error("[/api/iiko/analytics/wages/export GET]", e.message);
    return Response.json({ error: "Внутренняя ошибка сервера: " + e.message }, { status: 500 });
  }
}
