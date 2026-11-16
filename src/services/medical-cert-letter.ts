import type { Client } from './clients';
import { MEDICAL_CERT_TEMPLATE_RAW } from './medical-cert-template-raw';
import { splitClientName } from './transfer-request';

export interface MedicalCertificateValues {
  /** Candidate surname (اللقب) */
  lastName?: string;
  /** Candidate given name (الإسم) */
  firstName?: string;
  /** Candidate birth date formatted, e.g. "1995/05/12" */
  birthDate?: string;
  /** Candidate birth place, e.g. "المدية" */
  birthPlace?: string;
  /** Full formatted birth line, e.g. "1995/05/12 بـ المدية" */
  birth?: string;
  /** Full address (العنوان) */
  address?: string;
  /** Phone number (رقم الهاتف) */
  phone?: string;
  /** Email address (البريد الإلكتروني) */
  email?: string;
  /** Desired license category, e.g. "B" */
  targetCategory?: string;
  /** Already held license categories, e.g. ["A1", "B"] */
  heldCategories?: string[];
  /** Candidate photo data URL / path */
  photo?: string;
  /** Wilaya name, defaults to "المدية" */
  wilaya?: string;
  /** Daira name, defaults to "عين بوسيف" */
  daira?: string;
  /** Baladia name, defaults to "عين بوسيف" */
  baladia?: string;
}

/**
 * Normalizes date format to YYYY/MM/DD or DD/MM/YYYY
 */
export function formatMedicalDate(dateStr?: string): string {
  if (!dateStr) return '';
  const trimmed = dateStr.trim();
  if (trimmed.includes('-')) {
    return trimmed.replace(/-/g, '/');
  }
  return trimmed;
}

/**
 * Builds the official Algerian Medical Certificate (شهادة طبية لطلب رخصة سياقة) HTML
 * filled with candidate details.
 */
export function getMedicalCertificateHtml(
  client: Partial<Client>,
  values: MedicalCertificateValues = {},
): string {
  const { lastName: defaultLastName, firstName: defaultFirstName } = splitClientName(client.name || '');
  const lastName = values.lastName !== undefined ? values.lastName : defaultLastName;
  const firstName = values.firstName !== undefined ? values.firstName : defaultFirstName;

  const birthDateFormatted = values.birthDate !== undefined
    ? formatMedicalDate(values.birthDate)
    : formatMedicalDate(client.birthDate);
  const birthPlace = values.birthPlace !== undefined ? values.birthPlace : (client.birthPlace || '').trim();

  let birth = values.birth;
  if (!birth) {
    if (birthDateFormatted && birthPlace) {
      birth = `${birthDateFormatted} بـ ${birthPlace}`;
    } else {
      birth = birthDateFormatted || birthPlace || '';
    }
  }

  const address = values.address !== undefined ? values.address : (client.address || '');
  const phone = values.phone !== undefined ? values.phone : (client.phone || '');
  const email = values.email !== undefined ? values.email : (client.email || '');
  const targetCategory = (values.targetCategory || client.training || 'B').trim().toUpperCase();
  const photo = values.photo !== undefined ? values.photo : (client.photo || client.attendance?.photo || '');

  const wilaya = values.wilaya !== undefined ? values.wilaya : 'المدية';
  const daira = values.daira !== undefined ? values.daira : 'عين بوسيف';
  const baladia = values.baladia !== undefined ? values.baladia : 'عين بوسيف';

  const ALL_CATS = ['A1', 'A', 'B', 'BE', 'C1', 'C1E', 'C', 'CE', 'D', 'F'];
  const heldCats = (values.heldCategories || []).map((c) => c.toUpperCase().replace(/[()]/g, ''));

  const replacements: Record<string, string> = {
    lastName: escapeHtml(lastName),
    firstName: escapeHtml(firstName),
    birth: escapeHtml(birth),
    address: escapeHtml(address),
    phone: escapeHtml(phone),
    email: escapeHtml(email),
    wilaya: escapeHtml(wilaya),
    daira: escapeHtml(daira),
    baladia: escapeHtml(baladia),
  };

  // Replace photo conditional
  let html = MEDICAL_CERT_TEMPLATE_RAW;

  if (photo) {
    html = html.replace(/\{\{#photo\}\}([\s\S]*?)\{\{\/photo\}\}/g, '$1');
    html = html.replace(/\{\{\^photo\}\}([\s\S]*?)\{\{\/\^photo\}\}/g, '');
    replacements.photo = photo;
  } else {
    html = html.replace(/\{\{#photo\}\}([\s\S]*?)\{\{\/photo\}\}/g, '');
    html = html.replace(/\{\{\^photo\}\}([\s\S]*?)\{\{\/\^photo\}\}/g, '$1');
  }

  // Categories held
  for (const cat of ALL_CATS) {
    const isHeld = heldCats.includes(cat);
    replacements[`cat_has_${cat}`] = isHeld ? '✓' : '';
  }

  // Target category
  const normalizedTarget = targetCategory.replace(/[()]/g, '');
  for (const cat of ALL_CATS) {
    const isTarget = normalizedTarget === cat || (cat === 'CE' && normalizedTarget === 'C(E)');
    replacements[`check_target_${cat}`] = isTarget ? '✓' : '';
    replacements[`is_target_${cat}`] = isTarget ? 'checked' : '';
  }

  // Simple mustache replacement
  for (const [key, val] of Object.entries(replacements)) {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    html = html.replace(regex, val);
  }

  return html;
}

/**
 * Downloads the medical certificate as a standalone printable HTML file.
 */
export function downloadMedicalCertificateHtml(
  client: Partial<Client>,
  values?: MedicalCertificateValues,
): void {
  const html = getMedicalCertificateHtml(client, values);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const name = (values?.lastName || values?.firstName || client.name || 'شهادة-طبية').trim().replace(/\s+/g, '-');
  a.download = `شهادة-طبية-${name}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
