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

function drawHexPattern(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string) {
  ctx.save();
  ctx.globalAlpha = 0.04;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  const size = 28;
  const hGap = size * 1.75;
  const vGap = size * 1.5;
  for (let row = 0; row < h / vGap + 1; row++) {
    for (let col = 0; col < w / hGap + 1; col++) {
      const cx = x + col * hGap + (row % 2 ? hGap / 2 : 0);
      const cy = y + row * vGap;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i - Math.PI / 6;
        const px = cx + size * Math.cos(angle);
        const py = cy + size * Math.sin(angle);
        i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();
    }
  }
  ctx.restore();
}

export async function renderIdCard(
  canvas: HTMLCanvasElement,
  data: IdCardData,
  settings: IdCardSettings
): Promise<void> {
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext('2d')!;

  const primaryColor = settings.card_bg_color || '#0f2557';
  const accentColor = '#0d9488';

  // ── Card background with rounded corners ──
  drawRoundedRect(ctx, 0, 0, CARD_W, CARD_H, 20);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.save();
  ctx.clip();

  // ── Header gradient ──
  const headerH = 115;
  const headerGrad = ctx.createLinearGradient(0, 0, CARD_W, 0);
  headerGrad.addColorStop(0, primaryColor);
  headerGrad.addColorStop(0.7, '#153a6e');
  headerGrad.addColorStop(1, accentColor);
  ctx.fillStyle = headerGrad;
  ctx.fillRect(0, 0, CARD_W, headerH);

  // Subtle header pattern
  drawHexPattern(ctx, 0, 0, CARD_W, headerH, '#ffffff');

  // ── Logo with white circle backdrop ──
  const logoSize = 80;
  const logoX = 30;
  const logoY = (headerH - logoSize) / 2;
  
  // White circle behind logo
  ctx.beginPath();
  ctx.arc(logoX + logoSize / 2, logoY + logoSize / 2, logoSize / 2 + 6, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();

  const logoSrc = settings.logo_url || otsLogoUrl;
  try {
    const logo = await loadImage(logoSrc);
    ctx.save();
    ctx.beginPath();
    ctx.arc(logoX + logoSize / 2, logoY + logoSize / 2, logoSize / 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(logo, logoX, logoY, logoSize, logoSize);
    ctx.restore();
  } catch { /* skip */ }

  // ── University name & location ──
  const textX = logoX + logoSize + 24;
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'left';
  ctx.font = 'bold 30px "Segoe UI", Arial, sans-serif';
  ctx.fillText(settings.university_name || 'Online Textile School', textX, headerH / 2 - 6);

  ctx.font = '17px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.fillText(settings.location || 'Dhaka, Bangladesh', textX, headerH / 2 + 20);

  // ── "STUDENT ID CARD" pill badge ──
  const badgeText = 'STUDENT ID CARD';
  ctx.font = 'bold 13px "Segoe UI", Arial, sans-serif';
  const badgeW = ctx.measureText(badgeText).width + 28;
  const badgeH = 28;
  const badgeX = CARD_W - badgeW - 25;
  const badgeY = (headerH - badgeH) / 2;
  drawRoundedRect(ctx, badgeX, badgeY, badgeW, badgeH, 14);
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.fillText(badgeText, badgeX + badgeW / 2, badgeY + badgeH / 2 + 5);

  // ── Body section ──
  const bodyY = headerH + 18;
  const photoW = 155;
  const photoH = 190;
  const photoX = 38;
  const photoY = bodyY + 8;

  // Subtle watermark hex pattern in body
  drawHexPattern(ctx, CARD_W - 300, bodyY, 300, CARD_H - bodyY - 100, primaryColor);

  // ── Photo with glow border ──
  // Glow shadow
  ctx.save();
  ctx.shadowColor = accentColor;
  ctx.shadowBlur = 18;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 4;
  drawRoundedRect(ctx, photoX, photoY, photoW, photoH, 12);
  ctx.fillStyle = '#e2e8f0';
  ctx.fill();
  ctx.restore();

  // Photo clip
  ctx.save();
  drawRoundedRect(ctx, photoX, photoY, photoW, photoH, 12);
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
  ctx.strokeStyle = primaryColor;
  ctx.lineWidth = 3;
  drawRoundedRect(ctx, photoX, photoY, photoW, photoH, 12);
  ctx.stroke();

  // ── Fields ──
  const fieldX = photoX + photoW + 32;
  const fieldStartY = bodyY + 20;
  const lineH = 40;
  ctx.textAlign = 'left';

  const fields = [
    { label: 'NAME', value: data.studentName },
    { label: 'ROLL', value: data.rollId },
    { label: 'BLOOD GROUP', value: data.bloodGroup || '—' },
    { label: 'DATE OF BIRTH', value: data.dateOfBirth || '—' },
    { label: 'ADDRESS', value: data.address || '—' },
  ];

  fields.forEach((f, i) => {
    const y = fieldStartY + i * lineH;

    // Divider line (skip first)
    if (i > 0) {
      ctx.strokeStyle = '#e5e7eb';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(fieldX, y - 12);
      ctx.lineTo(CARD_W - 40, y - 12);
      ctx.stroke();
    }

    // Label (small caps style)
    ctx.font = '600 11px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(f.label, fieldX, y);

    // Value
    ctx.font = 'bold 17px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = '#1e293b';
    const maxValW = CARD_W - fieldX - 50;
    ctx.fillText(truncate(ctx, f.value, maxValW), fieldX, y + 20);
  });

  // ── Validity pill ──
  const pillY = photoY + photoH + 16;
  const pillText = `Valid Until: ${data.validUntil}`;
  ctx.font = 'bold 13px "Segoe UI", Arial, sans-serif';
  const pillW = ctx.measureText(pillText).width + 24;
  const pillH = 26;
  drawRoundedRect(ctx, photoX, pillY, pillW, pillH, 13);
  const pillGrad = ctx.createLinearGradient(photoX, pillY, photoX + pillW, pillY);
  pillGrad.addColorStop(0, primaryColor);
  pillGrad.addColorStop(1, accentColor);
  ctx.fillStyle = pillGrad;
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.fillText(pillText, photoX + pillW / 2, pillY + pillH / 2 + 5);

  // ── Signature section (right side) ──
  const sigX = CARD_W - 240;
  const sigY = pillY - 10;

  if (settings.signature_url) {
    try {
      const sig = await loadImage(settings.signature_url);
      ctx.drawImage(sig, sigX + 30, sigY - 45, 140, 40);
    } catch { /* skip */ }
  }

  // Signature line
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(sigX + 10, sigY + 2);
  ctx.lineTo(sigX + 190, sigY + 2);
  ctx.stroke();

  ctx.font = '12px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = '#1e293b';
  ctx.textAlign = 'center';
  if (settings.authority_name) {
    ctx.font = 'bold 13px "Segoe UI", Arial, sans-serif';
    ctx.fillText(settings.authority_name, sigX + 100, sigY + 18);
  }
  if (settings.authority_position) {
    ctx.font = '11px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = '#64748b';
    ctx.fillText(settings.authority_position, sigX + 100, sigY + 34);
  }

  // ── Footer separator ──
  const footerY = CARD_H - 88;
  const footGrad = ctx.createLinearGradient(30, footerY, CARD_W - 30, footerY);
  footGrad.addColorStop(0, primaryColor);
  footGrad.addColorStop(1, accentColor);
  ctx.strokeStyle = footGrad;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(30, footerY);
  ctx.lineTo(CARD_W - 30, footerY);
  ctx.stroke();

  // ── Barcode ──
  const barcodeCanvas = document.createElement('canvas');
  JsBarcode(barcodeCanvas, data.cardNumber, {
    format: 'CODE128',
    width: 2,
    height: 45,
    displayValue: false,
    margin: 0,
  });
  const barcodeW = 380;
  const barcodeH = 45;
  ctx.drawImage(barcodeCanvas, (CARD_W - barcodeW) / 2, footerY + 10, barcodeW, barcodeH);

  // Card number
  ctx.font = 'bold 13px "Courier New", monospace';
  ctx.fillStyle = '#475569';
  ctx.textAlign = 'center';
  const spacedNumber = data.cardNumber.split('').join(' ');
  ctx.fillText(spacedNumber, CARD_W / 2, footerY + 10 + barcodeH + 16);

  // ── Bottom gradient strip ──
  const stripH = 8;
  const stripGrad = ctx.createLinearGradient(0, CARD_H - stripH, CARD_W, CARD_H - stripH);
  stripGrad.addColorStop(0, primaryColor);
  stripGrad.addColorStop(0.5, accentColor);
  stripGrad.addColorStop(1, primaryColor);
  ctx.fillStyle = stripGrad;
  drawRoundedRect(ctx, 0, CARD_H - stripH, CARD_W, stripH, 0);
  ctx.fill();

  ctx.restore();
}

function drawInitial(ctx: CanvasRenderingContext2D, name: string, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#cbd5e1';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = '#64748b';
  ctx.font = 'bold 56px "Segoe UI", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(name?.[0]?.toUpperCase() || '?', x + w / 2, y + h / 2 + 18);
}

function truncate(ctx: CanvasRenderingContext2D, text: string, maxW: number): string {
  if (ctx.measureText(text).width <= maxW) return text;
  let t = text;
  while (t.length > 0 && ctx.measureText(t + '…').width > maxW) t = t.slice(0, -1);
  return t + '…';
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
