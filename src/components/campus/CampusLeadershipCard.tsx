import { Card, CardContent } from '@/components/ui/card';
import { Mail, Phone, UserRound } from 'lucide-react';

interface CampusLeadershipCardProps {
  name?: string | null;
  designation?: string | null;
  photoUrl?: string | null;
  phone?: string | null;
  email?: string | null;
}

/**
 * Principal / VC leadership block, shown on both public campus pages
 * (CampusOnboardDetail and CampusPortfolio). Renders nothing if no
 * leadership info has been filled in yet.
 */
const CampusLeadershipCard = ({ name, designation, photoUrl, phone, email }: CampusLeadershipCardProps) => {
  if (!name) return null;

  return (
    <Card>
      <CardContent className="pt-6">
        <h3 className="font-heading font-bold mb-3">Leadership</h3>
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full overflow-hidden bg-muted/30 border shrink-0 flex items-center justify-center">
            {photoUrl ? <img src={photoUrl} alt={name} className="w-full h-full object-cover" /> : <UserRound className="h-7 w-7 text-muted-foreground" />}
          </div>
          <div className="min-w-0">
            <p className="font-semibold truncate">{name}</p>
            {designation && <p className="text-sm text-muted-foreground truncate">{designation}</p>}
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5">
              {phone && <a href={`tel:${phone}`} className="flex items-center gap-1.5 text-xs text-primary hover:underline"><Phone className="h-3 w-3" /> {phone}</a>}
              {email && <a href={`mailto:${email}`} className="flex items-center gap-1.5 text-xs text-primary hover:underline"><Mail className="h-3 w-3" /> {email}</a>}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default CampusLeadershipCard;
