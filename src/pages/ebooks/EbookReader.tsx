import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Progress } from '@/components/ui/progress';
import {
  ArrowLeft, ChevronLeft, ChevronRight, Sun, Moon, BookOpen,
  Minus, Plus, StickyNote, X, Loader2, Type, Lightbulb
} from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

type ReadingMode = 'light' | 'dark' | 'sepia';

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
  const pdfDocRef = useRef<any>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);

  const [loadingState, setLoadingState] = useState<'auth' | 'loading' | 'ready' | 'error'>('auth');
  const [errorMsg, setErrorMsg] = useState('');
  const [ebookTitle, setEbookTitle] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [readingMode, setReadingMode] = useState<ReadingMode>('light');
  const [fontSize, setFontSize] = useState(16);
  const [brightness, setBrightness] = useState(100);
  const [showControls, setShowControls] = useState(true);
  const [showNotes, setShowNotes] = useState(false);
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [newNote, setNewNote] = useState('');
  const [pageInput, setPageInput] = useState('');
  const [rendering, setRendering] = useState(false);
  const [pageTransition, setPageTransition] = useState(false);

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

  // Load PDF via edge function streaming
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate('/auth/login?redirect=/read/' + ebookId);
      return;
    }
    setLoadingState('loading');
    loadPdf();
  }, [user, authLoading, ebookId]);

  const loadPdf = async () => {
    try {
      // Step 1: Generate token
      const { data: tokenData, error: tokenError } = await supabase.functions.invoke(
        'ebook-secure-access',
        { body: { action: 'generate_token', ebook_id: ebookId } }
      );
      if (tokenError || tokenData?.error) {
        throw new Error(tokenData?.error || tokenError?.message || 'Token generation failed');
      }

      // Step 2: Stream file bytes via raw fetch (never use supabase.functions.invoke for binary)
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const session = (await supabase.auth.getSession()).data.session;

      const response = await fetch(`${supabaseUrl}/functions/v1/ebook-secure-access`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
          'apikey': supabaseKey,
        },
        body: JSON.stringify({
          action: 'stream_file',
          ebook_id: ebookId,
          token: tokenData.token,
        }),
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || 'Failed to load ebook');
      }

      const contentType = response.headers.get('Content-Type') || '';
      if (contentType.includes('application/json')) {
        const errJson = await response.json();
        throw new Error(errJson.error || 'Unexpected response');
      }

      const arrayBuffer = await response.arrayBuffer();
      const title = decodeURIComponent(response.headers.get('X-Ebook-Title') || 'eBook');
      setEbookTitle(title);
      await initPdf(new Uint8Array(arrayBuffer));
    } catch (err: any) {
      setLoadingState('error');
      setErrorMsg(err.message || 'Failed to load ebook');
    }
  };

  const initPdf = async (data: Uint8Array) => {
    try {
      const pdf = await pdfjsLib.getDocument({ data }).promise;
      pdfDocRef.current = pdf;
      setTotalPages(pdf.numPages);

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
      const containerWidth = container?.clientWidth || 800;
      const containerHeight = container?.clientHeight || 600;

      const viewport = page.getViewport({ scale: 1 });
      const scaleW = (containerWidth - 40) / viewport.width;
      const scaleH = (containerHeight - 40) / viewport.height;
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

  useEffect(() => {
    saveProgress();
  }, [currentPage, readingMode, fontSize, brightness, notes]);

  // Keyboard navigation
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        goNext();
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        goPrev();
      }
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

    // Minimum 50px horizontal swipe, less than 100px vertical, within 500ms
    if (Math.abs(dx) > 50 && Math.abs(dy) < 100 && dt < 500) {
      if (dx < 0) goNext();
      else goPrev();
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

  const goNext = () => {
    if (currentPage < totalPages) changePage(currentPage + 1);
  };
  const goPrev = () => {
    if (currentPage > 1) changePage(currentPage - 1);
  };
  const goToPage = () => {
    const p = parseInt(pageInput);
    if (p >= 1 && p <= totalPages) {
      changePage(p);
      setPageInput('');
    }
  };

  const addNote = () => {
    if (!newNote.trim()) return;
    setNotes((prev) => [
      ...prev,
      { id: crypto.randomUUID(), page: currentPage, text: newNote.trim(), createdAt: new Date().toISOString() },
    ]);
    setNewNote('');
  };

  const deleteNote = (id: string) => {
    setNotes((prev) => prev.filter((n) => n.id !== id));
  };

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

  if (loadingState === 'auth' || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (loadingState === 'error') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4">
        <BookOpen className="h-16 w-16 text-muted-foreground" />
        <h2 className="font-heading text-xl font-bold">Unable to load eBook</h2>
        <p className="text-muted-foreground text-sm max-w-md text-center">{errorMsg}</p>
        <Button onClick={() => navigate(-1)} variant="outline">
          <ArrowLeft className="h-4 w-4 mr-2" /> Go Back
        </Button>
      </div>
    );
  }

  if (loadingState === 'loading') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-3">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-muted-foreground font-medium animate-pulse">Loading your eBook securely...</p>
      </div>
    );
  }

  const currentPageNotes = notes.filter((n) => n.page === currentPage);

  return (
    <div
      className={`min-h-screen flex flex-col select-none ${modeStyles[readingMode]} transition-colors duration-300`}
      style={{ filter: `brightness(${brightness}%)` }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Print block */}
      <style>{`@media print { body * { display: none !important; } }`}</style>

      {/* Top bar */}
      {showControls && (
        <header
          className={`sticky top-0 z-50 border-b px-3 py-2 flex items-center gap-2 backdrop-blur-md transition-all ${controlBg[readingMode]}`}
        >
          <Button size="icon" variant="ghost" onClick={() => navigate(-1)} className="shrink-0">
            <ArrowLeft className="h-4 w-4" />
          </Button>

          <h1 className="font-heading font-bold text-sm truncate flex-1">{ebookTitle}</h1>

          {/* Mode toggles */}
          <div className="flex items-center gap-1 border rounded-lg px-1 py-0.5">
            <button
              onClick={() => setReadingMode('light')}
              className={`p-1.5 rounded text-xs ${readingMode === 'light' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
              title="Light mode"
            >
              <Sun className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setReadingMode('dark')}
              className={`p-1.5 rounded text-xs ${readingMode === 'dark' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
              title="Night mode"
            >
              <Moon className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setReadingMode('sepia')}
              className={`p-1.5 rounded text-xs font-bold ${readingMode === 'sepia' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
              title="Sepia mode"
            >
              S
            </button>
          </div>

          {/* Font size */}
          <div className="hidden md:flex items-center gap-1">
            <button onClick={() => setFontSize((s) => Math.max(10, s - 2))} className="p-1 hover:bg-muted rounded">
              <Minus className="h-3.5 w-3.5" />
            </button>
            <Type className="h-3.5 w-3.5" />
            <span className="text-xs w-6 text-center">{fontSize}</span>
            <button onClick={() => setFontSize((s) => Math.min(32, s + 2))} className="p-1 hover:bg-muted rounded">
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Brightness */}
          <div className="hidden lg:flex items-center gap-1.5 min-w-[100px]">
            <Lightbulb className="h-3.5 w-3.5 shrink-0" />
            <Slider
              value={[brightness]}
              min={50}
              max={120}
              step={5}
              onValueChange={([v]) => setBrightness(v)}
              className="flex-1"
            />
          </div>

          {/* Notes toggle */}
          <Button
            size="icon"
            variant={showNotes ? 'default' : 'ghost'}
            onClick={() => setShowNotes(!showNotes)}
            className="shrink-0"
          >
            <StickyNote className="h-4 w-4" />
          </Button>
        </header>
      )}

      {/* Main reading area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Canvas container with touch support */}
        <div
          ref={containerRef}
          className="flex-1 flex items-center justify-center overflow-auto p-4 cursor-pointer"
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

        {/* Notes panel */}
        {showNotes && (
          <aside
            className={`w-72 border-l flex flex-col overflow-hidden ${controlBg[readingMode]}`}
          >
            <div className="p-3 border-b flex items-center justify-between">
              <h3 className="font-heading font-bold text-sm">Notes — Page {currentPage}</h3>
              <button onClick={() => setShowNotes(false)}>
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-auto p-3 space-y-2">
              {currentPageNotes.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">No notes on this page.</p>
              )}
              {currentPageNotes.map((note) => (
                <div key={note.id} className="p-2 rounded-lg bg-muted/50 text-xs group relative">
                  <p>{note.text}</p>
                  <button
                    onClick={() => deleteNote(note.id)}
                    className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>

            <div className="p-3 border-t flex gap-2">
              <input
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addNote()}
                placeholder="Add a note..."
                className="flex-1 text-xs bg-transparent border rounded px-2 py-1.5 outline-none focus:border-primary"
              />
              <Button size="sm" onClick={addNote} disabled={!newNote.trim()}>
                Add
              </Button>
            </div>
          </aside>
        )}
      </div>

      {/* Bottom navigation bar */}
      {showControls && (
        <footer className={`border-t px-3 py-2 backdrop-blur-md ${controlBg[readingMode]}`}>
          <Progress value={progressPct} className="h-1.5 mb-2" />

          <div className="flex items-center justify-between gap-2">
            <Button size="sm" variant="ghost" onClick={goPrev} disabled={currentPage <= 1}>
              <ChevronLeft className="h-4 w-4 mr-1" /> Prev
            </Button>

            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Page</span>
              <input
                value={pageInput || currentPage}
                onChange={(e) => setPageInput(e.target.value)}
                onBlur={goToPage}
                onKeyDown={(e) => e.key === 'Enter' && goToPage()}
                className="w-12 text-center text-sm bg-transparent border rounded px-1 py-0.5"
              />
              <span className="text-muted-foreground">of {totalPages}</span>
              <span className="text-xs text-muted-foreground ml-1">({progressPct}%)</span>
            </div>

            <Button size="sm" variant="ghost" onClick={goNext} disabled={currentPage >= totalPages}>
              Next <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </footer>
      )}
    </div>
  );
};

export default EbookReader;
