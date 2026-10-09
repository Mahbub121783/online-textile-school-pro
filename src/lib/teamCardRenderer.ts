// Canvas-drawn campus-team roster card (webinar-poster style, per the
// reference the requester shared): OTS brand header, campus name, then the
// team in hierarchy order -- Head of Campus Ambassador (one, prominent),
// Ambassadors (grid), Graphics/Others (grid) -- then a website+season
// footer. Downloadable by both the ambassador (their own campus) and admin
// (any campus). Dynamic height: computed in a measure pass before the
// canvas is created, since team size varies per campus.

export interface TeamMember {
  name: string;
  avatarUrl?: string | null;
}

export interface TeamCardData {
  campusName: string;
  sessionLabel?: string;
  head?: TeamMember | null;
  ambassadors: TeamMember[];
  graphics: TeamMember[];
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
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
    ctx.beginPath(); ctx.arc(cx + i * gap, cy + j * gap, 2.6, 0, Math.PI * 2); ctx.fill();
  }
}

function drawX(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string) {
  ctx.strokeStyle = color; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(x - size, y - size); ctx.lineTo(x + size, y + size); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x + size, y - size); ctx.lineTo(x - size, y + size); ctx.stroke();
}

function wrapTitle(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, fontPx: number): string[] {
  ctx.font = `800 ${fontPx}px Arial, sans-serif`;
  if (ctx.measureText(text.toUpperCase()).width <= maxWidth) return [text.toUpperCase()];
  const words = text.toUpperCase().split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && cur) { lines.push(cur); cur = w; }
    else cur = test;
  }
  if (cur) lines.push(cur);
  return lines.slice(0, 2);
}

const PRIMARY = 'hsl(193, 88%, 21%)';
const PRIMARY_DARK = 'hsl(193, 90%, 15%)';
const ACCENT = 'hsl(2, 64%, 57%)';
const W = 1080;
const CARD_W = 220, CARD_GAP = 24, GRID_SIDE_PAD = 70;
const PER_ROW = Math.floor((W - GRID_SIDE_PAD * 2 + CARD_GAP) / (CARD_W + CARD_GAP));

async function loadAvatar(url?: string | null) {
  if (!url) return null;
  try { return await loadImage(url); } catch { return null; }
}

