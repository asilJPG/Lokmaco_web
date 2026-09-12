/**
 * Преобразование чисел и сумм в строку прописью на русском языке (для форм ИНВ-3, 1С).
 */

const ONES_MASC = ['', 'один', 'два', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять'];
const ONES_FEM = ['', 'одна', 'две', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять'];
const TEENS = [
  'десять', 'одиннадцать', 'двенадцать', 'тринадцать', 'четырнадцать',
  'пятнадцать', 'шестнадцать', 'семнадцать', 'восемнадцать', 'девятнадцать',
];
const TENS = ['', '', 'двадцать', 'тридцать', 'сорок', 'пятьдесят', 'шестьдесят', 'семьдесят', 'восемьдесят', 'девяносто'];
const HUNDREDS = ['', 'сто', 'двести', 'триста', 'четыреста', 'пятьсот', 'шестьсот', 'семьсот', 'восемьсот', 'девятьсот'];

type UnitForms = [one: string, two: string, five: string];

const THOUSAND_FORMS: UnitForms = ['тысяча', 'тысячи', 'тысяч'];
const MILLION_FORMS: UnitForms = ['миллион', 'миллиона', 'миллионов'];
const BILLION_FORMS: UnitForms = ['миллиард', 'миллиарда', 'миллиардов'];

function getPluralForm(n: number, forms: UnitForms): string {
  const abs = Math.abs(n) % 100;
  const rem = abs % 10;
  if (abs > 10 && abs < 20) return forms[2];
  if (rem > 1 && rem < 5) return forms[1];
  if (rem === 1) return forms[0];
  return forms[2];
}

function tripletToWords(n: number, isFem: boolean): string {
  const parts: string[] = [];
  const h = Math.floor(n / 100);
  const t = Math.floor((n % 100) / 10);
  const o = n % 10;

  if (h > 0) parts.push(HUNDREDS[h]);

  if (t === 1) {
    parts.push(TEENS[o]);
  } else {
    if (t > 1) parts.push(TENS[t]);
    if (o > 0) {
      parts.push(isFem ? ONES_FEM[o] : ONES_MASC[o]);
    }
  }

  return parts.join(' ');
}

export function numberToWordsRu(num: number, isFem = false): string {
  if (num === 0) return 'ноль';

  const n = Math.floor(Math.abs(num));
  const billions = Math.floor(n / 1_000_000_000);
  const millions = Math.floor((n % 1_000_000_000) / 1_000_000);
  const thousands = Math.floor((n % 1_000_000) / 1_000);
  const remainder = n % 1_000;

  const parts: string[] = [];

  if (billions > 0) {
    parts.push(tripletToWords(billions, false));
    parts.push(getPluralForm(billions, BILLION_FORMS));
  }
  if (millions > 0) {
    parts.push(tripletToWords(millions, false));
    parts.push(getPluralForm(millions, MILLION_FORMS));
  }
  if (thousands > 0) {
    parts.push(tripletToWords(thousands, true));
    parts.push(getPluralForm(thousands, THOUSAND_FORMS));
  }
  if (remainder > 0 || parts.length === 0) {
    const w = tripletToWords(remainder, isFem);
    if (w) parts.push(w);
  }

  const res = parts.join(' ').trim();
  return res.charAt(0).toUpperCase() + res.slice(1);
}

export function sumToWordsRu(amount: number): string {
  const total = Math.max(0, amount);
  const integerPart = Math.floor(total);
  const fractionPart = Math.round((total - integerPart) * 100);

  const words = integerPart === 0 ? 'Ноль' : numberToWordsRu(integerPart, false);
  const sumWord = 'сум';
  const tiyinStr = String(fractionPart).padStart(2, '0');

  return `${words} ${sumWord} ${tiyinStr} тийин`;
}
