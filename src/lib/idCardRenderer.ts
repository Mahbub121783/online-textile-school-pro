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

export async function renderIdCard(
  canvas: HTMLCanvasElement,
  data: IdCardData,
  settings: IdCardSettings
): Promise<void> {
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext('2d')!;
  const primary = settings.card_bg_color || '#0f2557';

  // ── Card background ──
  roundRect(ctx, 0, 0, CARD_W, CARD_H, 16);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.save();
  ctx.clip();

  // ── Header ──
  const hH = 100;
  ctx.fillStyle = primary;
  ctx.fillRect(0, 0, CARD_W, hH);

  // Logo (no circle clip — show full logo)
  const logoSize = 60;
  const logoX = 28;
  const logoY = (hH - logoSize) / 2;
  const logoSrc = settings.logo_url || otsLogoUrl;
  try {
    const logo = await loadImage(logoSrc);
    ctx.drawImage(logo, logoX, logoY, logoSize, logoSize);
  } catch { /* skip */ }

  // University name + location
  const textX = logoX + logoSize + 18;
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'left';
  ctx.font = 'bold 26px "Segoe UI", Arial, sans-serif';
  ctx.fillText(settings.university_name || 'Online Textile School', textX, hH / 2 - 4);
  ctx.font = '14px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.fillText(settings.location || 'Dhaka, Bangladesh', textX, hH / 2 + 18);

  // "STUDENT ID CARD" right-aligned
  ctx.textAlign = 'right';
  ctx.font = 'bold 16px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.fillText('STUDENT ID CARD', CARD_W - 30, hH / 2 + 6);

  // ── Thin accent line below header ──
  ctx.fillStyle = '#0d9488';
  ctx.fillRect(0, hH, CARD_W, 3);

  // ── Body ──
  const bodyY = hH + 24;
  const photoW = 160;
  const photoH = 200;
  const photoX = 40;
  const photoY = bodyY;

  // Photo with simple border
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
  // Border
  ctx.strokeStyle = primary;
  ctx.lineWidth = 2;
  roundRect(ctx, photoX, photoY, photoW, photoH, 8);
  ctx.stroke();

  // ── Fields ──
  const fieldX = photoX + photoW + 36;
  const labelW = 140;
  const valueX = fieldX + labelW;
  const rowH = 44;
  const startY = bodyY + 16;
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

    // Label
    ctx.font = '600 12px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(f.label + ' :', fieldX, y + 16);

    // Value
    ctx.font = 'bold 16px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = '#1e293b';
    ctx.fillText(truncate(ctx, f.value, maxValW), valueX, y + 16);
  });

  // ── Footer area ──
  const footerY = CARD_H - 130;

  // Thin separator
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(30, footerY);
  ctx.lineTo(CARD_W - 30, footerY);
  ctx.stroke();

  // Left: validity
  ctx.font = '13px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = '#64748b';
  ctx.textAlign = 'left';
  ctx.fillText(`Valid Until: ${data.validUntil}`, 40, footerY + 22);

  // Right: signature
  const sigCenterX = CARD_W - 160;

  if (settings.signature_url) {
    try {
      const sig = await loadImage(settings.signature_url);
      ctx.drawImage(sig, sigCenterX - 60, footerY + 2, 120, 32);
    } catch { /* skip */ }
  }

  // Signature line
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(sigCenterX - 70, footerY + 38);
  ctx.lineTo(sigCenterX + 70, footerY + 38);
  ctx.stroke();

  ctx.textAlign = 'center';
  if (settings.authority_name) {
    ctx.font = 'bold 12px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = '#1e293b';
    ctx.fillText(settings.authority_name, sigCenterX, footerY + 54);
  }
  if (settings.authority_position) {
    ctx.font = '11px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = '#64748b';
    ctx.fillText(settings.authority_position, sigCenterX, footerY + 68);
  }

  // ── Barcode (centered bottom) ──
  const barcodeCanvas = document.createElement('canvas');
  JsBarcode(barcodeCanvas, data.cardNumber, {
    format: 'CODE128',
    width: 2,
    height: 38,
    displayValue: false,
    margin: 0,
  });
  const barcodeW = 280;
  const barcodeH = 38;
  const barcodeY = footerY + 80;
  ctx.drawImage(barcodeCanvas, (CARD_W - barcodeW) / 2, barcodeY, barcodeW, barcodeH);

  // Card number
  ctx.font = 'bold 11px "Courier New", monospace';
  ctx.fillStyle = '#475569';
  ctx.textAlign = 'center';
  ctx.fillText(data.cardNumber.split('').join(' '), CARD_W / 2, barcodeY + barcodeH + 14);

  // ── Bottom accent bar ──
  ctx.fillStyle = primary;
  ctx.fillRect(0, CARD_H - 4, CARD_W, 4);

  ctx.restore();
}

function drawInitial(ctx: CanvasRenderingContext2D, name: string, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#e2e8f0';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = '#64748b';
  ctx.font = 'bold 52px "Segoe UI", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(name?.[0]?.toUpperCase() || '?', x + w / 2, y + h / 2 + 16);
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
