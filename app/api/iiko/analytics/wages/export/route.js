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
  "Абдукодилов Шахзод": "Абдукобулов Ш"
};

function canonicalizeName(name) {
  if (!name) return "";
  const n = name.trim().replace(/\s+/g, " ");
  if (DB_TO_EXCEL_MAP[n]) {
    return DB_TO_EXCEL_MAP[n];
  }
  return n;
}

// Canonical Employee List Template
const TEMPLATE_EMPLOYEES = [
  // Бар
  { name: "Бойматов Шохрух", role: "ст.Бар", dept: "Бар" },
  { name: "Мухтаров Д", role: "бармен", dept: "Бар" },
  { name: "Набиев К", role: "бармен", dept: "Бар" },
  { name: "Каримов М", role: "бармен", dept: "Бар" },
  { name: "Мухтаров М", role: "бармен", dept: "Бар" },

  // Кухня
  { name: "Бабаев Достон", role: "Шеф", dept: "Кухня" },
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

  // Мойка
  { name: "Кадирова Киммат", role: "мойка", dept: "Мойка" },
  { name: "Юлдашева Сабохат", role: "мойка", dept: "Мойка" },
  { name: "Юлдашева Садокат", role: "мойка", dept: "Мойка" },
  { name: "Маматова Ирода", role: "мойка", dept: "Мойка" },
  { name: "Умархожаева ", role: "мойка", dept: "Мойка" },
  { name: "Хасанова З", role: "мойка", dept: "Мойка" },
  { name: "Каримова М", role: "смесь", dept: "Мойка", specialCheck: (wage) => wage > 150000 },

  // Администрация
  { name: "Аминжонов А", role: "бухгалтер", dept: "Администрация" },
  { name: "Акбаралиев М", role: "Снабженец", dept: "Администрация" },
  { name: "Азамхонов Аббосхон", role: "кассир", dept: "Администрация" },
  { name: "Умиджон ", role: "", dept: "Администрация" }
];

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
    if (baseRole !== "admin") {
      return Response.json({ error: "Доступ запрещен" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const dateFrom = searchParams.get("from");
    const dateTo = searchParams.get("to");

    if (!dateFrom || !dateTo) {
      return Response.json({ error: "Укажите даты from и to" }, { status: 400 });
    }

    // 1. Fetch records from Supabase
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
    
    // Generate the full dates list in ascending order
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

    // Process wage records
    for (const rec of records) {
      const createdAt = rec.created_at || "";
      const dateKey = rec.details?.selected_date || createdAt.split("T")[0] || "";

      if (dateKey >= dateFrom && dateKey <= dateTo) {
        const wages = rec.details?.employee_wages || [];
        for (const w of wages) {
          const rawName = w.name || "";
          const canonicalName = canonicalizeName(rawName);
          const wageAmt = parseFloat(w.wage) || 0;

          let matchedItem = null;
          if (canonicalName === "Каримова М") {
            // Distinguish fruit-prep vs wash mixtures
            const isKitchen = wageAmt <= 150000;
            matchedItem = TEMPLATE_EMPLOYEES.find(item => 
              item.name === "Каримова М" && 
              (isKitchen ? item.dept === "Кухня" : item.dept === "Мойка")
            );
          } else {
            matchedItem = TEMPLATE_EMPLOYEES.find(item => item.name === canonicalName);
          }

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

    // 2. Build rows structure
    const rowsToExport = [];
    const depts = ["Бар", "Кухня", "Менеджер и официанты", "Мойка", "Администрация"];
    
    for (const deptName of depts) {
      const deptItems = TEMPLATE_EMPLOYEES.filter(item => item.dept === deptName);
      rowsToExport.push({ isHeader: true, name: deptName });
      
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

    // Append out-of-template employees if any
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

    // 3. Create Excel Workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("ЗП Таблица");
    worksheet.views = [{ showGridLines: true }];

    // Formatting date helper for title
    const formatDateShort = (dStr) => {
      const parts = dStr.split("-");
      if (parts.length === 3) {
        return `${parts[2]}.${parts[1]}.${parts[0].slice(2)}`;
      }
      return dStr;
    };
    const titleRange = `${formatDateShort(dateFrom)}-${formatDateShort(dateTo)}`;

    // Set title
    worksheet.getCell("B2").value = `The Lokmaco Fergana -ЗП таблица ${titleRange}`;
    worksheet.getCell("B2").font = { name: "Segoe UI", size: 16, bold: true };

    // Build Headers row (Row 4)
    const headerRowIdx = 4;
    
    // Column index maps
    const colNoIdx = 2; // B
    const colFioIdx = 3; // C
    const colRoleIdx = 4; // D
    const colWagesStartIdx = 5; // E
    
    const totalDays = datesList.length;
    const colAccruedIdx = colWagesStartIdx + totalDays;
    const colAdvanceIdx = colAccruedIdx + 1;
    const colNetIdx = colAdvanceIdx + 1;
    const colPaidIdx = colNetIdx + 1;
    const colSpacerIdx = colPaidIdx + 1;
    const colSignatureIdx = colSpacerIdx + 1;

    // Set headers
    worksheet.getCell(headerRowIdx, colNoIdx).value = "№";
    worksheet.getCell(headerRowIdx, colFioIdx).value = "Ф.И.О.";
    worksheet.getCell(headerRowIdx, colRoleIdx).value = "Должность";
    
    datesList.forEach((dateStr, idx) => {
      const parts = dateStr.split("-");
      const shortDate = `${parts[2]}.${parts[1]}`; // DD.MM
      worksheet.getCell(headerRowIdx, colWagesStartIdx + idx).value = shortDate;
    });

    worksheet.getCell(headerRowIdx, colAccruedIdx).value = "итого начислено";
    worksheet.getCell(headerRowIdx, colAdvanceIdx).value = "Аванс";
    worksheet.getCell(headerRowIdx, colNetIdx).value = "Итого на руки";
    worksheet.getCell(headerRowIdx, colPaidIdx).value = "Оплачено";
    worksheet.getCell(headerRowIdx, colSignatureIdx).value = "Подпись";

    // Style headers
    const thinBorder = {
      top: { style: "thin", color: { argb: "BFBFBF" } },
      left: { style: "thin", color: { argb: "BFBFBF" } },
      bottom: { style: "thin", color: { argb: "BFBFBF" } },
      right: { style: "thin", color: { argb: "BFBFBF" } }
    };

    const headerFill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "F2F2F2" }
    };

    for (let c = colNoIdx; c <= colSignatureIdx; c++) {
      if (c === colSpacerIdx) continue;
      const cell = worksheet.getCell(headerRowIdx, c);
      cell.font = { name: "Segoe UI", size: 10, bold: true };
      cell.fill = headerFill;
      cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
      cell.border = thinBorder;
    }

    // Set row height for headers
    worksheet.getRow(headerRowIdx).height = 25;

    // Fill Data rows
    let currentDeptRowNo = 0;
    let currentRowIdx = 5;

    const deptFill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "D9E1F2" } // Soft blue-gray
    };

    const inactiveFill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FCE4D6" } // Soft orange/peach
    };

    rowsToExport.forEach(row => {
      if (row.isHeader) {
        // Merge category row
        worksheet.mergeCells(currentRowIdx, colNoIdx, currentRowIdx, colSignatureIdx);
        const cell = worksheet.getCell(currentRowIdx, colNoIdx);
        cell.value = row.name;
        cell.font = { name: "Segoe UI", size: 11, bold: true };
        cell.fill = deptFill;
        cell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
        
        // Borders for merged header cell range
        for (let c = colNoIdx; c <= colSignatureIdx; c++) {
          worksheet.getCell(currentRowIdx, c).border = thinBorder;
        }
        worksheet.getRow(currentRowIdx).height = 22;
        currentDeptRowNo = 0; // Reset numbering for new department
      } else {
        currentDeptRowNo++;
        
        // No
        const cellNo = worksheet.getCell(currentRowIdx, colNoIdx);
        cellNo.value = currentDeptRowNo;
        cellNo.alignment = { vertical: "middle", horizontal: "center" };
        
        // FIO
        const cellFio = worksheet.getCell(currentRowIdx, colFioIdx);
        cellFio.value = row.name;
        cellFio.alignment = { vertical: "middle", horizontal: "left" };
        
        // Role
        const cellRole = worksheet.getCell(currentRowIdx, colRoleIdx);
        cellRole.value = row.role;
        cellRole.alignment = { vertical: "middle", horizontal: "left" };

        // Daily Wages
        datesList.forEach((dateStr, idx) => {
          const cellWage = worksheet.getCell(currentRowIdx, colWagesStartIdx + idx);
          const wageVal = row.wages[dateStr];
          
          if (wageVal && wageVal > 0) {
            cellWage.value = wageVal;
            cellWage.numFmt = "#,##0";
            cellWage.alignment = { vertical: "middle", horizontal: "right" };
          } else {
            // Inactive day - orange peach color
            cellWage.fill = inactiveFill;
            cellWage.value = 0;
            cellWage.numFmt = "0";
            cellWage.alignment = { vertical: "middle", horizontal: "center" };
          }
          cellWage.border = thinBorder;
        });

        // O = SUM(E:N)
        const startLetter = getColLetter(colWagesStartIdx);
        const endLetter = getColLetter(colWagesStartIdx + totalDays - 1);
        const cellAccrued = worksheet.getCell(currentRowIdx, colAccruedIdx);
        cellAccrued.value = {
          formula: `SUM(${startLetter}${currentRowIdx}:${endLetter}${currentRowIdx})`
        };
        cellAccrued.numFmt = "#,##0";
        cellAccrued.alignment = { vertical: "middle", horizontal: "right" };
        cellAccrued.font = { name: "Segoe UI", size: 10, bold: true };

        // Advance (default 0 or blank)
        const cellAdvance = worksheet.getCell(currentRowIdx, colAdvanceIdx);
        cellAdvance.value = 0;
        cellAdvance.numFmt = "#,##0";
        cellAdvance.alignment = { vertical: "middle", horizontal: "right" };

        // Net = Accrued - Advance
        const accruedLetter = getColLetter(colAccruedIdx);
        const advanceLetter = getColLetter(colAdvanceIdx);
        const cellNet = worksheet.getCell(currentRowIdx, colNetIdx);
        cellNet.value = {
          formula: `${accruedLetter}${currentRowIdx}-${advanceLetter}${currentRowIdx}`
        };
        cellNet.numFmt = "#,##0";
        cellNet.alignment = { vertical: "middle", horizontal: "right" };
        cellNet.font = { name: "Segoe UI", size: 10, bold: true };

        // Paid (default empty or net)
        const cellPaid = worksheet.getCell(currentRowIdx, colPaidIdx);
        cellPaid.alignment = { vertical: "middle", horizontal: "right" };

        // Apply borders and fonts to basic row cells
        const dataCols = [colNoIdx, colFioIdx, colRoleIdx, colAccruedIdx, colAdvanceIdx, colNetIdx, colPaidIdx, colSignatureIdx];
        dataCols.forEach(c => {
          if (c === colSpacerIdx) return;
          const cell = worksheet.getCell(currentRowIdx, c);
          cell.border = thinBorder;
          if (c !== colAccruedIdx && c !== colNetIdx) {
            cell.font = { name: "Segoe UI", size: 10 };
          }
        });

        worksheet.getRow(currentRowIdx).height = 20;
      }
      currentRowIdx++;
    });

    // 4. Summary Row (bottom totals)
    const sumRowIdx = currentRowIdx;
    worksheet.mergeCells(sumRowIdx, colNoIdx, sumRowIdx, colRoleIdx);
    const cellSumLabel = worksheet.getCell(sumRowIdx, colNoIdx);
    cellSumLabel.value = "Итого";
    cellSumLabel.font = { name: "Segoe UI", size: 11, bold: true };
    cellSumLabel.alignment = { vertical: "middle", horizontal: "right" };

    const sumFill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "F2F2F2" }
    };

    // Style label cells
    for (let c = colNoIdx; c <= colRoleIdx; c++) {
      worksheet.getCell(sumRowIdx, c).fill = sumFill;
      worksheet.getCell(sumRowIdx, c).border = thinBorder;
    }

    // Daily column sums
    const firstDataRowIdx = 5;
    const lastDataRowIdx = sumRowIdx - 1;

    datesList.forEach((_, idx) => {
      const colIdx = colWagesStartIdx + idx;
      const colLetter = getColLetter(colIdx);
      const cellSum = worksheet.getCell(sumRowIdx, colIdx);
      cellSum.value = {
        formula: `SUM(${colLetter}${firstDataRowIdx}:${colLetter}${lastDataRowIdx})`
      };
      cellSum.font = { name: "Segoe UI", size: 10, bold: true };
      cellSum.fill = sumFill;
      cellSum.alignment = { vertical: "middle", horizontal: "right" };
      cellSum.numFmt = "#,##0";
      cellSum.border = thinBorder;
    });

    // Accrued, Advance, Net, Paid sums
    const sumCols = [colAccruedIdx, colAdvanceIdx, colNetIdx, colPaidIdx];
    sumCols.forEach(c => {
      const colLetter = getColLetter(c);
      const cellSum = worksheet.getCell(sumRowIdx, c);
      cellSum.value = {
        formula: `SUM(${colLetter}${firstDataRowIdx}:${colLetter}${lastDataRowIdx})`
      };
      cellSum.font = { name: "Segoe UI", size: 10, bold: true };
      cellSum.fill = sumFill;
      cellSum.alignment = { vertical: "middle", horizontal: "right" };
      cellSum.numFmt = "#,##0";
      cellSum.border = thinBorder;
    });

    // Spacer & Signature sum cells style
    worksheet.getCell(sumRowIdx, colSpacerIdx).value = "";
    const cellSigSum = worksheet.getCell(sumRowIdx, colSignatureIdx);
    cellSigSum.value = "";
    cellSigSum.fill = sumFill;
    cellSigSum.border = thinBorder;

    worksheet.getRow(sumRowIdx).height = 22;

    // 5. Adjust Column Widths
    worksheet.getColumn(1).width = 2; // Column A spacer
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

    // 6. Output Buffer response
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
