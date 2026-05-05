import { useEffect, useRef, useState } from 'react';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import CommentThread from './CommentThread';

interface Props {
  videoId: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export default function CommentsSheet({ videoId, open, onOpenChange }: Props) {
  const [dragY, setDragY] = useState(0);
  const startY = useRef<number | null>(null);
  const startTime = useRef<number>(0);

  // Reset drag state when sheet (re)opens
  useEffect(() => {
    if (open) setDragY(0);
  }, [open, videoId]);

  const onPointerDown = (e: React.PointerEvent) => {
    startY.current = e.clientY;
    startTime.current = Date.now();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (startY.current == null) return;
    const dy = e.clientY - startY.current;
    if (dy > 0) setDragY(dy);
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (startY.current == null) return;
    const dy = e.clientY - startY.current;
    const dt = Math.max(1, Date.now() - startTime.current);
    const velocity = dy / dt;
    startY.current = null;
    if (dy > 100 || velocity > 0.6) {
      onOpenChange(false);
    } else {
      setDragY(0);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="h-[82vh] sm:h-[85vh] rounded-t-2xl p-0 sm:max-w-2xl sm:mx-auto flex flex-col gap-0 transition-transform"
        style={{ transform: dragY ? `translateY(${dragY}px)` : undefined }}
      >
        {/* Drag handle */}
        <div
          className="pt-2 pb-3 flex flex-col items-center cursor-grab active:cursor-grabbing touch-none select-none"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <div className="h-1.5 w-10 rounded-full bg-muted-foreground/30" />
          <SheetTitle className="sr-only">Comments</SheetTitle>
        </div>

        <div className="flex-1 min-h-0 px-4 sm:px-6 pb-4 sm:pb-6">
          {videoId ? (
            <CommentThread key={videoId} videoId={videoId} sticky />
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
