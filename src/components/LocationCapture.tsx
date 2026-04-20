import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { MapPin, Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

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

const LocationCapture = ({ onLocation, lastUpdated }: Props) => {
  const [loading, setLoading] = useState(false);

  const handleCapture = () => {
    if (!('geolocation' in navigator)) {
      toast({ title: 'Not supported', description: 'Geolocation is not supported by your browser.', variant: 'destructive' });
      return;
    }
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=10&addressdetails=1`,
            { headers: { 'Accept': 'application/json' } }
          );
          const data = await res.json();
          const addr = data?.address || {};
          const district = addr.state_district || addr.county || addr.city_district || addr.district || '';
          const upazila = addr.suburb || addr.town || addr.village || addr.municipality || addr.city || '';
          const country = addr.country || '';
          onLocation({ latitude, longitude, district, upazila, country });
          toast({ title: 'Location captured', description: `${upazila || ''}${upazila && district ? ', ' : ''}${district || ''}` });
        } catch {
          onLocation({ latitude, longitude });
          toast({ title: 'Location saved', description: 'Coordinates saved (address lookup failed).' });
        } finally {
          setLoading(false);
        }
      },
      (err) => {
        setLoading(false);
        toast({ title: 'Location denied', description: err.message, variant: 'destructive' });
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
