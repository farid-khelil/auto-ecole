import { PDFDocument, PDFHexString, degrees, drawText, rgb, StandardFonts } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { ArabicShaper } from "arabic-persian-reshaper";
import {
  candidatesListService,
  type CandidatesListRecord,
  isClassAB,
  getCandidateLastExamDate,
  getCurrentCandidates,
} from "./candidates-lists";
import { clientService, type Client } from "./clients";

/**
 * Generates the official النموذج رقم 02 as a PDF using the authentic
 * vector template and candidate data.
 *
 * This produces an exact, crisp A4 PDF that matches the original Excel template 1:1,
 * with complete, sharp grid lines and official styling.
 */
export async function generateCandidatesListPdf(
  record: CandidatesListRecord,
  allLists: CandidatesListRecord[] = [],
  allClients: Client[] = []
): Promise<Uint8Array> {
  const listsToUse =
    allLists.length > 0
      ? allLists
      : await candidatesListService.getAll().catch(() => []);
  const clientsToUse =
    allClients.length > 0
      ? allClients
      : await clientService.list().catch(() => []);
  // 1. Load the authentic Model 02 template PDF
  const templateUrl = "/model-02-template.pdf?v=2";
  const existingPdfBytes = await fetch(templateUrl).then((res) => {
    if (!res.ok) throw new Error("فشل تحميل قالب النموذج رقم 02");
    return res.arrayBuffer();
  });

  const pdfDoc = await PDFDocument.load(existingPdfBytes);
  pdfDoc.registerFontkit(fontkit);

  // 2. Load Arabic & Latin Fonts
  const arabicFontBytes = await fetch("/fonts/NotoSansArabic-Regular.ttf").then((res) => {
    if (!res.ok) throw new Error("فشل تحميل الخط العربي");
    return res.arrayBuffer();
  });

  const arabicRegularFont = await pdfDoc.embedFont(arabicFontBytes, {subset: false,});
  const arabicFontkitFont = fontkit.create(new Uint8Array(arabicFontBytes));
  const latinBoldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const latinRegularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const page = pdfDoc.getPages()[0];
  const arabicFontKey = page.node.newFontDictionary(
    arabicRegularFont.name,
    arabicRegularFont.ref
  );
  const textColor = rgb(0, 0, 0);
  const whiteColor = rgb(1, 1, 1);

  // Helper: shape connected Arabic text
  const shape = (text?: string) => {
    // Pasted names can contain invisible bidi/zero-width marks between words.
    // pdf-lib/fontkit may render those controls as stray glyphs, so remove them
    // before shaping and keep one ordinary space between Arabic words.
    const normalized = String(text ?? "")
      .replace(/[\u061C\u200B-\u200F\u202A-\u202E\u2060\u2066-\u2069\uFEFF]/g, "")
      .replace(/\s+/g, " ")
      .trim();

    return normalized ? ArabicShaper.convertArabic(normalized) : "";
  };

  // pdf-lib encodes glyph IDs but does not apply fontkit's glyph offsets.
  // Noto Arabic uses offsets for some dots in final letters, which left dots
  // detached after words. Encode the pre-shaped glyphs directly instead.
  function getArabicGlyphs(shaped: string) {
    return [...shaped]
      .map((character) => arabicFontkitFont.glyphForCodePoint(character.codePointAt(0)!))
      .reverse();
  }

  function usesArabicGlyphPath(shaped: string) {
    return /[\u0600-\u06FF\uFB50-\uFEFF]/.test(shaped);
  }

  function getArabicWidth(shaped: string, size: number) {
    if (!usesArabicGlyphPath(shaped)) {
      return arabicRegularFont.widthOfTextAtSize(shaped, size);
    }

    return getArabicGlyphs(shaped).reduce(
      (width, glyph) => width + glyph.advanceWidth,
      0
    ) * (size / 1000);
  }

  function drawArabicShaped(shaped: string, x: number, y: number, size: number) {
    if (!usesArabicGlyphPath(shaped)) {
      page.drawText(shaped, { x, y, size, font: arabicRegularFont, color: textColor });
      return;
    }

    const glyphs = getArabicGlyphs(shaped);
    if (glyphs.length === 0) return;

    const encodedGlyphs = PDFHexString.of(
      glyphs.map((glyph) => glyph.id.toString(16).padStart(4, "0")).join("")
    );

    page.pushOperators(
      ...drawText(encodedGlyphs, {
        x,
        y,
        size,
        font: arabicFontKey,
        color: textColor,
        rotate: degrees(0),
        xSkew: degrees(0),
        ySkew: degrees(0),
      })
    );
  }
  // Helper: clear inner cell area without wiping grid borders
  function clearInner(x1: number, y1: number, x2: number, y2: number) {
    page.drawRectangle({
      x: x1,
      y: y1,
      width: x2 - x1,
      height: y2 - y1,
      color: whiteColor,
    });
  }


  function drawArabicCenter(
    text: string,
    xCenter: number,
    yBaseline: number,
    size = 9.5
  ) {
    if (!text?.trim()) return;

    const shaped = shape(text);
    const width = getArabicWidth(shaped, size);
    drawArabicShaped(shaped, xCenter - width / 2, yBaseline, size);
  }

  // Draw a centered Arabic value and shrink it if necessary.
  function drawArabicFitCenter(
    text: string,
    xCenter: number,
    yCenter: number,
    maxWidth: number,
    initialSize = 10.5
  ) {
    if (!text?.trim()) return;

    const shaped = shape(text);
    let fontSize = initialSize;
    let width = getArabicWidth(shaped, fontSize);

    while (width > maxWidth && fontSize > 6) {
      fontSize -= 0.5;
      width = getArabicWidth(shaped, fontSize);
    }

    drawArabicShaped(shaped, xCenter - width / 2, yCenter - fontSize / 3, fontSize);
  }

  function drawLatinCenter(text: string | number, xCenter: number, yBaseline: number, size = 9.5, bold = false) {
    if (!text && text !== 0) return;
    const font = bold ? latinBoldFont : latinRegularFont;
    const str = String(text);
    const w = font.widthOfTextAtSize(str, size);
    page.drawText(str, {
      x: xCenter - w / 2,
      y: yBaseline,
      size,
      font,
      color: textColor,
    });
  }
  // Keep PDF dates identical to the Excel generator: DD/MM/YYYY.
  function formatDate(dateStr?: string): string {
    if (!dateStr) return "";
    const [year, month, day] = dateStr.split("-");
    return day && month && year ? `${day}/${month}/${year}` : dateStr;
  }

  function getExamType(stage?: string): string {
    switch (stage) {
      case "مناورات":    return "مناورات";
      case "سياقة عامة": return "سياقة";
      default:           return "قانون المرور";
    }
  }

  // ── 1. Clean tatweel smearing in Republic Header Line 1 ──
  clearInner(215, 746, 430, 775);
  drawArabicCenter("الجمهورية الجزائرية الديمقراطية الشعبية", 322, 756, 11);

  // ── 2. Draw Dynamic Model 02 Header Dates (تاريخ الإيداع / تاريخ الامتحان) ──
  const yDateBase = 661.3;
  const dateFontSize = 10;
  const depDateStr = record.depositDate ? formatDate(record.depositDate) : "";
  const examDateStr = record.examDate ? formatDate(record.examDate) : "";

  // تاريخ الإيداع:
  const depLabel = shape("تاريخ الإيداع:");
  const depLabelW = getArabicWidth(depLabel, dateFontSize);
  const depLabelX = 398 - depLabelW;
  drawArabicShaped(depLabel, depLabelX, yDateBase, dateFontSize);

  let depDateEndX = depLabelX;
  if (depDateStr) {
    const depDateW = latinBoldFont.widthOfTextAtSize(depDateStr, dateFontSize);
    const depDateX = depLabelX - depDateW - 4;
    page.drawText(depDateStr, {
      x: depDateX,
      y: yDateBase,
      size: dateFontSize,
      font: latinBoldFont,
      color: textColor,
    });
    depDateEndX = depDateX;
  }

  // تاريخ الإمتحان:
  const examLabel = shape("تاريخ الإمتحان:");
  const examLabelW = getArabicWidth(examLabel, dateFontSize);
  const examLabelX = depDateEndX - 18 - examLabelW;
  drawArabicShaped(examLabel, examLabelX, yDateBase, dateFontSize);

  if (examDateStr) {
    const examDateW = latinBoldFont.widthOfTextAtSize(examDateStr, dateFontSize);
    const examDateX = examLabelX - examDateW - 4;
    page.drawText(examDateStr, {
      x: examDateX,
      y: yDateBase,
      size: dateFontSize,
      font: latinBoldFont,
      color: textColor,
    });
  }

  // ── 3. Candidate Rows Calibration ──
  const v1RowY: number[] = [];
  for (let i = 0; i <= 15; i++) {
    v1RowY.push(602.64 - (i * 17.64));
  }

  const v2RowY: number[] = [
    333.00, 318.60, 300.24, 280.44, 260.64,
    240.84, 221.04, 207.72, 194.40, 181.08, 167.76
  ];

  // Clear cells in Vehicle 1
  for (let i = 0; i < 15; i++) {
    const top = v1RowY[i];
    const bottom = v1RowY[i + 1];
    clearInner(76.32, bottom, 127.44, top);  // Col A (النتيجة)
    clearInner(127.44, bottom, 183.60, top); // Col B (تاريخ اخر امتحان)
    clearInner(183.60, bottom, 236.16, top); // Col C (طبيعة الامتحان)
    clearInner(264.96, bottom, 330.48, top); // Col E (تاريخ الميلاد)
    clearInner(330.48, bottom, 460.80, top); // Col F:G (اللقب و الاسم)
    clearInner(460.80, bottom, 517.68, top); // Col H (رقم التسجيل)
  }

  // The source template contains sample candidate data. Clear the complete
  // editable area as a final pass so glyphs that extend past cell boundaries
  // cannot remain visible behind the generated values.
  // Keep Col D (الصنف) unchanged, exactly as it appears in the template.
  clearInner(76.32, v1RowY[15], 236.16, v1RowY[0]);
  clearInner(264.96, v1RowY[15], 517.68, v1RowY[0]);

  // Clear cells in Vehicle 2
  for (let i = 0; i < 10; i++) {
    const top = v2RowY[i];
    const bottom = v2RowY[i + 1];
    clearInner(76.32, bottom, 127.44, top);
    clearInner(127.44, bottom, 183.60, top);
    clearInner(183.60, bottom, 236.16, top);
    clearInner(264.96, bottom, 330.48, top);
    clearInner(330.48, bottom, 460.80, top);
    clearInner(460.80, bottom, 517.68, top);
  }

  // Keep Col D (الصنف) unchanged, exactly as it appears in the template.
  clearInner(76.32, v2RowY[10], 236.16, v2RowY[0]);
  clearInner(264.96, v2RowY[10], 517.68, v2RowY[0]);

  // Clear Summary Box
  clearInner(264.96, 61.20, 460.80, 154.44);

  // ── 4. DRAW COMPLETE, CRISP TABLE GRID LINES ──
  function drawHLine(x1: number, x2: number, y: number, thickness = 0.8) {
    page.drawLine({ start: { x: x1, y }, end: { x: x2, y }, thickness, color: textColor });
  }
  function drawVLine(x: number, y1: number, y2: number, thickness = 0.8) {
    page.drawLine({ start: { x, y: y1 }, end: { x, y: y2 }, thickness, color: textColor });
  }

  // Horizontals for Vehicle 1 (Col D is merged so horizontals skip it)
  for (let i = 0; i <= 15; i++) {
    drawHLine(76.32, 236.16, v1RowY[i], 0.8);
    drawHLine(264.96, 546.48, v1RowY[i], 0.8);
  }
  drawHLine(236.16, 264.96, v1RowY[0], 0.8);
  drawHLine(76.32, 565.20, v1RowY[15], 0.8);

  // Verticals for Vehicle 1
  const v1Cols = [76.32, 127.44, 183.60, 236.16, 264.96, 330.48, 460.80, 517.68, 546.48, 565.20];
  for (const x of v1Cols) {
    drawVLine(x, v1RowY[15], v1RowY[0], 0.8);
  }

  // Horizontals for Vehicle 2
  for (let i = 0; i <= 10; i++) {
    drawHLine(76.32, 236.16, v2RowY[i], 0.8);
    drawHLine(264.96, 546.48, v2RowY[i], 0.8);
  }
  drawHLine(236.16, 264.96, v2RowY[0], 0.8);
  drawHLine(76.32, 565.20, v2RowY[10], 0.8);

  // Verticals for Vehicle 2
  for (const x of v1Cols) {
    drawVLine(x, v2RowY[10], v2RowY[0], 0.8);
  }

  // ── 5. DRAW SUMMARY TABLE GRID & HEADERS ──
  const sumCols = [264.96, 330.48, 387.36, 460.80];
  const sumRows = [154.44, 114.48, 101.16, 87.84, 74.52, 61.20];
  for (const y of sumRows) {
    drawHLine(264.96, 460.80, y, 0.8);
  }
  for (const x of sumCols) {
    drawVLine(x, 61.20, 154.44, 0.8);
  }

  drawArabicCenter("طبيعة الامتحان", (387.36 + 460.80) / 2, (154.44 + 114.48) / 2 - 3, 9);
  drawArabicCenter("عدد المترشحين", (330.48 + 387.36) / 2, 137, 7.8);
  drawArabicCenter("المدعوين", (330.48 + 387.36) / 2, 122, 7.8);
  drawArabicCenter("عدد المترشحين", (264.96 + 330.48) / 2, 137, 7.8);
  drawArabicCenter("الناجحين", (264.96 + 330.48) / 2, 122, 7.8);

  drawArabicCenter("قانون المرور", (387.36 + 460.80) / 2, (114.48 + 101.16) / 2 - 3, 9.5);
  drawArabicCenter("المناورات", (387.36 + 460.80) / 2, (101.16 + 87.84) / 2 - 3, 9.5);
  drawArabicCenter("السياقة", (387.36 + 460.80) / 2, (87.84 + 74.52) / 2 - 3, 9.5);
  drawArabicCenter("المجموع", (387.36 + 460.80) / 2, (74.52 + 61.20) / 2 - 3, 10);

  // ── 6. POPULATE CANDIDATE ROWS ──
  const candidates = getCurrentCandidates(record, clientsToUse);
  const v1List = candidates.filter((c) => isClassAB(c.training)).slice(0, 15);
  const v2List = candidates.filter((c) => !isClassAB(c.training)).slice(0, 10);

  // Vehicle 1 Candidates
  v1List.forEach((c, idx) => {
    const top = v1RowY[idx];
    const bottom = v1RowY[idx + 1];
    const yCenter = (top + bottom) / 2;

    // Col H: Registration Info
    const regValue1 = c.registrationNumber || '';
    if (regValue1) {
      drawLatinCenter(regValue1, 489.24, yCenter - 3, 9);
    }

    // Col F:G: Name
    if (c.name) {
      drawArabicFitCenter(
        c.name,
        395.64,
        yCenter,
        460.80 - 330.48 - 4,
        10.5
      );
    }

    // Col E: Birth Date
    if (c.birthDate) {
      drawLatinCenter(formatDate(c.birthDate), 297.72, yCenter - 3, 9);
    }

    // Col C: Exam Stage
    drawArabicCenter(getExamType(c.stage), 209.88, yCenter - 3, 9.5);

    // Col B: Last Exam Date (تاريخ اخر امتحان)
    const lastExamDate = getCandidateLastExamDate(c, record, listsToUse, clientsToUse);
    if (lastExamDate) {
      drawLatinCenter(formatDate(lastExamDate), 155.52, yCenter - 3, 8.5);
    }

    // Col A: Exam Result (النتيجة)
    const res1 = record.results?.[String(c.id)] || (c.registrationNumber && record.results?.[c.registrationNumber]);
    if (res1) {
      drawArabicCenter(res1, 101.88, yCenter - 3, 9.5);
    }
  });

  // Vehicle 2 Candidates
  v2List.forEach((c, idx) => {
    const top = v2RowY[idx];
    const bottom = v2RowY[idx + 1];
    const yCenter = (top + bottom) / 2;

    const regValue2 = c.registrationNumber || '';
    if (regValue2) {
      drawLatinCenter(regValue2, 489.24, yCenter - 3, 9);
    }

    // Col F:G: Name
    if (c.name) {
      drawArabicFitCenter(
        c.name,
        395.64,
        yCenter,
        460.80 - 330.48 - 4,
        10.5
      );
    }

    if (c.birthDate) {
      drawLatinCenter(formatDate(c.birthDate), 297.72, yCenter - 3, 9);
    }

    drawArabicCenter(getExamType(c.stage), 209.88, yCenter - 3, 9.5);

    // Col B: Last Exam Date (تاريخ اخر امتحان)
    const lastExamDate2 = getCandidateLastExamDate(c, record, listsToUse, clientsToUse);
    if (lastExamDate2) {
      drawLatinCenter(formatDate(lastExamDate2), 155.52, yCenter - 3, 8.5);
    }

    // Col A: Exam Result (النتيجة)
    const res2 = record.results?.[String(c.id)] || (c.registrationNumber && record.results?.[c.registrationNumber]);
    if (res2) {
      drawArabicCenter(res2, 101.88, yCenter - 3, 9.5);
    }
  });

  // ── 7. DRAW SUMMARY COUNTS ──
  const placedCandidates = [...v1List, ...v2List];
  const codeCount     = placedCandidates.filter(c => getExamType(c.stage) === "قانون المرور").length;
  const maneuverCount = placedCandidates.filter(c => getExamType(c.stage) === "مناورات").length;
  const drivingCount  = placedCandidates.filter(c => getExamType(c.stage) === "سياقة").length;
  const totalCount    = placedCandidates.length;

  const sumXCenter = 358.92;
  if (codeCount > 0)     drawLatinCenter(codeCount, sumXCenter, (114.48 + 101.16) / 2 - 3, 10);
  if (maneuverCount > 0) drawLatinCenter(maneuverCount, sumXCenter, (101.16 + 87.84) / 2 - 3, 10);
  if (drivingCount > 0)  drawLatinCenter(drivingCount, sumXCenter, (87.84 + 74.52) / 2 - 3, 10);
  if (totalCount > 0)    drawLatinCenter(totalCount, sumXCenter, (74.52 + 61.20) / 2 - 3, 10.5);

  // Summary counts for passed candidates (الناجحين)
  const isCandPassed = (c: Client) =>
    record.results?.[String(c.id)] === "ناجح" || (c.registrationNumber && record.results?.[c.registrationNumber] === "ناجح");

  const hasAnyResults = placedCandidates.some(
    (c) => record.results?.[String(c.id)] || (c.registrationNumber && record.results?.[c.registrationNumber])
  );

  if (hasAnyResults) {
    const codePassed     = placedCandidates.filter(c => getExamType(c.stage) === "قانون المرور" && isCandPassed(c)).length;
    const maneuverPassed = placedCandidates.filter(c => getExamType(c.stage) === "مناورات" && isCandPassed(c)).length;
    const drivingPassed  = placedCandidates.filter(c => getExamType(c.stage) === "سياقة" && isCandPassed(c)).length;
    const totalPassed    = codePassed + maneuverPassed + drivingPassed;

    const passXCenter = 297.72;
    if (codePassed > 0)     drawLatinCenter(codePassed, passXCenter, (114.48 + 101.16) / 2 - 3, 10);
    if (maneuverPassed > 0) drawLatinCenter(maneuverPassed, passXCenter, (101.16 + 87.84) / 2 - 3, 10);
    if (drivingPassed > 0)  drawLatinCenter(drivingPassed, passXCenter, (87.84 + 74.52) / 2 - 3, 10);
    if (totalPassed > 0)    drawLatinCenter(totalPassed, passXCenter, (74.52 + 61.20) / 2 - 3, 10.5);
  }

  return await pdfDoc.save();
}

/**
 * Generates and downloads the filled Model 02 PDF.
 */
export async function downloadCandidatesListPdf(
  record: CandidatesListRecord,
  allLists: CandidatesListRecord[] = [],
  allClients: Client[] = []
): Promise<void> {
  const pdfBytes = await generateCandidatesListPdf(record, allLists, allClients);
  const blob = new Blob([pdfBytes as unknown as BlobPart], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `النموذج_رقم_02_${record.depositDate || "قائمة"}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

/**
 * Generates the filled Model 02 PDF and immediately opens it in the browser
 * or launches the native print dialog.
 */
export async function printCandidatesListPdf(
  record: CandidatesListRecord,
  allLists: CandidatesListRecord[] = [],
  allClients: Client[] = []
): Promise<void> {
  const pdfBytes = await generateCandidatesListPdf(record, allLists, allClients);
  const blob = new Blob([pdfBytes as unknown as BlobPart], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);

  // Hidden iframe to launch native print dialog directly
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  iframe.src = url;
  document.body.appendChild(iframe);

  iframe.onload = () => {
    setTimeout(() => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch {
        window.open(url, "_blank");
      }
    }, 400);
  };
}
