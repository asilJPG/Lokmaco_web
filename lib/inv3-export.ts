import { numberToWordsRu, sumToWordsRu } from './number-to-words';

export type Inv3Item = {
  id: string;
  name: string;
  inv_number: string;
  code?: string;
  cost?: number;
  unit?: string;
  fact: number;
  book: number;
};

export type Inv3Data = {
  organization?: string;
  department?: string;
  docNumber?: string;
  docDate?: string;
  startDate?: string;
  endDate?: string;
  performedBy?: string;
  responsiblePerson?: string;
  items: Inv3Item[];
};

const INV3_CSS = `
body {
  background: #ffffff;
  margin: 0;
  padding: 24px;
  font-family: 'Segoe UI', Arial, Helvetica, sans-serif;
  font-size: 10pt;
  color: #111;
  line-height: 1.35;
}
.doc-container {
  max-width: 1060px;
  margin: 0 auto;
}
.header-table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 16px;
}
.header-table td {
  padding: 3px 6px;
  font-size: 9pt;
  vertical-align: bottom;
}
.doc-title {
  text-align: center;
  font-size: 14pt;
  font-weight: bold;
  text-transform: uppercase;
  margin: 12px 0 4px 0;
  letter-spacing: 0.5px;
}
.doc-subtitle {
  text-align: center;
  font-size: 10.5pt;
  font-weight: 600;
  margin-bottom: 12px;
}
.border-box {
  border: 1px solid #111;
  text-align: center;
  font-weight: bold;
  padding: 4px 8px;
}
.line-bot {
  border-bottom: 1px solid #222;
}
.subtext {
  font-size: 7pt;
  color: #555;
  text-align: center;
  padding-top: 1px;
}
.receipt-box {
  border: 1px solid #ddd;
  background: #fafafa;
  padding: 10px 14px;
  font-size: 8.5pt;
  text-align: justify;
  margin: 12px 0;
  border-radius: 4px;
}
.inv-table {
  width: 100%;
  border-collapse: collapse;
  margin: 16px 0;
  font-size: 8.5pt;
}
.inv-table th, .inv-table td {
  border: 1px solid #333;
  padding: 5px 6px;
  vertical-align: middle;
}
.inv-table th {
  background: #f3f4f6;
  font-weight: bold;
  text-align: center;
  font-size: 8pt;
}
.inv-table td.num {
  text-align: right;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}
.inv-table td.center {
  text-align: center;
}
.inv-table tr.total-row {
  background: #f9fafb;
  font-weight: bold;
}
.inv-table tr.diff-shortage {
  background: #fff5f5;
}
.inv-table tr.diff-surplus {
  background: #f0fdf4;
}
.totals-words {
  margin: 16px 0;
  font-size: 9pt;
  line-height: 1.8;
}
.signatures-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 20px;
  page-break-inside: avoid;
}
.signatures-table td {
  padding: 6px 8px;
  font-size: 8.5pt;
  vertical-align: bottom;
}
@media print {
  body { padding: 0; }
  .no-print { display: none !important; }
  .receipt-box { background: transparent; border-color: #999; }
  .inv-table th { background: #eee !important; -webkit-print-color-adjust: exact; }
  .doc-container { max-width: 100%; width: 100%; }
}
`;

function escapeHtml(s: string | number | undefined | null): string {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fmtMoney(n: number): string {
  return (Math.round(n * 100) / 100)
    .toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    .replace(/\s/g, '&nbsp;');
}

function fmtQty(n: number): string {
  if (n === 0) return '0';
  return (Math.round(n * 1000) / 1000)
    .toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 3 })
    .replace(/\s/g, '&nbsp;');
}

/**
 * Генерация чистого HTML-документа по унифицированной описи ИНВ-3
 * со структурой таблицы:
 * № п/п | Наименование | Номенклатурный номер | Цена | Фактические значения (кол-во / сумма) | По данным бухучета (кол-во / сумма) | Разница (кол-во / сумма)
 */
