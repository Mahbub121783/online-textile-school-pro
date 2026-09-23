import jsPDF, { GState } from 'jspdf';
import QRCode from 'qrcode';
import { format } from 'date-fns';
import otsLogoUrl from '@/assets/OTS_LOGO.png';

export interface EnrollmentLetterCourse {
  title: string;
  enrolledAt: string;
}

export interface EnrollmentLetterData {
  studentName: string;
  rollId: string;
  department: string;
  academicYear: string;
  cardNumber: string;
  validFrom: string;
  validUntil: string;
  programMonths: number;
  courses: EnrollmentLetterCourse[];
}

export interface EnrollmentLetterSettings {
  university_name: string;
  location: string;
  authority_name: string;
  authority_position: string;
  signature_url: string;
  logo_url: string;
  seal_url: string;
}

export type EnrollmentLetterType = 'course' | 'general';

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image: ' + src));
    img.src = src;
  });
}

async function toPngDataUrl(src: string): Promise<string | null> {
  if (!src) return null;
  try {
    const img = await loadImage(src);
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0);
    return canvas.toDataURL('image/png');
  } catch {
    return null;
  }
}

// Fits `src` inside a maxW x maxH box, preserving aspect ratio, and returns
// the drawable width/height (jsPDF has no object-fit -- addImage stretches).
function fitBox(natW: number, natH: number, maxW: number, maxH: number) {
  const ratio = natW / natH;
  let w = maxW;
  let h = maxW / ratio;
  if (h > maxH) {
    h = maxH;
    w = maxH * ratio;
  }
  return { w, h };
}

