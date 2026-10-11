import jsPDF from 'jspdf';

export interface LeaderboardRow {
  id: string;
  points: number;
  sub_role: string;
  profile?: { full_name?: string | null; avatar_url?: string | null } | null;
  campus?: { campus_name?: string | null } | null;
  session?: { label?: string | null } | null;
}

const SUB_ROLE_LABELS: Record<string, string> = {
  head_of_campus: 'Head of Campus',
  ambassador: 'Ambassador',
  graphics_team: 'Graphics Team',
};

const MEDAL_COLORS: [number, number, number][] = [
  [212, 160, 23],  // gold
  [148, 163, 184], // silver
  [180, 101, 42],  // bronze
];

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image: ' + src));
    img.src = src;
  });
}

// Renders a circular, center-cropped avatar (or a colored initial if the
// photo is missing/fails to load -- a dead photo URL must never break the
// whole PDF) to a PNG data URL, exactly the way idCardRenderer.ts already
// handles student photos for ID cards.
async function loadCircularAvatarDataUrl(src: string | null | undefined, fallbackInitial: string, size = 160): Promise<string> {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  if (src) {
    try {
      const img = await loadImage(src);
      ctx.save();
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      const side = Math.min(img.width, img.height);
      ctx.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, size, size);
      ctx.restore();
      return canvas.toDataURL('image/png');
    } catch {
      // fall through to the initial-letter fallback below
    }
  }

  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
  ctx.fillStyle = '#1e3a5f';
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${Math.round(size * 0.45)}px "Segoe UI", Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText((fallbackInitial || '?').toUpperCase(), size / 2, size / 2 + size * 0.03);
  return canvas.toDataURL('image/png');
}

async function loadLogoDataUrl(): Promise<string | null> {
  try {
    const img = await loadImage('/logo-512.png');
    const c = document.createElement('canvas');
    c.width = 200;
    c.height = 200;
    c.getContext('2d')!.drawImage(img, 0, 0, 200, 200);
    return c.toDataURL('image/png');
  } catch {
    return null;
  }
}

export async function downloadAmbassadorLeaderboardPdf(rows: LeaderboardRow[]) {
  const doc = new jsPDF();
  const pageW = 210, pageH = 297;
  const marginX = 14;
  const usableW = pageW - marginX * 2;
  const rowH = 20;
  const footerMargin = 14;

  const [logoDataUrl, avatars] = await Promise.all([
    loadLogoDataUrl(),
    Promise.all(rows.map((r) => loadCircularAvatarDataUrl(r.profile?.avatar_url, r.profile?.full_name?.[0] || '?'))),
  ]);

  const totalPoints = rows.reduce((s, r) => s + r.points, 0);

  const drawPageHeader = (isFirst: boolean): number => {
    if (isFirst) {
      if (logoDataUrl) doc.addImage(logoDataUrl, 'PNG', marginX, 9, 14, 14);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(17);
      doc.setTextColor(20, 20, 20);
      doc.text('Campus Ambassador Leaderboard', pageW / 2, 17, { align: 'center' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(110, 110, 110);
      doc.text(
        `Online Textile School  ·  Generated ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}  ·  ${rows.length} Ambassadors  ·  ${totalPoints} Total Points`,
        pageW / 2, 24, { align: 'center' }
      );
      doc.setDrawColor(210, 210, 210);
      doc.line(marginX, 29, pageW - marginX, 29);
      return 35;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(70, 70, 70);
    doc.text('Campus Ambassador Leaderboard', marginX, 14);
    doc.setDrawColor(210, 210, 210);
    doc.line(marginX, 18, pageW - marginX, 18);
    return 24;
  };

  let y = drawPageHeader(true);
  const bottomLimit = pageH - footerMargin;

  rows.forEach((r, idx) => {
    if (y + rowH > bottomLimit) {
      doc.addPage();
      y = drawPageHeader(false);
    }

    if (idx % 2 === 1) {
      doc.setFillColor(248, 249, 250);
      doc.rect(marginX, y, usableW, rowH, 'F');
    }

    const cx = marginX + 7, cy = y + rowH / 2;
    doc.setFont('helvetica', 'bold');
    if (idx < 3) {
      doc.setFillColor(...MEDAL_COLORS[idx]);
      doc.circle(cx, cy, 5, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(8);
    } else {
      doc.setTextColor(120, 120, 120);
      doc.setFontSize(9);
    }
    doc.text(`${idx + 1}`, cx, cy + 1.2, { align: 'center' });

    const avX = marginX + 16, avY = y + rowH / 2 - 6;
    doc.addImage(avatars[idx], 'PNG', avX, avY, 12, 12);
    doc.setDrawColor(222, 222, 222);
    doc.circle(avX + 6, avY + 6, 6, 'S');

    const textX = avX + 16;
    doc.setTextColor(20, 20, 20);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.text((r.profile?.full_name || 'Unknown').substring(0, 34), textX, y + 8);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(115, 115, 115);
    const metaParts = [SUB_ROLE_LABELS[r.sub_role] || r.sub_role, r.campus?.campus_name, r.session?.label].filter(Boolean);
    doc.text(metaParts.join('  ·  ').substring(0, 85), textX, y + 14);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(30, 58, 95);
    doc.text(String(r.points), pageW - marginX - 2, y + 9, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text('points', pageW - marginX - 2, y + 14, { align: 'right' });

    y += rowH;
  });

  const totalPages = doc.internal.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(150, 150, 150);
    doc.text(`Page ${p} of ${totalPages}`, pageW / 2, pageH - 8, { align: 'center' });
    doc.text('onlinetextileschool.com', pageW - marginX, pageH - 8, { align: 'right' });
  }

  doc.save(`ots-ambassador-leaderboard-${new Date().toISOString().slice(0, 10)}.pdf`);
}
