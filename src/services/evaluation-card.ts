import type { Client } from './clients';
import { EVALUATION_TEMPLATE_RAW } from './evaluation-template-raw';

export interface EvaluationCardValues {
  /** Candidate full name (الإسم واللقب) */
  name?: string;
  /** Date and place of birth, e.g. "12/05/1998 - المدية" */
  birth?: string;
  /** Full address (العنوان) */
  address?: string;
  /** Registration date at driving school (تاريخ التسجيل لدى مدرسة تعليم السياقة) */
  registrationDate?: string;
  /** Dossier submission date at prefecture (تاريخ إيداع الملف لدى مصالح المندوبية الولائية) */
  submissionDate?: string;
  /** Wilaya name (الولاية) */
  wilaya?: string;
}

/**
 * Converts a date string (ISO YYYY-MM-DD or YYYY/MM/DD) to Algerian official DD/MM/YYYY format.
 * If already formatted or non-standard, preserves it.
 */
export function formatEvaluationDate(dateStr?: string): string {
  if (!dateStr) return '';
  const trimmed = dateStr.trim();
  // YYYY-MM-DD or YYYY/MM/DD
  const ymdMatch = trimmed.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (ymdMatch) {
    const [, y, m, d] = ymdMatch;
    return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
  }
  // DD-MM-YYYY or DD/MM/YYYY
  const dmyMatch = trimmed.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (dmyMatch) {
    const [, d, m, y] = dmyMatch;
    return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
  }
  return trimmed;
}

/**
 * Combines candidate birth date and birth place in the format "DD/MM/YYYY - مكان الميلاد"
 * matching the official evaluation card template.
 */
export function formatEvaluationBirth(birthDate?: string, birthPlace?: string): string {
  const dateFormatted = formatEvaluationDate(birthDate);
  const place = (birthPlace || '').trim();
  if (dateFormatted && place) {
    return `${dateFormatted} - ${place}`;
  }
  return dateFormatted || place || '';
}

/**
 * Builds the Evaluation Card (بطاقة تقييم المترشحين لسياقة السيارات ذات المحرك) HTML
 * filled with candidate details only, leaving the examination table blank for manual evaluation.
 */
export function getEvaluationCardHtml(
  client: Client,
  values: EvaluationCardValues = {},
): string {
  const name = values.name !== undefined ? values.name : (client.name || '');
  const birth = values.birth !== undefined
    ? values.birth
    : formatEvaluationBirth(client.birthDate, client.birthPlace);
  const address = values.address !== undefined ? values.address : (client.address || '');
  const registrationDate = values.registrationDate !== undefined
    ? values.registrationDate
    : formatEvaluationDate(client.registrationDate);
  const submissionDate = values.submissionDate !== undefined
    ? values.submissionDate
    : formatEvaluationDate(client.attendance?.submissionDate || client.registrationDate);
  const wilaya = values.wilaya !== undefined ? values.wilaya : 'المدية';

  return fillTemplate(EVALUATION_TEMPLATE_RAW, {
    name,
    birth,
    address,
    registrationDate,
    submissionDate,
    wilaya,
  });
}

/**
 * Downloads the evaluation card as a standalone printable HTML file.
 */
export function downloadEvaluationCard(
  client: Client,
  values?: EvaluationCardValues,
): void {
  const html = getEvaluationCardHtml(client, values);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const name = (values?.name || client.name || 'بطاقة-تقييم').trim().replace(/\s+/g, '-');
  a.download = `بطاقة-تقييم-${name}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── helpers ──────────────────────────────────────────────────────────────────

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

interface TemplateData {
  name: string;
  birth: string;
  address: string;
  registrationDate: string;
  submissionDate: string;
  wilaya: string;
}

function fillTemplate(template: string, data: TemplateData): string {
  const escapedName = escapeHtml(data.name);
  const escapedBirth = escapeHtml(data.birth);
  const escapedAddress = escapeHtml(data.address);
  const escapedRegDate = escapeHtml(data.registrationDate);
  const escapedSubDate = escapeHtml(data.submissionDate);
  const escapedWilaya = escapeHtml(data.wilaya || 'المدية');

  let filled = template
    .replace(/\{\{NAME\}\}/g, escapedName)
    .replace(/\{\{BIRTH\}\}/g, escapedBirth)
    .replace(/\{\{ADDRESS\}\}/g, escapedAddress)
    .replace(/\{\{REGDATE\}\}/g, escapedRegDate)
    .replace(/\{\{SUBDATE\}\}/g, escapedSubDate)
    .replace(/\{\{WILAYA\}\}/g, escapedWilaya);

  // Also replace data-f elements if template uses them
  filled = filled
    .replace(/(<[^>]*data-f="name"[^>]*>)(.*?)(<\/[^>]+>)/gs, `$1${escapedName}$3`)
    .replace(/(<[^>]*data-f="birth"[^>]*>)(.*?)(<\/[^>]+>)/gs, `$1${escapedBirth}$3`)
    .replace(/(<[^>]*data-f="address"[^>]*>)(.*?)(<\/[^>]+>)/gs, `$1${escapedAddress}$3`)
    .replace(/(<[^>]*data-f="regdate"[^>]*>)(.*?)(<\/[^>]+>)/gs, `$1${escapedRegDate}$3`)
    .replace(/(<[^>]*data-f="subdate"[^>]*>)(.*?)(<\/[^>]+>)/gs, `$1${escapedSubDate}$3`);

  return filled;
}

export const EVALUATION_CARD_TEMPLATE_RAW = EVALUATION_TEMPLATE_RAW;