export function generateInv3Html(data: Inv3Data): string {
  const org = escapeHtml(data.organization || 'OOO "The Lokmaco Fergana"');
  const dept = escapeHtml(data.department || 'The Lokmaco');
  const docNum = escapeHtml(data.docNumber || '1');
  const docDate = escapeHtml(data.docDate || new Date().toLocaleDateString('ru-RU'));

  // Разбираем ответственных лиц (ФИО которые вводит пользователь)
  const persons = (data.performedBy || data.responsiblePerson || 'Материально ответственное лицо')
    .split(/[,;/]|\s+и\s+/i)
    .map((p) => p.trim())
    .filter(Boolean);

  if (persons.length === 0) persons.push('Материально ответственное лицо');

  const chairman = escapeHtml(persons[0]);
  const members = persons.length > 1 ? persons.slice(1).map(escapeHtml) : [escapeHtml(persons[0])];
  const allPersonsEscaped = persons.map(escapeHtml).join(', ');

  const items = data.items || [];
  const itemCount = items.length;

  let totalFactQty = 0;
  let totalFactSum = 0;
  let totalBookQty = 0;
  let totalBookSum = 0;
  let totalDiffQty = 0;
  let totalDiffSum = 0;

  const rowsHtml = items.map((it, idx) => {
    const num = idx + 1;
    const name = escapeHtml(it.name);
    const code = escapeHtml(it.code || it.inv_number || '—');
    const cost = Number(it.cost) || 0;

    const factQty = Number(it.fact) || 0;
    const factSum = factQty * cost;
    const bookQty = Number(it.book) || 0;
    const bookSum = bookQty * cost;

    const diffQty = factQty - bookQty;
    const diffSum = diffQty * cost;

    totalFactQty += factQty;
    totalFactSum += factSum;
    totalBookQty += bookQty;
    totalBookSum += bookSum;
    totalDiffQty += diffQty;
    totalDiffSum += diffSum;

    const rowClass = diffQty < 0 ? 'diff-shortage' : diffQty > 0 ? 'diff-surplus' : '';
    const diffSign = diffQty > 0 ? '+' : '';

    return `
      <tr class="${rowClass}">
        <td class="center" style="width: 38px;">${num}</td>
        <td style="font-weight: 500;">${name}</td>
        <td class="center" style="font-family: monospace; font-size: 8pt;">${code}</td>
        <td class="num">${fmtMoney(cost)}</td>
        <td class="num" style="width: 60px;">${fmtQty(factQty)}</td>
        <td class="num" style="width: 85px;">${fmtMoney(factSum)}</td>
        <td class="num" style="width: 60px;">${fmtQty(bookQty)}</td>
        <td class="num" style="width: 85px;">${fmtMoney(bookSum)}</td>
        <td class="num" style="width: 60px; font-weight: ${diffQty !== 0 ? 'bold' : 'normal'}; color: ${diffQty < 0 ? '#b91c1c' : diffQty > 0 ? '#15803d' : '#333'};">
          ${diffQty === 0 ? '0' : diffSign + fmtQty(diffQty)}
        </td>
        <td class="num" style="width: 85px; font-weight: ${diffSum !== 0 ? 'bold' : 'normal'}; color: ${diffSum < 0 ? '#b91c1c' : diffSum > 0 ? '#15803d' : '#333'};">
          ${diffSum === 0 ? '0,00' : diffSign + fmtMoney(diffSum)}
        </td>
      </tr>`;
  }).join('\n');

  const countWords = numberToWordsRu(itemCount, false);
  const totalFactQtyWords = numberToWordsRu(Math.floor(totalFactQty), false);
  const totalFactSumWords = sumToWordsRu(totalFactSum);

  const diffSignTotal = totalDiffQty > 0 ? '+' : '';

  // Блок подписей членов комиссии: ФИО которое внёс пользователь, рядом линия подписи и место для расшифровки
  const commissionRowsHtml = persons.map((p, i) => `
    <tr>
      <td style="width: 170px; font-weight: bold;">${i === 0 ? 'Председатель комиссии:' : 'Член комиссии:'}</td>
      <td style="width: 140px; border-bottom: 1px solid #222; text-align: center; font-weight: bold;">${escapeHtml(p)}</td>
      <td style="width: 12px;"></td>
      <td style="width: 130px; border-bottom: 1px solid #222; text-align: center;"></td>
      <td style="width: 12px;"></td>
      <td style="border-bottom: 1px solid #222; text-align: center; color: #555;">( &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; )</td>
    </tr>
    <tr>
      <td></td>
      <td class="subtext">(ФИО)</td>
      <td></td>
      <td class="subtext">(подпись)</td>
      <td></td>
      <td class="subtext">(расшифровка подписи вручную)</td>
    </tr>
  `).join('\n');

  const molRowsHtml = persons.map((p) => `
    <tr>
      <td style="width: 170px; font-weight: bold;">МОЛ / Проводил:</td>
      <td style="width: 140px; border-bottom: 1px solid #222; text-align: center; font-weight: bold;">${escapeHtml(p)}</td>
      <td style="width: 12px;"></td>
      <td style="width: 130px; border-bottom: 1px solid #222; text-align: center;"></td>
      <td style="width: 12px;"></td>
      <td style="border-bottom: 1px solid #222; text-align: center; color: #555;">( &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; )</td>
    </tr>
    <tr>
      <td></td>
      <td class="subtext">(ФИО)</td>
      <td></td>
      <td class="subtext">(подпись)</td>
      <td></td>
      <td class="subtext">(расшифровка подписи вручную)</td>
    </tr>
  `).join('\n');

  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>ИНВ-3. Инвентаризационная опись товарно-материальных ценностей</title>
  <style>
    ${INV3_CSS}
  </style>
</head>
<body>
  <div class="doc-container">
    <div style="margin-bottom: 16px; display: flex; justify-content: flex-end; gap: 8px;" class="no-print">
      <button onclick="window.print()" style="padding: 8px 18px; font-size: 13px; font-weight: bold; background: #111827; color: #fff; border: none; border-radius: 6px; cursor: pointer;">🖨️ Распечатать / Сохранить в PDF</button>
    </div>

    <!-- Шапка документа -->
    <table class="header-table">
      <tr>
        <td style="width: 65%;">
          <div style="font-size: 11pt; font-weight: bold; border-bottom: 1px solid #222; padding-bottom: 2px;">${org}</div>
          <div class="subtext" style="text-align: left;">(организация)</div>
          <div style="font-size: 10pt; font-weight: 600; border-bottom: 1px solid #222; padding-top: 6px; padding-bottom: 2px;">${dept}</div>
          <div class="subtext" style="text-align: left;">(структурное подразделение / место)</div>
        </td>
        <td style="width: 35%; text-align: right; vertical-align: top;">
          <div style="font-size: 7.5pt; color: #555;">Унифицированная форма № ИНВ-3<br/>Форма по ОКУД 0317004</div>
          <div style="margin-top: 10px; display: inline-flex; gap: 6px; text-align: center;">
            <div class="border-box" style="font-size: 8pt; min-width: 90px;">
              <div style="font-size: 7pt; font-weight: normal; color: #555;">Номер документа</div>
              <div>${docNum}</div>
            </div>
            <div class="border-box" style="font-size: 8pt; min-width: 100px;">
              <div style="font-size: 7pt; font-weight: normal; color: #555;">Дата составления</div>
              <div>${docDate}</div>
            </div>
          </div>
        </td>
      </tr>
    </table>

    <!-- Заголовок -->
    <div class="doc-title">ИНВЕНТАРИЗАЦИОННАЯ ОПИСЬ</div>
    <div class="doc-subtitle">товарно-материальных ценностей / основных средств</div>

    <!-- Расписка -->
    <div class="receipt-box">
      <b>РАСПИСКА:</b> К началу проведения инвентаризации все расходные и приходные документы на товарно-материальные ценности сданы в бухгалтерию и все товарно-материальные ценности, поступившие на мою (нашу) ответственность, оприходованы, а выбывшие списаны в расход.
      <div style="margin-top: 8px; display: flex; gap: 12px; align-items: flex-end;">
        <span>Материально ответственное(ые) лицо(а):</span>
        <span style="border-bottom: 1px solid #222; font-weight: bold; flex: 1; padding: 0 8px;">${allPersonsEscaped}</span>
      </div>
    </div>

    <!-- Основная таблица -->
    <table class="inv-table">
      <thead>
        <tr>
          <th rowspan="2" style="width: 36px;">№<br/>п/п</th>
          <th rowspan="2">Наименование ценностей</th>
          <th rowspan="2" style="width: 110px;">Номенклатурный<br/>номер</th>
          <th rowspan="2" style="width: 80px;">Цена,<br/>сум</th>
          <th colspan="2">Фактическое наличие</th>
          <th colspan="2">По данным бухучета</th>
          <th colspan="2">Разница (расхождения)</th>
        </tr>
        <tr>
          <th style="width: 55px;">Кол-во</th>
          <th style="width: 85px;">Сумма, сум</th>
          <th style="width: 55px;">Кол-во</th>
          <th style="width: 85px;">Сумма, сум</th>
          <th style="width: 55px;">Кол-во</th>
          <th style="width: 85px;">Сумма, сум</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
        <tr class="total-row">
          <td colspan="4" style="text-align: right; font-weight: bold; padding-right: 8px;">ИТОГО:</td>
          <td class="num">${fmtQty(totalFactQty)}</td>
          <td class="num">${fmtMoney(totalFactSum)}</td>
          <td class="num">${fmtQty(totalBookQty)}</td>
          <td class="num">${fmtMoney(totalBookSum)}</td>
          <td class="num" style="color: ${totalDiffQty < 0 ? '#b91c1c' : totalDiffQty > 0 ? '#15803d' : '#111'}; font-weight: bold;">
            ${totalDiffQty === 0 ? '0' : diffSignTotal + fmtQty(totalDiffQty)}
          </td>
          <td class="num" style="color: ${totalDiffSum < 0 ? '#b91c1c' : totalDiffSum > 0 ? '#15803d' : '#111'}; font-weight: bold;">
            ${totalDiffSum === 0 ? '0,00' : diffSignTotal + fmtMoney(totalDiffSum)}
          </td>
        </tr>
      </tbody>
    </table>

    <!-- Итоги прописью -->
    <div class="totals-words">
      <div><b>Итого по описи:</b></div>
      <div style="display: flex; gap: 8px;">
        <span style="min-width: 260px;">а) количество порядковых номеров:</span>
        <span style="border-bottom: 1px solid #222; font-weight: bold; flex: 1;">${countWords}</span>
      </div>
      <div style="display: flex; gap: 8px;">
        <span style="min-width: 260px;">б) общее количество единиц фактически:</span>
        <span style="border-bottom: 1px solid #222; font-weight: bold; flex: 1;">${totalFactQtyWords}</span>
      </div>
      <div style="display: flex; gap: 8px;">
        <span style="min-width: 260px;">в) на сумму фактически:</span>
        <span style="border-bottom: 1px solid #222; font-weight: bold; flex: 1;">${totalFactSumWords}</span>
      </div>
    </div>

    <!-- Подписи комиссии -->
    <div style="font-size: 8.5pt; margin-top: 14px;">
      Все цены, подсчеты итогов по строкам, страницам и в целом по инвентаризационной описи товарно-материальных ценностей проверены.
    </div>

    <table class="signatures-table">
      ${commissionRowsHtml}
    </table>

    <!-- Заключительная расписка МОЛ -->
    <div style="font-size: 8.5pt; margin-top: 16px; line-height: 1.35; text-align: justify;">
      Все товарно-материальные ценности, поименованные в настоящей инвентаризационной описи с № 1 по № ${itemCount}, комиссией проверены в натуре в моем присутствии и внесены в опись, в связи с чем претензий к инвентаризационной комиссии не имею. Товарно-материальные ценности, перечисленные в описи, находятся на моем ответственном хранении.
    </div>

    <table class="signatures-table" style="margin-top: 10px;">
      ${molRowsHtml}
      <tr>
        <td style="width: 170px; font-weight: bold;">Проверил (бухгалтер):</td>
        <td style="width: 140px; border-bottom: 1px solid #222; text-align: center;">Бухгалтер</td>
        <td style="width: 12px;"></td>
        <td style="width: 130px; border-bottom: 1px solid #222; text-align: center;"></td>
        <td style="width: 12px;"></td>
        <td style="border-bottom: 1px solid #222; text-align: center; color: #555;">( &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; )</td>
      </tr>
      <tr>
        <td></td>
        <td class="subtext">(должность)</td>
        <td></td>
        <td class="subtext">(подпись)</td>
        <td></td>
        <td class="subtext">(расшифровка подписи вручную)</td>
      </tr>
    </table>
  </div>
