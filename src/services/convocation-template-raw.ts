/**
 * Raw HTML template for the convocation letter (إستدعاء).
 * Placeholders are replaced at runtime by the convocation-letter service.
 *
 * Placeholders:
 *   {{NUM}}       – convocation reference number (e.g. 2026/88)
 *   {{NAME}}      – candidate's full name
 *   {{ADDR}}      – candidate's address
 *   {{EXAMDATE}}  – exam date
 *   {{TIME}}      – exam time text
 *   {{CAT}}       – driving licence category
 *   {{FEE}}       – postal stamp fee in DA
 *   {{ISSUED}}    – date the convocation was issued
 */
export const CONVOCATION_TEMPLATE_RAW = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>إستدعاء</title>
<style>
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; }
  :root { --fit: 1; }
  html, body {
    margin: 0;
    padding: 16px 0;
    background: #2e3235;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
  }

  /* ---------- Page ---------- */
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
    font-family: "Simplified Arabic", "Traditional Arabic", "Arabic Typesetting", "Noto Naskh Arabic", "Times New Roman", serif;
    font-weight: bold;
    color: #000;
    direction: rtl;
  }

  .copy { position: absolute; left: 0; right: 0; height: 148mm; padding: 0 20mm 0 20mm; }
  .copy.top    { top: 10mm; }
  .copy.bottom { top: 158mm; }

  .republic { text-align: center; font-size: 15pt; text-decoration: underline; margin: 0; padding-top: 6mm; }

  .school { margin-top: 10mm; margin-right: 0; width: 62mm; text-align: center; }
  .school div { font-size: 15pt; text-decoration: underline; line-height: 1.75; text-align: right; }
  .school .kash { text-align: justify; text-align-last: justify; }
  .school .city { padding-right: 8mm; }

  .titlerow { position: relative; height: 16mm; margin-top: 8mm; }
  .titlerow .num { position: absolute; right: 0; top: 0; font-size: 15pt; }
  .titlerow .title { position: absolute; left: 0; right: 0; top: 0; text-align: center; font-size: 19pt; text-decoration: underline; letter-spacing: 1px; padding-right: 0; }

  .body { margin-top: 4mm; font-size: 14pt; line-height: 1.75; }
  .body p { margin: 0; }
  .body .em { font-style: italic; }

  .dateline { margin-top: 11mm; padding-right: 38mm; font-size: 14pt; }
  .director { margin-top: 6mm; padding-right: 55mm; font-size: 14pt; }

  @media print {
    html, body { background: #fff; padding: 0; }
    .page { margin: 0; box-shadow: none; transform: none !important; }
  }
</style>
</head>
<body>

<div class="page">

  <!-- ============ COPY 1 ============ -->
  <section class="copy top">
    <p class="republic">الجمهورية الجزائرية الديمقراطية الشعبية</p>

    <div class="school">
      <div>مدرســة تعليم السيـــــاقة</div>
      <div class="kash">بـــــوطيبـــة محمـــــد</div>
      <div>الحي الغربي - عين بوسيف</div>
      <div class="city">المـــديـــــــــة</div>
    </div>

    <div class="titlerow">
      <span class="num">{{NUM}}</span>
      <div class="title">إستــــــدعـــــــــاء</div>
    </div>

    <div class="body">
      <p>المطلوب من السيد (ة) : {{NAME}}</p>
      <p>الساكن في : {{ADDR}}</p>
      <p class="em">أن يتقدم إلى مدرسة تعليم السياقة يوم : {{EXAMDATE}} إبتداءا من الساعة {{TIME}}</p>
      <p>من أجل إجراء الإمتحان النظري و التطبيقي لرخصة السياقة صنف ({{CAT}})</p>
      <p>مرفوق ببطاقة التعريف الوطنية وطابع بريدي بقيمة {{FEE}} دج</p>
    </div>

    <div class="dateline">عين بوسيف في : {{ISSUED}}</div>
    <div class="director">المــــــــــدير</div>
  </section>

  <!-- ============ COPY 2 ============ -->
  <section class="copy bottom">
    <p class="republic">الجمهورية الجزائرية الديمقراطية الشعبية</p>

    <div class="school">
      <div>مدرســة تعليم السيـــــاقة</div>
      <div class="kash">بـــــوطيبـــة محمـــــد</div>
      <div>الحي الغربي - عين بوسيف</div>
      <div class="city">المـــديـــــــــة</div>
    </div>

    <div class="titlerow">
      <span class="num">{{NUM}}</span>
      <div class="title">إستــــــدعـــــــــاء</div>
    </div>

    <div class="body">
      <p>المطلوب من السيد (ة) : {{NAME}}</p>
      <p>الساكن في : {{ADDR}}</p>
      <p class="em">أن يتقدم إلى مدرسة تعليم السياقة يوم : {{EXAMDATE}} إبتداءا من الساعة {{TIME}}</p>
      <p>من أجل إجراء الإمتحان النظري و التطبيقي لرخصة السياقة صنف ({{CAT}})</p>
      <p>مرفوق ببطاقة التعريف الوطنية وطابع بريدي بقيمة {{FEE}} دج</p>
    </div>

    <div class="dateline">عين بوسيف في : {{ISSUED}}</div>
    <div class="director">المــــــــــدير</div>
  </section>

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
