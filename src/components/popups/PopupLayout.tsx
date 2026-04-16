import { ReactNode, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PopupLayoutProps {
  layout: string;
  size: string;
  animation: string;
  background?: string | null;
  textColor?: string | null;
  onClose: () => void;
  children: ReactNode;
}

const sizeClasses: Record<string, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
};

const animClasses: Record<string, string> = {
  fade: 'animate-in fade-in duration-300',
  zoom: 'animate-in zoom-in-95 fade-in duration-300',
  slide: 'animate-in slide-in-from-bottom-8 fade-in duration-400',
  bounce: 'animate-in zoom-in-50 fade-in duration-500',
};

export function PopupLayout({ layout, size, animation, background, textColor, onClose, children }: PopupLayoutProps) {
  useEffect(() => {
    if (layout.includes('banner')) return;
    const onEsc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onEsc);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onEsc);
      document.body.style.overflow = '';
    };
  }, [layout, onClose]);

  const style: React.CSSProperties = {
    backgroundColor: background || undefined,
    color: textColor || undefined,
  };

  const closeBtn = (
    <button
      onClick={onClose}
      aria-label="Close"
      className="absolute top-3 right-3 p-1.5 rounded-full hover:bg-black/10 transition-colors z-10"
      style={{ color: textColor || undefined }}
    >
      <X className="h-4 w-4" />
    </button>
  );

  let content: ReactNode;

  if (layout === 'top_banner' || layout === 'bottom_banner') {
    content = (
      <div
        className={cn(
          'fixed left-0 right-0 z-[9999] shadow-lg border-b',
          layout === 'top_banner' ? 'top-0 animate-in slide-in-from-top duration-400' : 'bottom-0 border-t border-b-0 animate-in slide-in-from-bottom duration-400',
        )}
        style={style}
      >
        <div className="container mx-auto px-4 py-3 pr-12 relative">
          {children}
          {closeBtn}
        </div>
      </div>
    );
  } else if (layout === 'fullscreen') {
    content = (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center" style={style}>
        <div className={cn('w-full h-full overflow-auto p-8', animClasses[animation] || animClasses.fade)}>
          {children}
        </div>
        {closeBtn}
      </div>
    );
  } else if (layout === 'slide_in_bottom_right' || layout === 'slide_in_bottom_left') {
    content = (
      <div
        className={cn(
          'fixed z-[9999] bottom-6 rounded-xl shadow-2xl border w-[calc(100vw-2rem)]',
          sizeClasses[size] || sizeClasses.md,
          layout === 'slide_in_bottom_right' ? 'right-6 animate-in slide-in-from-right duration-400' : 'left-6 animate-in slide-in-from-left duration-400',
        )}
        style={style}
      >
        <div className="p-6 pr-10 relative">
          {children}
          {closeBtn}
        </div>
      </div>
    );
  } else {
    // center_modal default
    content = (
      <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={onClose}>
        <div
          className={cn('relative w-full rounded-xl shadow-2xl border', sizeClasses[size] || sizeClasses.md, animClasses[animation] || animClasses.fade)}
          style={style}
          onClick={e => e.stopPropagation()}
        >
          <div className="p-6 pr-10">{children}</div>
          {closeBtn}
        </div>
      </div>
    );
  }

  return createPortal(content, document.body);
}
