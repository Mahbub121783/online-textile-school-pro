// Five additional ambassador share-card layouts, distinct from the
// original "Classic Strip" design in ambassadorCardRenderer.ts, so
// ambassadors can pick whichever style they like best before downloading
// and posting. Same Canvas 2D technique and AmbassadorCardData shape as
// that file; helpers are duplicated rather than shared, matching this
// codebase's existing convention (idCardRenderer.ts/teamCardRenderer.ts
// each keep their own copies too).
import type { AmbassadorCardData } from './ambassadorCardRenderer';

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

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function fitFontSize(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, startPx: number, minPx: number, weight = '800') {
  let size = startPx;
  while (size > minPx) {
    ctx.font = `${weight} ${size}px Arial, sans-serif`;
    if (ctx.measureText(text).width <= maxWidth) break;
    size -= 2;
  }
  return size;
}

async function drawPhotoCover(ctx: CanvasRenderingContext2D, avatarUrl: string | null | undefined, x: number, y: number, w: number, h: number, initial: string, c1: string, c2: string) {
  if (avatarUrl) {
    try {
      const img = await loadImage(avatarUrl);
      const scale = Math.max(w / img.width, h / img.height);
      const dw = img.width * scale, dh = img.height * scale;
      ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
      return;
    } catch { /* fall through to initial */ }
  }
  const g = ctx.createLinearGradient(x, y, x + w, y + h);
  g.addColorStop(0, c1); g.addColorStop(1, c2);
  ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = '#ffffff';
  ctx.font = `800 ${Math.round(Math.min(w, h) * 0.4)}px Arial, sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText((initial || '?')[0]?.toUpperCase() || '?', x + w / 2, y + h / 2 + Math.min(w, h) * 0.03);
}

const PRIMARY = 'hsl(193, 88%, 21%)';
const PRIMARY_DARK = 'hsl(193, 90%, 15%)';
const PRIMARY_LIGHT = 'hsl(193, 70%, 38%)';
const ACCENT = 'hsl(2, 64%, 57%)';
const ACCENT_DARK = 'hsl(2, 60%, 42%)';
const GOLD = 'hsl(42, 85%, 55%)';

const W = 1080, H = 1080;

// ---------------------------------------------------------------------
// 1) "Spotlight" -- full-bleed photo with a bottom gradient overlay, like
// an event speaker announcement / Instagram story.
// ---------------------------------------------------------------------
export async function renderCardSpotlight(data: AmbassadorCardData): Promise<HTMLCanvasElement> {
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  await drawPhotoCover(ctx, data.avatarUrl, 0, 0, W, H, data.fullName, PRIMARY, ACCENT);

  const overlay = ctx.createLinearGradient(0, H * 0.4, 0, H);
  overlay.addColorStop(0, 'rgba(8, 28, 38, 0)');
  overlay.addColorStop(1, 'rgba(6, 22, 30, 0.92)');
  ctx.fillStyle = overlay;
  ctx.fillRect(0, 0, W, H);

  // Framed border for a "poster" feel
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 6;
  ctx.strokeRect(24, 24, W - 48, H - 48);

  // Top badge
  const badge = 'CAMPUS AMBASSADOR';
  ctx.font = '800 26px Arial, sans-serif';
  const bw = ctx.measureText(badge).width + 56;
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  roundRect(ctx, 64, 64, bw, 52, 26);
  ctx.fill();
  ctx.fillStyle = PRIMARY_DARK;
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillText(badge, 90, 90);

  // Bottom text block
  const textX = 64;
  const maxW = W - 128;
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  const nameSize = fitFontSize(ctx, data.fullName, maxW, 76, 40);
  ctx.font = `800 ${nameSize}px Arial, sans-serif`;
  ctx.fillStyle = '#ffffff';
  ctx.fillText(data.fullName, textX, H - 190);

  ctx.font = '700 32px Arial, sans-serif';
  ctx.fillStyle = GOLD;
  ctx.fillText(data.roleLabel, textX, H - 142);

  let metaY = H - 100;
  const metaParts = [data.campusName, data.sessionLabel ? `Season: ${data.sessionLabel}` : null].filter(Boolean);
  if (metaParts.length) {
    ctx.font = '400 26px Arial, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillText(metaParts.join('  ·  '), textX, metaY);
    metaY += 10;
  }

  ctx.font = '400 20px Arial, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.fillText('onlinetextileschool.com', textX, H - 56);

  return canvas;
}

// ---------------------------------------------------------------------
// 2) "Diagonal Split" -- bold two-tone diagonal background, circular
// photo with ring, geometric accent triangles.
// ---------------------------------------------------------------------
export async function renderCardDiagonalSplit(data: AmbassadorCardData): Promise<HTMLCanvasElement> {
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = PRIMARY_DARK;
  ctx.fillRect(0, 0, W, H);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(W, 0);
  ctx.lineTo(0, H * 0.62);
  ctx.closePath();
  const g1 = ctx.createLinearGradient(0, 0, W, H * 0.6);
  g1.addColorStop(0, PRIMARY_LIGHT); g1.addColorStop(1, PRIMARY);
  ctx.fillStyle = g1;
  ctx.fill();

  // Accent triangles
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.beginPath(); ctx.moveTo(W - 60, 40); ctx.lineTo(W - 220, 40); ctx.lineTo(W - 60, 220); ctx.closePath(); ctx.fill();
  ctx.fillStyle = ACCENT;
  ctx.beginPath(); ctx.moveTo(60, H - 40); ctx.lineTo(220, H - 40); ctx.lineTo(60, H - 220); ctx.closePath(); ctx.fill();

  // Circular photo with white ring + shadow
  const r = 230, cx = W / 2, cy = 410;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = 40; ctx.shadowOffsetY = 14;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, r - 10, 0, Math.PI * 2); ctx.clip();
  await drawPhotoCover(ctx, data.avatarUrl, cx - r, cy - r, r * 2, r * 2, data.fullName, PRIMARY, ACCENT);
  ctx.restore();

  // Badge
  ctx.font = '800 24px Arial, sans-serif';
  const badge = 'CAMPUS AMBASSADOR';
  const bw = ctx.measureText(badge).width + 50;
  ctx.fillStyle = ACCENT;
  roundRect(ctx, cx - bw / 2, cy + r + 30, bw, 48, 24);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(badge, cx, cy + r + 54);

  // Name + role
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  const nameSize = fitFontSize(ctx, data.fullName, W - 160, 64, 36);
  ctx.font = `800 ${nameSize}px Arial, sans-serif`;
  ctx.fillStyle = '#ffffff';
  ctx.fillText(data.fullName, cx, cy + r + 150);

  ctx.font = '600 28px Arial, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillText(data.roleLabel, cx, cy + r + 190);

  const metaParts = [data.campusName, data.sessionLabel ? `Season ${data.sessionLabel}` : null].filter(Boolean);
  if (metaParts.length) {
    ctx.font = '400 24px Arial, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    ctx.fillText(metaParts.join('  ·  '), cx, cy + r + 228);
  }

  ctx.font = '400 20px Arial, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.fillText('onlinetextileschool.com', cx, H - 44);

  return canvas;
}

// ---------------------------------------------------------------------
// 3) "Minimal Badge" -- clean light background, centered ringed photo,
// viewfinder-style corner brackets, professional/LinkedIn feel.
// ---------------------------------------------------------------------
export async function renderCardMinimalBadge(data: AmbassadorCardData): Promise<HTMLCanvasElement> {
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#fbfdfe';
  ctx.fillRect(0, 0, W, H);

  // Corner brackets
  const bracket = (x: number, y: number, dx: number, dy: number) => {
    ctx.strokeStyle = PRIMARY;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(x, y + dy * 70);
    ctx.lineTo(x, y);
    ctx.lineTo(x + dx * 70, y);
    ctx.stroke();
  };
  bracket(56, 56, 1, 1);
  bracket(W - 56, 56, -1, 1);
  bracket(56, H - 56, 1, -1);
  bracket(W - 56, H - 56, -1, -1);

  // Top pill badge
  const badge = 'CAMPUS AMBASSADOR';
  ctx.font = '800 24px Arial, sans-serif';
  const bw = ctx.measureText(badge).width + 56;
  ctx.fillStyle = ACCENT;
  roundRect(ctx, (W - bw) / 2, 110, bw, 50, 25);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(badge, W / 2, 135);

  // Ringed circular photo
  const r = 240, cx = W / 2, cy = 470;
  ctx.save();
  ctx.shadowColor = 'rgba(10,60,80,0.18)'; ctx.shadowBlur = 50; ctx.shadowOffsetY = 18;
  ctx.beginPath(); ctx.arc(cx, cy, r + 14, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.fill();
  ctx.restore();

  const ringGrad = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
  ringGrad.addColorStop(0, PRIMARY); ringGrad.addColorStop(1, ACCENT);
  ctx.lineWidth = 12;
  ctx.strokeStyle = ringGrad;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();

  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, r - 14, 0, Math.PI * 2); ctx.clip();
  await drawPhotoCover(ctx, data.avatarUrl, cx - r, cy - r, r * 2, r * 2, data.fullName, PRIMARY, ACCENT);
  ctx.restore();

  // Name + role + meta
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  const nameSize = fitFontSize(ctx, data.fullName, W - 160, 64, 36);
  ctx.font = `800 ${nameSize}px Arial, sans-serif`;
  ctx.fillStyle = PRIMARY_DARK;
  ctx.fillText(data.fullName, cx, cy + r + 90);

  ctx.font = '700 30px Arial, sans-serif';
  ctx.fillStyle = ACCENT;
  ctx.fillText(data.roleLabel, cx, cy + r + 134);

  ctx.strokeStyle = 'rgba(10,60,80,0.15)';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(cx - 90, cy + r + 160); ctx.lineTo(cx + 90, cy + r + 160); ctx.stroke();

  const metaParts = [data.campusName, data.sessionLabel ? `Season ${data.sessionLabel}` : null].filter(Boolean);
  if (metaParts.length) {
    ctx.font = '400 24px Arial, sans-serif';
    ctx.fillStyle = 'rgba(10,50,65,0.7)';
    ctx.fillText(metaParts.join('  ·  '), cx, cy + r + 196);
  }

  ctx.font = '400 20px Arial, sans-serif';
  ctx.fillStyle = 'rgba(10,50,65,0.5)';
  ctx.fillText('onlinetextileschool.com', cx, H - 50);

  return canvas;
}

// ---------------------------------------------------------------------
// 4) "Vivid Glow" -- vibrant gradient background, glowing rounded-square
// photo frame, bold stacked typography -- influencer-announcement feel.
// ---------------------------------------------------------------------
export async function renderCardVividGlow(data: AmbassadorCardData): Promise<HTMLCanvasElement> {
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, PRIMARY_DARK);
  bg.addColorStop(0.55, PRIMARY);
  bg.addColorStop(1, ACCENT_DARK);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Soft glow blobs
  const blob = (x: number, y: number, r: number, color: string, alpha: number) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color.replace(')', `, ${alpha})`).replace('hsl', 'hsla'));
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  };
  blob(140, 140, 260, ACCENT, 0.5);
  blob(W - 120, H - 160, 320, GOLD, 0.35);

  // Badge
  const badge = 'CAMPUS AMBASSADOR';
  ctx.font = '800 26px Arial, sans-serif';
  const bw = ctx.measureText(badge).width + 56;
  ctx.fillStyle = 'rgba(255,255,255,0.16)';
  roundRect(ctx, (W - bw) / 2, 86, bw, 52, 26);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 2;
  roundRect(ctx, (W - bw) / 2, 86, bw, 52, 26); ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(badge, W / 2, 112);

  // Glowing rounded-square photo frame -- a soft gold shadow behind the
  // white backing card reads as a glow around the whole frame.
  const size = 460, px = (W - size) / 2, py = 190;
  ctx.save();
  ctx.shadowColor = GOLD; ctx.shadowBlur = 60;
  roundRect(ctx, px - 8, py - 8, size + 16, size + 16, 40);
  ctx.fillStyle = '#fff'; ctx.fill();
  ctx.restore();

  ctx.save();
  roundRect(ctx, px, py, size, size, 34);
  ctx.clip();
  await drawPhotoCover(ctx, data.avatarUrl, px, py, size, size, data.fullName, PRIMARY, ACCENT);
  ctx.restore();
  const ringGrad = ctx.createLinearGradient(px, py, px + size, py + size);
  ringGrad.addColorStop(0, GOLD); ringGrad.addColorStop(1, ACCENT);
  ctx.lineWidth = 6; ctx.strokeStyle = ringGrad;
  roundRect(ctx, px, py, size, size, 34); ctx.stroke();

  // Stacked bold name
  const cx = W / 2;
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  const nameSize = fitFontSize(ctx, data.fullName, W - 140, 72, 38);
  ctx.font = `800 ${nameSize}px Arial, sans-serif`;
  ctx.fillStyle = '#ffffff';
  ctx.fillText(data.fullName, cx, py + size + 90);

  ctx.font = '700 30px Arial, sans-serif';
  ctx.fillStyle = GOLD;
  ctx.fillText(data.roleLabel, cx, py + size + 134);

  const metaParts = [data.campusName, data.sessionLabel ? `Season ${data.sessionLabel}` : null].filter(Boolean);
  if (metaParts.length) {
    const label = metaParts.join('  ·  ');
    ctx.font = '600 22px Arial, sans-serif';
    const lw = ctx.measureText(label).width + 48;
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    roundRect(ctx, cx - lw / 2, py + size + 160, lw, 46, 23);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.fillText(label, cx, py + size + 189);
  }

  ctx.font = '400 20px Arial, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.fillText('onlinetextileschool.com', cx, H - 48);

  return canvas;
}

// ---------------------------------------------------------------------
// 5) "Polaroid" -- playful tilted photo card on a soft pastel background,
// washi-tape accent, casual social-post feel.
// ---------------------------------------------------------------------
export async function renderCardPolaroid(data: AmbassadorCardData): Promise<HTMLCanvasElement> {
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, 'hsl(193, 60%, 93%)');
  bg.addColorStop(1, 'hsl(2, 60%, 94%)');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Scattered soft dot decoration
  ctx.fillStyle = 'rgba(10, 60, 80, 0.08)';
  for (let i = 0; i < 24; i++) {
    const rx = (i * 157) % W, ry = (i * 97) % (H * 0.4) + 40;
    ctx.beginPath(); ctx.arc(rx, ry, 4, 0, Math.PI * 2); ctx.fill();
  }

  // Tilted polaroid card
  const cardW = 640, cardH = 780, cardX = (W - cardW) / 2, cardY = 150;
  const photoPad = 36, photoW = cardW - photoPad * 2, photoH = 560;

  ctx.save();
  ctx.translate(cardX + cardW / 2, cardY + cardH / 2);
  ctx.rotate(-3.5 * Math.PI / 180);
  ctx.translate(-(cardX + cardW / 2), -(cardY + cardH / 2));

  ctx.save();
  ctx.shadowColor = 'rgba(10,30,40,0.3)'; ctx.shadowBlur = 44; ctx.shadowOffsetY = 20;
  ctx.fillStyle = '#ffffff';
  roundRect(ctx, cardX, cardY, cardW, cardH, 10);
  ctx.fill();
  ctx.restore();

  ctx.save();
  roundRect(ctx, cardX + photoPad, cardY + photoPad, photoW, photoH, 4);
  ctx.clip();
  await drawPhotoCover(ctx, data.avatarUrl, cardX + photoPad, cardY + photoPad, photoW, photoH, data.fullName, PRIMARY, ACCENT);
  ctx.restore();

  // Handwritten-style name in the polaroid's bottom strip
  const textCx = cardX + cardW / 2;
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  const nameSize = fitFontSize(ctx, data.fullName, cardW - 80, 52, 30, '700');
  ctx.font = `italic 700 ${nameSize}px Georgia, 'Times New Roman', serif`;
  ctx.fillStyle = PRIMARY_DARK;
  ctx.fillText(data.fullName, textCx, cardY + photoPad + photoH + 72);

  ctx.font = '600 26px Arial, sans-serif';
  ctx.fillStyle = ACCENT;
  ctx.fillText(data.roleLabel, textCx, cardY + photoPad + photoH + 112);

  ctx.restore(); // end rotation

  // Washi tape accent (drawn unrotated, over the top-left corner of the tilted card)
  ctx.save();
  ctx.translate(cardX + 70, cardY - 6);
  ctx.rotate(-18 * Math.PI / 180);
  ctx.fillStyle = 'rgba(224, 90, 80, 0.75)';
  ctx.fillRect(-60, -18, 120, 36);
  ctx.restore();

  // Badge + meta below the tilted card
  const badge = 'CAMPUS AMBASSADOR';
  ctx.font = '800 24px Arial, sans-serif';
  const bw = ctx.measureText(badge).width + 50;
  const badgeY = cardY + cardH + 36;
  ctx.fillStyle = PRIMARY;
  roundRect(ctx, (W - bw) / 2, badgeY, bw, 46, 23);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(badge, W / 2, badgeY + 23);

  const metaParts = [data.campusName, data.sessionLabel ? `Season ${data.sessionLabel}` : null].filter(Boolean);
  if (metaParts.length) {
    ctx.font = '400 22px Arial, sans-serif';
    ctx.fillStyle = 'rgba(10,50,65,0.7)';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(metaParts.join('  ·  '), W / 2, badgeY + 76);
  }

  ctx.font = '400 20px Arial, sans-serif';
  ctx.fillStyle = 'rgba(10,50,65,0.5)';
  ctx.fillText('onlinetextileschool.com', W / 2, H - 36);

  return canvas;
}

export interface AmbassadorCardTemplate {
  id: string;
  name: string;
  description: string;
  render: (data: AmbassadorCardData) => Promise<HTMLCanvasElement>;
}

export const EXTRA_AMBASSADOR_CARD_TEMPLATES: AmbassadorCardTemplate[] = [
  { id: 'spotlight', name: 'Spotlight', description: 'Full-photo poster with bottom overlay', render: renderCardSpotlight },
  { id: 'diagonal-split', name: 'Diagonal Split', description: 'Bold two-tone geometric layout', render: renderCardDiagonalSplit },
  { id: 'minimal-badge', name: 'Minimal Badge', description: 'Clean, professional, LinkedIn-style', render: renderCardMinimalBadge },
  { id: 'vivid-glow', name: 'Vivid Glow', description: 'Vibrant gradient with a glowing frame', render: renderCardVividGlow },
  { id: 'polaroid', name: 'Polaroid', description: 'Playful tilted photo card', render: renderCardPolaroid },
];
