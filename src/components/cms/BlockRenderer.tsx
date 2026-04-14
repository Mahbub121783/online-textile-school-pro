import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { Info, AlertTriangle, CheckCircle, Quote } from 'lucide-react';

export interface ContentBlock {
  id: string;
  type: 'text' | 'image' | 'video' | 'button' | 'columns' | 'spacer' | 'html'
    | 'heading' | 'quote' | 'list' | 'table' | 'divider' | 'callout' | 'gallery' | 'code' | 'embed';
  content?: string;
  url?: string;
  alt?: string;
  buttonText?: string;
  buttonUrl?: string;
  buttonVariant?: string;
  height?: number;
  columns?: ContentBlock[][];
  html?: string;
  // New block fields
  headingLevel?: 2 | 3 | 4;
  citation?: string;
  listItems?: string[];
  listType?: 'ordered' | 'unordered';
  tableData?: { headers: string[]; rows: string[][] };
  calloutType?: 'info' | 'warning' | 'success';
  galleryUrls?: string[];
  codeLanguage?: string;
  embedUrl?: string;
}

interface BlockRendererProps {
  blocks: ContentBlock[];
}

const CalloutIcons = {
  info: Info,
  warning: AlertTriangle,
  success: CheckCircle,
};

const CalloutColors = {
  info: 'bg-blue-500/10 border-blue-500/30 text-blue-700 dark:text-blue-300',
  warning: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-700 dark:text-yellow-300',
  success: 'bg-green-500/10 border-green-500/30 text-green-700 dark:text-green-300',
};

const RenderBlock = ({ block }: { block: ContentBlock }) => {
  switch (block.type) {
    case 'text':
      return (
        <div
          className="prose prose-lg dark:prose-invert max-w-none"
          dangerouslySetInnerHTML={{ __html: block.content || '' }}
        />
      );

    case 'heading': {
      const Tag = `h${block.headingLevel || 2}` as 'h2' | 'h3' | 'h4';
      const sizes = { h2: 'text-3xl', h3: 'text-2xl', h4: 'text-xl' };
      return <Tag className={`${sizes[Tag]} font-heading font-bold text-foreground`}>{block.content || ''}</Tag>;
    }

    case 'image':
      return (
        <div className="my-4">
          <img src={block.url} alt={block.alt || ''} className="w-full rounded-lg" loading="lazy" />
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

    case 'quote':
      return (
        <blockquote className="my-6 border-l-4 border-primary pl-6 py-3 bg-muted/30 rounded-r-lg">
          <div className="flex gap-2 items-start">
            <Quote className="h-5 w-5 text-primary mt-1 shrink-0" />
            <div>
              <p className="text-lg italic text-foreground">{block.content || ''}</p>
              {block.citation && <cite className="text-sm text-muted-foreground mt-2 block not-italic">— {block.citation}</cite>}
            </div>
          </div>
        </blockquote>
      );

    case 'list': {
      const Tag = block.listType === 'ordered' ? 'ol' : 'ul';
      return (
        <Tag className={`my-4 pl-6 space-y-1 ${block.listType === 'ordered' ? 'list-decimal' : 'list-disc'} text-foreground`}>
          {(block.listItems || []).map((item, i) => <li key={i}>{item}</li>)}
        </Tag>
      );
    }

    case 'table': {
      const data = block.tableData;
      if (!data) return null;
      return (
        <div className="my-4 overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            {data.headers?.length > 0 && (
              <thead className="bg-muted/50">
                <tr>
                  {data.headers.map((h, i) => <th key={i} className="px-4 py-2 text-left font-semibold border-b">{h}</th>)}
                </tr>
              </thead>
            )}
            <tbody>
              {data.rows?.map((row, ri) => (
                <tr key={ri} className="border-b last:border-0 hover:bg-muted/20">
                  {row.map((cell, ci) => <td key={ci} className="px-4 py-2">{cell}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    case 'divider':
      return <hr className="my-8 border-border" />;

    case 'callout': {
      const cType = block.calloutType || 'info';
      const Icon = CalloutIcons[cType];
      return (
        <div className={`my-4 flex gap-3 items-start p-4 rounded-lg border ${CalloutColors[cType]}`}>
          <Icon className="h-5 w-5 mt-0.5 shrink-0" />
          <div className="text-sm" dangerouslySetInnerHTML={{ __html: block.content || '' }} />
        </div>
      );
    }

    case 'gallery':
      return (
        <div className="my-4 grid grid-cols-2 md:grid-cols-3 gap-3">
          {(block.galleryUrls || []).map((url, i) => (
            <img key={i} src={url} alt="" className="w-full aspect-square object-cover rounded-lg" loading="lazy" />
          ))}
        </div>
      );

    case 'code':
      return (
        <div className="my-4 rounded-lg overflow-hidden">
          {block.codeLanguage && (
            <div className="bg-muted px-4 py-1.5 text-xs font-mono text-muted-foreground border-b">{block.codeLanguage}</div>
          )}
          <pre className="bg-muted/50 p-4 overflow-x-auto text-sm font-mono text-foreground"><code>{block.content || ''}</code></pre>
        </div>
      );

    case 'embed': {
      const src = block.embedUrl || block.url || '';
      return (
        <div className="my-4 aspect-video rounded-lg overflow-hidden border">
          <iframe src={src} className="w-full h-full" allowFullScreen />
        </div>
      );
    }

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
