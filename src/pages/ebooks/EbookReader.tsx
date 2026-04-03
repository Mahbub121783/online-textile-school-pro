import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Progress } from '@/components/ui/progress';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  ArrowLeft, ChevronLeft, ChevronRight, Sun, Moon, BookOpen,
  Minus, Plus, StickyNote, X, Loader2, Type, Lightbulb, List, Scroll
} from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';

// Use local worker bundled by Vite — no CDN dependency
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

type ReadingMode = 'light' | 'dark' | 'sepia';
type ViewMode = 'page' | 'scroll';

interface NoteItem {
  id: string;
  page: number;
  text: string;
  createdAt: string;
}

const EbookReader = () => {
  const { ebookId } = useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const pdfDocRef = useRef<any>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  const [loadingState, setLoadingState] = useState<'auth' | 'loading' | 'ready' | 'error'>('auth');
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const [ebookTitle, setEbookTitle] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [readingMode, setReadingMode] = useState<ReadingMode>('light');
  const [viewMode, setViewMode] = useState<ViewMode>('page');
  const [fontSize, setFontSize] = useState(16);
  const [brightness, setBrightness] = useState(100);
  const [showControls, setShowControls] = useState(true);
  const [showNotes, setShowNotes] = useState(false);
  const [showTOC, setShowTOC] = useState(false);
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [newNote, setNewNote] = useState('');
  const [pageInput, setPageInput] = useState('');
  const [rendering, setRendering] = useState(false);
  const [pageTransition, setPageTransition] = useState(false);
  const [tocItems, setTocItems] = useState<{ title: string; pageNum: number }[]>([]);
  const [fileFormat, setFileFormat] = useState<string>('pdf');

  // DRM: block right-click, printing, text selection
  useEffect(() => {
    const blockCtxMenu = (e: MouseEvent) => e.preventDefault();
    const blockKeys = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'p' || e.key === 's' || e.key === 'P' || e.key === 'S')) {
        e.preventDefault();
      }
    };
    document.addEventListener('contextmenu', blockCtxMenu);
    document.addEventListener('keydown', blockKeys);
    return () => {
      document.removeEventListener('contextmenu', blockCtxMenu);
      document.removeEventListener('keydown', blockKeys);
    };
  }, []);

  // Load PDF via GET-based streaming with reusable token
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate('/auth/login?redirect=/read/' + ebookId);
      return;
    }
    setLoadingState('loading');
    setLoadingProgress(5);
    loadPdf();
  }, [user, authLoading, ebookId]);

  const loadPdf = async () => {
    try {
      // Step 1: Generate a reusable access token
      setLoadingProgress(10);
      const { data: tokenData, error: tokenError } = await supabase.functions.invoke(
        'ebook-secure-access',
        { body: { action: 'generate_token', ebook_id: ebookId } }
      );
      if (tokenError || tokenData?.error) {
        throw new Error(tokenData?.error || tokenError?.message || 'Token generation failed');
      }

      // Check format from token response
      const format = (tokenData.file_format || 'pdf').toLowerCase();
      setFileFormat(format);

      if (format !== 'pdf') {
        setLoadingState('error');
        setErrorMsg(`This ebook is in "${format.toUpperCase()}" format. Currently only PDF ebooks can be read in the browser. Please download the file instead.`);
        return;
      }

      setEbookTitle(tokenData.title || 'eBook');
      setLoadingProgress(20);

      // Step 2: Use GET-based URL for PDF.js range loading
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const session = (await supabase.auth.getSession()).data.session;

      const streamUrl = `${supabaseUrl}/functions/v1/ebook-secure-access?action=stream&ebook_id=${ebookId}&token=${tokenData.token}`;

      setLoadingProgress(30);

      // PDF.js opens the URL directly with auth headers, enabling range requests
      const loadingTask = pdfjsLib.getDocument({
        url: streamUrl,
        httpHeaders: {
          'Authorization': `Bearer ${session?.access_token}`,
          'apikey': supabaseKey,
        },
        rangeChunkSize: 65536, // 64KB chunks for fast first-page render
        disableAutoFetch: false,
        disableStream: false,
      });

      loadingTask.onProgress = (progress: { loaded: number; total: number }) => {
        if (progress.total > 0) {
          const pct = Math.min(90, 30 + Math.round((progress.loaded / progress.total) * 60));
          setLoadingProgress(pct);
        }
      };

      const pdf = await loadingTask.promise;
      setLoadingProgress(95);
      await initPdf(pdf);
    } catch (err: any) {
      console.error('EbookReader load error:', err);
      setLoadingState('error');
      setErrorMsg(err.message || 'Failed to load ebook');
    }
  };

  const initPdf = async (pdf: any) => {
    try {
      pdfDocRef.current = pdf;
      setTotalPages(pdf.numPages);

      // Extract TOC / outline
      try {
        const outline = await pdf.getOutline();
        if (outline?.length) {
          const items: { title: string; pageNum: number }[] = [];
          for (const item of outline.slice(0, 50)) {
            try {
              const dest = item.dest;
              if (typeof dest === 'string') {
                const resolvedDest = await pdf.getDestination(dest);
                if (resolvedDest) {
                  const pageIdx = await pdf.getPageIndex(resolvedDest[0]);
                  items.push({ title: item.title, pageNum: pageIdx + 1 });
                }
              } else if (Array.isArray(dest)) {
                const pageIdx = await pdf.getPageIndex(dest[0]);
                items.push({ title: item.title, pageNum: pageIdx + 1 });
              }
            } catch { /* skip unresolvable entries */ }
          }
          setTocItems(items);
        }
      } catch { /* no outline */ }

      // Load saved progress
      const { data: progress } = await supabase
        .from('ebook_reading_progress')
        .select('*')
        .eq('ebook_id', ebookId!)
        .eq('user_id', user!.id)
        .maybeSingle();

      const startPage = progress?.current_page || 1;
      setCurrentPage(startPage);
      setReadingMode((progress?.reading_mode as ReadingMode) || 'light');
      setFontSize(progress?.font_size || 16);
      setBrightness(progress?.brightness || 100);
      setNotes((progress?.notes as unknown as NoteItem[]) || []);

      if (!progress) {
        await supabase.from('ebook_reading_progress').insert({
          ebook_id: ebookId!,
          user_id: user!.id,
          total_pages: pdf.numPages,
          current_page: 1,
        });
      }

      setLoadingProgress(100);
      setLoadingState('ready');
      renderPage(startPage, pdf);
    } catch (err: any) {
      setLoadingState('error');
      setErrorMsg('Failed to render PDF: ' + (err.message || ''));
    }
  };

  const renderPage = useCallback(async (pageNum: number, pdf?: any) => {
    const doc = pdf || pdfDocRef.current;
    if (!doc || !canvasRef.current || rendering) return;

    setRendering(true);
    try {
      const page = await doc.getPage(pageNum);
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d')!;

      const container = containerRef.current;
      const containerWidth = container?.clientWidth || window.innerWidth;
      const containerHeight = container?.clientHeight || window.innerHeight;

      const viewport = page.getViewport({ scale: 1 });
      const scaleW = (containerWidth - 20) / viewport.width;
      const scaleH = (containerHeight - 20) / viewport.height;
      const scale = Math.min(scaleW, scaleH) * (fontSize / 16);

      const scaledViewport = page.getViewport({ scale });
      canvas.width = scaledViewport.width;
      canvas.height = scaledViewport.height;

      await page.render({ canvasContext: ctx, viewport: scaledViewport }).promise;
    } catch (err) {
      console.error('Render error:', err);
    } finally {
      setRendering(false);
    }
  }, [rendering, fontSize]);

  // ResizeObserver for responsive re-render
  useEffect(() => {
    if (loadingState !== 'ready' || !containerRef.current) return;

    resizeObserverRef.current = new ResizeObserver(() => {
      renderPage(currentPage);
    });
    resizeObserverRef.current.observe(containerRef.current);

    return () => {
      resizeObserverRef.current?.disconnect();
    };
  }, [loadingState]);

  // Re-render on page/fontSize change
  useEffect(() => {
    if (loadingState === 'ready') {
      renderPage(currentPage);
    }
  }, [currentPage, fontSize, loadingState]);

  // Debounced save progress
  const saveProgress = useCallback(() => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(async () => {
      if (!user || !ebookId || !totalPages) return;
      const progressPct = totalPages > 0 ? Math.round((currentPage / totalPages) * 100) : 0;
      await supabase
        .from('ebook_reading_progress')
        .upsert({
          user_id: user.id,
          ebook_id: ebookId,
          current_page: currentPage,
          total_pages: totalPages,
          progress_pct: progressPct,
          reading_mode: readingMode,
          font_size: fontSize,
          brightness,
          notes: notes as unknown as any,
          updated_at: new Date().toISOString(),
        } as any, { onConflict: 'user_id,ebook_id' });
    }, 800);
  }, [currentPage, totalPages, readingMode, fontSize, brightness, notes, user, ebookId]);

  useEffect(() => { saveProgress(); }, [currentPage, readingMode, fontSize, brightness, notes]);

  // Keyboard navigation
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); goNext(); }
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); goPrev(); }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [currentPage, totalPages]);

  // Touch/swipe navigation
  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY, time: Date.now() };
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const touch = e.changedTouches[0];
    const dx = touch.clientX - touchStartRef.current.x;
    const dy = touch.clientY - touchStartRef.current.y;
    const dt = Date.now() - touchStartRef.current.time;
    touchStartRef.current = null;
    if (Math.abs(dx) > 50 && Math.abs(dy) < 100 && dt < 500) {
      if (dx < 0) goNext(); else goPrev();
    }
  };

  const changePage = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages || newPage === currentPage) return;
    setPageTransition(true);
    setTimeout(() => {
      setCurrentPage(newPage);
      setTimeout(() => setPageTransition(false), 200);
    }, 150);
  };

  const goNext = () => { if (currentPage < totalPages) changePage(currentPage + 1); };
  const goPrev = () => { if (currentPage > 1) changePage(currentPage - 1); };
  const goToPage = () => {
    const p = parseInt(pageInput);
    if (p >= 1 && p <= totalPages) { changePage(p); setPageInput(''); }
  };

  const addNote = () => {
    if (!newNote.trim()) return;
    setNotes((prev) => [
      ...prev,
      { id: crypto.randomUUID(), page: currentPage, text: newNote.trim(), createdAt: new Date().toISOString() },
    ]);
    setNewNote('');
  };

  const deleteNote = (id: string) => { setNotes((prev) => prev.filter((n) => n.id !== id)); };

  const progressPct = totalPages > 0 ? Math.round((currentPage / totalPages) * 100) : 0;

  const modeStyles: Record<ReadingMode, string> = {
    light: 'bg-white text-foreground',
    dark: 'bg-[#1a1a2e] text-gray-100',
    sepia: 'bg-[#f4ecd8] text-[#5b4636]',
  };

  const controlBg: Record<ReadingMode, string> = {
    light: 'bg-background/95 border-border',
    dark: 'bg-[#16213e]/95 border-[#334155]',
    sepia: 'bg-[#e8dcc8]/95 border-[#c4a882]',
  };

  const currentPageNotes = useMemo(() => notes.filter((n) => n.page === currentPage), [notes, currentPage]);

  if (loadingState === 'auth' || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (loadingState === 'error') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4 px-4">
        <BookOpen className="h-16 w-16 text-muted-foreground" />
        <h2 className="font-heading text-xl font-bold text-center">Unable to load eBook</h2>
        <p className="text-muted-foreground text-sm max-w-md text-center">{errorMsg}</p>
        <Button onClick={() => navigate(-1)} variant="outline">
          <ArrowLeft className="h-4 w-4 mr-2" /> Go Back
        </Button>
      </div>
    );
  }

  if (loadingState === 'loading') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-3 px-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-muted-foreground font-medium animate-pulse text-center">Loading your eBook securely...</p>
        <div className="w-48">
          <Progress value={loadingProgress} className="h-2" />
          <p className="text-xs text-muted-foreground text-center mt-1">{loadingProgress}%</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`min-h-screen flex flex-col select-none ${modeStyles[readingMode]} transition-colors duration-300`}
      style={{ filter: `brightness(${brightness}%)` }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <style>{`@media print { body * { display: none !important; } }`}</style>

      {/* Top bar */}
      {showControls && (
        <header className={`sticky top-0 z-50 border-b px-2 sm:px-3 py-2 flex items-center gap-1 sm:gap-2 backdrop-blur-md transition-all ${controlBg[readingMode]}`}>
          <Button size="icon" variant="ghost" onClick={() => navigate(-1)} className="shrink-0 h-8 w-8">
            <ArrowLeft className="h-4 w-4" />
          </Button>

          <h1 className="font-heading font-bold text-xs sm:text-sm truncate flex-1 min-w-0">{ebookTitle}</h1>

          {/* Mode toggles */}
          <div className="flex items-center gap-0.5 border rounded-lg px-0.5 py-0.5">
            {([
              { mode: 'light' as const, icon: <Sun className="h-3 w-3 sm:h-3.5 sm:w-3.5" /> },
              { mode: 'dark' as const, icon: <Moon className="h-3 w-3 sm:h-3.5 sm:w-3.5" /> },
              { mode: 'sepia' as const, icon: <span className="text-[10px] font-bold">S</span> },
            ]).map(({ mode, icon }) => (
              <button
                key={mode}
                onClick={() => setReadingMode(mode)}
                className={`p-1 sm:p-1.5 rounded text-xs ${readingMode === mode ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
              >
                {icon}
              </button>
            ))}
          </div>

          {/* Font size - hidden on very small screens */}
          <div className="hidden sm:flex items-center gap-0.5">
            <button onClick={() => setFontSize((s) => Math.max(10, s - 2))} className="p-1 hover:bg-muted rounded">
              <Minus className="h-3.5 w-3.5" />
            </button>
            <Type className="h-3.5 w-3.5" />
            <span className="text-xs w-6 text-center">{fontSize}</span>
            <button onClick={() => setFontSize((s) => Math.min(32, s + 2))} className="p-1 hover:bg-muted rounded">
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Brightness - hidden on mobile */}
          <div className="hidden lg:flex items-center gap-1.5 min-w-[100px]">
            <Lightbulb className="h-3.5 w-3.5 shrink-0" />
            <Slider value={[brightness]} min={50} max={120} step={5} onValueChange={([v]) => setBrightness(v)} className="flex-1" />
          </div>

          {/* TOC button */}
          {tocItems.length > 0 && (
            <Button size="icon" variant="ghost" onClick={() => setShowTOC(true)} className="shrink-0 h-8 w-8">
              <List className="h-4 w-4" />
            </Button>
          )}

          {/* Notes toggle */}
          <Button size="icon" variant={showNotes ? 'default' : 'ghost'} onClick={() => setShowNotes(!showNotes)} className="shrink-0 h-8 w-8">
            <StickyNote className="h-4 w-4" />
          </Button>
        </header>
      )}

      {/* Main reading area */}
      <div className="flex-1 flex overflow-hidden">
        <div
          ref={containerRef}
          className="flex-1 flex items-center justify-center overflow-auto p-2 sm:p-4 cursor-pointer"
          onClick={() => setShowControls((s) => !s)}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <canvas
            ref={canvasRef}
            className={`max-w-full max-h-full shadow-2xl rounded-sm transition-opacity duration-200 ${pageTransition ? 'opacity-0' : 'opacity-100'}`}
            style={{ userSelect: 'none', pointerEvents: 'none' }}
          />
        </div>
      </div>

      {/* Notes panel - Sheet on mobile, sidebar on desktop */}
      <Sheet open={showNotes} onOpenChange={setShowNotes}>
        <SheetContent side="right" className="w-[85vw] sm:w-80 p-0">
          <SheetHeader className="p-4 border-b">
            <SheetTitle className="text-sm">Notes — Page {currentPage}</SheetTitle>
          </SheetHeader>
          <ScrollArea className="flex-1 h-[calc(100vh-140px)]">
            <div className="p-4 space-y-2">
              {currentPageNotes.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">No notes on this page.</p>
              )}
              {currentPageNotes.map((note) => (
                <div key={note.id} className="p-2 rounded-lg bg-muted/50 text-xs group relative">
                  <p>{note.text}</p>
                  <button onClick={() => deleteNote(note.id)} className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          </ScrollArea>
          <div className="p-3 border-t flex gap-2">
            <input
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addNote()}
              placeholder="Add a note..."
              className="flex-1 text-xs bg-transparent border rounded px-2 py-1.5 outline-none focus:border-primary"
            />
            <Button size="sm" onClick={addNote} disabled={!newNote.trim()}>Add</Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* TOC Sheet */}
      <Sheet open={showTOC} onOpenChange={setShowTOC}>
        <SheetContent side="left" className="w-[85vw] sm:w-80 p-0">
          <SheetHeader className="p-4 border-b">
            <SheetTitle className="text-sm">Table of Contents</SheetTitle>
          </SheetHeader>
          <ScrollArea className="h-[calc(100vh-80px)]">
            <div className="p-2">
              {tocItems.map((item, i) => (
                <button
                  key={i}
                  onClick={() => { changePage(item.pageNum); setShowTOC(false); }}
                  className={`w-full text-left px-3 py-2.5 rounded-lg text-sm hover:bg-muted transition-colors ${currentPage === item.pageNum ? 'bg-primary/10 text-primary font-medium' : ''}`}
                >
                  <span className="truncate block">{item.title}</span>
                  <span className="text-[10px] text-muted-foreground">Page {item.pageNum}</span>
                </button>
              ))}
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>

      {/* Bottom navigation bar */}
      {showControls && (
        <footer className={`border-t px-2 sm:px-3 py-2 backdrop-blur-md ${controlBg[readingMode]}`}>
          <Progress value={progressPct} className="h-1.5 mb-2" />
          <div className="flex items-center justify-between gap-1 sm:gap-2">
            <Button size="sm" variant="ghost" onClick={goPrev} disabled={currentPage <= 1} className="px-2 sm:px-3">
              <ChevronLeft className="h-4 w-4" />
              <span className="hidden sm:inline ml-1">Prev</span>
            </Button>

            <div className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm">
              <span className="text-muted-foreground hidden sm:inline">Page</span>
              <input
                value={pageInput || currentPage}
                onChange={(e) => setPageInput(e.target.value)}
                onBlur={goToPage}
                onKeyDown={(e) => e.key === 'Enter' && goToPage()}
                className="w-10 sm:w-12 text-center text-xs sm:text-sm bg-transparent border rounded px-1 py-0.5"
              />
              <span className="text-muted-foreground">/ {totalPages}</span>
              <span className="text-[10px] text-muted-foreground ml-1">({progressPct}%)</span>
            </div>

            <Button size="sm" variant="ghost" onClick={goNext} disabled={currentPage >= totalPages} className="px-2 sm:px-3">
              <span className="hidden sm:inline mr-1">Next</span>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </footer>
      )}
    </div>
  );
};

export default EbookReader;
