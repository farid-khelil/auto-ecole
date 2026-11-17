import evaluationTemplate from '../../بطاقة تقييم.html?raw';

/**
 * The evaluation-card design is maintained in the root HTML template so it
 * can be reviewed and adjusted visually. Vite imports it as a string and
 * bundles it into the Electron renderer for offline previews and printing.
 */
export const EVALUATION_TEMPLATE_RAW = evaluationTemplate;
