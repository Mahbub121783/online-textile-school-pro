import { Skeleton } from '@/components/ui/skeleton';

export default function CommentSkeleton() {
  return (
    <div className="flex gap-3">
      <Skeleton className="h-9 w-9 rounded-full shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="flex items-center gap-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-3 w-12" />
        </div>
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-3/4" />
        <div className="flex gap-2 pt-1">
          <Skeleton className="h-6 w-12 rounded-md" />
          <Skeleton className="h-6 w-14 rounded-md" />
        </div>
      </div>
    </div>
  );
}

export function CommentSkeletonList({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-5">
      {Array.from({ length: count }).map((_, i) => (
        <CommentSkeleton key={i} />
      ))}
    </div>
  );
}
