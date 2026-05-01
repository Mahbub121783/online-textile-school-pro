import { Link } from 'react-router-dom';
import { Folder } from 'lucide-react';
import type { VideoCategory } from '@/hooks/useClassVideos';

export default function CategoryCard({ category }: { category: VideoCategory }) {
  return (
    <Link
      to={`/class-videos/category/${category.slug}`}
      className="group relative block rounded-xl overflow-hidden border border-border bg-card hover:border-primary/40 hover:shadow-md transition-all"
    >
      <div className="relative aspect-[16/10] bg-muted">
        {category.cover_url ? (
          <img
            src={category.cover_url}
            alt={category.name}
            loading="lazy"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-accent/20">
            <Folder className="h-14 w-14 text-primary/60" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-3">
          <h3 className="text-white font-semibold text-base line-clamp-1">
            {category.icon ? <span className="mr-1.5">{category.icon}</span> : null}
            {category.name}
          </h3>
          {category.description ? (
            <p className="text-white/80 text-xs line-clamp-1 mt-0.5">{category.description}</p>
          ) : null}
        </div>
      </div>
    </Link>
  );
}
