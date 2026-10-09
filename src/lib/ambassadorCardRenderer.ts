// Canvas-drawn Facebook/Instagram/LinkedIn share card for approved campus
// ambassadors -- plain Canvas 2D (same technique as certificateRenderer.ts),
// styled as a professional "event speaker" promo card: branded side strip,
// large photo, bold name, role, campus/session badge, dotted decoration.

export interface AmbassadorCardData {
  fullName: string;
  roleLabel: string;
  campusName?: string;
  sessionLabel?: string;
  avatarUrl?: string | null;
}

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

function drawDots(ctx: CanvasRenderingContext2D, cx: number, cy: number, cols: number, rows: number, gap: number, color: string) {
  ctx.fillStyle = color;
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      ctx.beginPath();
      ctx.arc(cx + i * gap, cy + j * gap, 2.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }
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

const PRIMARY = 'hsl(193, 88%, 21%)';
const PRIMARY_DARK = 'hsl(193, 90%, 15%)';
const ACCENT = 'hsl(2, 64%, 57%)';

export async function renderAmbassadorCard(data: AmbassadorCardData): Promise<HTMLCanvasElement> {
  const W = 1080, H = 1080;
  const STRIP_W = 110;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  // Main background
  ctx.fillStyle = 'hsl(193, 55%, 96%)';
  ctx.fillRect(0, 0, W, H);

  // Decorative dot clusters
  drawDots(ctx, W - 220, 50, 6, 5, 26, 'rgba(10, 60, 80, 0.14)');
  drawDots(ctx, STRIP_W + 40, H - 160, 5, 4, 26, 'rgba(10, 60, 80, 0.10)');

  // Left brand strip
  const stripGrad = ctx.createLinearGradient(0, 0, 0, H);
  stripGrad.addColorStop(0, PRIMARY);
  stripGrad.addColorStop(1, PRIMARY_DARK);
  ctx.fillStyle = stripGrad;
  ctx.fillRect(0, 0, STRIP_W, H);
  ctx.save();
  ctx.translate(STRIP_W / 2 + 8, H / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillStyle = '#ffffff';
  ctx.font = '700 32px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  try { (ctx as any).letterSpacing = '6px'; } catch {}
  ctx.fillText('ONLINE TEXTILE SCHOOL', 0, 0);
  ctx.restore();

  // Top badge + accent bars
  ctx.textAlign = 'right';
  ctx.fillStyle = ACCENT;
  ctx.font = '800 26px Arial, sans-serif';
  ctx.fillText('CAMPUS', W - 190, 72);
  ctx.fillText('AMBASSADOR', W - 190, 104);
  ctx.fillStyle = PRIMARY;
  ctx.fillRect(W - 160, 50, 7, 60);
  ctx.fillRect(W - 140, 50, 7, 60);
  ctx.fillRect(W - 120, 50, 7, 60);

  // Photo (centered square, rounded)
  const photoSize = 460;
  const photoX = (W + STRIP_W - photoSize) / 2;
  const photoY = 150;
  ctx.save();
  roundRect(ctx, photoX, photoY, photoSize, photoSize, 28);
  ctx.clip();
  if (data.avatarUrl) {
    try {
      const img = await loadImage(data.avatarUrl);
      const scale = Math.max(photoSize / img.width, photoSize / img.height);
      const dw = img.width * scale, dh = img.height * scale;
      ctx.drawImage(img, photoX + (photoSize - dw) / 2, photoY + (photoSize - dh) / 2, dw, dh);
    } catch {
      const g = ctx.createLinearGradient(photoX, photoY, photoX + photoSize, photoY + photoSize);
      g.addColorStop(0, PRIMARY); g.addColorStop(1, ACCENT);
      ctx.fillStyle = g; ctx.fillRect(photoX, photoY, photoSize, photoSize);
      ctx.fillStyle = '#ffffff'; ctx.font = '800 180px Arial, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText((data.fullName || '?')[0].toUpperCase(), photoX + photoSize / 2, photoY + photoSize / 2 + 15);
    }
  } else {
    const g = ctx.createLinearGradient(photoX, photoY, photoX + photoSize, photoY + photoSize);
    g.addColorStop(0, PRIMARY); g.addColorStop(1, ACCENT);
    ctx.fillStyle = g; ctx.fillRect(photoX, photoY, photoSize, photoSize);
    ctx.fillStyle = '#ffffff'; ctx.font = '800 180px Arial, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText((data.fullName || '?')[0].toUpperCase(), photoX + photoSize / 2, photoY + photoSize / 2 + 15);
  }
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = 6;
  roundRect(ctx, photoX, photoY, photoSize, photoSize, 28);
  ctx.stroke();

  // Name (auto-fit width)
  const textCenterX = (W + STRIP_W) / 2;
  const maxTextWidth = W - STRIP_W - 100;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const nameSize = fitFontSize(ctx, data.fullName, maxTextWidth, 60, 34);
  ctx.font = `800 ${nameSize}px Arial, sans-serif`;
  ctx.fillStyle = PRIMARY_DARK;
  ctx.fillText(data.fullName, textCenterX, 700);

  // Role
  ctx.font = '700 30px Arial, sans-serif';
  ctx.fillStyle = ACCENT;
  ctx.fillText(data.roleLabel, textCenterX, 744);

  // Campus
  let y = 782;
  if (data.campusName) {
    ctx.font = '400 24px Arial, sans-serif';
    ctx.fillStyle = 'rgba(10, 50, 65, 0.75)';
    ctx.fillText(data.campusName, textCenterX, y);
    y += 44;
  }

  // Session pill
  if (data.sessionLabel) {
    const label = `SESSION: ${data.sessionLabel.toUpperCase()}`;
    ctx.font = '700 20px Arial, sans-serif';
    const tw = ctx.measureText(label).width;
    const pillW = tw + 48, pillX = textCenterX - pillW / 2;
    ctx.fillStyle = 'rgba(10, 60, 80, 0.10)';
    roundRect(ctx, pillX, y, pillW, 44, 22);
    ctx.fill();
    ctx.fillStyle = PRIMARY;
    ctx.fillText(label, textCenterX, y + 29);
  }

  // Bottom-right diagonal accent + footer
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(W, H);
  ctx.lineTo(W, H - 140);
  ctx.lineTo(W - 240, H);
  ctx.closePath();
  ctx.fillStyle = ACCENT;
  ctx.fill();
  ctx.restore();

  ctx.font = '400 20px Arial, sans-serif';
  ctx.fillStyle = 'rgba(10, 50, 65, 0.6)';
  ctx.textAlign = 'center';
  ctx.fillText('onlinetextileschool.com', textCenterX, H - 36);

  return canvas;
}

export async function downloadAmbassadorCard(data: AmbassadorCardData, filename = 'ots-ambassador-card.png'): Promise<void> {
  const canvas = await renderAmbassadorCard(data);
  const url = canvas.toDataURL('image/png');
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
}
