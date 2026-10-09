// Simple canvas-drawn Facebook share card for approved campus ambassadors --
// deliberately plain Canvas 2D (same technique as certificateRenderer.ts)
// rather than pulling in html2canvas, since this is a fixed layout, not an
// arbitrary DOM snapshot.

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

export async function renderAmbassadorCard(data: AmbassadorCardData): Promise<HTMLCanvasElement> {
  const W = 1200, H = 630;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  // Brand gradient background (matches the Practice Arena hero: primary -> primary-dark -> accent)
  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, 'hsl(193, 88%, 21%)');
  grad.addColorStop(0.6, 'hsl(193, 90%, 15%)');
  grad.addColorStop(1, 'hsl(2, 64%, 57%)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Decorative translucent circles
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.beginPath(); ctx.arc(W - 80, -40, 220, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(-60, H + 40, 260, 0, Math.PI * 2); ctx.fill();

  // Brand name
  ctx.fillStyle = '#ffffff';
  ctx.font = '700 28px Arial, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('ONLINE TEXTILE SCHOOL', 60, 70);
  ctx.font = '400 16px Arial, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.fillText('onlinetextileschool.com', 60, 96);

  // Badge pill
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  roundRect(ctx, 60, 130, 260, 44, 22);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = '700 18px Arial, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('CAMPUS AMBASSADOR', 84, 158);

  // Avatar
  const avatarX = 60, avatarY = 210, avatarR = 90;
  ctx.save();
  ctx.beginPath();
  ctx.arc(avatarX + avatarR, avatarY + avatarR, avatarR, 0, Math.PI * 2);
  ctx.closePath();
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.fill();
  ctx.clip();
  if (data.avatarUrl) {
    try {
      const img = await loadImage(data.avatarUrl);
      ctx.drawImage(img, avatarX, avatarY, avatarR * 2, avatarR * 2);
    } catch {
      ctx.fillStyle = '#ffffff';
      ctx.font = '700 64px Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText((data.fullName || '?')[0].toUpperCase(), avatarX + avatarR, avatarY + avatarR + 24);
    }
  } else {
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 64px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText((data.fullName || '?')[0].toUpperCase(), avatarX + avatarR, avatarY + avatarR + 24);
  }
  ctx.restore();

  // Name + role + campus + session
  const textX = 280;
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffffff';
  ctx.font = '700 44px Arial, sans-serif';
  ctx.fillText(data.fullName, textX, 270);

  ctx.font = '600 24px Arial, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.fillText(data.roleLabel, textX, 312);

  if (data.campusName) {
    ctx.font = '400 22px Arial, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.fillText(data.campusName, textX, 346);
  }

  if (data.sessionLabel) {
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    roundRect(ctx, textX, 370, ctx.measureText(data.sessionLabel).width + 40 + 60, 40, 20);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = '600 18px Arial, sans-serif';
    ctx.fillText(`SESSION: ${data.sessionLabel.toUpperCase()}`, textX + 20, 396);
  }

  // Footer tagline
  ctx.font = '400 20px Arial, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.textAlign = 'center';
  ctx.fillText('Bangladesh’s premier online textile education platform', W / 2, H - 50);

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
