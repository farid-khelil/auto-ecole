import type { Client } from './clients';
import evaluationCardTemplateRaw from '../../بطاقة تقييم.html?raw';

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

  return fillTemplate(evaluationCardTemplateRaw, {
    name,
    birth,
    address,
    registrationDate,
    submissionDate,
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
}

function fillTemplate(template: string, data: TemplateData): string {
  function replaceField(currentHtml: string, attr: string, value: string): string {
    const escaped = escapeHtml(value);
    return currentHtml
      .replace(
        new RegExp(`data-f="${attr}"[^>]*value="[^"]*"`, 'g'),
        `data-f="${attr}" value="${escaped}"`
      )
      .replace(
        new RegExp(`(<[^>]*data-f="${attr}"[^>]*>)(.*?)(</[^>]+>)`, 'gs'),
        `$1${escaped}$3`
      );
  }

  let nextTemplate = template;
  for (const [field, value] of Object.entries({
    name: data.name,
    birth: data.birth,
    address: data.address,
    regdate: data.registrationDate,
    subdate: data.submissionDate,
  })) {
    nextTemplate = replaceField(nextTemplate, field, value);
  }

  return nextTemplate;
}

export const EVALUATION_CARD_TEMPLATE_RAW = evaluationCardTemplateRaw;
