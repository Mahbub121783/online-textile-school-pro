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
import { Textarea } from '@/components/ui/textarea';
import {
  ArrowLeft, ChevronLeft, ChevronRight, Sun, Moon, BookOpen,
  Minus, Plus, StickyNote, X, Loader2, Type, Lightbulb, List,
  Highlighter, MessageSquare, Trash2
} from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import SEOHead from '@/components/SEOHead';

// Use local worker bundled by Vite — no CDN dependency
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

// One-time diagnostic log so version-mismatch issues are obvious in console
if (typeof window !== 'undefined' && !(window as any).__pdfjsVersionLogged) {
  (window as any).__pdfjsVersionLogged = true;
  // eslint-disable-next-line no-console
  console.info(`[EbookReader] pdfjs-dist v${pdfjsLib.version} | worker: ${pdfjsLib.GlobalWorkerOptions.workerSrc}`);
}

type ReadingMode = 'light' | 'dark' | 'sepia';
type FitMode = 'width' | 'page';
type HighlightColor = 'yellow' | 'green' | 'blue' | 'pink';

interface HighlightItem {
  id: string;
  page: number;
  text: string;
  color: HighlightColor;
  startOffset: number;
  endOffset: number;
  note?: string;
  createdAt: string;
}

interface NoteItem {
  id: string;
  page: number;
  text: string;
  createdAt: string;
}

interface ReaderData {
  highlights: HighlightItem[];
  notes: NoteItem[];
}

const HIGHLIGHT_COLORS: { color: HighlightColor; bg: string; label: string }[] = [
  { color: 'yellow', bg: 'rgba(250, 204, 21, 0.4)', label: 'Yellow' },
  { color: 'green', bg: 'rgba(74, 222, 128, 0.4)', label: 'Green' },
  { color: 'blue', bg: 'rgba(96, 165, 250, 0.4)', label: 'Blue' },
  { color: 'pink', bg: 'rgba(244, 114, 182, 0.4)', label: 'Pink' },
];

const getHighlightBg = (color: HighlightColor) =>
  HIGHLIGHT_COLORS.find((c) => c.color === color)?.bg || 'rgba(250, 204, 21, 0.4)';

