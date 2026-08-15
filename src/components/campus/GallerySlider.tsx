import { Carousel, CarouselContent, CarouselItem, CarouselPrevious, CarouselNext } from '@/components/ui/carousel';
import { Trash2 } from 'lucide-react';

interface GalleryImage {
  id: string;
  image_url: string;
  caption?: string | null;
}

interface GallerySliderProps {
  images: GalleryImage[];
  /** Pass to show a delete button on every tile (admin / campus owner views). */
  onDelete?: (id: string) => void;
  deletingId?: string | null;
}

/**
 * Campus gallery as a slider -- roughly 4 photos visible per view on desktop
 * (fewer on smaller screens), bigger tiles than the old dense 3/4-column
 * static grid. Built on the existing embla-carousel wrapper
 * (src/components/ui/carousel.tsx), which was already installed but unused
 * anywhere in the app.
 */
const GallerySlider = ({ images, onDelete, deletingId }: GallerySliderProps) => {
  if (images.length === 0) return null;

  return (
    <Carousel opts={{ align: 'start', loop: images.length > 4 }} className="w-full px-8 sm:px-10">
      <CarouselContent>
        {images.map((g) => (
          <CarouselItem key={g.id} className="basis-1/2 sm:basis-1/3 lg:basis-1/4">
            <div className="group relative aspect-[4/3] rounded-xl overflow-hidden border bg-muted/30">
              <img src={g.image_url} alt={g.caption || ''} className="w-full h-full object-cover" loading="lazy" />
              {g.caption && (
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2 py-1.5">
                  <p className="text-white text-xs truncate">{g.caption}</p>
                </div>
              )}
              {onDelete && (
                <button
                  type="button"
                  onClick={() => onDelete(g.id)}
                  disabled={deletingId === g.id}
                  className="absolute top-2 right-2 bg-black/60 hover:bg-destructive text-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-100"
                  aria-label="Remove photo"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </CarouselItem>
        ))}
      </CarouselContent>
      <CarouselPrevious />
      <CarouselNext />
    </Carousel>
  );
};

export default GallerySlider;
