import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { ArabicShaper } from 'arabic-persian-reshaper';

export interface MedicalCertData {
  firstName: string;   // الإسم
  lastName: string;    // اللقب
  birthDate: string;   // تاريخ الميلاد
  birthPlace: string;  // مكان الميلاد
  address?: string;    // العنوان
  phone: string;       // رقم الهاتف
  email: string;       // البريد الإلكتروني
}

export async function printMedicalCertificate(data: MedicalCertData): Promise<void> {
  // Load the PDF template
  const templateUrl = '/medical-cert-template.pdf';
  const existingPdfBytes = await fetch(templateUrl).then((res) => {
    if (!res.ok) throw new Error('فشل تحميل قالب الشهادة الطبية');
    return res.arrayBuffer();
  });

  const pdfDoc = await PDFDocument.load(existingPdfBytes);
  pdfDoc.registerFontkit(fontkit);

  // Load NotoSansArabic-Bold to render Arabic letters in bold and joined (connected)
  const arabicFontBytes = await fetch('/fonts/NotoSansArabic-Bold.ttf').then((res) => {
    if (!res.ok) throw new Error('فشل تحميل الخط العربي');
    return res.arrayBuffer();
  });

  const arabicBoldFont = await pdfDoc.embedFont(arabicFontBytes);
  const latinBoldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const page = pdfDoc.getPages()[0];

  // Helper to shape connected Arabic text
  const shape = (text: string) => (text ? ArabicShaper.convertArabic(text) : '');
  const containsArabic = (text: string) => /[\u0600-\u06ff]/.test(text);

  // Larger font sizes for better readability
  const arabicSize = 13.5;
  const latinSize = 12.5;
  const textColor = rgb(0, 0, 0);

  // Arabic values retain their shaped Noto font; Latin-only values use Helvetica.
  // Both are right-aligned to the template's existing field coordinates.
  const drawNameOrAddress = (text: string, x: number, y: number, customArabicSize = arabicSize) => {
    if (!text) return;
    const useArabicFont = containsArabic(text);
    const value = useArabicFont ? shape(text) : text;
    const font = useArabicFont ? arabicBoldFont : latinBoldFont;
    const size = useArabicFont ? customArabicSize : latinSize;
    const width = font.widthOfTextAtSize(value, size);
    page.drawText(value, {
      x: x - width,
      y,
      size,
      font,
      color: textColor,
    });
  };

  // 1: X 451, Y 705 -> Nom / اللقب
  if (data.lastName) {
    drawNameOrAddress(data.lastName, 451, 705);
  }

  // 2: X 447, Y 685 -> Prénom / الإسم
  if (data.firstName) {
    drawNameOrAddress(data.firstName, 447, 685);
  }

  // 3: Date of birth -> X: 435, Y: 668
  const formattedDate = data.birthDate
    ? data.birthDate.includes('-')
      ? data.birthDate.split('-').reverse().join('/')
      : data.birthDate
    : '';

  if (formattedDate) {
    const dateWidth = latinBoldFont.widthOfTextAtSize(formattedDate, latinSize);
    page.drawText(formattedDate, {
      x: 435 - dateWidth,
      y: 668,
      size: latinSize,
      font: latinBoldFont,
      color: textColor,
    });
  }

  // 3b: Place of birth -> X: 314, Y: 669
  if (data.birthPlace) {
    drawNameOrAddress(data.birthPlace, 314, 669);
  }

  // 4: X 438, Y 646 -> Adresse / العنوان
  if (data.address) {
    drawNameOrAddress(data.address, 438, 646);
  }

  // 5: X 444, Y 625 -> N° Téléphone / رقم الهاتف
  if (data.phone) {
    const phoneWidth = latinBoldFont.widthOfTextAtSize(data.phone, latinSize);
    page.drawText(data.phone, {
      x: 444 - phoneWidth,
      y: 625,
      size: latinSize,
      font: latinBoldFont,
      color: textColor,
    });
  }

  // 6: X 439, Y 605 -> Adresse électronique / البريد الإلكتروني (بدون خلفية بيضاء)
  if (data.email) {
    const emailWidth = latinBoldFont.widthOfTextAtSize(data.email, latinSize);
    page.drawText(data.email, {
      x: 439 - emailWidth,
      y: 605,
      size: latinSize,
      font: latinBoldFont,
      color: textColor,
    });
  }

  const pdfBytes = await pdfDoc.save();
  const blob = new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);

  // Open in a new tab for preview and printing
  const newTab = window.open(url, '_blank');
  if (newTab) {
    newTab.focus();
  }
}
