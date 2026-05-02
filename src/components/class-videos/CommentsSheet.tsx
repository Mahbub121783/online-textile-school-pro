import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import CommentThread from './CommentThread';

interface Props {
  videoId: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export default function CommentsSheet({ videoId, open, onOpenChange }: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="h-[80vh] sm:h-[85vh] overflow-y-auto rounded-t-2xl p-4 sm:p-6 sm:max-w-2xl sm:mx-auto"
      >
        <SheetHeader className="text-left mb-2">
          <SheetTitle>Comments</SheetTitle>
        </SheetHeader>
        {videoId && <CommentThread videoId={videoId} />}
      </SheetContent>
    </Sheet>
  );
}
