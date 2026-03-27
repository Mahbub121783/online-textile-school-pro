import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

export interface ContentBlock {
  id: string;
  type: 'text' | 'image' | 'video' | 'button' | 'columns' | 'spacer' | 'html';
  content?: string;
  url?: string;
  alt?: string;
  buttonText?: string;
  buttonUrl?: string;
  buttonVariant?: string;
  height?: number;
  columns?: ContentBlock[][];
  html?: string;
}

interface BlockRendererProps {
  blocks: ContentBlock[];
}

const RenderBlock = ({ block }: { block: ContentBlock }) => {
  switch (block.type) {
    case 'text':
      return (
        <div
          className="prose prose-lg dark:prose-invert max-w-none"
          dangerouslySetInnerHTML={{ __html: block.content || '' }}
        />
      );

    case 'image':
      return (
        <div className="my-4">
          <img
            src={block.url}
            alt={block.alt || ''}
            className="w-full rounded-lg"
            loading="lazy"
          />
          {block.alt && <p className="text-sm text-muted-foreground mt-2 text-center">{block.alt}</p>}
        </div>
      );

    case 'video': {
      const videoUrl = block.url || '';
      let embedUrl = videoUrl;
      if (videoUrl.includes('youtube.com/watch')) {
        const id = new URL(videoUrl).searchParams.get('v');
        embedUrl = `https://www.youtube.com/embed/${id}`;
      } else if (videoUrl.includes('youtu.be/')) {
        const id = videoUrl.split('youtu.be/')[1]?.split('?')[0];
        embedUrl = `https://www.youtube.com/embed/${id}`;
      } else if (videoUrl.includes('vimeo.com/')) {
        const id = videoUrl.split('vimeo.com/')[1]?.split('?')[0];
        embedUrl = `https://player.vimeo.com/video/${id}`;
      }
      return (
        <div className="my-4 aspect-video rounded-lg overflow-hidden">
          <iframe src={embedUrl} className="w-full h-full" allow="autoplay; fullscreen" allowFullScreen />
        </div>
      );
    }

    case 'button':
      return (
        <div className="my-4 flex justify-center">
          <Button asChild variant={block.buttonVariant === 'outline' ? 'outline' : 'default'} size="lg">
            <Link to={block.buttonUrl || '#'}>{block.buttonText || 'Click Here'}</Link>
          </Button>
        </div>
      );

    case 'columns':
      return (
        <div className={`grid gap-6 my-4 ${block.columns?.length === 3 ? 'grid-cols-1 md:grid-cols-3' : 'grid-cols-1 md:grid-cols-2'}`}>
          {block.columns?.map((col, i) => (
            <div key={i}>
              {col.map(b => <RenderBlock key={b.id} block={b} />)}
            </div>
          ))}
        </div>
      );

    case 'spacer':
      return <div style={{ height: block.height || 40 }} />;

    case 'html':
      return <div className="my-4" dangerouslySetInnerHTML={{ __html: block.html || '' }} />;

    default:
      return null;
  }
};

const BlockRenderer = ({ blocks }: BlockRendererProps) => {
  if (!blocks?.length) return null;
  return (
    <div className="space-y-6">
      {blocks.map((block) => (
        <RenderBlock key={block.id} block={block} />
      ))}
    </div>
  );
};

export default BlockRenderer;
