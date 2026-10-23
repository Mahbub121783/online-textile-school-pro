export const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] as const;

// Mirrors blood_donation_gap_days() in db/97-blood-bank.sql.
export const DONATION_GAP_DAYS = 120;

// Mirrors blood_compatible_donor_groups(): donor groups a recipient can receive.
export const COMPATIBLE_DONORS: Record<string, string[]> = {
  'O-': ['O-'],
  'O+': ['O+', 'O-'],
  'A-': ['A-', 'O-'],
  'A+': ['A+', 'A-', 'O+', 'O-'],
  'B-': ['B-', 'O-'],
  'B+': ['B+', 'B-', 'O+', 'O-'],
  'AB-': ['AB-', 'A-', 'B-', 'O-'],
  'AB+': ['AB+', 'AB-', 'A+', 'A-', 'B+', 'B-', 'O+', 'O-'],
};

export const URGENCY_META: Record<string, { label: string; className: string }> = {
  critical: { label: 'Critical', className: 'bg-red-600 text-white hover:bg-red-600' },
  urgent: { label: 'Urgent', className: 'bg-amber-500 text-white hover:bg-amber-500' },
  normal: { label: 'Normal', className: 'bg-slate-500 text-white hover:bg-slate-500' },
};

export const REQUEST_STATUS_META: Record<string, { label: string; className: string }> = {
  pending: { label: 'Awaiting review', className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' },
  approved: { label: 'Live', className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
  rejected: { label: 'Rejected', className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
  fulfilled: { label: 'Fulfilled', className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400' },
  cancelled: { label: 'Cancelled', className: 'bg-muted text-muted-foreground' },
  expired: { label: 'Expired', className: 'bg-muted text-muted-foreground' },
};

export const DONOR_STATUS_META: Record<string, { label: string; className: string }> = {
  pending: { label: 'Pending verification', className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' },
  approved: { label: 'Verified donor', className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
  rejected: { label: 'Not approved', className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
  suspended: { label: 'Suspended', className: 'bg-muted text-muted-foreground' },
};

export function getCurrentPosition(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('Location is not supported by this browser'));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      (e) => reject(new Error(e.code === e.PERMISSION_DENIED ? 'Location permission was denied' : 'Could not get your location')),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
    );
  });
}

export async function locationPermissionGranted(): Promise<boolean> {
  try {
    const status = await navigator.permissions?.query({ name: 'geolocation' as PermissionName });
    return status?.state === 'granted';
  } catch {
    return false;
  }
}

export function formatDistance(km: number | null | undefined): string {
  if (km == null) return 'Distance unknown';
  if (km < 1) return `${Math.max(50, Math.round(km * 1000 / 50) * 50)} m away`;
  return `${km < 10 ? km.toFixed(1) : Math.round(km)} km away`;
}

export function directionsUrl(lat: number, lng: number) {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}

export function mapEmbedUrl(lat: number, lng: number, spanDeg = 0.02) {
  const bbox = [lng - spanDeg, lat - spanDeg, lng + spanDeg, lat + spanDeg].join(',');
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lng}`;
}

export function nextEligibleDate(lastDonation: string | null | undefined): Date | null {
  if (!lastDonation) return null;
  const d = new Date(lastDonation);
  d.setDate(d.getDate() + DONATION_GAP_DAYS);
  return d > new Date() ? d : null;
}

export interface PlaceResult { label: string; lat: number; lng: number; district: string | null }

// OpenStreetMap Nominatim place search, limited to Bangladesh -- lets a
// requester type a hospital name and get real coordinates for distance
// matching without needing a paid maps API key.
export async function searchPlaces(query: string): Promise<PlaceResult[]> {
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&countrycodes=bd&limit=6&q=${encodeURIComponent(query)}`;
  const res = await fetch(url, { headers: { 'Accept-Language': 'en' } });
  if (!res.ok) return [];
  const rows = await res.json();
  return (rows || []).map((r: any) => ({
    label: r.display_name,
    lat: parseFloat(r.lat),
    lng: parseFloat(r.lon),
    district: r.address?.state_district?.replace(/ District$/i, '') || r.address?.county?.replace(/ District$/i, '') || r.address?.city || null,
  }));
}

export function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const esc = (v: unknown) => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.join(','), ...rows.map((r) => headers.map((h) => esc(r[h])).join(','))].join('\n');
}

export function downloadText(filename: string, content: string, mime = 'text/csv') {
  const blob = new Blob(['﻿' + content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
