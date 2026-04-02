import jsPDF from 'jspdf';
import JsBarcode from 'jsbarcode';
import otsLogoUrl from '@/assets/OTS_LOGO.png';

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

const CARD_W = 1012;
const CARD_H = 638;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image: ' + src));
    img.src = src;
  });
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
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

function truncate(ctx: CanvasRenderingContext2D, text: string, maxW: number): string {
  if (ctx.measureText(text).width <= maxW) return text;
  let t = text;
  while (t.length > 0 && ctx.measureText(t + '…').width > maxW) t = t.slice(0, -1);
  return t + '…';
}

function drawInitial(ctx: CanvasRenderingContext2D, name: string, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#e2e8f0';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = '#64748b';
  ctx.font = 'bold 56px "Segoe UI", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(name?.[0]?.toUpperCase() || '?', x + w / 2, y + h / 2 + 18);
}

export async function renderIdCard(
  canvas: HTMLCanvasElement,
  data: IdCardData,
  settings: IdCardSettings
): Promise<void> {
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext('2d')!;
  const primary = settings.card_bg_color || '#0f2557';

  // ── Card background with rounded corners ──
  roundRect(ctx, 0, 0, CARD_W, CARD_H, 16);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.save();
  ctx.clip();

  // ══════════════════════════════════════════
  // HEADER — 116px (~5% bigger), dark background
  // ══════════════════════════════════════════
  const hH = 116;
  ctx.fillStyle = primary;
  ctx.fillRect(0, 0, CARD_W, hH);

  // Logo 76x76
  const logoSize = 76;
  const logoX = 30;
  const logoY = (hH - logoSize) / 2;
  const logoSrc = settings.logo_url || otsLogoUrl;
  try {
    const logo = await loadImage(logoSrc);
    ctx.drawImage(logo, logoX, logoY, logoSize, logoSize);
  } catch { /* skip */ }

  // University name — 38px bold
  const textX = logoX + logoSize + 20;
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'left';
  ctx.font = 'bold 38px "Segoe UI", Arial, sans-serif';
  ctx.fillText(settings.university_name || 'Online Textile School', textX, hH / 2 - 6);

  // Location — 20px
  ctx.font = '20px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.fillText(settings.location || 'Dhaka, Bangladesh', textX, hH / 2 + 22);

  // "STUDENT ID CARD" — right-aligned, 22px bold
  ctx.textAlign = 'right';
  ctx.font = 'bold 22px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.fillText('STUDENT ID CARD', CARD_W - 34, hH / 2 + 8);

  // ── Teal accent line ──
  ctx.fillStyle = '#0d9488';
  ctx.fillRect(0, hH, CARD_W, 4);

  // ══════════════════════════════════════════
  // BODY — Photo + Fields
  // ══════════════════════════════════════════
  const bodyY = hH + 20;
  const photoW = 170;
  const photoH = 210;
  const photoX = 40;
  const photoY = bodyY;

  // Photo
  ctx.save();
  roundRect(ctx, photoX, photoY, photoW, photoH, 8);
  ctx.clip();
  if (data.photoUrl) {
    try {
      const photo = await loadImage(data.photoUrl);
      ctx.drawImage(photo, photoX, photoY, photoW, photoH);
    } catch {
      drawInitial(ctx, data.studentName, photoX, photoY, photoW, photoH);
    }
  } else {
    drawInitial(ctx, data.studentName, photoX, photoY, photoW, photoH);
  }
  ctx.restore();

  // Photo border
  ctx.strokeStyle = primary;
  ctx.lineWidth = 2;
  roundRect(ctx, photoX, photoY, photoW, photoH, 8);
  ctx.stroke();

  // ── Fields ──
  const fieldX = photoX + photoW + 40;
  const labelW = 160;
  const valueX = fieldX + labelW;
  const rowH = 46;
  const startY = bodyY + 20;
  const maxValW = CARD_W - valueX - 40;

  ctx.textAlign = 'left';
  const fields = [
    { label: 'NAME', value: data.studentName },
    { label: 'ROLL', value: data.rollId },
    { label: 'BLOOD GROUP', value: data.bloodGroup || '—' },
    { label: 'DATE OF BIRTH', value: data.dateOfBirth || '—' },
    { label: 'ADDRESS', value: data.address || '—' },
  ];

  fields.forEach((f, i) => {
    const y = startY + i * rowH;

    // Label — 16px semi-bold slate
    ctx.font = '600 16px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = '#64748b';
    ctx.fillText(f.label + ' :', fieldX, y + 18);

    // Value — 20px bold dark
    ctx.font = 'bold 20px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = '#1e293b';
    ctx.fillText(truncate(ctx, f.value, maxValW), valueX, y + 18);
  });

  // ══════════════════════════════════════════
  // FOOTER — Validity + Signature
  // ══════════════════════════════════════════
  const barcodeBarH = 70;
  const footerY = CARD_H - barcodeBarH - 80;

  // Thin separator
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(30, footerY);
  ctx.lineTo(CARD_W - 30, footerY);
  ctx.stroke();

  // Left: validity
  ctx.font = '14px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = '#475569';
  ctx.textAlign = 'left';
  ctx.fillText(`Valid Until: ${data.validUntil}`, 40, footerY + 24);

  // Right: signature
  const sigCenterX = CARD_W - 170;

  if (settings.signature_url) {
    try {
      const sig = await loadImage(settings.signature_url);
      ctx.drawImage(sig, sigCenterX - 70, footerY + 4, 140, 34);
    } catch { /* skip */ }
  }

  // Signature line — 160px wide
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(sigCenterX - 80, footerY + 42);
  ctx.lineTo(sigCenterX + 80, footerY + 42);
  ctx.stroke();

  // Authority name — 14px bold
  ctx.textAlign = 'center';
  if (settings.authority_name) {
    ctx.font = 'bold 14px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = '#1e293b';
    ctx.fillText(settings.authority_name, sigCenterX, footerY + 58);
  }
  // Authority position — 12px
  if (settings.authority_position) {
    ctx.font = '12px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = '#64748b';
    ctx.fillText(settings.authority_position, sigCenterX, footerY + 74);
  }

  // ══════════════════════════════════════════
  // BARCODE BAR — Oxford-style full-width dark strip
  // ══════════════════════════════════════════
  const barY = CARD_H - barcodeBarH;
  ctx.fillStyle = primary;
  ctx.fillRect(0, barY, CARD_W, barcodeBarH);

  // Generate barcode
  const barcodeCanvas = document.createElement('canvas');
  JsBarcode(barcodeCanvas, data.cardNumber, {
    format: 'CODE128',
    width: 2,
    height: 50,
    displayValue: false,
    margin: 0,
    background: 'transparent',
    lineColor: '#ffffff',
  });

  // Draw barcode centered, 70% width
  const barcodeW = CARD_W * 0.7;
  const barcodeH = 42;
  const barcodeX = (CARD_W - barcodeW) / 2;
  ctx.drawImage(barcodeCanvas, barcodeX, barY + 6, barcodeW, barcodeH);

  // Card number in white monospace
  ctx.font = 'bold 12px "Courier New", monospace';
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.textAlign = 'center';
  ctx.fillText(data.cardNumber.split('').join(' '), CARD_W / 2, barY + barcodeH + 20);

  ctx.restore();
}

export async function downloadIdCardPdf(
  data: IdCardData,
  settings: IdCardSettings
): Promise<void> {
  const canvas = document.createElement('canvas');
  await renderIdCard(canvas, data, settings);

  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'in',
    format: [3.375, 2.125],
  });

  const imgData = canvas.toDataURL('image/png');
  pdf.addImage(imgData, 'PNG', 0, 0, 3.375, 2.125);
  pdf.save(`ID-Card-${data.cardNumber}.pdf`);
}

export async function downloadIdCardPng(
  data: IdCardData,
  settings: IdCardSettings
): Promise<void> {
  const canvas = document.createElement('canvas');
  await renderIdCard(canvas, data, settings);

  const link = document.createElement('a');
  link.download = `ID-Card-${data.cardNumber}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
}
