/**
 * Arabic search normalization utility.
 * Normalizes common variations in Arabic orthography (Alef forms, Teh Marbuta / Heh,
 * Alef Maksura / Yeh, and removes diacritics / tashkeel and tatweel) to provide
 * accurate, forgiving search across client names and text fields.
 */

export function normalizeArabic(text: string | null | undefined): string {
  if (!text) return '';
  return text
    .toLowerCase()
    // Remove diacritics (harakat / tashkeel) and tatweel
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    // Normalize alef variants (أ, إ, آ, ٱ) -> ا
    .replace(/[أإآٱ]/g, 'ا')
    // Normalize alef maksura (ى) -> ي
    .replace(/ى/g, 'ي')
    // Normalize teh marbuta (ة) -> ه
    .replace(/ة/g, 'ه')
    // Normalize multiple whitespace to single space
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Checks if targetText matches all whitespace-separated terms of searchQuery
 * using normalized Arabic comparison.
 */
export function matchesArabicSearch(
  targetText: string | null | undefined,
  searchQuery: string | null | undefined
): boolean {
  if (!searchQuery || !searchQuery.trim()) return true;
  const normTarget = normalizeArabic(targetText);
  const normQuery = normalizeArabic(searchQuery);
  if (!normQuery) return true;

  const terms = normQuery.split(' ').filter(Boolean);
  return terms.every((term) => normTarget.includes(term));
}