const EbookReader = () => {
  const { ebookId } = useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textLayerRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const pdfDocRef = useRef<any>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const pageLabelsRef = useRef<string[] | null>(null);
  const renderingRef = useRef(false);
  const renderPageRef = useRef<((pageNum: number, pdf?: any) => Promise<void>) | null>(null);
  const currentPageRef = useRef(1);

  const [loadingState, setLoadingState] = useState<'auth' | 'loading' | 'ready' | 'error'>('auth');
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const [ebookTitle, setEbookTitle] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [readingMode, setReadingMode] = useState<ReadingMode>('light');
  const [fitMode, setFitMode] = useState<FitMode>('width');
  const [zoomLevel, setZoomLevel] = useState(100);
  const [brightness, setBrightness] = useState(100);
  const [showControls, setShowControls] = useState(true);
  const [showNotes, setShowNotes] = useState(false);
  const [showTOC, setShowTOC] = useState(false);
  const [highlights, setHighlights] = useState<HighlightItem[]>([]);
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [newNote, setNewNote] = useState('');
  const [pageInput, setPageInput] = useState('');
  const [rendering, setRendering] = useState(false);
  const [pageTransition, setPageTransition] = useState(false);
  const [tocItems, setTocItems] = useState<{ title: string; pageNum: number }[]>([]);
  const [fileFormat, setFileFormat] = useState<string>('pdf');
  const [isBlurred, setIsBlurred] = useState(false);

  // Highlight toolbar state
  const [selectionToolbar, setSelectionToolbar] = useState<{
    x: number; y: number; text: string; startOffset: number; endOffset: number;
  } | null>(null);
  const [highlightNoteMode, setHighlightNoteMode] = useState<{
    color: HighlightColor; text: string; startOffset: number; endOffset: number; noteText: string;
  } | null>(null);

  // Keep ref in sync
  useEffect(() => { currentPageRef.current = currentPage; }, [currentPage]);

  // ===== DRM: block right-click, printing, copy, screenshots, drag =====
  useEffect(() => {
    const blockCtxMenu = (e: MouseEvent) => e.preventDefault();
    const blockCopy = (e: ClipboardEvent) => e.preventDefault();
    const blockDrag = (e: DragEvent) => e.preventDefault();
    const blockKeys = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && ['p', 's', 'c', 'P', 'S', 'C'].includes(e.key)) {
        e.preventDefault();
      }
      if (e.key === 'PrintScreen') e.preventDefault();
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && ['s', 'S', 'i', 'I'].includes(e.key)) {
        e.preventDefault();
      }
    };

    document.addEventListener('contextmenu', blockCtxMenu);
    document.addEventListener('keydown', blockKeys);
    document.addEventListener('copy', blockCopy);
    document.addEventListener('dragstart', blockDrag);

    return () => {
      document.removeEventListener('contextmenu', blockCtxMenu);
      document.removeEventListener('keydown', blockKeys);
      document.removeEventListener('copy', blockCopy);
      document.removeEventListener('dragstart', blockDrag);
    };
  }, []);

  // ===== Visibility API: blur content when tab loses focus =====
  useEffect(() => {
    const handleVisibility = () => { setIsBlurred(document.hidden); };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  // ===== Load PDF via GET-based streaming =====
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
      setLoadingProgress(10);
      const { data: tokenData, error: tokenError } = await supabase.functions.invoke(
        'ebook-secure-access',
        { body: { action: 'generate_token', ebook_id: ebookId } }
      );
      // Friendly handling for known structured errors
      if (tokenData?.error === 'EBOOK_FILE_MISSING') {
        setLoadingState('error');
        setErrorMsg(tokenData.message || 'This eBook is not ready yet. Please contact support.');
        return;
      }
      if (tokenError || tokenData?.error) {
        throw new Error(tokenData?.message || tokenData?.error || tokenError?.message || 'Token generation failed');
      }

      const format = (tokenData.file_format || 'pdf').toLowerCase();
      setFileFormat(format);

      if (format !== 'pdf') {
        setLoadingState('error');
        setErrorMsg(`This ebook is in "${format.toUpperCase()}" format. Currently only PDF ebooks can be read in the browser. Please download the file instead.`);
        return;
      }

      setEbookTitle(tokenData.title || 'eBook');
      setLoadingProgress(20);

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const session = (await supabase.auth.getSession()).data.session;

      const streamUrl = `${supabaseUrl}/functions/v1/ebook-secure-access?action=stream&ebook_id=${ebookId}&token=${tokenData.token}`;

      setLoadingProgress(30);

      const loadingTask = pdfjsLib.getDocument({
        url: streamUrl,
        httpHeaders: {
          'Authorization': `Bearer ${session?.access_token}`,
          'apikey': supabaseKey,
        },
        rangeChunkSize: 65536,
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
      const msg = String(err?.message || err || '');
      const status = err?.status || err?.response?.status;
      // Auto-retry once on auth failures (expired/invalid token) — generate a fresh token transparently
      const isAuthErr = status === 401 || status === 403 || /401|403|Unauthorized|Forbidden|Invalid or expired token/i.test(msg);
      if (isAuthErr && !(window as any).__ebookRetryDone) {
        (window as any).__ebookRetryDone = true;
        console.info('[EbookReader] auth error — regenerating token and retrying once');
        setLoadingProgress(5);
        return loadPdf();
      }
      setLoadingState('error');
      setErrorMsg(msg || 'Failed to load ebook');
    }
  };

  const initPdf = async (pdf: any) => {
    try {
      pdfDocRef.current = pdf;
      setTotalPages(pdf.numPages);

      // Get page labels for proper page numbering
      try {
        const labels = await pdf.getPageLabels();
        pageLabelsRef.current = labels;
      } catch {
        pageLabelsRef.current = null;
      }

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
            } catch { /* skip */ }
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
      const restoredZoom = typeof progress?.font_size === 'number' && progress.font_size >= 50
        ? progress.font_size
        : 100;
      setCurrentPage(startPage);
      currentPageRef.current = startPage;
      setReadingMode((progress?.reading_mode as ReadingMode) || 'light');
      setZoomLevel(restoredZoom);
      setBrightness(progress?.brightness || 100);

      // Parse saved data — highlights are stored alongside notes
      const savedData = progress?.notes as unknown as ReaderData | NoteItem[] | null;
      if (savedData && 'highlights' in (savedData as any)) {
        const rd = savedData as ReaderData;
        setHighlights(rd.highlights || []);
        setNotes(rd.notes || []);
      } else if (Array.isArray(savedData)) {
        setNotes(savedData as NoteItem[]);
        setHighlights([]);
      } else {
        setNotes([]);
        setHighlights([]);
      }

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

  // ===== Render page with canvas + text layer + watermark =====
  const renderPage = useCallback(async (pageNum: number, pdf?: any) => {
    const doc = pdf || pdfDocRef.current;
    if (!doc || !canvasRef.current || renderingRef.current) return;

    renderingRef.current = true;
    setRendering(true);
    setSelectionToolbar(null);

    try {
      const page = await doc.getPage(pageNum);
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const container = containerRef.current;
      const containerWidth = container?.clientWidth || window.innerWidth;
      const containerHeight = container?.clientHeight || window.innerHeight;
      const viewport = page.getViewport({ scale: 1 });

      // Calculate fit scales
      const pagePadding = window.innerWidth < 640 ? 12 : 24;
      const fitWidthScale = Math.max(0.1, (containerWidth - pagePadding * 2) / viewport.width);
      const fitPageScale = Math.max(0.1, Math.min(
        (containerWidth - pagePadding * 2) / viewport.width,
        (containerHeight - pagePadding * 2) / viewport.height
      ));
      const baseScale = fitMode === 'page' ? fitPageScale : fitWidthScale;
      const scale = Math.max(0.1, baseScale * (zoomLevel / 100));
      const scaledViewport = page.getViewport({ scale });

      // DPR-aware canvas for retina clarity
      const outputScale = window.devicePixelRatio || 1;
      canvas.width = Math.floor(scaledViewport.width * outputScale);
      canvas.height = Math.floor(scaledViewport.height * outputScale);
      canvas.style.width = `${scaledViewport.width}px`;
      canvas.style.height = `${scaledViewport.height}px`;

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(outputScale, 0, 0, outputScale, 0, 0);

      await page.render({ canvasContext: ctx, viewport: scaledViewport }).promise;

      // ===== Watermark on canvas — user email at 3% opacity =====
      if (user?.email) {
        ctx.save();
        ctx.globalAlpha = 0.03;
        ctx.font = `${Math.max(14, scaledViewport.width / 30)}px sans-serif`;
        ctx.fillStyle = '#000000';
        ctx.translate(scaledViewport.width / 2, scaledViewport.height / 2);
        ctx.rotate(-Math.PI / 6);
        const wmText = user.email;
        const spacing = 120;
        for (let y = -scaledViewport.height; y < scaledViewport.height; y += spacing) {
          for (let x = -scaledViewport.width; x < scaledViewport.width; x += ctx.measureText(wmText).width + 80) {
            ctx.fillText(wmText, x, y);
          }
        }
        ctx.restore();
      }

      // ===== Render text layer =====
      if (textLayerRef.current) {
        const textLayerDiv = textLayerRef.current;
        textLayerDiv.innerHTML = '';
        textLayerDiv.style.width = `${scaledViewport.width}px`;
        textLayerDiv.style.height = `${scaledViewport.height}px`;

        const textContentSource = typeof page.streamTextContent === 'function'
          ? page.streamTextContent()
          : await page.getTextContent();

        const textLayerInstance = new pdfjsLib.TextLayer({
          textContentSource,
          container: textLayerDiv,
          viewport: scaledViewport,
        });
        await textLayerInstance.render();

        applyHighlightsToTextLayer(pageNum, textLayerDiv);
      }
    } catch (err) {
      console.error('Render error:', err);
    } finally {
      renderingRef.current = false;
      setRendering(false);
    }
  }, [fitMode, zoomLevel, user, highlights]);

  // Keep renderPageRef in sync
  useEffect(() => { renderPageRef.current = renderPage; }, [renderPage]);

  // ===== Apply highlights to text layer spans =====
  const applyHighlightsToTextLayer = useCallback((pageNum: number, container: HTMLDivElement) => {
    const pageHighlights = highlights.filter((h) => h.page === pageNum);
    if (!pageHighlights.length) return;

    const spans = container.querySelectorAll('span');
    let runningOffset = 0;

    spans.forEach((span) => {
      const spanText = span.textContent || '';
      const spanStart = runningOffset;
      const spanEnd = runningOffset + spanText.length;

      for (const hl of pageHighlights) {
        if (hl.startOffset < spanEnd && hl.endOffset > spanStart) {
          span.style.backgroundColor = getHighlightBg(hl.color);
          span.style.borderRadius = '2px';
          span.dataset.highlightId = hl.id;
          if (hl.note) {
            span.title = hl.note;
          }
        }
      }
      runningOffset = spanEnd;
    });
  }, [highlights]);

  // ===== Handle text selection for highlighting =====
  const handleTextSelection = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !textLayerRef.current) {
      setSelectionToolbar(null);
      return;
    }

    const selectedText = sel.toString().trim();
    if (!selectedText || selectedText.length < 2) {
      setSelectionToolbar(null);
      return;
    }

    const spans = textLayerRef.current.querySelectorAll('span');
    let runningOffset = 0;
    let startOffset = 0;
    let endOffset = 0;
    let foundStart = false;

    const range = sel.getRangeAt(0);

    spans.forEach((span) => {
      const spanText = span.textContent || '';
      if (span.contains(range.startContainer) || span === range.startContainer) {
        startOffset = runningOffset + range.startOffset;
        foundStart = true;
      }
      if (span.contains(range.endContainer) || span === range.endContainer) {
        endOffset = runningOffset + range.endOffset;
      }
      runningOffset += spanText.length;
    });

    if (!foundStart) {
      const fullText = Array.from(spans).map((s) => s.textContent || '').join('');
      const idx = fullText.indexOf(selectedText);
      if (idx >= 0) {
        startOffset = idx;
        endOffset = idx + selectedText.length;
      }
    }

    const rect = range.getBoundingClientRect();
    const containerRect = containerRef.current?.getBoundingClientRect();
    if (containerRect) {
      setSelectionToolbar({
        x: rect.left - containerRect.left + rect.width / 2,
        y: rect.top - containerRect.top - 10,
        text: selectedText,
        startOffset,
        endOffset,
      });
    }
  }, []);

  // Listen for mouse/touch/selection events on text layer
  useEffect(() => {
    const textLayer = textLayerRef.current;
    if (!textLayer) return;

    const scheduleCheck = () => { window.setTimeout(handleTextSelection, 60); };

    const onSelectionChange = () => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) return;
      if (selection.anchorNode && textLayer.contains(selection.anchorNode)) {
        scheduleCheck();
      }
    };

    textLayer.addEventListener('mouseup', scheduleCheck);
    textLayer.addEventListener('touchend', scheduleCheck);
    document.addEventListener('selectionchange', onSelectionChange);

    return () => {
      textLayer.removeEventListener('mouseup', scheduleCheck);
      textLayer.removeEventListener('touchend', scheduleCheck);
      document.removeEventListener('selectionchange', onSelectionChange);
    };
  }, [handleTextSelection, currentPage, loadingState]);

  // ===== Add highlight =====
  const addHighlight = (color: HighlightColor, withNote = false) => {
    if (!selectionToolbar) return;

    if (withNote) {
      setHighlightNoteMode({
        color,
        text: selectionToolbar.text,
        startOffset: selectionToolbar.startOffset,
        endOffset: selectionToolbar.endOffset,
        noteText: '',
      });
      setSelectionToolbar(null);
      window.getSelection()?.removeAllRanges();
      return;
    }

    const hl: HighlightItem = {
      id: crypto.randomUUID(),
      page: currentPage,
      text: selectionToolbar.text,
      color,
      startOffset: selectionToolbar.startOffset,
      endOffset: selectionToolbar.endOffset,
      createdAt: new Date().toISOString(),
    };

    setHighlights((prev) => [...prev, hl]);
    setSelectionToolbar(null);
    window.getSelection()?.removeAllRanges();

    if (textLayerRef.current) {
      applyHighlightsToTextLayer(currentPage, textLayerRef.current);
    }
  };

  const saveHighlightNote = () => {
    if (!highlightNoteMode) return;

    const hl: HighlightItem = {
      id: crypto.randomUUID(),
      page: currentPage,
      text: highlightNoteMode.text,
      color: highlightNoteMode.color,
      startOffset: highlightNoteMode.startOffset,
      endOffset: highlightNoteMode.endOffset,
      note: highlightNoteMode.noteText.trim() || undefined,
      createdAt: new Date().toISOString(),
    };

    setHighlights((prev) => [...prev, hl]);
    setHighlightNoteMode(null);

    if (textLayerRef.current) {
      applyHighlightsToTextLayer(currentPage, textLayerRef.current);
    }
  };

  const deleteHighlight = (id: string) => {
    setHighlights((prev) => prev.filter((h) => h.id !== id));
  };

  // ===== ResizeObserver — width-only, stable via refs =====
  useEffect(() => {
    if (loadingState !== 'ready' || !containerRef.current) return;
    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    let lastWidth = containerRef.current.clientWidth;

    resizeObserverRef.current = new ResizeObserver((entries) => {
      const newWidth = entries[0]?.contentRect?.width || 0;
      if (Math.abs(newWidth - lastWidth) < 2) return;
      lastWidth = newWidth;
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        renderPageRef.current?.(currentPageRef.current);
      }, 150);
    });

    resizeObserverRef.current.observe(containerRef.current);
    return () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeObserverRef.current?.disconnect();
    };
  }, [loadingState]);

  // Reset scroll on page change
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = 0;
      containerRef.current.scrollLeft = 0;
    }
  }, [currentPage]);

  // Re-render on page/zoom/fit change
  useEffect(() => {
    if (loadingState === 'ready') renderPage(currentPage);
  }, [currentPage, fitMode, zoomLevel, loadingState, renderPage]);

  // ===== Debounced save progress (highlights + notes) =====
  const saveProgress = useCallback(() => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(async () => {
      if (!user || !ebookId || !totalPages) return;
      const progressPct = totalPages > 0 ? Math.round((currentPage / totalPages) * 100) : 0;
      const readerData: ReaderData = { highlights, notes };
      await supabase
        .from('ebook_reading_progress')
        .upsert({
          user_id: user.id,
          ebook_id: ebookId,
          current_page: currentPage,
          total_pages: totalPages,
          progress_pct: progressPct,
          reading_mode: readingMode,
          font_size: zoomLevel,
          brightness,
          notes: readerData as unknown as any,
          updated_at: new Date().toISOString(),
        } as any, { onConflict: 'user_id,ebook_id' });
    }, 800);
  }, [currentPage, totalPages, readingMode, zoomLevel, brightness, notes, highlights, user, ebookId]);

  useEffect(() => { saveProgress(); }, [currentPage, readingMode, zoomLevel, brightness, notes, highlights]);

  // ===== Keyboard navigation =====
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); goNext(); }
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); goPrev(); }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [currentPage, totalPages]);

  // Touch/swipe
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

  // ===== Page-level notes =====
  const addNote = () => {
    if (!newNote.trim()) return;
    setNotes((prev) => [
      ...prev,
      { id: crypto.randomUUID(), page: currentPage, text: newNote.trim(), createdAt: new Date().toISOString() },
    ]);
    setNewNote('');
  };
  const deleteNote = (id: string) => setNotes((prev) => prev.filter((n) => n.id !== id));

  // ===== Page label logic =====
  const getPageLabel = (pageIdx: number) => {
    const labels = pageLabelsRef.current;
    if (labels && labels[pageIdx - 1] && labels[pageIdx - 1] !== String(pageIdx)) {
      return labels[pageIdx - 1];
    }
    return null;
  };

  const pageLabel = getPageLabel(currentPage);
  const progressPct = totalPages > 0 ? Math.round((currentPage / totalPages) * 100) : 0;

  const currentPageHighlights = useMemo(() => highlights.filter((h) => h.page === currentPage), [highlights, currentPage]);
  const currentPageNotes = useMemo(() => notes.filter((n) => n.page === currentPage), [notes, currentPage]);

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

  // ===== Loading / Error states =====
  if (loadingState === 'auth' || authLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (loadingState === 'error') {
    const isMissingFile = /not ready yet|not been uploaded|EBOOK_FILE_MISSING/i.test(errorMsg);
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-background gap-4 px-4">
        <BookOpen className="h-16 w-16 text-muted-foreground" />
        <h2 className="font-heading text-xl font-bold text-center">
          {isMissingFile ? 'eBook is being prepared' : 'Unable to load eBook'}
        </h2>
        <p className="text-muted-foreground text-sm max-w-md text-center">{errorMsg}</p>
        <div className="flex flex-wrap gap-2 justify-center">
          <Button onClick={() => navigate(-1)} variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" /> Go Back
          </Button>
          {isMissingFile && (
            <Button onClick={() => navigate('/contact')}>Contact Support</Button>
          )}
        </div>
      </div>
    );
  }

  if (loadingState === 'loading') {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-background gap-3 px-4">
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
      className={`h-screen flex flex-col overflow-hidden ${modeStyles[readingMode]} transition-colors duration-300`}
      style={{ filter: `brightness(${brightness}%)` }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <SEOHead title="Ebook Reader" noindex />
      <style>{`
        @media print { body * { display: none !important; } }
        .text-layer-container {
          position: absolute;
          inset: 0;
          overflow: hidden;
          opacity: 1;
          line-height: 1;
          z-index: 2;
          text-align: initial;
          transform-origin: 0 0;
          -webkit-text-size-adjust: none;
          forced-color-adjust: none;
          touch-action: pan-y;
        }
        .text-layer-container span,
        .text-layer-container br {
          position: absolute;
          white-space: pre;
          color: transparent;
          cursor: text;
          transform-origin: 0 0;
          -webkit-user-select: text;
          user-select: text;
          -webkit-touch-callout: default;
        }
        .text-layer-container span::selection {
          background: rgba(96, 165, 250, 0.4);
          color: transparent;
        }
        .text-layer-container span::-moz-selection {
          background: rgba(96, 165, 250, 0.4);
          color: transparent;
        }
        .pdf-page-canvas {
          display: block;
          max-width: none;
          max-height: none;
        }
        .reader-blurred .reader-content {
          filter: blur(20px) !important;
          pointer-events: none !important;
        }
      `}</style>

      {/* Blur overlay when tab loses focus */}
      {isBlurred && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="text-center text-white">
            <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-60" />
            <p className="text-lg font-medium">Content hidden for security</p>
            <p className="text-sm opacity-60 mt-1">Click here to continue reading</p>
          </div>
        </div>
      )}

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
              { mode: 'light' as const, icon: <Sun className="h-3 w-3" /> },
              { mode: 'dark' as const, icon: <Moon className="h-3 w-3" /> },
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

          {/* Zoom + fit mode */}
          <div className="flex items-center gap-1">
            <div className="hidden sm:flex items-center gap-0.5">
              <button onClick={() => setZoomLevel((s) => Math.max(50, s - 10))} className="p-1 hover:bg-muted rounded">
                <Minus className="h-3.5 w-3.5" />
              </button>
              <Type className="h-3.5 w-3.5" />
              <span className="text-xs min-w-10 text-center">{zoomLevel}%</span>
              <button onClick={() => setZoomLevel((s) => Math.min(200, s + 10))} className="p-1 hover:bg-muted rounded">
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="flex items-center gap-0.5 border rounded-lg px-0.5 py-0.5">
              {[
                { mode: 'width' as const, label: 'W' },
                { mode: 'page' as const, label: 'P' },
              ].map(({ mode, label }) => (
                <button
                  key={mode}
                  onClick={() => setFitMode(mode)}
                  className={`px-1.5 sm:px-2 py-1 rounded text-[10px] sm:text-xs ${fitMode === mode ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
                  title={mode === 'width' ? 'Fit Width' : 'Fit Page'}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Brightness */}
          <div className="hidden lg:flex items-center gap-1.5 min-w-[100px]">
            <Lightbulb className="h-3.5 w-3.5 shrink-0" />
            <Slider value={[brightness]} min={50} max={120} step={5} onValueChange={([v]) => setBrightness(v)} className="flex-1" />
          </div>

          {tocItems.length > 0 && (
            <Button size="icon" variant="ghost" onClick={() => setShowTOC(true)} className="shrink-0 h-8 w-8">
              <List className="h-4 w-4" />
            </Button>
          )}

          <Button size="icon" variant={showNotes ? 'default' : 'ghost'} onClick={() => setShowNotes(!showNotes)} className="shrink-0 h-8 w-8">
            <StickyNote className="h-4 w-4" />
          </Button>
        </header>
      )}

      {/* Main reading area */}
      <div className={`flex-1 flex overflow-hidden reader-content ${isBlurred ? 'reader-blurred' : ''}`}>
        <div
          ref={containerRef}
          className={`flex-1 flex justify-center overflow-auto p-2 sm:p-4 relative ${fitMode === 'width' ? 'items-start' : 'items-center'}`}
          onClick={(e) => {
            if (!(e.target as HTMLElement).closest('.text-layer-container') && !selectionToolbar) {
              setShowControls((s) => !s);
            }
          }}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <div className="relative">
            <canvas
              ref={canvasRef}
              className={`pdf-page-canvas shadow-2xl rounded-sm transition-opacity duration-200 ${pageTransition ? 'opacity-0' : 'opacity-100'}`}
              style={{ userSelect: 'none' }}
              onDragStart={(e) => e.preventDefault()}
            />
            {/* Text layer overlay — full pointer events for selection */}
            <div
              ref={textLayerRef}
              className="text-layer-container"
              style={{ pointerEvents: 'auto' }}
              onMouseDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
              onTouchEnd={(e) => e.stopPropagation()}
              onCopy={(e) => e.preventDefault()}
            />
          </div>

          {/* Highlight toolbar */}
          {selectionToolbar && (
            <div
              className="absolute z-30 bg-background border rounded-lg shadow-xl p-1.5 flex items-center gap-1 animate-in fade-in zoom-in-95"
              style={{
                left: Math.min(selectionToolbar.x, (containerRef.current?.clientWidth || 300) - 200),
                top: Math.max(selectionToolbar.y - 40, 10),
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {HIGHLIGHT_COLORS.map(({ color, bg }) => (
                <button
                  key={color}
                  onClick={() => addHighlight(color)}
                  className="w-6 h-6 rounded-full border-2 border-background hover:scale-110 transition-transform"
                  style={{ backgroundColor: bg.replace('0.4', '0.8') }}
                  title={`Highlight ${color}`}
                />
              ))}
              <div className="w-px h-5 bg-border mx-0.5" />
              <button
                onClick={() => addHighlight('yellow', true)}
                className="p-1 hover:bg-muted rounded"
                title="Highlight + Note"
              >
                <MessageSquare className="h-4 w-4" />
              </button>
              <button
                onClick={() => { setSelectionToolbar(null); window.getSelection()?.removeAllRanges(); }}
                className="p-1 hover:bg-muted rounded"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* Note input modal for highlight */}
          {highlightNoteMode && (
            <div
              className="absolute z-40 inset-0 flex items-center justify-center bg-black/30 backdrop-blur-sm"
              onClick={(e) => { e.stopPropagation(); setHighlightNoteMode(null); }}
            >
              <div
                className="bg-background rounded-xl shadow-2xl p-4 w-[90%] max-w-sm space-y-3"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center gap-2">
                  <Highlighter className="h-4 w-4 text-primary" />
                  <span className="font-medium text-sm">Add Note to Highlight</span>
                </div>
                <p className="text-xs text-muted-foreground bg-muted rounded p-2 line-clamp-2">
                  "{highlightNoteMode.text}"
                </p>
                <Textarea
                  value={highlightNoteMode.noteText}
                  onChange={(e) => setHighlightNoteMode((m) => m ? { ...m, noteText: e.target.value } : null)}
                  placeholder="Write your note..."
                  className="text-sm min-h-[80px]"
                  autoFocus
                />
                <div className="flex gap-2 justify-end">
                  <Button size="sm" variant="outline" onClick={() => setHighlightNoteMode(null)}>Cancel</Button>
                  <Button size="sm" onClick={saveHighlightNote}>
                    Save
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Notes & Highlights panel */}
      <Sheet open={showNotes} onOpenChange={setShowNotes}>
        <SheetContent side="right" className="w-[85vw] sm:w-80 p-0">
          <SheetHeader className="p-4 border-b">
            <SheetTitle className="text-sm flex items-center gap-2">
              <StickyNote className="h-4 w-4" />
              Notes & Highlights
            </SheetTitle>
          </SheetHeader>
          <ScrollArea className="flex-1 h-[calc(100vh-200px)]">
            <div className="p-3 space-y-3">
              {/* Highlights section */}
              {currentPageHighlights.length > 0 && (
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5 flex items-center gap-1">
                    <Highlighter className="h-3 w-3" /> Highlights — Page {pageLabel ? `${pageLabel} (${currentPage})` : currentPage}
                  </p>
                  {currentPageHighlights.map((hl) => (
                    <div
                      key={hl.id}
                      className="p-2 rounded-lg text-xs group relative mb-1.5 border"
                      style={{ borderLeftColor: getHighlightBg(hl.color).replace('0.4', '1'), borderLeftWidth: 3 }}
                    >
                      <p className="italic text-muted-foreground line-clamp-2">"{hl.text}"</p>
                      {hl.note && <p className="mt-1 font-medium">{hl.note}</p>}
                      <button onClick={() => deleteHighlight(hl.id)} className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* All highlights grouped by page */}
              {highlights.filter((h) => h.page !== currentPage).length > 0 && (
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">
                    Other Pages
                  </p>
                  {Array.from(new Set(highlights.filter((h) => h.page !== currentPage).map((h) => h.page)))
                    .sort((a, b) => a - b)
                    .map((page) => (
                      <div key={page} className="mb-2">
                        <button
                          onClick={() => { changePage(page); }}
                          className="text-[10px] text-primary hover:underline font-medium"
                        >
                          Page {getPageLabel(page) ? `${getPageLabel(page)} (${page})` : page}
                        </button>
                        {highlights.filter((h) => h.page === page).map((hl) => (
                          <div
                            key={hl.id}
                            className="p-1.5 rounded text-xs ml-2 border-l-2 pl-2 mb-1 group relative"
                            style={{ borderLeftColor: getHighlightBg(hl.color).replace('0.4', '1') }}
                          >
                            <p className="italic text-muted-foreground line-clamp-1">"{hl.text}"</p>
                            {hl.note && <p className="text-[10px] mt-0.5">{hl.note}</p>}
                            <button onClick={() => deleteHighlight(hl.id)} className="absolute top-0.5 right-0.5 opacity-0 group-hover:opacity-100">
                              <Trash2 className="h-2.5 w-2.5 text-destructive" />
                            </button>
                          </div>
                        ))}
                      </div>
                    ))}
                </div>
              )}

              {/* Page notes */}
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">
                  Page Notes
                </p>
                {currentPageNotes.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-3">No notes on this page.</p>
                )}
                {currentPageNotes.map((note) => (
                  <div key={note.id} className="p-2 rounded-lg bg-muted/50 text-xs group relative mb-1.5">
                    <p>{note.text}</p>
                    <button onClick={() => deleteNote(note.id)} className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </ScrollArea>
          <div className="p-3 border-t flex gap-2">
            <input
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addNote()}
              placeholder="Add a page note..."
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
                  <span className="text-[10px] text-muted-foreground">
                    Page {getPageLabel(item.pageNum) ? `${getPageLabel(item.pageNum)} (${item.pageNum})` : item.pageNum}
                  </span>
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
              {pageLabel ? (
                <span className="text-muted-foreground">
                  Page <strong>{pageLabel}</strong>
                </span>
              ) : (
                <span className="text-muted-foreground hidden sm:inline">Page</span>
              )}
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