</body>
</html>`;
}

/**
 * Скачивание документа в формате HTML (открывается браузером и Excel)
 */
export function downloadInv3HtmlFile(data: Inv3Data, filename?: string) {
  const html = generateInv3Html(data);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const name = filename || `ИНВ-3_Инвентаризационная_опись_${(data.docDate || new Date().toLocaleDateString('ru-RU')).replace(/[./]/g, '-')}.html`;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Скачивание документа для Excel (.xls)
 */
export function downloadInv3ExcelFile(data: Inv3Data, filename?: string) {
  const html = generateInv3Html(data);
  const excelWrapper = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
  <head>
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8"/>
    <!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>ИНВ-3</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
    <style>${INV3_CSS}</style>
  </head>
  <body>
    ${html}
  </body>
</html>`;
  const blob = new Blob([excelWrapper], { type: 'application/vnd.ms-excel;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const name = filename || `ИНВ-3_Инвентаризационная_опись_${(data.docDate || new Date().toLocaleDateString('ru-RU')).replace(/[./]/g, '-')}.xls`;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Открытие документа в отдельном окне для прямой печати
 */
export function printInv3Window(data: Inv3Data) {
  const html = generateInv3Html(data);
  const win = window.open('', '_blank');
  if (win) {
    win.document.write(html);
    win.document.close();
    win.focus();
  }
}
