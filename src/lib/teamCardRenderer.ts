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
  campusLogoUrl?: string | null;
  sessionLabel?: string;
  head?: TeamMember | null;
  ambassadors: TeamMember[];
  graphics: TeamMember[];
}

const OTS_LOGO_URL = '/logo-512.png';

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

function withShadow(ctx: CanvasRenderingContext2D, color: string, blur: number, offsetY: number, draw: () => void) {
  ctx.save();
  ctx.shadowColor = color; ctx.shadowBlur = blur; ctx.shadowOffsetY = offsetY;
  draw();
  ctx.restore();
}

function drawDots(ctx: CanvasRenderingContext2D, cx: number, cy: number, cols: number, rows: number, gap: number, color: string) {
  ctx.fillStyle = color;
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
    ctx.beginPath(); ctx.arc(cx + i * gap, cy + j * gap, 2.8, 0, Math.PI * 2); ctx.fill();
  }
}

function drawX(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string) {
  ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x - size, y - size); ctx.lineTo(x + size, y + size); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x + size, y - size); ctx.lineTo(x - size, y + size); ctx.stroke();
}

function drawStar(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string) {
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? r : r * 0.45;
    const ang = (Math.PI / 5) * i - Math.PI / 2;
    const px = cx + rad * Math.cos(ang), py = cy + rad * Math.sin(ang);
    i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
  }
  ctx.closePath(); ctx.fill();
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
const GOLD = 'hsl(42, 90%, 55%)';
const W = 1080;
const CARD_W = 220, CARD_GAP = 28, GRID_SIDE_PAD = 70;
const PER_ROW = Math.floor((W - GRID_SIDE_PAD * 2 + CARD_GAP) / (CARD_W + CARD_GAP));

async function loadAvatar(url?: string | null) {
  if (!url) return null;
  try { return await loadImage(url); } catch { return null; }
}