export async function renderEnrollmentLetter(
  type: EnrollmentLetterType,
  data: EnrollmentLetterData,
  settings: EnrollmentLetterSettings
): Promise<jsPDF> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageW = 210;
  const marginX = 22;
  const contentW = pageW - marginX * 2;
  const now = new Date();
  const universityName = settings.university_name || 'Online Textile School';
  const location = settings.location || '';

  const [logoImg, sigImg, sealImg] = await Promise.all([
    toPngDataUrl(settings.logo_url || otsLogoUrl),
    toPngDataUrl(settings.signature_url),
    toPngDataUrl(settings.seal_url),
  ]);

  // ── Letterhead ──
  let y = 18;
  if (logoImg) {
    try {
      const props = doc.getImageProperties(logoImg);
      const { w, h } = fitBox(props.width, props.height, 20, 20);
      doc.addImage(logoImg, 'PNG', marginX, y - 4, w, h);
    } catch { /* skip */ }
  }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(19);
  doc.setTextColor(15, 37, 87);
  doc.text(universityName, marginX + 26, y + 2);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(90, 90, 90);
  if (location) doc.text(location, marginX + 26, y + 8);
  doc.text('www.onlinetextileschool.com', marginX + 26, y + 13);

  y += 20;
  doc.setDrawColor(13, 148, 136);
  doc.setLineWidth(1);
  doc.line(marginX, y, pageW - marginX, y);
  y += 10;

  // ── Ref / Date ──
  const refNo = `OTS/ENR/${data.rollId}/${format(now, 'yyyyMMdd')}`;
  doc.setFontSize(9.5);
  doc.setTextColor(60, 60, 60);
  doc.text(`Ref: ${refNo}`, marginX, y);
  doc.text(`Date: ${format(now, 'dd MMMM yyyy')}`, pageW - marginX, y, { align: 'right' });
  y += 12;

  // ── Title ──
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(15, 37, 87);
  const title = type === 'course' ? 'ENROLLMENT VERIFICATION LETTER' : 'STUDENT STATUS VERIFICATION LETTER';
  doc.text(title, pageW / 2, y, { align: 'center' });
  y += 12;

  // ── Salutation ──
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(30, 30, 30);
  doc.text('To Whom It May Concern,', marginX, y);
  y += 9;

  // ── Body ──
  doc.setFontSize(10.5);
  const durationLabel = data.programMonths >= 12
    ? `${(data.programMonths / 12).toFixed(data.programMonths % 12 === 0 ? 0 : 1)} year(s)`
    : `${data.programMonths} months`;

  const bodyText = type === 'course'
    ? `This is to formally certify that ${data.studentName} (Student Roll No. ${data.rollId}, Department of ${data.department}) is a bona fide, currently enrolled student of ${universityName}. The student is officially registered under Academic Year ${data.academicYear}, with a program duration of ${durationLabel}, and remains in active, good standing as of the date of issue of this letter.\n\nThe student's registered course(s) are listed below, along with the date enrollment began for each:`
    : `This is to formally certify that ${data.studentName} (Student Roll No. ${data.rollId}, Department of ${data.department}) is a registered and verified student of ${universityName}, currently in active, good standing as of the date of issue of this letter. The student's record is on file under Academic Year ${data.academicYear} and remains valid through ${format(new Date(data.validUntil), 'dd MMMM yyyy')}.`;

  const lines = doc.splitTextToSize(bodyText, contentW);
  doc.text(lines, marginX, y, { lineHeightFactor: 1.5 });
  y += lines.length * 5.3 + 4;

  // ── Course table (course letters only) ──
  if (type === 'course' && data.courses.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFillColor(240, 244, 248);
    doc.rect(marginX, y, contentW, 8, 'F');
    doc.setFontSize(9.5);
    doc.setTextColor(15, 37, 87);
    doc.text('Course', marginX + 3, y + 5.5);
    doc.text('Enrolled Since', pageW - marginX - 3, y + 5.5, { align: 'right' });
    y += 8;

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 30, 30);
    for (const c of data.courses) {
      if (y > 250) { doc.addPage(); y = 20; }
      const courseLines = doc.splitTextToSize(c.title, contentW - 45);
      doc.text(courseLines, marginX + 3, y + 5.5);
      doc.text(format(new Date(c.enrolledAt), 'dd MMM yyyy'), pageW - marginX - 3, y + 5.5, { align: 'right' });
      const rowH = Math.max(8, courseLines.length * 5);
      doc.setDrawColor(225, 229, 233);
      doc.line(marginX, y + rowH, pageW - marginX, y + rowH);
      y += rowH;
    }
    y += 8;
  }

  doc.setFontSize(10.5);
  doc.setTextColor(30, 30, 30);
  const closing = 'This letter has been issued at the express request of the student for the purpose of proof of enrollment / student status verification, and reflects the student\'s status as maintained in our official records as of the date shown above. Its authenticity can be independently confirmed at any time using the reference and QR code below.';
  const closingLines = doc.splitTextToSize(closing, contentW);
  if (y + closingLines.length * 5.3 > 250) { doc.addPage(); y = 20; }
  doc.text(closingLines, marginX, y, { lineHeightFactor: 1.5 });
  y += closingLines.length * 5.3 + 14;

  // ── Signature + Seal block ──
  if (y > 230) { doc.addPage(); y = 30; }
  const sigBlockX = pageW - marginX - 55;
  let sigTopY = y;

  if (sealImg) {
    try {
      const props = doc.getImageProperties(sealImg);
      const { w, h } = fitBox(props.width, props.height, 26, 26);
      doc.saveGraphicsState();
      doc.setGState(new GState({ opacity: 0.85 }));
      doc.addImage(sealImg, 'PNG', sigBlockX - 20, sigTopY - 2, w, h);
      doc.restoreGraphicsState();
    } catch { /* skip */ }
  }

  if (sigImg) {
    try {
      const props = doc.getImageProperties(sigImg);
      const { w, h } = fitBox(props.width, props.height, 42, 16);
      doc.addImage(sigImg, 'PNG', sigBlockX + (55 - w) / 2, sigTopY, w, h);
      sigTopY += h + 2;
    } catch { sigTopY += 16; }
  } else {
    sigTopY += 16;
  }

  doc.setDrawColor(140, 140, 140);
  doc.setLineWidth(0.3);
  doc.line(sigBlockX, sigTopY + 2, sigBlockX + 55, sigTopY + 2);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(30, 30, 30);
  doc.text(settings.authority_name || 'Authorized Signatory', sigBlockX + 27.5, sigTopY + 8, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(90, 90, 90);
  doc.text(settings.authority_position || universityName, sigBlockX + 27.5, sigTopY + 13, { align: 'center' });

  // ── QR verification ──
  try {
    const verifyUrl = `${window.location.origin}/verify-student?code=${encodeURIComponent(data.cardNumber)}`;
    const qrDataUrl = await QRCode.toDataURL(verifyUrl, { width: 200, margin: 1 });
    doc.addImage(qrDataUrl, 'PNG', marginX, y - 4, 24, 24);
    doc.setFontSize(7.5);
    doc.setTextColor(110, 110, 110);
    doc.text('Scan to verify authenticity', marginX + 12, y + 23, { align: 'center' });
    doc.text(`or visit ${window.location.host}/verify-student`, marginX + 12, y + 27, { align: 'center' });
  } catch { /* skip */ }

  // ── Footer ──
  const footerY = 280;
  doc.setDrawColor(225, 229, 233);
  doc.setLineWidth(0.2);
  doc.line(marginX, footerY - 6, pageW - marginX, footerY - 6);
  doc.setFontSize(7.5);
  doc.setTextColor(120, 120, 120);
  doc.text(
    `This is a digitally generated, system-verifiable document issued by ${universityName}. Reference: ${refNo}`,
    pageW / 2,
    footerY,
    { align: 'center' }
  );

  return doc;
}

export async function downloadEnrollmentLetter(
  type: EnrollmentLetterType,
  data: EnrollmentLetterData,
  settings: EnrollmentLetterSettings
): Promise<void> {
  const doc = await renderEnrollmentLetter(type, data, settings);
  const suffix = type === 'course' ? 'Enrollment-Verification' : 'Student-Status';
  doc.save(`OTS-${suffix}-${data.rollId}.pdf`);
}
