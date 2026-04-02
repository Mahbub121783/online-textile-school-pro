import jsPDF from 'jspdf';
import JsBarcode from 'jsbarcode';

export interface IdCardData {
  studentName: string;
  rollId: string;
  bloodGroup: string;
  dateOfBirth: string;
  address: string;
  photoUrl: string | null;
  cardNumber: string;
  validUntil: string;
}

export interface IdCardSettings {
  university_name: string;
  location: string;
  authority_name: string;
  authority_position: string;
  signature_url: string;
  logo_url: string;
  card_bg_color: string;
}

const CARD_W = 1012; // 2x CR80 width
const CARD_H = 638;  // 2x CR80 height

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image: ' + src));
    img.src = src;
  });
}

function drawRoundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

export async function renderIdCard(
  canvas: HTMLCanvasElement,
  data: IdCardData,
  settings: IdCardSettings
): Promise<void> {
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext('2d')!;

  // Background
  drawRoundedRect(ctx, 0, 0, CARD_W, CARD_H, 20);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.clip();

  // Header bar
  const headerH = 100;
  ctx.fillStyle = settings.card_bg_color || '#1a365d';
  ctx.fillRect(0, 0, CARD_W, headerH);

  // Logo
  if (settings.logo_url) {
    try {
      const logo = await loadImage(settings.logo_url);
      ctx.drawImage(logo, 30, 15, 70, 70);
    } catch { /* skip logo */ }
  }

  // University name
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 28px Arial, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(settings.university_name || 'Online Textile School', settings.logo_url ? 115 : 30, 50);

  ctx.font = '18px Arial, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillText(settings.location || 'Dhaka, Bangladesh', settings.logo_url ? 115 : 30, 78);

  // "STUDENT ID CARD" badge
  ctx.font = 'bold 14px Arial, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.textAlign = 'right';
  ctx.fillText('STUDENT ID CARD', CARD_W - 30, 50);

  // Body section
  const bodyY = headerH + 20;
  const photoSize = 160;
  const photoX = 40;
  const photoY = bodyY + 10;

  // Photo placeholder/image
  ctx.save();
  drawRoundedRect(ctx, photoX, photoY, photoSize, photoSize, 10);
  ctx.fillStyle = '#e2e8f0';
  ctx.fill();
  ctx.clip();
  if (data.photoUrl) {
    try {
      const photo = await loadImage(data.photoUrl);
      ctx.drawImage(photo, photoX, photoY, photoSize, photoSize);
    } catch { /* keep placeholder */ }
  } else {
    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 60px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(data.studentName?.[0]?.toUpperCase() || '?', photoX + photoSize / 2, photoY + photoSize / 2 + 20);
  }
  ctx.restore();

  // Photo border
  ctx.strokeStyle = settings.card_bg_color || '#1a365d';
  ctx.lineWidth = 3;
  drawRoundedRect(ctx, photoX, photoY, photoSize, photoSize, 10);
  ctx.stroke();

  // Fields
  const fieldX = photoX + photoSize + 40;
  const fieldStartY = bodyY + 20;
  const lineH = 38;
  ctx.textAlign = 'left';

  const fields = [
    { label: 'Name', value: data.studentName },
    { label: 'Roll', value: data.rollId },
    { label: 'Blood Group', value: data.bloodGroup || '—' },
    { label: 'Date of Birth', value: data.dateOfBirth || '—' },
    { label: 'Address', value: data.address || '—' },
  ];

  fields.forEach((f, i) => {
    const y = fieldStartY + i * lineH;
    ctx.font = '14px Arial, sans-serif';
    ctx.fillStyle = '#64748b';
    ctx.fillText(f.label + ':', fieldX, y);
    ctx.font = 'bold 17px Arial, sans-serif';
    ctx.fillStyle = '#1e293b';
    ctx.fillText(f.value, fieldX + 110, y);
  });

  // Valid until
  ctx.font = 'bold 15px Arial, sans-serif';
  ctx.fillStyle = settings.card_bg_color || '#1a365d';
  ctx.fillText(`Valid Until: ${data.validUntil}`, photoX, photoY + photoSize + 35);

  // Signature section (right side)
  const sigX = CARD_W - 250;
  const sigY = photoY + photoSize - 30;

  if (settings.signature_url) {
    try {
      const sig = await loadImage(settings.signature_url);
      ctx.drawImage(sig, sigX + 30, sigY - 50, 150, 45);
    } catch { /* skip */ }
  }

  ctx.font = '14px Arial, sans-serif';
  ctx.fillStyle = '#1e293b';
  ctx.textAlign = 'center';
  if (settings.authority_name) {
    ctx.fillText(settings.authority_name, sigX + 105, sigY + 10);
  }
  if (settings.authority_position) {
    ctx.font = '12px Arial, sans-serif';
    ctx.fillStyle = '#64748b';
    ctx.fillText(settings.authority_position, sigX + 105, sigY + 28);
  }

  // Separator line
  const barY = CARD_H - 100;
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(30, barY);
  ctx.lineTo(CARD_W - 30, barY);
  ctx.stroke();

  // Barcode
  const barcodeCanvas = document.createElement('canvas');
  JsBarcode(barcodeCanvas, data.cardNumber, {
    format: 'CODE128',
    width: 2,
    height: 50,
    displayValue: false,
    margin: 0,
  });
  const barcodeW = 400;
  const barcodeH = 50;
  ctx.drawImage(barcodeCanvas, (CARD_W - barcodeW) / 2, barY + 10, barcodeW, barcodeH);

  // Card number text
  ctx.font = 'bold 14px monospace';
  ctx.fillStyle = '#475569';
  ctx.textAlign = 'center';
  ctx.fillText(data.cardNumber, CARD_W / 2, barY + 10 + barcodeH + 18);
}

export async function downloadIdCardPdf(
  data: IdCardData,
  settings: IdCardSettings
): Promise<void> {
  const canvas = document.createElement('canvas');
  await renderIdCard(canvas, data, settings);

  // CR80 card: 3.375" x 2.125"
  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'in',
    format: [3.375, 2.125],
  });

  const imgData = canvas.toDataURL('image/png');
  pdf.addImage(imgData, 'PNG', 0, 0, 3.375, 2.125);
  pdf.save(`ID-Card-${data.cardNumber}.pdf`);
}