function drawPersonCard(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, photoH: number, name: string, img: HTMLImageElement | null, accent = false) {
  withShadow(ctx, 'rgba(10,40,55,0.28)', 18, 8, () => {
    roundRect(ctx, x, y, w, photoH, 20);
    ctx.fillStyle = '#fff'; ctx.fill();
  });
  ctx.save();
  roundRect(ctx, x, y, w, photoH, 20);
  ctx.clip();
  if (img) {
    const scale = Math.max(w / img.width, photoH / img.height);
    const dw = img.width * scale, dh = img.height * scale;
    ctx.drawImage(img, x + (w - dw) / 2, y + (photoH - dh) / 2, dw, dh);
  } else {
    const g = ctx.createLinearGradient(x, y, x + w, y + photoH);
    g.addColorStop(0, accent ? GOLD : PRIMARY); g.addColorStop(1, ACCENT);
    ctx.fillStyle = g; ctx.fillRect(x, y, w, photoH);
    ctx.fillStyle = '#fff'; ctx.font = `800 ${Math.round(photoH * 0.4)}px Arial, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText((name || '?')[0].toUpperCase(), x + w / 2, y + photoH / 2 + 6);
  }
  ctx.restore();
  ctx.strokeStyle = accent ? GOLD : '#ffffff'; ctx.lineWidth = accent ? 6 : 4;
  roundRect(ctx, x, y, w, photoH, 20); ctx.stroke();

  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.font = '700 20px Arial, sans-serif';
  ctx.fillStyle = PRIMARY_DARK;
  let label = name;
  const maxW = w + 10;
  while (ctx.measureText(label).width > maxW && label.length > 3) label = label.slice(0, -2) + '…';
  ctx.fillText(label, x + w / 2, y + photoH + 30);
}

function drawSectionPanel(ctx: CanvasRenderingContext2D, y: number, h: number) {
  withShadow(ctx, 'rgba(10,40,55,0.10)', 20, 6, () => {
    roundRect(ctx, GRID_SIDE_PAD - 30, y, W - (GRID_SIDE_PAD - 30) * 2, h, 24);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
  });
}

export async function renderTeamCard(data: TeamCardData): Promise<HTMLCanvasElement> {
  const measureCanvas = document.createElement('canvas');
  const mctx = measureCanvas.getContext('2d')!;
  const titleLines = wrapTitle(mctx, data.campusName, W - 220, 56);

  const HEADER_TOP_PAD = 210;
  const HEADER_H = HEADER_TOP_PAD + titleLines.length * 62 + 98;
  // Head-of-campus card: top edge overlaps HEAD_TOP_OVERLAP px up into the
  // header (so it visually "pokes up" like the reference), then its photo
  // + name label + trailing gap occupy HEAD_CARD_SIZE + HEAD_LABEL_GAP px
  // of new body space. These same constants drive both this measure pass
  // and the actual draw below -- keep them in sync, since any drift either
  // strands blank space before the footer or overlaps it with the last
  // panel.
  const HEAD_CARD_SIZE = 240, HEAD_TOP_OVERLAP = 60, HEAD_LABEL_GAP = 84;
  const ambRows = data.ambassadors.length ? Math.ceil(data.ambassadors.length / PER_ROW) : 0;
  const graRows = data.graphics.length ? Math.ceil(data.graphics.length / PER_ROW) : 0;
  const CARD_PHOTO_H = 190, CARD_UNIT_H = CARD_PHOTO_H + 46 + CARD_GAP;
  const sectionPanelH = (rows: number) => 72 + rows * CARD_UNIT_H;
  const ambSectionH = ambRows ? sectionPanelH(ambRows) + 24 : 0;
  const graSectionH = graRows ? sectionPanelH(graRows) + 24 : 0;
  const FOOTER_H = 150;
  const headContribution = data.head ? HEAD_CARD_SIZE + HEAD_LABEL_GAP - HEAD_TOP_OVERLAP : 40;
  const H = HEADER_H + headContribution + ambSectionH + graSectionH + FOOTER_H;

  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  // Body background (textured light tint, drawn first so the header
  // overlays it cleanly)
  ctx.fillStyle = 'hsl(193, 45%, 95%)';
  ctx.fillRect(0, 0, W, H);
  drawDots(ctx, W - 160, H - 220, 5, 5, 24, 'rgba(10,60,80,0.05)');
  drawDots(ctx, 50, HEADER_H + 40, 4, 6, 24, 'rgba(10,60,80,0.05)');

  // Header
  const grad = ctx.createLinearGradient(0, 0, W, HEADER_H);
  grad.addColorStop(0, PRIMARY_DARK); grad.addColorStop(0.55, PRIMARY); grad.addColorStop(1, 'hsl(193, 70%, 28%)');
  ctx.fillStyle = grad; ctx.fillRect(0, 0, W, HEADER_H);

  // Soft diagonal ribbon + corner glow for depth
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(0, HEADER_H * 0.75); ctx.lineTo(W, HEADER_H * 0.35); ctx.lineTo(W, HEADER_H); ctx.lineTo(0, HEADER_H);
  ctx.closePath();
  ctx.fillStyle = 'rgba(255,255,255,0.045)';
  ctx.fill();
  ctx.restore();
  const glow = ctx.createRadialGradient(W - 40, 40, 10, W - 40, 40, 260);
  glow.addColorStop(0, 'rgba(255,255,255,0.14)'); glow.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = glow; ctx.fillRect(0, 0, W, HEADER_H);

  drawDots(ctx, 50, 170, 4, 3, 20, 'rgba(255,255,255,0.18)');
  drawStar(ctx, W - 180, 150, 8, 'rgba(255,255,255,0.3)');
  drawStar(ctx, W - 150, 185, 6, 'rgba(255,255,255,0.22)');
  drawX(ctx, W - 48, 170, 9, 'rgba(255,255,255,0.3)');
  drawX(ctx, W - 48, 198, 9, 'rgba(255,255,255,0.3)');

  // Two logo badges -- OTS (left) and this campus's own logo (right), both
  // on a white disc so transparent/white-bg logos stay legible on the dark
  // gradient header.
  async function drawLogoBadge(cx: number, cy: number, r: number, url: string) {
    withShadow(ctx, 'rgba(0,0,0,0.3)', 14, 4, () => {
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff'; ctx.fill();
    });
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.closePath();
    ctx.clip();
    const img = await loadAvatar(url);
    if (img) {
      const pad = r * 0.3;
      const scale = Math.min((r * 2 - pad) / img.width, (r * 2 - pad) / img.height);
      const dw = img.width * scale, dh = img.height * scale;
      ctx.drawImage(img, cx - dw / 2, cy - dh / 2, dw, dh);
    }
    ctx.restore();
    ctx.strokeStyle = GOLD; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
  }
  await drawLogoBadge(110, 90, 52, OTS_LOGO_URL);
  if (data.campusLogoUrl) await drawLogoBadge(W - 110, 90, 52, data.campusLogoUrl);

  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = '700 22px Arial, sans-serif';
  try { (ctx as any).letterSpacing = '4px'; } catch {}
  ctx.fillText('ONLINE TEXTILE SCHOOL', W / 2, 152);
  try { (ctx as any).letterSpacing = '0px'; } catch {}

  let ty = HEADER_TOP_PAD;
  ctx.fillStyle = '#ffffff';
  titleLines.forEach((line) => { ctx.font = '800 56px Arial, sans-serif'; ctx.fillText(line, W / 2, ty); ty += 62; });
  ctx.fillStyle = ACCENT;
  ctx.font = '800 38px Arial, sans-serif';
  ctx.fillText('CAMPUS AMBASSADOR TEAM', W / 2, ty + 14);

  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = '400 20px Arial, sans-serif';
  ctx.fillText('Representing Online Textile School', W / 2, ty + 54);

  let cursorY = HEADER_H;

  if (data.head) {
    const img = await loadAvatar(data.head.avatarUrl);
    const cardW = HEAD_CARD_SIZE, cardPhotoH = HEAD_CARD_SIZE;
    const cx = (W - cardW) / 2, cy = HEADER_H - HEAD_TOP_OVERLAP;
    // Gold halo ring behind the head card for prominence
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx + cardW / 2, cy + cardPhotoH / 2, cardW / 2 + 16, 0, Math.PI * 2);
    const haloGrad = ctx.createRadialGradient(cx + cardW / 2, cy + cardPhotoH / 2, cardW / 2 - 10, cx + cardW / 2, cy + cardPhotoH / 2, cardW / 2 + 16);
    haloGrad.addColorStop(0, 'rgba(230,180,40,0.35)'); haloGrad.addColorStop(1, 'rgba(230,180,40,0)');
    ctx.fillStyle = haloGrad; ctx.fill();
    ctx.restore();
    drawPersonCard(ctx, cx, cy, cardW, cardPhotoH, data.head.name, img, true);
    // Crown badge
    ctx.save();
    ctx.translate(cx + cardW / 2, cy - 14);
    ctx.fillStyle = GOLD;
    ctx.beginPath();
    ctx.moveTo(-22, 10); ctx.lineTo(-22, -6); ctx.lineTo(-10, 4); ctx.lineTo(0, -14); ctx.lineTo(10, 4); ctx.lineTo(22, -6); ctx.lineTo(22, 10);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.stroke();
    ctx.restore();
    ctx.font = '800 18px Arial, sans-serif';
    ctx.fillStyle = GOLD;
    ctx.fillText('HEAD OF CAMPUS AMBASSADOR', W / 2, cy + cardPhotoH + 62);
    cursorY = cy + cardPhotoH + HEAD_LABEL_GAP;
  } else {
    cursorY = HEADER_H + 40;
  }

  async function drawGrid(members: TeamMember[], label: string, startY: number): Promise<number> {
    if (!members.length) return startY;
    const rows = Math.ceil(members.length / PER_ROW);
    const panelH = sectionPanelH(rows);
    drawSectionPanel(ctx, startY, panelH);
    ctx.textAlign = 'left';
    ctx.font = '800 24px Arial, sans-serif';
    ctx.fillStyle = PRIMARY;
    ctx.fillText(label, GRID_SIDE_PAD, startY + 42);
    ctx.fillStyle = ACCENT;
    ctx.fillRect(GRID_SIDE_PAD, startY + 52, 50, 4);
    let y = startY + 76;
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
    return startY + panelH + 24;
  }

  cursorY = await drawGrid(data.ambassadors, 'AMBASSADORS', cursorY);
  cursorY = await drawGrid(data.graphics, 'GRAPHICS & OTHERS', cursorY);

  // Footer with diagonal accent corner
  const footerY = H - FOOTER_H;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(W, H); ctx.lineTo(W, H - 110); ctx.lineTo(W - 180, H);
  ctx.closePath();
  ctx.fillStyle = ACCENT;
  ctx.fill();
  ctx.restore();
  drawDots(ctx, 50, H - 60, 4, 2, 20, 'rgba(10,60,80,0.10)');

  const lineGrad = ctx.createLinearGradient(GRID_SIDE_PAD, 0, W - GRID_SIDE_PAD, 0);
  lineGrad.addColorStop(0, 'rgba(10,60,80,0)'); lineGrad.addColorStop(0.5, 'rgba(10,60,80,0.2)'); lineGrad.addColorStop(1, 'rgba(10,60,80,0)');
  ctx.strokeStyle = lineGrad; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(GRID_SIDE_PAD, footerY); ctx.lineTo(W - GRID_SIDE_PAD, footerY); ctx.stroke();

  ctx.textAlign = 'center';
  ctx.font = '700 24px Arial, sans-serif';
  ctx.fillStyle = PRIMARY_DARK;
  ctx.fillText('onlinetextileschool.com', W / 2, footerY + 50);

  if (data.sessionLabel) {
    const label = `SESSION: ${data.sessionLabel.toUpperCase()}`;
    ctx.font = '700 18px Arial, sans-serif';
    const tw = ctx.measureText(label).width;
    const pillW = tw + 48, pillX = W / 2 - pillW / 2;
    withShadow(ctx, 'rgba(10,40,55,0.12)', 10, 3, () => {
      ctx.fillStyle = '#ffffff';
      roundRect(ctx, pillX, footerY + 72, pillW, 42, 21);
      ctx.fill();
    });
    ctx.fillStyle = PRIMARY;
    ctx.fillText(label, W / 2, footerY + 98);
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
