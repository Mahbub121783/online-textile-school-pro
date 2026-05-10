import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { MapPin, Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { BD_DISTRICTS } from '@/lib/constants';

interface LocationData {
  latitude: number;
  longitude: number;
  district?: string;
  upazila?: string;
  country?: string;
}

interface Props {
  onLocation: (data: LocationData) => void;
  lastUpdated?: string | null;
}

// Normalize a raw district string to match exactly one of BD_DISTRICTS
const normalizeDistrict = (raw?: string): string => {
  if (!raw) return '';
  const cleaned = raw
    .replace(/\b(district|zila|division|বিভাগ|জেলা)\b/gi, '')
    .replace(/[,]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return '';
  const match = BD_DISTRICTS.find(
    (d) => d.toLowerCase() === cleaned.toLowerCase()
  );
  if (match) return match;
  // partial — first BD district whose name appears in the cleaned string
  const partial = BD_DISTRICTS.find((d) =>
    cleaned.toLowerCase().includes(d.toLowerCase())
  );
  return partial || cleaned;
};

const reverseNominatim = async (lat: number, lon: number) => {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=14&addressdetails=1&accept-language=en`,
    { headers: { Accept: 'application/json' } }
  );
  if (!res.ok) throw new Error('Nominatim failed');
  const data = await res.json();
  const a = data?.address || {};
  const districtRaw =
    a.state_district || a.county || a.district || a.city_district || a.region || a.city || '';
  const upazila =
    a.subdistrict ||
    a.suburb ||
    a.town ||
    a.municipality ||
    a.village ||
    a.neighbourhood ||
    a.hamlet ||
    a.city_district ||
    '';
  return { district: districtRaw, upazila, country: a.country || '' };
};

const reverseBigDataCloud = async (lat: number, lon: number) => {
  const res = await fetch(
    `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`
  );
  if (!res.ok) throw new Error('BigDataCloud failed');
  const data = await res.json();
  const districtRaw =
    data?.principalSubdivision || data?.localityInfo?.administrative?.[2]?.name || '';
  const upazila = data?.city || data?.locality || data?.localityInfo?.administrative?.[3]?.name || '';
  return { district: districtRaw, upazila, country: data?.countryName || '' };
};

const LocationCapture = ({ onLocation, lastUpdated }: Props) => {
  const [loading, setLoading] = useState(false);

  const handleCapture = () => {
    if (!('geolocation' in navigator)) {
      toast({
        title: 'Not supported',
        description: 'Geolocation is not supported by your browser.',
        variant: 'destructive',
      });
      return;
    }
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        let district = '';
        let upazila = '';
        let country = '';

        try {
          const r = await reverseNominatim(latitude, longitude);
          district = r.district;
          upazila = r.upazila;
          country = r.country;
        } catch {
          // primary failed — fall through to fallback
        }

        // Fallback if no usable district yet
        if (!district || !normalizeDistrict(district)) {
          try {
            const r2 = await reverseBigDataCloud(latitude, longitude);
            district = district || r2.district;
            upazila = upazila || r2.upazila;
            country = country || r2.country;
          } catch {
            /* ignore */
          }
        }

        const normalizedDistrict = normalizeDistrict(district);
        const finalUpazila = (upazila || '').trim();

        onLocation({
          latitude,
          longitude,
          district: normalizedDistrict,
          upazila: finalUpazila,
          country,
        });

        if (normalizedDistrict || finalUpazila) {
          toast({
            title: 'Location captured',
            description: [finalUpazila, normalizedDistrict].filter(Boolean).join(', '),
          });
        } else {
          toast({
            title: 'Location saved',
            description: 'Coordinates saved, but address lookup returned no district. Please pick manually.',
          });
        }
        setLoading(false);
      },
      (err) => {
        setLoading(false);
        toast({
          title: 'Location denied',
          description: `${err.message}. Please allow location access and try again.`,
          variant: 'destructive',
        });
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
    );
  };

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <Button type="button" variant="outline" size="sm" onClick={handleCapture} disabled={loading} className="gap-2">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
        {loading ? 'Detecting…' : 'Use my current location'}
      </Button>
      {lastUpdated && (
        <span className="text-xs text-muted-foreground">
          Updated {new Date(lastUpdated).toLocaleDateString()}
        </span>
      )}
    </div>
  );
};

export default LocationCapture;
