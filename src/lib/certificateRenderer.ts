import jsPDF from 'jspdf';

export interface CertificateField {
  key: string;
  label: string;
  x: number; // percentage 0-100
  y: number; // percentage 0-100
  fontSize: number;
  fontColor: string;
  fontWeight: 'normal' | 'bold' | 'semibold';
  fontStyle?: 'normal' | 'italic';
  fontFamily?: string;
  textAlign?: 'left' | 'center' | 'right';
  visible: boolean;
  value?: string;
}

export interface CertificateData {
  student_name: string;
  course_title: string;
  certificate_number: string;
  completion_date: string;
  instructor_signature: string;
}

// Shared image cache
const imageCache = new Map<string, HTMLImageElement>();

function loadImage(src: string): Promise<HTMLImageElement> {
  if (imageCache.has(src)) return Promise.resolve(imageCache.get(src)!);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => { imageCache.set(src, img); resolve(img); };
    img.onerror = reject;
    img.src = src;
  });
}

export function getCachedImage(src: string): HTMLImageElement | null {
  return imageCache.get(src) || null;
}

export async function preloadImage(src: string): Promise<HTMLImageElement> {
  return loadImage(src);
}

function getFieldText(field: CertificateField, data: CertificateData): string {
  switch (field.key) {
    case 'student_name': return data.student_name;
    case 'course_title': return data.course_title;
    case 'certificate_number': return data.certificate_number;
    case 'completion_date': return data.completion_date;
    case 'instructor_signature': return data.instructor_signature;
    case 'custom_text': return field.value || '';
    default: return field.value || '';
  }
}

/**
 * Draw fields onto an existing canvas context (synchronous — uses cached image).
 * Used for real-time drag preview.
 */
export function renderFieldsSync(
  ctx: CanvasRenderingContext2D,
  fields: CertificateField[],
  data: CertificateData,
  width: number,
  height: number,
  selectedIdx?: number | null,
  showLabels = false
) {
  for (let i = 0; i < fields.length; i++) {
    const field = fields[i];
    if (!field.visible) continue;

    const x = (field.x / 100) * width;
    const y = (field.y / 100) * height;
    const family = field.fontFamily || 'Arial, sans-serif';
    const style = field.fontStyle === 'italic' ? 'italic ' : '';
    const weight = field.fontWeight === 'bold' ? 'bold ' : field.fontWeight === 'semibold' ? '600 ' : '';

    ctx.font = `${style}${weight}${field.fontSize}px ${family}`;
    ctx.fillStyle = field.fontColor || '#000000';
    ctx.textAlign = (field.textAlign as CanvasTextAlign) || 'center';
    ctx.textBaseline = 'middle';

    const text = getFieldText(field, data);
    if (text) ctx.fillText(text, x, y);

    // Selection indicator
    if (selectedIdx === i) {
      const metrics = ctx.measureText(text || field.label);
      const tw = metrics.width;
      const th = field.fontSize * 1.4;
      let bx = x - tw / 2;
      if (field.textAlign === 'left') bx = x;
      else if (field.textAlign === 'right') bx = x - tw;

      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 3]);
      ctx.strokeRect(bx - 6, y - th / 2, tw + 12, th);
      ctx.setLineDash([]);
    }

    // Show field labels in edit mode
    if (showLabels) {
      ctx.font = `10px Arial, sans-serif`;
      ctx.fillStyle = '#3b82f6';
      ctx.textAlign = 'center';
      ctx.fillText(field.label, x, y - field.fontSize * 0.8);
    }
  }
}

/**
 * Renders a certificate onto a canvas element and returns it.
 * For PDF export, uses 2x resolution for crisp output.
 */
export async function renderCertificateToCanvas(
  backgroundUrl: string | null,
  fields: CertificateField[],
  data: CertificateData,
  width = 2244,  // 2x A4 landscape
  height = 1586
): Promise<HTMLCanvasElement> {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  if (backgroundUrl) {
    try {
      const img = await loadImage(backgroundUrl);
      ctx.drawImage(img, 0, 0, width, height);
    } catch (e) {
      console.warn('Failed to load certificate background:', e);
    }
  }

  // Scale font sizes proportionally (fields are designed for 1122x793 base)
  const scale = width / 1122;
  const scaledFields = fields.map(f => ({ ...f, fontSize: Math.round(f.fontSize * scale) }));
  renderFieldsSync(ctx, scaledFields, data, width, height);

  return canvas;
}

/**
 * Generate a PDF from the certificate canvas and trigger download.
 */
export async function downloadCertificatePDF(
  backgroundUrl: string | null,
  fields: CertificateField[],
  data: CertificateData,
  filename = 'certificate.pdf'
): Promise<void> {
  const canvas = await renderCertificateToCanvas(backgroundUrl, fields, data, 2244, 1586);
  const imgData = canvas.toDataURL('image/jpeg', 0.95);

  const pdf = new jsPDF({ orientation: 'landscape', unit: 'px', format: [canvas.width, canvas.height] });
  pdf.addImage(imgData, 'JPEG', 0, 0, canvas.width, canvas.height);
  pdf.save(filename);
}