function drawPersonCard(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, photoH: number, name: string, img: HTMLImageElement | null) {
  roundRect(ctx, x, y, w, photoH, 16);
  ctx.save(); ctx.clip();
  if (img) {
    const scale = Math.max(w / img.width, photoH / img.height);
    const dw = img.width * scale, dh = img.height * scale;
    ctx.drawImage(img, x + (w - dw) / 2, y + (photoH - dh) / 2, dw, dh);
  } else {
    const g = ctx.createLinearGradient(x, y, x + w, y + photoH);
    g.addColorStop(0, PRIMARY); g.addColorStop(1, ACCENT);
    ctx.fillStyle = g; ctx.fillRect(x, y, w, photoH);
    ctx.fillStyle = '#fff'; ctx.font = `800 ${Math.round(photoH * 0.4)}px Arial, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText((name || '?')[0].toUpperCase(), x + w / 2, y + photoH / 2 + 6);
  }
  ctx.restore();
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 4;
  roundRect(ctx, x, y, w, photoH, 16); ctx.stroke();

  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.font = '700 20px Arial, sans-serif';
  ctx.fillStyle = PRIMARY_DARK;
  let label = name;
  const maxW = w + 10;
  while (ctx.measureText(label).width > maxW && label.length > 3) label = label.slice(0, -2) + '…';
  ctx.fillText(label, x + w / 2, y + photoH + 28);
}

export async function renderTeamCard(data: TeamCardData): Promise<HTMLCanvasElement> {
  const measureCanvas = document.createElement('canvas');
  const mctx = measureCanvas.getContext('2d')!;

  const HEADER_H = 380;
  const headCardH = data.head ? 300 : 0;
  const ambRows = data.ambassadors.length ? Math.ceil(data.ambassadors.length / PER_ROW) : 0;
  const graRows = data.graphics.length ? Math.ceil(data.graphics.length / PER_ROW) : 0;
  const CARD_PHOTO_H = 190, CARD_UNIT_H = CARD_PHOTO_H + 40 + CARD_GAP;
  const ambSectionH = ambRows ? 56 + ambRows * CARD_UNIT_H : 0;
  const graSectionH = graRows ? 56 + graRows * CARD_UNIT_H : 0;
  const FOOTER_H = 130;
  const H = HEADER_H + (data.head ? headCardH - 60 + 30 : 10) + ambSectionH + graSectionH + FOOTER_H;

  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  // Header
  const grad = ctx.createLinearGradient(0, 0, W, HEADER_H);
  grad.addColorStop(0, PRIMARY_DARK); grad.addColorStop(1, PRIMARY);
  ctx.fillStyle = grad; ctx.fillRect(0, 0, W, HEADER_H);
  drawDots(ctx, 60, 50, 5, 4, 22, 'rgba(255,255,255,0.18)');
  drawX(ctx, W - 70, 50, 10, 'rgba(255,255,255,0.3)');
  drawX(ctx, W - 110, 50, 10, 'rgba(255,255,255,0.3)');
  drawX(ctx, W - 70, 90, 10, 'rgba(255,255,255,0.3)');
  drawX(ctx, W - 110, 90, 10, 'rgba(255,255,255,0.3)');

  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = '700 22px Arial, sans-serif';
  try { (ctx as any).letterSpacing = '4px'; } catch {}
  ctx.fillText('ONLINE TEXTILE SCHOOL', W / 2, 70);
  try { (ctx as any).letterSpacing = '0px'; } catch {}

  const titleLines = wrapTitle(ctx, data.campusName, W - 160, 56);
  let ty = 150;
  ctx.fillStyle = '#ffffff';
  titleLines.forEach((line) => { ctx.font = '800 56px Arial, sans-serif'; ctx.fillText(line, W / 2, ty); ty += 62; });
  ctx.fillStyle = ACCENT;
  ctx.font = '800 38px Arial, sans-serif';
  ctx.fillText('CAMPUS AMBASSADOR TEAM', W / 2, ty + 10);

  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.font = '400 20px Arial, sans-serif';
  ctx.fillText('Representing Online Textile School', W / 2, ty + 48);

  // Body background
  ctx.fillStyle = 'hsl(193, 55%, 97%)';
  ctx.fillRect(0, HEADER_H, W, H - HEADER_H);

  let cursorY = HEADER_H;

  if (data.head) {
    const img = await loadAvatar(data.head.avatarUrl);
    const cardW = 240, cardPhotoH = 240;
    const cx = (W - cardW) / 2, cy = HEADER_H - 60;
    drawPersonCard(ctx, cx, cy, cardW, cardPhotoH, data.head.name, img);
    ctx.font = '700 18px Arial, sans-serif';
    ctx.fillStyle = ACCENT;
    ctx.fillText('HEAD OF CAMPUS AMBASSADOR', W / 2, cy + cardPhotoH + 58);
    cursorY = cy + cardPhotoH + 80;
  } else {
    cursorY = HEADER_H + 30;
  }

  async function drawGrid(members: TeamMember[], label: string, startY: number): Promise<number> {
    if (!members.length) return startY;
    ctx.textAlign = 'left';
    ctx.font = '800 24px Arial, sans-serif';
    ctx.fillStyle = PRIMARY;
    ctx.fillText(label, GRID_SIDE_PAD, startY + 28);
    let y = startY + 56;
    for (let i = 0; i < members.length; i += PER_ROW) {
      const rowMembers = members.slice(i, i + PER_ROW);
      const rowW = rowMembers.length * CARD_W + (rowMembers.length - 1) * CARD_GAP;
      let x = (W - rowW) / 2;
      for (const m of rowMembers) {
        const img = await loadAvatar(m.avatarUrl);
        drawPersonCard(ctx, x, y, CARD_W, CARD_PHOTO_H, m.name, img);
        x += CARD_W + CARD_GAP;
      }
      y += CARD_UNIT_H;
    }
    return y;
  }

  cursorY = await drawGrid(data.ambassadors, 'AMBASSADORS', cursorY);
  cursorY = await drawGrid(data.graphics, 'GRAPHICS & OTHERS', cursorY);

  // Footer
  const footerY = H - FOOTER_H;
  ctx.strokeStyle = 'rgba(10,60,80,0.15)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(GRID_SIDE_PAD, footerY); ctx.lineTo(W - GRID_SIDE_PAD, footerY); ctx.stroke();

  ctx.textAlign = 'center';
  ctx.font = '700 22px Arial, sans-serif';
  ctx.fillStyle = PRIMARY_DARK;
  ctx.fillText('onlinetextileschool.com', W / 2, footerY + 48);

  if (data.sessionLabel) {
    const label = `SESSION: ${data.sessionLabel.toUpperCase()}`;
    ctx.font = '700 18px Arial, sans-serif';
    const tw = ctx.measureText(label).width;
    const pillW = tw + 48, pillX = W / 2 - pillW / 2;
    ctx.fillStyle = 'rgba(10,60,80,0.10)';
    roundRect(ctx, pillX, footerY + 70, pillW, 40, 20);
    ctx.fill();
    ctx.fillStyle = PRIMARY;
    ctx.fillText(label, W / 2, footerY + 96);
  }

  return canvas;
}

export async function downloadTeamCard(data: TeamCardData, filename = 'ots-ambassador-team-card.png'): Promise<void> {
  const canvas = await renderTeamCard(data);
  const url = canvas.toDataURL('image/png');
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
}
