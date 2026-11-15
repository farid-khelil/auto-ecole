import type { Client } from './clients';
import { CONVOCATION_TEMPLATE_RAW } from './convocation-template-raw';

/**
 * Builds the convocation letter (إستدعاء) HTML filled with the client's
 * personal information and the provided convocation details.
 */
export interface ConvocationLetterValues {
  /** Reference number, e.g. "2026/88" */
  referenceNumber?: string;
  /** Exam date, e.g. "2026-10-07" */
  examDate?: string;
  /** Exam time as "HH:MM" (24h), converted to Arabic words automatically */
  examTime?: string;
  /** Issued date, e.g. "2026-10-04" */
  issuedDate?: string;
}

export function getConvocationLetterHtml(
  client: Client,
  values: ConvocationLetterValues = {},
): string {
  const name = client.name || '';
  const address = client.address || '';
  const category = client.training || 'B';
  const referenceNumber = values.referenceNumber || '2026/88';
  const examDate = values.examDate ? formatDateSlash(values.examDate) : '';
  const examTime = values.examTime ? hourToArabic(values.examTime) : 'الثامنة صباحا';
  const issuedDate = values.issuedDate ? formatDateSlash(values.issuedDate) : '';

  return fillTemplate(CONVOCATION_TEMPLATE_RAW, {
    num: referenceNumber,
    name,
    addr: address,
    examdate: examDate,
    time: examTime,
    cat: category,
    fee: '300',
    issued: issuedDate,
  });
}

/**
 * Downloads the convocation letter as a standalone HTML file.
 */
export function downloadConvocationLetter(
  client: Client,
  values?: ConvocationLetterValues,
): void {
  const html = getConvocationLetterHtml(client, values);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const name = (client.name || 'إستدعاء').trim().replace(/\s+/g, '-');
  a.download = `إستدعاء-${name}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Convert a 24h time string like "08:00" to Arabic words like "الثامنة صباحا".
 * Exported so the UI can show a live preview of the converted text.
 */
export function hourToArabic(time: string): string {
  if (!time) return 'الثامنة صباحا';
  // If it's already words, return as is
  if (!time.includes(':')) return time;

  const parts = time.split(':');
  const h24 = parseInt(parts[0], 10);
  const m = parseInt(parts[1] || '0', 10);
  if (isNaN(h24)) return time;

  const HOUR_WORDS: Record<number, string> = {
    1: 'الواحدة',
    2: 'الثانية',
    3: 'الثالثة',
    4: 'الرابعة',
    5: 'الخامسة',
    6: 'السادسة',
    7: 'السابعة',
    8: 'الثامنة',
    9: 'التاسعة',
    10: 'العاشرة',
    11: 'الحادية عشر',
    12: 'الثانية عشر',
  };

  const isNextHour = m > 35;
  const targetHour = isNextHour ? (h24 + 1) % 24 : h24;
  const h12 = targetHour % 12 === 0 ? 12 : targetHour % 12;
  const period = targetHour >= 5 && targetHour < 12 ? 'صباحا' : targetHour >= 12 && targetHour < 18 ? 'مساء' : 'ليلا';
  const hourWord = HOUR_WORDS[h12] || `${h12}`;

  let minWord = '';
  if (m === 0) {
    minWord = '';
  } else if (m === 15) {
    minWord = ' والربع';
  } else if (m === 20) {
    minWord = ' والثلث';
  } else if (m === 30) {
    minWord = ' والنصف';
  } else if (m === 40) {
    return `${hourWord} إلا ثلث ${period}`.trim();
  } else if (m === 45) {
    return `${hourWord} إلا ربع ${period}`.trim();
  } else if (m === 5) {
    minWord = ' وخمس دقائق';
  } else if (m === 10) {
    minWord = ' وعشر دقائق';
  } else if (m > 0) {
    minWord = ` و ${m} دقيقة`;
  }

  return `${hourWord}${minWord} ${period}`.trim();
}

// ── helpers ──────────────────────────────────────────────────────────────────

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Convert "2026-10-07" to "2026/10/07" */
function formatDateSlash(dateStr: string): string {
  if (!dateStr) return '';
  return dateStr.replace(/-/g, '/');
}

interface TemplateData {
  num: string;
  name: string;
  addr: string;
  examdate: string;
  time: string;
  cat: string;
  fee: string;
  issued: string;
}

function fillTemplate(template: string, data: TemplateData): string {
  return template
    .replace(/\{\{NUM\}\}/g, escapeHtml(data.num))
    .replace(/\{\{NAME\}\}/g, escapeHtml(data.name))
    .replace(/\{\{ADDR\}\}/g, escapeHtml(data.addr))
    .replace(/\{\{EXAMDATE\}\}/g, escapeHtml(data.examdate))
    .replace(/\{\{TIME\}\}/g, escapeHtml(data.time))
    .replace(/\{\{CAT\}\}/g, escapeHtml(data.cat))
    .replace(/\{\{FEE\}\}/g, escapeHtml(data.fee))
    .replace(/\{\{ISSUED\}\}/g, escapeHtml(data.issued));
}
