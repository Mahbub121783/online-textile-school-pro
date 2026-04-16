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
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onEsc);
      document.body.style.overflow = prevOverflow;
    };
  }, [layout, onClose]);

  const style: React.CSSProperties = {
    backgroundColor: background || undefined,
    color: textColor || undefined,
  };

  // 44x44px tap target for accessibility
  const closeBtn = (
    <button
      onClick={onClose}
      aria-label="Close popup"
      className="absolute top-2 right-2 sm:top-3 sm:right-3 inline-flex items-center justify-center w-11 h-11 rounded-full hover:bg-black/10 active:bg-black/20 transition-colors z-10 touch-manipulation"
      style={{ color: textColor || undefined }}
    >
      <X className="h-5 w-5" />
    </button>
  );

  let content: ReactNode;

  if (layout === 'top_banner' || layout === 'bottom_banner') {
    content = (
      <div
        className={cn(
          'fixed left-0 right-0 z-[10000] shadow-lg border-b',
          layout === 'top_banner'
            ? 'top-0 animate-in slide-in-from-top duration-400'
            : 'bottom-0 border-t border-b-0 animate-in slide-in-from-bottom duration-400 pb-[max(0.75rem,env(safe-area-inset-bottom))]',
        )}
        style={style}
      >
        <div className="container mx-auto px-4 py-3 pr-14 relative">
          {children}
          {closeBtn}
        </div>
      </div>
    );
  } else if (layout === 'fullscreen') {
    content = (
      <div className="fixed inset-0 z-[10000]" style={style}>
        <div className={cn('w-full h-full overflow-auto p-6 sm:p-8 pt-16', animClasses[animation] || animClasses.fade)}>
          {children}
        </div>
        {/* Fixed close button — always visible regardless of scroll */}
        <button
          onClick={onClose}
          aria-label="Close popup"
          className="fixed top-3 right-3 inline-flex items-center justify-center w-11 h-11 rounded-full bg-black/10 hover:bg-black/20 active:bg-black/30 backdrop-blur-sm transition-colors z-[10001] touch-manipulation"
          style={{ color: textColor || undefined }}
        >
          <X className="h-5 w-5" />
        </button>
      </div>
    );
  } else if (layout === 'slide_in_bottom_right' || layout === 'slide_in_bottom_left') {
    content = (
      <div
        className={cn(
          'fixed z-[10000] rounded-xl shadow-2xl border max-h-[85vh] overflow-y-auto',
          'bottom-4 left-4 right-4 sm:left-auto sm:right-auto',
          sizeClasses[size] || sizeClasses.md,
          layout === 'slide_in_bottom_right'
            ? 'sm:right-6 sm:bottom-6 sm:left-auto animate-in slide-in-from-right duration-400'
            : 'sm:left-6 sm:bottom-6 sm:right-auto animate-in slide-in-from-left duration-400',
        )}
        style={{
          ...style,
          paddingBottom: 'max(0px, env(safe-area-inset-bottom))',
        }}
      >
        <div className="p-5 sm:p-6 pr-12 relative">
          {children}
          {closeBtn}
        </div>
      </div>
    );
  } else {
    // center_modal default
    content = (
      <div
        className="fixed inset-0 z-[10000] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
        onClick={onClose}
      >
        <div
          className={cn(
            'relative w-full rounded-xl shadow-2xl border max-h-[90vh] overflow-y-auto',
            sizeClasses[size] || sizeClasses.md,
            animClasses[animation] || animClasses.fade,
          )}
          style={style}
          onClick={e => e.stopPropagation()}
        >
          <div className="p-5 sm:p-6 pr-12">{children}</div>
          {closeBtn}
        </div>
      </div>
    );
  }

  return createPortal(content, document.body);
}
