import { type CandidatesListRecord, getFirstTimeCandidates } from './candidates-lists';
import type { Client } from './clients';
import { TRANSMITTAL_TEMPLATE_RAW } from './transmittal-template-raw';

function getStoredListsFallback(): CandidatesListRecord[] {
  try {
    const raw = typeof window !== 'undefined' ? window.localStorage?.getItem('auto-ecole.candidates-lists') : null;
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function getStoredClientsFallback(): Client[] {
  try {
    const raw = typeof window !== 'undefined' ? window.localStorage?.getItem('auto-ecole.clients') : null;
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Returns the exact transmittal letter (جدول إرسال) HTML using the user-provided
 * template and its exact embedded fonts ("Card Arabic", "Card Latin", etc.),
 * styling, and layout.
 *
 * NOTE: As per administrative requirements, only candidates taking their exam for
 * the very first time (never had an exam before) are included in جدول إرسال.
 *
 * Replaces:
 * - الرقــم with 1, 2, 3... corresponding to each first-time candidate
 * - الصنف with each candidate's matching category (line-by-line)
 * - بيان الوثائق with candidates' names (line-by-line)
 * - Removes yellow input backgrounds/contenteditable attributes (renders as plain text)
 */
export interface TransmittalLetterValues {
  referenceNumber?: string;
  date?: string;
}

export function getTransmittalLetterHtml(
  list: CandidatesListRecord,
  values: TransmittalLetterValues = {},
  allLists: CandidatesListRecord[] = [],
  allClients: Client[] = [],
): string {
  const listsToUse = allLists.length > 0 ? allLists : getStoredListsFallback();
  const clientsToUse = allClients.length > 0 ? allClients : getStoredClientsFallback();
  const firstTimeCandidates = getFirstTimeCandidates(list, listsToUse, clientsToUse);

  const numbers = firstTimeCandidates.map((_, i) => `${i + 1}`);
  const names = firstTimeCandidates.map((c) => c.name);
  const categories = firstTimeCandidates.map((c) => c.training || 'B');
  const date = values.date ?? list.transmittalDate ?? list.depositDate;
  const dateText = date ? formatDateArabic(date) : '';
  const referenceNumber = values.referenceNumber ?? list.transmittalNumber ?? '';

  return fillTransmittalTemplate(TRANSMITTAL_TEMPLATE_RAW, {
    numbers,
    names,
    categories,
    date: dateText,
    referenceNumber,
  });
}

/**
 * Opens the transmittal letter in a new browser window for printing.
 */
export function openTransmittalLetter(
  list: CandidatesListRecord,
  values?: TransmittalLetterValues,
  allLists: CandidatesListRecord[] = [],
  allClients: Client[] = [],
): void {
  const html = getTransmittalLetterHtml(list, values, allLists, allClients);
  const win = window.open('', '_blank');
  if (!win) {
    alert('لم يتمكن المتصفح من فتح نافذة جديدة. تأكد من السماح بالنوافذ المنبثقة.');
    return;
  }
  win.document.write(html);
  win.document.close();
}

/**
 * Downloads the filled transmittal letter as an HTML file.
 */
export function downloadTransmittalLetter(
  list: CandidatesListRecord,
  values?: TransmittalLetterValues,
  allLists: CandidatesListRecord[] = [],
  allClients: Client[] = [],
): void {
  const html = getTransmittalLetterHtml(list, values, allLists, allClients);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const dateSuffix = list.depositDate || list.examDate || 'قائمة';
  a.download = `جدول-إرسال-${dateSuffix}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Returns the transmittal letter (جدول إرسال) HTML for a single client (only this client in the file).
 */
export function getClientTransmittalLetterHtml(
  client: Client,
  values: TransmittalLetterValues = {},
): string {
  const numbers = ['1'];
  const names = [client.name || ''];
  const categories = [client.training || 'B'];
  const date = values.date || client.attendance?.submissionDate || client.registrationDate || new Date().toISOString().slice(0, 10);
  const dateText = formatDateArabic(date);
  const referenceNumber = values.referenceNumber ?? '';

  return fillTransmittalTemplate(TRANSMITTAL_TEMPLATE_RAW, {
    numbers,
    names,
    categories,
    date: dateText,
    referenceNumber,
  });
}

/**
 * Opens the transmittal letter for a single client in a new window for printing.
 */
export function openClientTransmittalLetter(
  client: Client,
  values?: TransmittalLetterValues,
): void {
  const html = getClientTransmittalLetterHtml(client, values);
  const win = window.open('', '_blank');
  if (!win) {
    alert('لم يتمكن المتصفح من فتح نافذة جديدة. تأكد من السماح بالنوافذ المنبثقة.');
    return;
  }
  win.document.write(html);
  win.document.close();
}

/**
 * Downloads the filled transmittal letter for a single client as an HTML file.
 */
export function downloadClientTransmittalLetter(
  client: Client,
  values?: TransmittalLetterValues,
): void {
  const html = getClientTransmittalLetterHtml(client, values);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const nameSuffix = (client.name || 'مترشح').trim().replace(/\s+/g, '-');
  a.download = `جدول-إرسال-${nameSuffix}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}


function formatDateArabic(dateStr: string): string {
  try {
    const d = new Date(`${dateStr}T00:00:00`);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  } catch {
    return dateStr;
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

interface TransmittalData {
  numbers: string[];
  names: string[];
  categories: string[];
  date: string;
  referenceNumber: string;
}

function fillTransmittalTemplate(template: string, data: TransmittalData): string {
  const namesHtml = data.names.map((n) => escapeHtml(n)).join('<br>');
  const numbersHtml = data.numbers.map((n) => escapeHtml(n)).join('<br>');
  const categoriesHtml = data.categories.map((c) => escapeHtml(c)).join('<br>');
  const dateHtml = escapeHtml(data.date);
  const referenceNumberHtml = escapeHtml(data.referenceNumber);
  const tableTextStyle = getTableTextStyle(data.names.length);

  let html = template;

  // 1. Remove yellow highlight styling completely so it's pure clean text
  html = html.replace(
    /\.fld\{[^}]*\}/,
    '.fld{outline:none;background:none;border-radius:0;unicode-bidi:isolate;line-height:normal}'
  );
  html = html.replace(/\.fld:hover\{[^}]*\}/, '');
  html = html.replace(/\.fld:focus\{[^}]*\}/, '');

  // 2. Category column (الصنف): replace with each candidate's category line-by-line
  html = html.replace(
    /<p dir="auto" class="p fld"[^>]*data-key="cat"[^>]*>[\s\S]*?<\/p>/,
    `<p dir="auto" class="p" style="${tableTextStyle}">${categoriesHtml}</p>`
  );

  // 3. Names column (بيان الوثائق): replace with candidate names line-by-line
  html = html.replace(
    /<p dir="auto" class="p fld"[^>]*data-key="names"[^>]*>[\s\S]*?<\/p>/,
    `<p dir="auto" class="p" style="${tableTextStyle}">${namesHtml}</p>`
  );

  // 4. Number column (الرقــم): replace with sequential 1, 2, 3... line-by-line
  html = html.replace(
    /<p dir="rtl" class="p fld"[^>]*data-key="item"[^>]*>[\s\S]*?<\/p>/,
    `<p dir="rtl" class="p" style="${tableTextStyle}">${numbersHtml}</p>`
  );

  // 5. Note column: keep as plain text without contenteditable
  html = html.replace(
    /<p dir="rtl" class="p fld"[^>]*data-key="note"[^>]*>([\s\S]*?)<\/p>/,
    `<p dir="rtl" class="p" style="line-height:16.1pt;font-size:14pt;position:relative;top:0.23pt;text-align:center;font-size:14pt;font-weight:700">$1</p>`
  );

  // 6. Date: insert deposit date as plain text
  html = html.replace(
    /<span class="fld in"[^>]*data-key="date"[^>]*>[\s\S]*?<\/span>/,
    `<span style="font-weight:700">${dateHtml}</span>`
  );

  // 7. Insert the reference number and make the place plain text.
  html = html.replace(
    /<span class="fld in"[^>]*data-key="ref"[^>]*>[\s\S]*?<\/span>/,
    `<span style="font-weight:700">${referenceNumberHtml}</span>`
  );
  html = html.replace(
    /<span class="fld in"[^>]*data-key="place"[^>]*>([\s\S]*?)<\/span>/,
    `<span style="font-weight:700">$1</span>`
  );

  // 8. Remove the top bar completely - only display the document file itself
  html = html.replace(/<div class="bar"[^>]*>[\s\S]*?<\/div>\s*/, '');
  html = html.replace(/\.bar\{[^}]*\}\s*/g, '');
  html = html.replace(/\.bar\s+[^{]+\{[^}]*\}\s*/g, '');

  // 9. Remove localstorage/demo script, keep zoom fit and print handlers
  html = html.replace(
    /<script>[\s\S]*?<\/script>/,
    `<script>\n(function(){\n  function fit(){var w=document.documentElement.clientWidth-16,pw=595.28*96/72;document.documentElement.style.setProperty("--fit",Math.min(1,w/pw));}\n  fit();window.addEventListener("resize",fit);\n  window.addEventListener("beforeprint",function(){document.documentElement.style.setProperty("--fit",1);});\n  window.addEventListener("afterprint",fit);\n})();\n</script>`
  );

  return html;
}

/**
 * The printed table has a fixed-height candidates area. Keep its normal
 * 14pt type through nine candidates, then compact all three data columns
 * together so their rows remain aligned and contained in the table.
 */
function getTableTextStyle(candidateCount: number): string {
  const standardFontSize = 14;
  const standardLineHeight = 18.51;

  if (candidateCount <= 9) {
    return `line-height:${standardLineHeight}pt;font-size:${standardFontSize}pt;position:relative;top:-0.98pt;text-align:center;font-weight:700`;
  }

  // Approximately 162pt of vertical space is available below the table intro.
  // Keep a readable lower limit for the longest practical candidate lists.
  const lineHeight = Math.max(7.5, Math.min(standardLineHeight, 162 / candidateCount));
  const fontSize = Math.max(6.5, standardFontSize * (lineHeight / standardLineHeight));

  return `line-height:${lineHeight.toFixed(2)}pt;font-size:${fontSize.toFixed(2)}pt;position:relative;top:-0.98pt;text-align:center;font-weight:700`;
}
