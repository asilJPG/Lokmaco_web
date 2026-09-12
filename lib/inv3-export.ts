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
body { background: #ffffff; margin: 0; padding: 20px; font-family: Arial, Helvetica, sans-serif; font-size: 10pt; }
.inv3-table { border-collapse: collapse; table-layout: fixed; margin: 0 auto; width: 1091px; color: #000; font-family: Arial, Helvetica, sans-serif; }
.inv3-table td { padding: 0; font-size: 8pt; vertical-align: top; }
.s-head-sm { font-size: 6.5pt; font-family: Arial, Helvetica, sans-serif; }
.s-head-bold { font-size: 11pt; font-weight: bold; font-family: Arial, Helvetica, sans-serif; }
.s-title { font-size: 13pt; font-weight: bold; font-family: Arial, Helvetica, sans-serif; text-align: center; }
.s-border-box { border: 1px solid #000; text-align: center; }
.s-border-bot { border-bottom: 1px solid #000; }
.s-border-top { border-top: 1px solid #000; }
.s-border-all { border: 1px solid #000; }
.s-subtext { font-size: 6pt; text-align: center; }
.s-num { text-align: right; }
.s-center { text-align: center; }
.s-receipt { font-size: 8pt; text-align: justify; }

@media print {
  body { padding: 0; }
  .inv3-table { width: 100%; max-width: 100%; }
  .no-print { display: none !important; }
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
  return (Math.round(n * 1000) / 1000)
    .toLocaleString('ru-RU', { minimumFractionDigits: 3, maximumFractionDigits: 3 })
    .replace(/\s/g, '&nbsp;');
}

/**
 * Генерация полного HTML-документа по унифицированной форме № ИНВ-3
 * (Инвентаризационная опись товарно-материальных ценностей / основных средств).
 */
export function generateInv3Html(data: Inv3Data): string {
  const org = escapeHtml(data.organization || 'OOO "The Lokmaco Fergana"');
  const dept = escapeHtml(data.department || 'The Lokmaco');
  const docNum = escapeHtml(data.docNumber || '1');
  const docDate = escapeHtml(data.docDate || new Date().toLocaleDateString('ru-RU'));

  // Разбираем ответственных лиц (если указано несколько через запятую/точку с запятой/слеш/и)
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

  const rowsHtml = items.map((it, idx) => {
    const num = idx + 1;
    const name = escapeHtml(it.name);
    const code = escapeHtml(it.code || it.inv_number || '');
    const unit = escapeHtml(it.unit || 'шт');
    const cost = Number(it.cost) || 0;
    const invNum = escapeHtml(it.inv_number);

    const factQty = Number(it.fact) || 0;
    const factSum = factQty * cost;
    const bookQty = Number(it.book) || 0;
    const bookSum = bookQty * cost;

    totalFactQty += factQty;
    totalFactSum += factSum;
    totalBookQty += bookQty;
    totalBookSum += bookSum;

    return `
      <tr style="height: 28px;">
        <td class="s-border-all s-center" style="width: 39px; height: 28px; vertical-align: middle;">${num}</td>
        <td class="s-border-all" colspan="4" style="width: 87px; height: 28px;"></td>
        <td class="s-border-all" colspan="10" style="width: 252px; height: 28px; vertical-align: middle; padding-left: 4px; padding-right: 4px;">${name}</td>
        <td class="s-border-all s-center" colspan="4" style="width: 87px; height: 28px; vertical-align: middle;">${code}</td>
        <td class="s-border-all" colspan="4" style="width: 63px; height: 28px;"></td>
        <td class="s-border-all s-center" colspan="3" style="width: 63px; height: 28px; vertical-align: middle;">${unit}</td>
        <td class="s-border-all s-num" colspan="4" style="width: 70px; height: 28px; vertical-align: middle; padding-right: 4px;">${fmtMoney(cost)}</td>
        <td class="s-border-all s-center" colspan="4" style="width: 63px; height: 28px; vertical-align: middle;">${invNum}</td>
        <td class="s-border-all" colspan="3" style="width: 63px; height: 28px;"></td>
        <td class="s-border-all s-num" colspan="8" style="width: 71px; height: 28px; vertical-align: middle; padding-right: 4px;">${fmtQty(factQty)}</td>
        <td class="s-border-all s-num" colspan="3" style="width: 79px; height: 28px; vertical-align: middle; padding-right: 4px;">${fmtMoney(factSum)}</td>
        <td class="s-border-all s-num" colspan="5" style="width: 71px; height: 28px; vertical-align: middle; padding-right: 4px;">${fmtQty(bookQty)}</td>
        <td class="s-border-all s-num" colspan="3" style="width: 79px; height: 28px; vertical-align: middle; padding-right: 4px;">${fmtMoney(bookSum)}</td>
        <td style="width: 4px; border: 0;"></td>
      </tr>`;
  }).join('\n');

  const countWords = numberToWordsRu(itemCount, false);
  const totalFactQtyWords = numberToWordsRu(Math.floor(totalFactQty), false);
  const totalFactSumWords = sumToWordsRu(totalFactSum);

  const membersRowsHtml = members.map((m) => `
    <tr style="height: 12px;"><td colspan="51"></td></tr>
    <tr>
      <td colspan="10" style="vertical-align: bottom; font-weight: bold;">Член комиссии:</td>
      <td colspan="11" class="s-border-bot" style="text-align: center; vertical-align: bottom;">Администратор</td>
      <td colspan="2"></td>
      <td colspan="12" class="s-border-bot"></td>
      <td colspan="2"></td>
      <td colspan="14" class="s-border-bot" style="text-align: center; vertical-align: bottom; font-weight: bold;">${m}</td>
    </tr>
    <tr>
      <td colspan="10"></td>
      <td colspan="11" class="s-subtext">(должность)</td>
      <td colspan="2"></td>
      <td colspan="12" class="s-subtext">(подпись)</td>
      <td colspan="2"></td>
      <td colspan="14" class="s-subtext">(расшифровка подписи)</td>
    </tr>
  `).join('\n');

  const molRowsHtml = persons.map((p) => `
    <tr style="height: 10px;"><td colspan="51"></td></tr>
    <tr>
      <td colspan="10" style="vertical-align: bottom; font-weight: bold;">МОЛ / Проводил:</td>
      <td colspan="11" class="s-border-bot" style="text-align: center; vertical-align: bottom;">Материально ответственное лицо</td>
      <td colspan="2"></td>
      <td colspan="12" class="s-border-bot"></td>
      <td colspan="2"></td>
      <td colspan="14" class="s-border-bot" style="text-align: center; vertical-align: bottom; font-weight: bold;">${escapeHtml(p)}</td>
    </tr>
    <tr>
      <td colspan="10"></td>
      <td colspan="11" class="s-subtext">(должность)</td>
      <td colspan="2"></td>
      <td colspan="12" class="s-subtext">(подпись)</td>
      <td colspan="2"></td>
      <td colspan="14" class="s-subtext">(расшифровка подписи)</td>
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
  <div style="margin-bottom: 16px; text-align: right;" class="no-print">
    <button onclick="window.print()" style="padding: 8px 16px; font-size: 14px; font-weight: bold; background: #111827; color: #fff; border: none; border-radius: 6px; cursor: pointer;">🖨️ Распечатать / Сохранить в PDF</button>
  </div>

  <table class="inv3-table">
    <!-- Шапка формы -->
    <tr>
      <td colspan="46" style="text-align: right; font-size: 7pt;">Унифицированная форма № ИНВ-3<br/>Утверждена постановлением Госкомстата России от 18.08.98 № 88</td>
      <td colspan="5" class="s-border-box" style="font-weight: bold; font-size: 8pt; height: 20px; vertical-align: middle;">Код</td>
    </tr>
    <tr>
      <td colspan="46"></td>
      <td colspan="5" class="s-border-box" style="height: 18px; vertical-align: middle; font-size: 7.5pt;">Форма по ОКУД 0317004</td>
    </tr>
    <tr>
      <td colspan="36" class="s-border-bot" style="font-weight: bold; font-size: 9pt; height: 22px; vertical-align: bottom;">${org}</td>
      <td colspan="10" style="text-align: right; font-size: 7.5pt; vertical-align: bottom;">по ОКПО</td>
      <td colspan="5" class="s-border-box" style="height: 22px; vertical-align: middle;"></td>
    </tr>
    <tr>
      <td colspan="36" class="s-subtext">(организация)</td>
      <td colspan="15"></td>
    </tr>
    <tr>
      <td colspan="36" class="s-border-bot" style="font-weight: bold; font-size: 9pt; height: 22px; vertical-align: bottom;">${dept}</td>
      <td colspan="15"></td>
    </tr>
    <tr>
      <td colspan="36" class="s-subtext">(структурное подразделение)</td>
      <td colspan="15"></td>
    </tr>
    <tr style="height: 12px;"><td colspan="51"></td></tr>

    <!-- Номер и дата -->
    <tr>
      <td colspan="31"></td>
      <td colspan="12" class="s-border-box" style="font-weight: bold; height: 22px; vertical-align: middle;">Номер документа</td>
      <td colspan="8" class="s-border-box" style="font-weight: bold; height: 22px; vertical-align: middle;">Дата составления</td>
    </tr>
    <tr>
      <td colspan="31"></td>
      <td colspan="12" class="s-border-box" style="font-weight: bold; height: 22px; vertical-align: middle;">${docNum}</td>
      <td colspan="8" class="s-border-box" style="font-weight: bold; height: 22px; vertical-align: middle;">${docDate}</td>
    </tr>

    <tr style="height: 16px;"><td colspan="51"></td></tr>

    <!-- Заголовок -->
    <tr>
      <td colspan="51" class="s-title">ИНВЕНТАРИЗАЦИОННАЯ ОПИСЬ</td>
    </tr>
    <tr>
      <td colspan="51" style="text-align: center; font-weight: bold; font-size: 10pt;">товарно-материальных ценностей / основных средств</td>
    </tr>
    <tr style="height: 8px;"><td colspan="51"></td></tr>

    <!-- Расписка -->
    <tr>
      <td colspan="51" style="text-align: center; font-weight: bold; font-size: 9pt;">РАСПИСКА</td>
    </tr>
    <tr>
      <td colspan="51" class="s-receipt" style="padding-top: 4px; line-height: 1.3;">
        &nbsp;&nbsp;&nbsp;&nbsp;К началу проведения инвентаризации все расходные и приходные документы на товарно-материальные ценности сданы в бухгалтерию и все товарно-материальные ценности, поступившие на мою (нашу) ответственность, оприходованы, а выбывшие списаны в расход.
      </td>
    </tr>
    <tr style="height: 12px;"><td colspan="51"></td></tr>
    <tr>
      <td colspan="12" style="font-size: 8pt; vertical-align: bottom;">Материально ответственное(ые) лицо(а):</td>
      <td colspan="11" class="s-border-bot" style="text-align: center; font-size: 8pt; vertical-align: bottom;">МОЛ</td>
      <td colspan="2"></td>
      <td colspan="12" class="s-border-bot" style="text-align: center; font-size: 8pt; vertical-align: bottom;"></td>
      <td colspan="2"></td>
      <td colspan="12" class="s-border-bot" style="text-align: center; font-size: 8pt; vertical-align: bottom; font-weight: bold;">${allPersonsEscaped}</td>
    </tr>
    <tr>
      <td colspan="12"></td>
      <td colspan="11" class="s-subtext">(должность)</td>
      <td colspan="2"></td>
      <td colspan="12" class="s-subtext">(подпись)</td>
      <td colspan="2"></td>
      <td colspan="12" class="s-subtext">(расшифровка подписи)</td>
    </tr>
    <tr style="height: 12px;"><td colspan="51"></td></tr>

    <!-- Шапка таблицы описи (колонки 1..13) -->
    <tr style="font-size: 7.5pt; text-align: center; font-weight: bold;">
      <td class="s-border-all" rowspan="2" style="width: 39px; vertical-align: middle;">№<br/>п/п</td>
      <td class="s-border-all" rowspan="2" colspan="4" style="width: 87px; vertical-align: middle;">Счет,<br/>субсчет</td>
      <td class="s-border-all" rowspan="2" colspan="10" style="width: 252px; vertical-align: middle;">Товарно-материальные ценности<br/>(наименование, характеристика)</td>
      <td class="s-border-all" rowspan="2" colspan="4" style="width: 87px; vertical-align: middle;">Код<br/>(номенкл.<br/>номер)</td>
      <td class="s-border-all" colspan="7" style="vertical-align: middle;">Единица измерения</td>
      <td class="s-border-all" rowspan="2" colspan="4" style="width: 70px; vertical-align: middle;">Цена,<br/>сум</td>
      <td class="s-border-all" colspan="7" style="vertical-align: middle;">Номер</td>
      <td class="s-border-all" colspan="11" style="vertical-align: middle;">Фактическое наличие</td>
      <td class="s-border-all" colspan="8" style="vertical-align: middle;">По данным бух. учета</td>
      <td style="width: 4px; border: 0;"></td>
    </tr>
    <tr style="font-size: 7pt; text-align: center; font-weight: bold;">
      <td class="s-border-all" colspan="4" style="width: 63px; vertical-align: middle;">код по ОКЕИ</td>
      <td class="s-border-all" colspan="3" style="width: 63px; vertical-align: middle;">наимен.</td>
      <td class="s-border-all" colspan="4" style="width: 63px; vertical-align: middle;">инвентарный</td>
      <td class="s-border-all" colspan="3" style="width: 63px; vertical-align: middle;">паспорта</td>
      <td class="s-border-all" colspan="8" style="width: 71px; vertical-align: middle;">количество</td>
      <td class="s-border-all" colspan="3" style="width: 79px; vertical-align: middle;">сумма, сум</td>
      <td class="s-border-all" colspan="5" style="width: 71px; vertical-align: middle;">количество</td>
      <td class="s-border-all" colspan="3" style="width: 79px; vertical-align: middle;">сумма, сум</td>
      <td style="width: 4px; border: 0;"></td>
    </tr>
    <!-- Номера колонок -->
    <tr style="font-size: 7pt; text-align: center; background: #f9f9f9;">
      <td class="s-border-all">1</td>
      <td class="s-border-all" colspan="4">2</td>
      <td class="s-border-all" colspan="10">3</td>
      <td class="s-border-all" colspan="4">4</td>
      <td class="s-border-all" colspan="4">5</td>
      <td class="s-border-all" colspan="3">6</td>
      <td class="s-border-all" colspan="4">7</td>
      <td class="s-border-all" colspan="4">8</td>
      <td class="s-border-all" colspan="3">9</td>
      <td class="s-border-all" colspan="8">10</td>
      <td class="s-border-all" colspan="3">11</td>
      <td class="s-border-all" colspan="5">12</td>
      <td class="s-border-all" colspan="3">13</td>
      <td style="width: 4px; border: 0;"></td>
    </tr>

    <!-- Строки данных -->
    ${rowsHtml}

    <!-- Итого по описи (числа в таблице) -->
    <tr style="height: 24px; font-weight: bold;">
      <td colspan="36" style="text-align: right; vertical-align: middle; padding-right: 8px;">Итого:</td>
      <td class="s-border-all s-num" colspan="8" style="vertical-align: middle; padding-right: 4px;">${fmtQty(totalFactQty)}</td>
      <td class="s-border-all s-num" colspan="3" style="vertical-align: middle; padding-right: 4px;">${fmtMoney(totalFactSum)}</td>
      <td class="s-border-all s-num" colspan="5" style="vertical-align: middle; padding-right: 4px;">${fmtQty(totalBookQty)}</td>
      <td class="s-border-all s-num" colspan="3" style="vertical-align: middle; padding-right: 4px;">${fmtMoney(totalBookSum)}</td>
      <td style="width: 4px; border: 0;"></td>
    </tr>

    <tr style="height: 16px;"><td colspan="51"></td></tr>

    <!-- Итого прописью -->
    <tr>
      <td colspan="12" style="font-weight: bold; vertical-align: bottom;">Итого по описи:</td>
      <td colspan="39"></td>
    </tr>
    <tr>
      <td colspan="16" style="vertical-align: bottom;">а) количество порядковых номеров:</td>
      <td colspan="35" class="s-border-bot" style="font-weight: bold; padding-left: 8px; vertical-align: bottom;">${countWords}</td>
    </tr>
    <tr>
      <td colspan="16"></td>
      <td colspan="35" class="s-subtext">(прописью)</td>
    </tr>
    <tr>
      <td colspan="16" style="vertical-align: bottom;">б) общее количество единиц фактически:</td>
      <td colspan="35" class="s-border-bot" style="font-weight: bold; padding-left: 8px; vertical-align: bottom;">${totalFactQtyWords}</td>
    </tr>
    <tr>
      <td colspan="16"></td>
      <td colspan="35" class="s-subtext">(прописью)</td>
    </tr>
    <tr>
      <td colspan="16" style="vertical-align: bottom;">в) на сумму фактически:</td>
      <td colspan="35" class="s-border-bot" style="font-weight: bold; padding-left: 8px; vertical-align: bottom;">${totalFactSumWords}</td>
    </tr>
    <tr>
      <td colspan="16"></td>
      <td colspan="35" class="s-subtext">(прописью)</td>
    </tr>

    <tr style="height: 16px;"><td colspan="51"></td></tr>

    <!-- Подписи комиссии -->
    <tr>
      <td colspan="51" style="font-size: 8pt; line-height: 1.3;">
        Все цены, подсчеты итогов по строкам, страницам и в целом по инвентаризационной описи товарно-материальных ценностей проверены.
      </td>
    </tr>
    <tr style="height: 10px;"><td colspan="51"></td></tr>
    <tr>
      <td colspan="10" style="vertical-align: bottom; font-weight: bold;">Председатель комиссии:</td>
      <td colspan="11" class="s-border-bot" style="text-align: center; vertical-align: bottom;">Директор</td>
      <td colspan="2"></td>
      <td colspan="12" class="s-border-bot"></td>
      <td colspan="2"></td>
      <td colspan="14" class="s-border-bot" style="text-align: center; vertical-align: bottom; font-weight: bold;">${chairman}</td>
    </tr>
    <tr>
      <td colspan="10"></td>
      <td colspan="11" class="s-subtext">(должность)</td>
      <td colspan="2"></td>
      <td colspan="12" class="s-subtext">(подпись)</td>
      <td colspan="2"></td>
      <td colspan="14" class="s-subtext">(расшифровка подписи)</td>
    </tr>

    ${membersRowsHtml}

    <tr style="height: 16px;"><td colspan="51"></td></tr>

    <!-- Заключительная расписка МОЛ -->
    <tr>
      <td colspan="51" class="s-receipt" style="line-height: 1.3;">
        &nbsp;&nbsp;&nbsp;&nbsp;Все товарно-материальные ценности, поименованные в настоящей инвентаризационной описи с № 1 по № ${itemCount}, комиссией проверены в натуре в моем присутствии и внесены в опись, в связи с чем претензий к инвентаризационной комиссии не имею. Товарно-материальные ценности, перечисленные в описи, находятся на моем ответственном хранении.
      </td>
    </tr>
    ${molRowsHtml}

    <tr style="height: 16px;"><td colspan="51"></td></tr>
    <tr>
      <td colspan="20" style="vertical-align: bottom;">Указанные в настоящей описи данные и расчеты проверил:</td>
      <td colspan="10" class="s-border-bot" style="text-align: center; vertical-align: bottom;">Бухгалтер</td>
      <td colspan="2"></td>
      <td colspan="8" class="s-border-bot"></td>
      <td colspan="2"></td>
      <td colspan="9" class="s-border-bot" style="text-align: center; vertical-align: bottom;"></td>
    </tr>
    <tr>
      <td colspan="20"></td>
      <td colspan="10" class="s-subtext">(должность)</td>
      <td colspan="2"></td>
      <td colspan="8" class="s-subtext">(подпись)</td>
      <td colspan="2"></td>
      <td colspan="9" class="s-subtext">(расшифровка подписи)</td>
    </tr>
  </table>
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
    ${html.slice(html.indexOf('<table'), html.lastIndexOf('</table>') + 8)}
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
