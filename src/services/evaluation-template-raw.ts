/**
 * Raw HTML template for the Evaluation Card (بطاقة تقييم المترشحين لسياقة السيارات ذات المحرك).
 * Designed for standard A4 portrait output with crisp typography and robust printable table borders.
 *
 * Placeholders:
 *   {{WILAYA}}    – Wilaya name, e.g. "المدية"
 *   {{NAME}}      – Candidate's full name
 *   {{BIRTH}}     – Candidate date and place of birth
 *   {{ADDRESS}}   – Candidate address
 *   {{REGDATE}}   – Driving school registration date
 *   {{SUBDATE}}   – Prefecture dossier submission date
 */
export const EVALUATION_TEMPLATE_RAW = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>بطاقة تقييم المترشحين لسياقة السيارات ذات المحرك</title>
<style>
  @page { size: A4 portrait; margin: 0; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  :root { --fit: 1; }
  html, body {
    margin: 0;
    padding: 16px 0;
    background: #2e3235;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    direction: rtl;
    -webkit-font-smoothing: antialiased;
  }

  /* ---------- Page (A4) ---------- */
  .page {
    width: 210mm;
    min-height: 297mm;
    height: 297mm;
    margin: 0 auto;
    background: #fff;
    position: relative;
    overflow: hidden;
    box-shadow: 0 4px 20px rgba(0,0,0,0.35);
    transform-origin: top center;
    transform: scale(var(--fit));
    font-family: "Traditional Arabic", "Simplified Arabic", "Arabic Typesetting", "Amiri", "Noto Naskh Arabic", "Times New Roman", serif;
    font-weight: 700;
    color: #000;
    direction: rtl;
    padding: 13mm 16mm 10mm 16mm;
    box-sizing: border-box;
  }

  .u { text-decoration: underline; text-underline-offset: 4px; text-decoration-thickness: 1.5px; }

  /* ---------- Header ---------- */
  .republic {
    text-align: center;
    font-size: 15pt;
    margin: 0 0 3.5mm 0;
    font-weight: bold;
  }

  .ministry {
    text-align: right;
    font-size: 11.5pt;
    line-height: 1.6;
    margin-bottom: 3.5mm;
    font-weight: bold;
  }

  .title {
    text-align: center;
    font-size: 15pt;
    margin-bottom: 5mm;
    font-weight: bold;
  }
  .title span {
    text-decoration: underline;
    text-underline-offset: 6px;
    text-decoration-thickness: 2px;
  }

  /* ---------- Candidate Fields ---------- */
  .fields-section {
    margin-bottom: 5mm;
    font-size: 12.5pt;
  }
  .field-row {
    display: flex;
    align-items: baseline;
    height: 7mm;
    line-height: 7mm;
  }
  .field-label {
    width: 88mm;
    flex-shrink: 0;
    white-space: nowrap;
    font-weight: bold;
  }
  .colon {
    width: 4mm;
    flex-shrink: 0;
    text-align: center;
    font-weight: bold;
  }
  .field-value {
    flex: 1;
    min-width: 0;
    font-weight: bold;
    padding-right: 3mm;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* ---------- Assessment Table ---------- */
  .eval-table {
    width: 100%;
    border-collapse: collapse;
    border: 2px solid #000;
    margin-bottom: 8mm;
  }
  .eval-table th, .eval-table td {
    border: 1.5px solid #000;
    vertical-align: middle;
  }
  .eval-table th {
    height: 12mm;
    font-size: 13.5pt;
    font-weight: bold;
    text-align: center;
    background: transparent;
  }
  .th-eval { width: 55%; }
  .th-notes { width: 45%; }

  .eval-table tbody tr {
    height: 35mm;
  }
  .td-stage {
    width: 25%;
    text-align: center;
    font-size: 13.5pt;
    font-weight: bold;
    padding: 0 4mm;
  }
  .td-dots-eval {
    width: 30%;
    padding: 2mm 5mm;
  }
  .td-dots-notes {
    width: 45%;
    padding: 2mm 5mm;
  }
  .dot-line {
    height: 9.5mm;
    border-bottom: 2px dotted #000;
  }

  /* ---------- Footer ---------- */
  .footer-section {
    display: flex;
    justify-content: space-between;
    font-size: 13pt;
    font-weight: bold;
    padding: 0 16mm;
    margin-top: 6mm;
  }

  @media print {
    html, body {
      background: #fff !important;
      padding: 0 !important;
      margin: 0 !important;
    }
    .page {
      margin: 0 !important;
      box-shadow: none !important;
      transform: none !important;
      width: 210mm !important;
      height: 297mm !important;
      min-height: 297mm !important;
      max-height: 297mm !important;
      page-break-after: avoid !important;
      page-break-inside: avoid !important;
    }
  }
</style>
</head>
<body>

<div class="page">
  <div class="republic">الجمهورية الجزائرية الديمقراطية الشعبية</div>

  <div class="ministry">
    <div><span class="u">وزارة الداخلية والجماعات المحلية والتهيئة العمرانية</span></div>
    <div><span class="u">المندوبية الوطنية للأمن في الطرق</span></div>
    <div><span class="u">المندوبية الولائية للأمن في الطرق</span></div>
    <div><span class="u">لـــــــــــــــــــولاية ـــــــــــ{{WILAYA}}ـــــــــــ</span></div>
  </div>

  <div class="title">
    <span>بطاقة تقييم المترشحين لسياقة السيارات ذات المحرك</span>
  </div>

  <div class="fields-section">
    <div class="field-row">
      <span class="field-label">الإســــم واللقــــب</span>
      <span class="colon">:</span>
      <span class="field-value" data-f="name">{{NAME}}</span>
    </div>
    <div class="field-row">
      <span class="field-label">تاريــــخ ومكــــان الميــــلاد</span>
      <span class="colon">:</span>
      <span class="field-value" data-f="birth">{{BIRTH}}</span>
    </div>
    <div class="field-row">
      <span class="field-label">العنــــوان</span>
      <span class="colon">:</span>
      <span class="field-value" data-f="address">{{ADDRESS}}</span>
    </div>
    <div class="field-row">
      <span class="field-label">تاريخ التسجيل لدى مدرسة تعليم السيــــاقة</span>
      <span class="colon">:</span>
      <span class="field-value" data-f="regdate">{{REGDATE}}</span>
    </div>
    <div class="field-row">
      <span class="field-label">تاريخ إيداع الملف لدى مصالح المندوبية الولائية</span>
      <span class="colon">:</span>
      <span class="field-value" data-f="subdate">{{SUBDATE}}</span>
    </div>
  </div>

  <table class="eval-table">
    <thead>
      <tr>
        <th class="th-eval" colspan="2">بطــــــــاقـــــــة التقيــــــيــــم</th>
        <th class="th-notes">ملاحظات الممتحن أثناء الإمتحان</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td class="td-stage">
          <div class="stage-name">قانون المرور</div>
        </td>
        <td class="td-dots td-dots-eval">
          <div class="dot-line"></div>
          <div class="dot-line"></div>
          <div class="dot-line"></div>
        </td>
        <td class="td-dots td-dots-notes">
          <div class="dot-line"></div>
          <div class="dot-line"></div>
          <div class="dot-line"></div>
        </td>
      </tr>
      <tr>
        <td class="td-stage">
          <div class="stage-name">المنـــــــاورات</div>
        </td>
        <td class="td-dots td-dots-eval">
          <div class="dot-line"></div>
          <div class="dot-line"></div>
          <div class="dot-line"></div>
        </td>
        <td class="td-dots td-dots-notes">
          <div class="dot-line"></div>
          <div class="dot-line"></div>
          <div class="dot-line"></div>
        </td>
      </tr>
      <tr>
        <td class="td-stage">
          <div class="stage-name">السياقة العـــــــامة</div>
        </td>
        <td class="td-dots td-dots-eval">
          <div class="dot-line"></div>
          <div class="dot-line"></div>
          <div class="dot-line"></div>
        </td>
        <td class="td-dots td-dots-notes">
          <div class="dot-line"></div>
          <div class="dot-line"></div>
          <div class="dot-line"></div>
        </td>
      </tr>
    </tbody>
  </table>

  <div class="footer-section">
    <div class="footer-trainer">إسم ولقب الممرن</div>
    <div class="footer-school">ختم وإمضاء المدرسة</div>
  </div>
</div>

<script>
(function(){
  function fit(){
    var w = document.documentElement.clientWidth - 20;
    var pw = 210 * 3.7795275591;
    if (w < pw) {
      document.documentElement.style.setProperty("--fit", (w / pw).toFixed(3));
    } else {
      document.documentElement.style.setProperty("--fit", "1");
    }
  }
  fit();
  window.addEventListener("resize", fit);
  window.addEventListener("beforeprint", function(){ document.documentElement.style.setProperty("--fit", "1"); });
  window.addEventListener("afterprint", fit);
})();
</script>

</body>
</html>`;
