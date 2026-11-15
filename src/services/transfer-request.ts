import type { Client } from './clients';
import transferRequestTemplateRaw from '../../transfer-request.html?raw';

export interface TransferRequestValues {
  /** Reference number, e.g. "02" */
  referenceNumber?: string;
  /** Year, e.g. "2026" */
  year?: string;
  /** Date of issue, e.g. "2026-11-04" or "2026/11/04" */
  issuedDate?: string;
  /** Originating driving school, defaults to "بوطيبة محمد" */
  transferFrom?: string;
  /** Destination driving school, defaults to empty */
  transferTo?: string;
  /** Candidate surname (اللقب) */
  lastName?: string;
  /** Candidate given name (الإسم) */
  firstName?: string;
  /** Birth date and place (تاريخ ومكان الميلاد) */
  birth?: string;
  /** Registration number (المسجل تحت الرقم) */
  registrationNumber?: string;
  /** Reason for transfer (أسباب التحويل) */
  reason?: string;
}

/**
 * Splits a full Arabic name into surname (اللقب) and given name (الإسم).
 */
export function splitClientName(fullName: string): { lastName: string; firstName: string } {
  const trimmed = (fullName || '').trim();
  if (!trimmed) return { lastName: '', firstName: '' };
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) {
    return { lastName: parts[0], firstName: '' };
  }
  // Handle common Arabic compound surname prefixes
  if (['بن', 'أيت', 'بو', 'بل', 'ابن', 'عبد'].includes(parts[0]) && parts.length > 2) {
    return {
      lastName: `${parts[0]} ${parts[1]}`,
      firstName: parts.slice(2).join(' '),
    };
  }
  return {
    lastName: parts[0],
    firstName: parts.slice(1).join(' '),
  };
}

/**
 * Builds the transfer request (طلب تحويل ملف رخصة السياقة) HTML filled with the client's
 * information and transfer details according to the official scanned template.
 */
export function getTransferRequestHtml(
  client: Client,
  values: TransferRequestValues = {},
): string {
  const { lastName: defaultLastName, firstName: defaultFirstName } = splitClientName(client.name || '');
  const lastName = values.lastName !== undefined ? values.lastName : defaultLastName;
  const firstName = values.firstName !== undefined ? values.firstName : defaultFirstName;

  const birthDateFormatted = client.birthDate ? formatDateSlash(client.birthDate) : '';
  const birthPlace = (client.birthPlace || '').trim();
  const defaultBirth = birthDateFormatted
    ? birthPlace
      ? `${birthDateFormatted} بـ ${birthPlace}`
      : birthDateFormatted
    : birthPlace || '';
  const birth = values.birth !== undefined ? values.birth : defaultBirth;

  const registrationNumber = values.registrationNumber !== undefined
    ? values.registrationNumber
    : (client.registrationNumber || '');

  const referenceNumber = values.referenceNumber?.trim() || '02';
  const year = values.year?.trim() || new Date().getFullYear().toString();
  const transferFrom = values.transferFrom?.trim() || 'بوطيبة محمد';
  const transferTo = values.transferTo?.trim() || '';

  const todayIso = new Date().toISOString().slice(0, 10);
  const issuedDate = values.issuedDate ? formatDateSlash(values.issuedDate) : formatDateSlash(todayIso);

  const reason = values.reason?.trim() || '';

  return fillTemplate(transferRequestTemplateRaw, {
    num: referenceNumber,
    year,
    date: issuedDate,
    from: transferFrom,
    to: transferTo,
    lastName,
    firstName,
    birth,
    regNum: registrationNumber,
    reason,
  });
}

/**
 * Downloads the transfer request letter as a standalone HTML file.
 */
export function downloadTransferRequest(
  client: Client,
  values?: TransferRequestValues,
): void {
  const html = getTransferRequestHtml(client, values);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const name = (client.name || 'طلب-تحويل').trim().replace(/\s+/g, '-');
  a.download = `طلب-تحويل-${name}.html`;
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

/** Convert "2026-10-07" to "2026/10/07" */
function formatDateSlash(dateStr: string): string {
  if (!dateStr) return '';
  return dateStr.replace(/-/g, '/');
}

interface TemplateData {
  num: string;
  year: string;
  date: string;
  from: string;
  to: string;
  lastName: string;
  firstName: string;
  birth: string;
  regNum: string;
  reason: string;
}

function fillTemplate(template: string, data: TemplateData): string {
  function replaceField(currentHtml: string, attr: string, value: string): string {
    const escaped = escapeHtml(value);
    return currentHtml
      .replace(new RegExp(`data-in="${attr}"[^>]*value="[^"]*"`, 'g'), `data-in="${attr}" value="${escaped}"`)
      .replace(new RegExp(`data-f="${attr}"[^>]*>.*?</span>`, 'gs'), `data-f="${attr}">${escaped}</span>`)
      .replace(new RegExp(`data-f="${attr}"[^>]*></span>`, 'g'), `data-f="${attr}">${escaped}</span>`);
  }

  let nextTemplate = template;
  for (const [field, value] of Object.entries({
    serial: data.num,
    year: data.year,
    date: data.date,
    from: data.from,
    to: data.to,
    lname: data.lastName,
    fname: data.firstName,
    birth: data.birth,
    licno: data.regNum,
    reason: data.reason,
  })) {
    nextTemplate = replaceField(nextTemplate, field, value);
  }

  return nextTemplate;
}

export const TRANSFER_REQUEST_TEMPLATE_RAW = transferRequestTemplateRaw;
