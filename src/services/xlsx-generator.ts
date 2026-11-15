import JSZip from 'jszip';
import {
  candidatesListService,
  type CandidatesListRecord,
  isClassAB,
  getCandidateLastExamDate,
  getCurrentCandidates,
} from './candidates-lists';
import { clientService, type Client } from './clients';

/**
 * Generates a filled النموذج رقم 02 (.xlsx) by modifying the raw XML
 * inside the template zip. This approach preserves ALL original elements:
 * drawings (title box, info box, signature box), printer settings,
 * relationships, merges, styles, etc.
 *
 * We only modify:
 * - xl/sharedStrings.xml: add new string entries for candidate data
 * - xl/worksheets/sheet1.xml: set cell values referencing the new strings
 * - xl/drawings/drawing1.xml: update تاريخ الإيداع and تاريخ الامتحان
 */
export async function generateFilledXlsx(
  record: CandidatesListRecord,
  allLists: CandidatesListRecord[] = [],
  allClients: Client[] = []
): Promise<void> {
  const listsToUse =
    allLists.length > 0
      ? allLists
      : await candidatesListService.getAll().catch(() => []);
  const clientsToUse =
    allClients.length > 0
      ? allClients
      : await clientService.list().catch(() => []);
  // 1. Fetch and unzip the template
  const response = await fetch('/model-02-template.xlsx');
  const templateBuffer = await response.arrayBuffer();
  const zip = await JSZip.loadAsync(templateBuffer);

  const candidates = getCurrentCandidates(record, clientsToUse);

  // --- Helpers ---
  function getExamType(stage?: string): string {
    switch (stage) {
      case 'مناورات':    return 'مناورات';
      case 'سياقة عامة': return 'سياقة';
      default:           return 'قانون المرور';
    }
  }

  function formatDate(dateStr?: string): string {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-');
    return d && m && y ? `${d}/${m}/${y}` : dateStr;
  }

  // Escape XML special characters
  function escXml(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // 2. Read and modify sharedStrings.xml
  // Add new strings for candidate data, get their indices
  const ssFile = zip.file('xl/sharedStrings.xml');
  if (!ssFile) throw new Error('sharedStrings.xml not found in template');
  let ssXml = await ssFile.async('string');

  // Parse current count
  const countMatch = ssXml.match(/count="(\d+)"/);
  const uniqueMatch = ssXml.match(/uniqueCount="(\d+)"/);
  let currentCount = countMatch ? parseInt(countMatch[1]) : 21;
  let currentUnique = uniqueMatch ? parseInt(uniqueMatch[1]) : 21;
  let nextIndex = currentUnique; // Index for next new string

  // Build new <si> entries and track their indices
  const newStrings: string[] = [];
  const stringIndexMap = new Map<string, number>(); // text -> shared string index

  function addSharedString(text: string): number {
    if (stringIndexMap.has(text)) return stringIndexMap.get(text)!;
    const idx = nextIndex++;
    stringIndexMap.set(text, idx);
    newStrings.push(`<si><t>${escXml(text)}</t></si>`);
    return idx;
  }

  // Prepare candidate data as shared string indices
  interface CandidateData {
    nameIdx: number;
    birthIdx: number;
    examTypeIdx: number;
    regIdx: number;
    lastExamIdx: number;
    resultIdx: number;
  }

  // Split candidates: Class A & B -> Section ب/أ (Vehicle 1), Else -> Section د (Vehicle 2)
  const classABCandidates = candidates.filter((c) => isClassAB(c.training));
  const otherCandidates = candidates.filter((c) => !isClassAB(c.training));

  // Vehicle 1 (rows 12-26): up to 15 candidates for Class A and B
  const v1Start = 12;
  const v1Max = 15;
  const vehicle1 = classABCandidates.slice(0, v1Max);

  // Vehicle 2 (rows 28-37): up to 10 candidates for other classes (Section د)
  const v2Start = 28;
  const v2Max = 10;
  const vehicle2 = otherCandidates.slice(0, v2Max);

  function toCandidateData(c: Client): CandidateData {
    // Only date of birth, without place
    const birthInfo = c.birthDate ? formatDate(c.birthDate) : '';
    const regValue = c.registrationNumber || '';
    const lastExamDate = getCandidateLastExamDate(c, record, listsToUse, clientsToUse);
    const lastExamFormatted = lastExamDate ? formatDate(lastExamDate) : '';
    const resultVal = record.results?.[String(c.id)] || (c.registrationNumber && record.results?.[c.registrationNumber]) || '';

    return {
      nameIdx: addSharedString(c.name || ''),
      birthIdx: birthInfo ? addSharedString(birthInfo) : -1,
      examTypeIdx: addSharedString(getExamType(c.stage)),
      regIdx: regValue ? addSharedString(regValue) : -1,
      lastExamIdx: lastExamFormatted ? addSharedString(lastExamFormatted) : -1,
      resultIdx: resultVal ? addSharedString(resultVal) : -1,
    };
  }

  const vehicle1Data = vehicle1.map(toCandidateData);
  const vehicle2Data = vehicle2.map(toCandidateData);

  // Summary counts based on placed candidates
  const placedCandidates = [...vehicle1, ...vehicle2];
  const codeCount     = placedCandidates.filter(c => getExamType(c.stage) === 'قانون المرور').length;
  const maneuverCount = placedCandidates.filter(c => getExamType(c.stage) === 'مناورات').length;
  const drivingCount  = placedCandidates.filter(c => getExamType(c.stage) === 'سياقة').length;
  const totalCount    = placedCandidates.length;

  // Update sharedStrings.xml: insert new strings before closing </sst>
  if (newStrings.length > 0) {
    const newCount = currentCount + newStrings.length;
    const newUnique = currentUnique + newStrings.length;
    ssXml = ssXml.replace(`count="${currentCount}"`, `count="${newCount}"`);
    ssXml = ssXml.replace(`uniqueCount="${currentUnique}"`, `uniqueCount="${newUnique}"`);
    ssXml = ssXml.replace('</sst>', newStrings.join('') + '</sst>');
  }
  zip.file('xl/sharedStrings.xml', ssXml);

  // 3. Read and modify sheet1.xml
  const sheetFile = zip.file('xl/worksheets/sheet1.xml');
  if (!sheetFile) throw new Error('sheet1.xml not found in template');
  let sheetXml = await sheetFile.async('string');

  // Function to set a cell value in the XML
  // For type "s" (shared string): <c r="F12" s="19" t="s"><v>INDEX</v></c>
  // For type "n" (number): <c r="F40" s="8"><v>5</v></c>
  function setCellInXml(cellRef: string, value: string | number, type: 's' | 'n') {
    // Pattern: <c r="CELLREF" s="STYLE"/> or <c r="CELLREF" s="STYLE"><v>...</v></c>
    // Also handle <c r="CELLREF" s="STYLE" t="s"><v>...</v></c>
    const escapedRef = cellRef.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Match the cell element (self-closing or with content)
    const cellRegex = new RegExp(
      `(<c\\s+r="${escapedRef}"\\s+s=")(\\d+)"((?:\\s+t="[^"]*")?)(\\s*/>|>(?:<v>[^<]*</v>)?</c>)`
    );

    const match = sheetXml.match(cellRegex);
    if (match) {
      const styleNum = match[2];
      const typeAttr = type === 's' ? ' t="s"' : '';
      const replacement = `<c r="${cellRef}" s="${styleNum}"${typeAttr}><v>${value}</v></c>`;
      sheetXml = sheetXml.replace(match[0], replacement);
    }
  }

  // Vehicle 1 (rows 12-26): up to 15 candidates (Class A and B - ب/أ)
  for (let i = 0; i < vehicle1Data.length; i++) {
    const row = v1Start + i;
    const data = vehicle1Data[i];

    // F = name (col F, shared string)
    setCellInXml(`F${row}`, data.nameIdx, 's');

    // E = birth date (col E, shared string)
    if (data.birthIdx >= 0) {
      setCellInXml(`E${row}`, data.birthIdx, 's');
    }

    // C = exam type (col C, shared string)
    setCellInXml(`C${row}`, data.examTypeIdx, 's');

    // H = registration number (col H, shared string)
    if (data.regIdx >= 0) {
      setCellInXml(`H${row}`, data.regIdx, 's');
    }

    // B = last exam date (col B, shared string)
    if (data.lastExamIdx >= 0) {
      setCellInXml(`B${row}`, data.lastExamIdx, 's');
    }

    // A = exam result (col A, shared string)
    if (data.resultIdx >= 0) {
      setCellInXml(`A${row}`, data.resultIdx, 's');
    }
  }

  // Vehicle 2 (rows 28-37): next up to 10 candidates (other classes - د)
  for (let i = 0; i < vehicle2Data.length; i++) {
    const row = v2Start + i;
    const data = vehicle2Data[i];

    setCellInXml(`F${row}`, data.nameIdx, 's');
    if (data.birthIdx >= 0) setCellInXml(`E${row}`, data.birthIdx, 's');
    setCellInXml(`C${row}`, data.examTypeIdx, 's');
    if (data.regIdx >= 0) setCellInXml(`H${row}`, data.regIdx, 's');
    if (data.lastExamIdx >= 0) setCellInXml(`B${row}`, data.lastExamIdx, 's');
    if (data.resultIdx >= 0) setCellInXml(`A${row}`, data.resultIdx, 's');
  }

  // Summary table (rows 40-43, col F = عدد المترشحين المدعوين)
  if (codeCount > 0)     setCellInXml('F40', codeCount, 'n');
  if (maneuverCount > 0) setCellInXml('F41', maneuverCount, 'n');
  if (drivingCount > 0)  setCellInXml('F42', drivingCount, 'n');
  if (totalCount > 0)    setCellInXml('F43', totalCount, 'n');

  zip.file('xl/worksheets/sheet1.xml', sheetXml);

  // 4. Update drawing1.xml — replace dates in the info text box and clear inspector placeholder
  const drawingFile = zip.file('xl/drawings/drawing1.xml');
  if (drawingFile) {
    let drawingXml = await drawingFile.async('string');

    const formattedDeposit = record.depositDate ? formatDate(record.depositDate) : '';
    const formattedExam = record.examDate ? formatDate(record.examDate) : '';

    // Replace deposit date (تاريخ الإيداع)
    drawingXml = drawingXml.replace(
      /(<a:t>[^<]*تاريخ الإيداع:[\s\S]*?<a:t>)\s*[\d/]*\s*(<\/a:t>)/,
      (_, g1, g2) => `${g1}${formattedDeposit ? formattedDeposit + ' ' : ''}${g2}`
    );

    // Replace exam date (تاريخ الإمتحان)
    drawingXml = drawingXml.replace(
      /(<a:t>[^<]*تاريخ الإمتحان:[\s\S]*?<a:t>)\s*[\d/]*\s*(<\/a:t>)/,
      (_, g1, g2) => `${g1}${formattedExam ? ' ' + formattedExam + ' ' : ''}${g2}`
    );

    // Clear inspector placeholder ('ؤؤ') so it remains blank for the inspector to sign
    drawingXml = drawingXml.replace(/<a:t>ؤؤ<\/a:t>/, '<a:t></a:t>');

    zip.file('xl/drawings/drawing1.xml', drawingXml);
  }

  // 5. Generate and download
  const blob = await zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const fileDate = record.depositDate || record.examDate || new Date().toISOString().slice(0, 10);
  a.download = `قائمة_المترشحين_${fileDate}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
