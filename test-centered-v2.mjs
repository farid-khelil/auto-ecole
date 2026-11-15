import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import pkg from "arabic-persian-reshaper";
const { ArabicShaper } = pkg;
import fs from "fs";
import path from "path";

const projectRoot = "/home/farid/Projects/auto-ecole";

async function main() {
  const templateBytes = fs.readFileSync(path.join(projectRoot, "public/model-02-template.pdf"));
  const fontBytes = fs.readFileSync(path.join(projectRoot, "public/fonts/NotoSansArabic-Bold.ttf"));

  const pdfDoc = await PDFDocument.load(templateBytes);
  pdfDoc.registerFontkit(fontkit);

  const arabicBoldFont = await pdfDoc.embedFont(fontBytes);
  const latinBoldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const page = pdfDoc.getPages()[0];
  const textColor = rgb(0, 0, 0);
  const whiteColor = rgb(1, 1, 1);

  const shape = (text) => (text ? ArabicShaper.convertArabic(String(text)) : "");

  function clearInner(x1, y1, x2, y2) {
    page.drawRectangle({ x: x1, y: y1, width: x2 - x1, height: y2 - y1, color: whiteColor });
  }

  function drawArabicCenter(text, xCenter, yBaseline, size = 9.5) {
    if (!text) return;
    const shaped = shape(text);
    const w = arabicBoldFont.widthOfTextAtSize(shaped, size);
    page.drawText(shaped, { x: xCenter - w / 2, y: yBaseline, size, font: arabicBoldFont, color: textColor });
  }

  function drawLatinCenter(text, xCenter, yBaseline, size = 9.5, bold = true) {
    if (!text && text !== 0) return;
    const font = bold ? latinBoldFont : latinBoldFont;
    const str = String(text);
    const w = font.widthOfTextAtSize(str, size);
    page.drawText(str, { x: xCenter - w / 2, y: yBaseline, size, font, color: textColor });
  }

  function formatDate(d) {
    if (!d) return "";
    const parts = d.split("-");
    return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : d;
  }

  function getExamType(stage) {
    switch (stage) {
      case "مناورات": return "مناورات";
      case "سياقة عامة": return "سياقة";
      default: return "قانون المرور";
    }
  }

  function drawHLine(x1, x2, y, thickness = 0.8) {
    page.drawLine({ start: { x: x1, y }, end: { x: x2, y }, thickness, color: textColor });
  }
  function drawVLine(x, y1, y2, thickness = 0.8) {
    page.drawLine({ start: { x, y: y1 }, end: { x, y: y2 }, thickness, color: textColor });
  }

  // --- Dates ---
  clearInner(290, 658, 350, 675);
  clearInner(174, 658, 234, 675);
  clearInner(215, 746, 430, 775);
  drawArabicCenter("الجمهورية الجزائرية الديمقراطية الشعبية", 322, 756, 11);
  drawLatinCenter("15/10/2026", 320, 663, 10, true);
  drawLatinCenter("18/10/2026", 204, 663, 10, true);

  // --- V1 rows ---
  const v1RowY = [];
  for (let i = 0; i <= 15; i++) v1RowY.push(602.64 - (i * 17.64));

  const v2RowY = [333.00, 318.60, 300.24, 280.44, 260.64, 240.84, 221.04, 207.72, 194.40, 181.08, 167.76];

  // Clear V1 cells
  for (let i = 0; i < 15; i++) {
    const top = v1RowY[i]; const bottom = v1RowY[i + 1];
    clearInner(76.32, bottom, 127.44, top);
    clearInner(127.44, bottom, 183.60, top);
    clearInner(183.60, bottom, 236.16, top);
    clearInner(264.96, bottom, 330.48, top);
    clearInner(330.48, bottom, 460.80, top);
    clearInner(460.80, bottom, 517.68, top);
  }

  clearInner(236.16, v1RowY[15], 264.96, v1RowY[0]);
  drawArabicCenter("أ / ب", 250.56, (v1RowY[0] + v1RowY[15]) / 2 - 3, 11);

  // Clear V2 cells
  for (let i = 0; i < 10; i++) {
    const top = v2RowY[i]; const bottom = v2RowY[i + 1];
    clearInner(76.32, bottom, 127.44, top);
    clearInner(127.44, bottom, 183.60, top);
    clearInner(183.60, bottom, 236.16, top);
    clearInner(264.96, bottom, 330.48, top);
    clearInner(330.48, bottom, 460.80, top);
    clearInner(460.80, bottom, 517.68, top);
  }

  clearInner(236.16, v2RowY[10], 264.96, v2RowY[0]);
  drawArabicCenter("د", 250.56, (v2RowY[0] + v2RowY[10]) / 2 - 4, 11);

  // Summary
  clearInner(264.96, 61.20, 460.80, 154.44);

  // Grid lines V1
  for (let i = 0; i <= 15; i++) {
    drawHLine(76.32, 236.16, v1RowY[i]);
    drawHLine(264.96, 546.48, v1RowY[i]);
  }
  drawHLine(236.16, 264.96, v1RowY[0]);
  drawHLine(76.32, 565.20, v1RowY[15]);

  const v1Cols = [76.32, 127.44, 183.60, 236.16, 264.96, 330.48, 460.80, 517.68, 546.48, 565.20];
  for (const x of v1Cols) drawVLine(x, v1RowY[15], v1RowY[0]);

  // Grid lines V2
  for (let i = 0; i <= 10; i++) {
    drawHLine(76.32, 236.16, v2RowY[i]);
    drawHLine(264.96, 546.48, v2RowY[i]);
  }
  drawHLine(236.16, 264.96, v2RowY[0]);
  drawHLine(76.32, 565.20, v2RowY[10]);
  for (const x of v1Cols) drawVLine(x, v2RowY[10], v2RowY[0]);

  // Summary grid
  const sumCols = [264.96, 330.48, 387.36, 460.80];
  const sumRows = [154.44, 114.48, 101.16, 87.84, 74.52, 61.20];
  for (const y of sumRows) drawHLine(264.96, 460.80, y);
  for (const x of sumCols) drawVLine(x, 61.20, 154.44);

  drawArabicCenter("طبيعة الامتحان", (387.36 + 460.80) / 2, (154.44 + 114.48) / 2 - 3, 9);
  drawArabicCenter("عدد المترشحين", (330.48 + 387.36) / 2, 137, 7.8);
  drawArabicCenter("المدعوين", (330.48 + 387.36) / 2, 122, 7.8);
  drawArabicCenter("عدد المترشحين", (264.96 + 330.48) / 2, 137, 7.8);
  drawArabicCenter("الناجحين", (264.96 + 330.48) / 2, 122, 7.8);

  drawArabicCenter("قانون المرور", (387.36 + 460.80) / 2, (114.48 + 101.16) / 2 - 3, 9.5);
  drawArabicCenter("المناورات", (387.36 + 460.80) / 2, (101.16 + 87.84) / 2 - 3, 9.5);
  drawArabicCenter("السياقة", (387.36 + 460.80) / 2, (87.84 + 74.52) / 2 - 3, 9.5);
  drawArabicCenter("المجموع", (387.36 + 460.80) / 2, (74.52 + 61.20) / 2 - 3, 10);

  // --- Test data ---
  const candidates = [
    { name: "بن علي محمد", birthDate: "1998-04-12", birthPlace: "عين بوسيف", registrationDate: "2026-09-01", stage: undefined },
    { name: "قادري _ فاطمة الزهراء", birthDate: "2001-11-23", birthPlace: "المدية", registrationDate: "2026-09-05", stage: "مناورات" },
    { name: "سالمي عبد القادر", birthDate: "1995-07-30", birthPlace: "", registrationDate: "2026-09-10", stage: "سياقة عامة" },
    { name: "حاج . كولة عبد الجبار عبد المطلب", birthDate: "2005-01-17", birthPlace: "عين بوسيف", registrationDate: "2026-09-12", stage: "سياقة عامة" },
    { name: "طيباوي _ عمار", birthDate: "1986-09-08", birthPlace: "عين بوسيف", registrationDate: "2026-09-14", stage: undefined },
  ];

  candidates.forEach((c, idx) => {
    const top = v1RowY[idx];
    const bottom = v1RowY[idx + 1];
    const yCenter = (top + bottom) / 2;

    if (c.registrationDate) drawLatinCenter(formatDate(c.registrationDate), 489.24, yCenter - 3, 9, true);

    // Centered name with auto-scaling
    if (c.name) {
      const colWidth = 460.80 - 330.48 - 4;
      const shaped = shape(c.name);
      let fontSize = 10.5;
      let w = arabicBoldFont.widthOfTextAtSize(shaped, fontSize);
      while (w > colWidth && fontSize > 6) {
        fontSize -= 0.5;
        w = arabicBoldFont.widthOfTextAtSize(shaped, fontSize);
      }
      page.drawText(shaped, {
        x: 395.64 - w / 2,
        y: yCenter - fontSize / 3,
        size: fontSize,
        font: arabicBoldFont,
        color: textColor,
      });
    }

    if (c.birthDate) {
      const dateStr = formatDate(c.birthDate);
      const placeStr = c.birthPlace ? c.birthPlace.trim() : "";
      if (placeStr) {
        const shapedPlace = shape(placeStr);
        const wDate = latinBoldFont.widthOfTextAtSize(dateStr, 7.5);
        const wPlace = arabicBoldFont.widthOfTextAtSize(shapedPlace, 7.5);
        page.drawText(dateStr, { x: 297.72 - wDate / 2, y: yCenter + 1.5, size: 7.5, font: latinBoldFont, color: textColor });
        page.drawText(shapedPlace, { x: 297.72 - wPlace / 2, y: yCenter - 7.0, size: 7.5, font: arabicBoldFont, color: textColor });
      } else {
        drawLatinCenter(dateStr, 297.72, yCenter - 3, 9, true);
      }
    }

    drawArabicCenter(getExamType(c.stage), 209.88, yCenter - 3, 9.5);
  });

  // Summary counts
  const sumXCenter = 358.92;
  drawLatinCenter(2, sumXCenter, (114.48 + 101.16) / 2 - 3, 10, true);
  drawLatinCenter(1, sumXCenter, (101.16 + 87.84) / 2 - 3, 10, true);
  drawLatinCenter(2, sumXCenter, (87.84 + 74.52) / 2 - 3, 10, true);
  drawLatinCenter(5, sumXCenter, (74.52 + 61.20) / 2 - 3, 10.5, true);

  const pdfBytes = await pdfDoc.save();
  fs.writeFileSync("/tmp/centered-test-v2.pdf", pdfBytes);
  console.log("✅ Written /tmp/centered-test-v2.pdf");
}

main().catch(console.error);
