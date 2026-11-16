/**
 * Raw HTML template for the official Algerian Medical Certificate for Driving License
 * (شهادة طبية لطلب رخصة سياقة - القرار الوزاري المشترك المؤرخ في 15 نوفمبر 1984)
 * Designed for pixel-perfect A4 printing and in-app preview.
 */
export const MEDICAL_CERT_TEMPLATE_RAW = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>شهادة طبية لطلب رخصة سياقة</title>
<style>
  @page {
    size: A4 portrait;
    margin: 0;
  }
  * {
    box-sizing: border-box;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  :root {
    --fit: 1;
  }
  html, body {
    margin: 0;
    padding: 12px 0;
    background: #2e3235;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    direction: rtl;
    -webkit-font-smoothing: antialiased;
    font-family: "Traditional Arabic", "Simplified Arabic", "Amiri", "Noto Naskh Arabic", "Arial", sans-serif;
  }

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
    color: #000;
    direction: rtl;
    padding: 8mm 12mm 6mm 12mm;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }

  /* Header Section */
  .header-grid {
    display: grid;
    grid-template-columns: 35mm 1fr 48mm;
    align-items: flex-start;
    gap: 4mm;
    margin-bottom: 2mm;
  }

  .photo-box {
    width: 35mm;
    height: 42mm;
    border: 1.5px dashed #000;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    font-size: 8.5pt;
    line-height: 1.4;
    font-weight: bold;
    padding: 2mm;
    position: relative;
    overflow: hidden;
    background: #fafafa;
  }
  .photo-box img {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .republic-center {
    text-align: center;
  }
  .republic-title {
    font-size: 13pt;
    font-weight: 800;
    margin: 0 0 1.5mm 0;
    letter-spacing: 0.3px;
  }
  .cert-title {
    font-size: 15pt;
    font-weight: 900;
    text-decoration: underline;
    text-underline-offset: 3px;
    margin: 0 0 1mm 0;
  }
  .cert-subtitle {
    font-size: 13pt;
    font-weight: 800;
    margin: 0 0 2mm 0;
  }
  .decree-ref {
    font-size: 8pt;
    font-weight: 600;
    line-height: 1.3;
    margin: 0;
  }

  .wilaya-block {
    text-align: right;
    font-size: 9.5pt;
    font-weight: 700;
    line-height: 1.9;
  }
  .wilaya-line {
    white-space: nowrap;
    border-bottom: 1px dotted #000;
    display: flex;
    justify-content: space-between;
  }
  .wilaya-line span.val {
    font-weight: 800;
    color: #000;
    padding: 0 2mm;
  }

  /* Candidate Details Table */
  .info-table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 2mm;
    font-size: 9.5pt;
  }
  .info-table td {
    border: 1px solid #000;
    padding: 1.2mm 2mm;
    vertical-align: middle;
  }
  .info-table .label-fr {
    width: 32mm;
    text-align: left;
    font-family: Arial, Helvetica, sans-serif;
    font-size: 8pt;
    font-weight: bold;
    direction: ltr;
  }
  .info-table .label-ar {
    width: 32mm;
    text-align: right;
    font-weight: bold;
    font-size: 9.5pt;
  }
  .info-table .value-cell {
    font-weight: bold;
    font-size: 10.5pt;
    text-align: right;
    letter-spacing: 0.5px;
    padding-right: 3mm;
  }

  /* Categories & Signature Section */
  .cat-sig-section {
    display: grid;
    grid-template-columns: 35mm 1fr;
    gap: 4mm;
    align-items: stretch;
    margin-bottom: 2mm;
  }

  .signature-box {
    border: 1.5px dashed #000;
    height: 30mm;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: 2mm;
    text-align: center;
    font-size: 9.5pt;
    font-weight: bold;
  }

  .categories-block {
    display: flex;
    flex-direction: column;
    gap: 2mm;
  }
  .cat-group {
    border: 1px solid #000;
    padding: 1mm 2mm;
  }
  .cat-group-title {
    font-size: 8.5pt;
    font-weight: bold;
    text-align: center;
    margin-bottom: 1mm;
  }
  .cat-boxes {
    display: flex;
    justify-content: space-around;
    direction: ltr;
  }
  .cat-box-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 11mm;
    border: 1px solid #000;
    font-family: Arial, Helvetica, sans-serif;
  }
  .cat-box-label {
    font-size: 7.5pt;
    font-weight: bold;
    background: #f0f0f0;
    width: 100%;
    text-align: center;
    border-bottom: 1px solid #000;
    padding: 0.5mm 0;
  }
  .cat-box-val {
    font-size: 9pt;
    font-weight: 900;
    height: 5mm;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .cat-box-val.checked {
    color: #000;
    font-size: 11pt;
  }

  /* Candidate Declaration */
  .declaration-card {
    border: 1px solid #000;
    padding: 1.5mm 3mm;
    margin-bottom: 2mm;
    text-align: center;
    background: #fff;
  }
  .declaration-title {
    font-size: 10pt;
    font-weight: 900;
    text-decoration: underline;
    margin-bottom: 1mm;
  }
  .declaration-text {
    font-size: 8.5pt;
    font-weight: 700;
    line-height: 1.35;
    margin: 0;
  }

  /* Doctor's Section */
  .doctor-section {
    border: 1.5px solid #000;
    padding: 2mm 3mm;
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }
  .doctor-header {
    text-align: center;
    border-bottom: 1px solid #000;
    padding-bottom: 1mm;
    margin-bottom: 1.5mm;
    font-size: 10.5pt;
    font-weight: 900;
    background: #f4f4f4;
  }
  .doctor-intro {
    font-size: 9pt;
    font-weight: bold;
    margin-bottom: 1.5mm;
  }
  .checkbox-row {
    display: flex;
    align-items: center;
    gap: 2mm;
    font-size: 8.5pt;
    font-weight: bold;
    margin-bottom: 1mm;
  }
  .chk {
    width: 4mm;
    height: 4mm;
    border: 1.2px solid #000;
    display: inline-block;
    flex-shrink: 0;
  }

  /* Doctor category table */
  .doc-table {
    width: 100%;
    border-collapse: collapse;
    margin: 1.5mm 0;
    font-size: 7.5pt;
    text-align: center;
  }
  .doc-table td, .doc-table th {
    border: 1px solid #000;
    padding: 0.8mm;
  }
  .doc-table th {
    font-weight: bold;
    background: #f9f9f9;
  }

  .doctor-bottom-grid {
    display: grid;
    grid-template-columns: 1fr 45mm;
    gap: 3mm;
    align-items: flex-end;
    margin-top: 1.5mm;
  }
  .vision-box {
    border: 1px solid #000;
    padding: 1.5mm 2mm;
    font-size: 8pt;
    font-weight: bold;
    line-height: 1.7;
  }
  .vision-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .vision-val {
    display: inline-block;
    width: 14mm;
    border-bottom: 1px dotted #000;
    text-align: center;
  }

  .doctor-stamp-box {
    text-align: center;
    font-size: 9pt;
    font-weight: bold;
  }
  .doctor-stamp-space {
    height: 16mm;
  }

  @media print {
    html, body {
      background: #fff;
      padding: 0;
    }
    .page {
      margin: 0;
      box-shadow: none;
      width: 100%;
      height: 100%;
      min-height: 100%;
      padding: 8mm 12mm 6mm 12mm;
    }
  }
</style>
</head>
<body>

<div class="page">

  <!-- Header -->
  <div>
    <div class="header-grid">
      <!-- Candidate Photo Box -->
      <div class="photo-box">
        {{#photo}}
        <img src="{{photo}}" alt="صورة المتدرب" />
        {{/photo}}
        {{^photo}}
        صورة شمسية ملونة<br>ومأخوذة حديثا
        {{/photo}}
      </div>

      <!-- Center Title -->
      <div class="republic-center">
        <div class="republic-title">الجمهورية الجزائرية الديمقراطية الشعبية</div>
        <div class="cert-title">شـــهـــادة طـبـيـــة</div>
        <div class="cert-subtitle">لـطـلـب رخـصـة سـيـاقـة</div>
        <div class="decree-ref">القرار الوزاري المشترك المؤرخ في 15 نوفمبر 1984 المحدد لقائمة الإصابات التي تتعارض والحصول أو الإبقاء على رخصة السياقة</div>
      </div>

      <!-- Top Right Administrative Info -->
      <div class="wilaya-block">
        <div class="wilaya-line">ولاية: <span class="val">{{wilaya}}</span></div>
        <div class="wilaya-line">الدائرة: <span class="val">{{daira}}</span></div>
        <div class="wilaya-line">بلدية: <span class="val">{{baladia}}</span></div>
      </div>
    </div>

    <!-- Candidate Identification Details -->
    <table class="info-table">
      <tr>
        <td class="label-fr">Nom</td>
        <td class="value-cell">{{lastName}}</td>
        <td class="label-ar">اللقب</td>
      </tr>
      <tr>
        <td class="label-fr">Prénom</td>
        <td class="value-cell">{{firstName}}</td>
        <td class="label-ar">الإسم</td>
      </tr>
      <tr>
        <td class="label-fr">Date et lieu de naissance</td>
        <td class="value-cell">{{birth}}</td>
        <td class="label-ar">تاريخ ومكان الميلاد</td>
      </tr>
      <tr>
        <td class="label-fr">Adresse</td>
        <td class="value-cell">{{address}}</td>
        <td class="label-ar">العنوان</td>
      </tr>
      <tr>
        <td class="label-fr">N° Téléphone</td>
        <td class="value-cell" style="direction: ltr; text-align: right;">{{phone}}</td>
        <td class="label-ar">رقم الهاتف</td>
      </tr>
      <tr>
        <td class="label-fr">Adresse électronique</td>
        <td class="value-cell" style="direction: ltr; text-align: right; font-family: Arial, sans-serif; font-size: 9.5pt;">{{email}}</td>
        <td class="label-ar">البريد الإلكتروني</td>
      </tr>
    </table>

    <!-- License Categories & Candidate Signature -->
    <div class="cat-sig-section">
      <div class="signature-box">
        <span>إمضاء المترشح</span>
        <div style="height: 18mm;"></div>
      </div>

      <div class="categories-block">
        <div class="cat-group">
          <div class="cat-group-title">الصنف أو الأصناف المتحصل عليها</div>
          <div class="cat-boxes">
            <div class="cat-box-item"><div class="cat-box-label">A1</div><div class="cat-box-val">{{cat_has_A1}}</div></div>
            <div class="cat-box-item"><div class="cat-box-label">A</div><div class="cat-box-val">{{cat_has_A}}</div></div>
            <div class="cat-box-item"><div class="cat-box-label">B</div><div class="cat-box-val">{{cat_has_B}}</div></div>
            <div class="cat-box-item"><div class="cat-box-label">BE</div><div class="cat-box-val">{{cat_has_BE}}</div></div>
            <div class="cat-box-item"><div class="cat-box-label">C1</div><div class="cat-box-val">{{cat_has_C1}}</div></div>
            <div class="cat-box-item"><div class="cat-box-label">C1E</div><div class="cat-box-val">{{cat_has_C1E}}</div></div>
            <div class="cat-box-item"><div class="cat-box-label">C</div><div class="cat-box-val">{{cat_has_C}}</div></div>
            <div class="cat-box-item"><div class="cat-box-label">C(E)</div><div class="cat-box-val">{{cat_has_CE}}</div></div>
            <div class="cat-box-item"><div class="cat-box-label">D</div><div class="cat-box-val">{{cat_has_D}}</div></div>
            <div class="cat-box-item"><div class="cat-box-label">F</div><div class="cat-box-val">{{cat_has_F}}</div></div>
          </div>
        </div>

        <div class="cat-group">
          <div class="cat-group-title">الصنف المراد الحصول عليه</div>
          <div class="cat-boxes">
            <div class="cat-box-item"><div class="cat-box-label">A1</div><div class="cat-box-val {{is_target_A1}}">{{check_target_A1}}</div></div>
            <div class="cat-box-item"><div class="cat-box-label">A</div><div class="cat-box-val {{is_target_A}}">{{check_target_A}}</div></div>
            <div class="cat-box-item"><div class="cat-box-label">B</div><div class="cat-box-val {{is_target_B}}">{{check_target_B}}</div></div>
            <div class="cat-box-item"><div class="cat-box-label">BE</div><div class="cat-box-val {{is_target_BE}}">{{check_target_BE}}</div></div>
            <div class="cat-box-item"><div class="cat-box-label">C1</div><div class="cat-box-val {{is_target_C1}}">{{check_target_C1}}</div></div>
            <div class="cat-box-item"><div class="cat-box-label">C1E</div><div class="cat-box-val {{is_target_C1E}}">{{check_target_C1E}}</div></div>
            <div class="cat-box-item"><div class="cat-box-label">C</div><div class="cat-box-val {{is_target_C}}">{{check_target_C}}</div></div>
            <div class="cat-box-item"><div class="cat-box-label">C(E)</div><div class="cat-box-val {{is_target_CE}}">{{check_target_CE}}</div></div>
            <div class="cat-box-item"><div class="cat-box-label">D</div><div class="cat-box-val {{is_target_D}}">{{check_target_D}}</div></div>
            <div class="cat-box-item"><div class="cat-box-label">F</div><div class="cat-box-val {{is_target_F}}">{{check_target_F}}</div></div>
          </div>
        </div>
      </div>
    </div>

    <!-- Candidate Declaration -->
    <div class="declaration-card">
      <div class="declaration-title">تصريح المترشح</div>
      <p class="declaration-text">أنا المترشح الممضي، أشهد بأنني غير مصاب بأي مرض عقلي، ولا بفقدان الوعي ولو لمدة قصيرة.<br>كل تصريح كاذب يعرض صاحبه إلى العقوبات المنصوص عليها في التشريع الساري المفعول.</p>
    </div>
  </div>

  <!-- Doctor's Evaluation Section -->
  <div class="doctor-section">
    <div>
      <div class="doctor-header">مساحة تملأ من طرف طبيب</div>
      <div class="doctor-intro">يشهد الممضي، الطبيب بعد فحص المترشح أن:</div>

      <div class="checkbox-row"><span class="chk"></span> <span>- له القدرة على القيادة خلال المدة المحددة بموجب التنظيم الساري المفعول</span></div>
      <div class="checkbox-row"><span class="chk"></span> <span>- له القدرة على القيادة لمدة محددة</span></div>
      <div style="font-size: 8pt; font-weight: bold; margin: 1mm 4mm 0.5mm 0;">في هذه الحالة، يجب تحديد المدة لكل صنف:</div>

      <table class="doc-table">
        <thead>
          <tr>
            <th>الصنف</th>
            <th>المدة (من ي ي/ش ش/س س س س إلى ي ي/ش ش/س س س س)</th>
            <th>الصنف</th>
            <th>المدة (من ي ي/ش ش/س س س س إلى ي ي/ش ش/س س س س)</th>
          </tr>
        </thead>
        <tbody>
          <tr><td>&nbsp;</td><td>من ....................... إلى .......................</td><td>&nbsp;</td><td>من ....................... إلى .......................</td></tr>
          <tr><td>&nbsp;</td><td>من ....................... إلى .......................</td><td>&nbsp;</td><td>من ....................... إلى .......................</td></tr>
          <tr><td>&nbsp;</td><td>من ....................... إلى .......................</td><td>&nbsp;</td><td>من ....................... إلى .......................</td></tr>
        </tbody>
      </table>

      <div class="checkbox-row" style="margin-top: 1mm;"><span class="chk"></span> <span>- ليس له القدرة على القيادة</span></div>
      <div style="font-size: 8pt; font-weight: bold; margin: 0.5mm 0 1.5mm 0;">ملاحظات أخرى: ....................................................................................................................................</div>

      <div style="font-size: 8.5pt; font-weight: bold; margin-bottom: 1mm;">و عليه، فإنه:</div>
      <div class="checkbox-row"><span class="chk"></span> <span>- لا يشكل أية خطورة على الأمن العمومي و على الذين يقودون المركبات بمختلف أصنافها</span></div>
      <div class="checkbox-row"><span class="chk"></span> <span>- يشكل خطورة على الأمن العمومي و على الذين يقودون المركبات بمختلف أصنافها</span></div>
      <div class="checkbox-row"><span class="chk"></span> <span>- يجب عليه وضع نظارات تصحيحية</span></div>
    </div>

    <div class="doctor-bottom-grid">
      <div class="vision-box">
        <div><strong>الرؤية:</strong></div>
        <div class="vision-row"><span>العين اليمنى:</span> <span class="vision-val">&nbsp;</span></div>
        <div class="vision-row"><span>العين اليسرى:</span> <span class="vision-val">&nbsp;</span></div>
      </div>

      <div class="doctor-stamp-box">
        <div>في: ................... بتاريخ: ..................</div>
        <div style="margin-top: 1mm;">إمضاء وختم الطبيب</div>
        <div class="doctor-stamp-space"></div>
      </div>
    </div>
  </div>

</div>

</body>
</html>
`;
