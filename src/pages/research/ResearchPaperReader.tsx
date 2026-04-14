import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import {
  ArrowLeft, ChevronLeft, ChevronRight, Sun, Moon, BookOpen,
  Minus, Plus, Loader2, List
} from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

type ReadingMode = 'light' | 'dark' | 'sepia';
type FitMode = 'width' | 'page';

const ResearchPaperReader = () => {
  const { paperId } = useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textLayerRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const pdfDocRef = useRef<any>(null);
  const renderingRef = useRef(false);

  const [loadingState, setLoadingState] = useState<'auth' | 'loading' | 'ready' | 'error'>('auth');
  const [errorMsg, setErrorMsg] = useState('');
  const [paperTitle, setPaperTitle] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [readingMode, setReadingMode] = useState<ReadingMode>('light');
  const [fitMode, setFitMode] = useState<FitMode>('width');
  const [zoomLevel, setZoomLevel] = useState(100);
  const [showControls, setShowControls] = useState(true);
  const [rendering, setRendering] = useState(false);
  const [isBlurred, setIsBlurred] = useState(false);
  const [tocItems, setTocItems] = useState<{ title: string; pageNum: number }[]>([]);
  const [showTOC, setShowTOC] = useState(false);

  // DRM protections
  useEffect(() => {
    const block = (e: Event) => e.preventDefault();
    const blockKeys = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && ['p', 's', 'c', 'P', 'S', 'C'].includes(e.key)) e.preventDefault();
    };
    document.addEventListener('contextmenu', block);
    document.addEventListener('keydown', blockKeys);
    document.addEventListener('copy', block);
    return () => {
      document.removeEventListener('contextmenu', block);
      document.removeEventListener('keydown', blockKeys);
      document.removeEventListener('copy', block);
    };
  }, []);

  useEffect(() => {
    const h = () => setIsBlurred(document.hidden);
    document.addEventListener('visibilitychange', h);
    return () => document.removeEventListener('visibilitychange', h);
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate('/auth/login?redirect=/research/' + paperId + '/read'); return; }
    loadPaper();
  }, [user, authLoading, paperId]);

  const loadPaper = async () => {
    try {
      setLoadingState('loading');
      // Check access
      const { data: paper, error } = await supabase
        .from('research_papers')
        .select('*')
        .eq('id', paperId!)
        .single();
      if (error || !paper) throw new Error('Paper not found');

      setPaperTitle(paper.title);

      const isFree = paper.access_type === 'free';
      const isAuthor = paper.submitted_by === user!.id;

      if (!isFree && !isAuthor) {
        const { data: access } = await supabase
          .from('research_paper_access')
          .select('id')
          .eq('paper_id', paperId!)
          .eq('user_id', user!.id)
          .maybeSingle();
        if (!access) {
          setLoadingState('error');
          setErrorMsg('You do not have access to this paper. Please purchase it first.');
          return;
        }
      }

      if (!paper.file_url) {
        setLoadingState('error');
        setErrorMsg('No PDF file is available for this paper.');
        return;
      }

      // Load PDF directly from file_url (R2 public URL)
      const loadingTask = pdfjsLib.getDocument({
        url: paper.file_url,
        rangeChunkSize: 65536,
        disableAutoFetch: false,
        disableStream: false,
      });

      const pdf = await loadingTask.promise;
      pdfDocRef.current = pdf;
      setTotalPages(pdf.numPages);

      // TOC
      try {
        const outline = await pdf.getOutline();
        if (outline?.length) {
          const items: { title: string; pageNum: number }[] = [];
          for (const item of outline.slice(0, 50)) {
            try {
              const dest = item.dest;
              if (typeof dest === 'string') {
                const rd = await pdf.getDestination(dest);
                if (rd) { const pi = await pdf.getPageIndex(rd[0]); items.push({ title: item.title, pageNum: pi + 1 }); }
              } else if (Array.isArray(dest)) {
                const pi = await pdf.getPageIndex(dest[0]);
                items.push({ title: item.title, pageNum: pi + 1 });
              }
            } catch {}
          }
          setTocItems(items);
        }
      } catch {}

      setLoadingState('ready');
      renderPage(1, pdf);
    } catch (err: any) {
      setLoadingState('error');
      setErrorMsg(err.message || 'Failed to load paper');
    }
  };

  const renderPage = useCallback(async (pageNum: number, pdf?: any) => {
    const doc = pdf || pdfDocRef.current;
    if (!doc || !canvasRef.current || renderingRef.current) return;
    renderingRef.current = true;
    setRendering(true);

    try {
      const page = await doc.getPage(pageNum);
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const container = containerRef.current;
      const cw = container?.clientWidth || window.innerWidth;
      const ch = container?.clientHeight || window.innerHeight;
      const vp = page.getViewport({ scale: 1 });
      const pad = window.innerWidth < 640 ? 12 : 24;
      const fwScale = Math.max(0.1, (cw - pad * 2) / vp.width);
      const fpScale = Math.max(0.1, Math.min((cw - pad * 2) / vp.width, (ch - pad * 2) / vp.height));
      const base = fitMode === 'page' ? fpScale : fwScale;
      const scale = Math.max(0.1, base * (zoomLevel / 100));
      const sv = page.getViewport({ scale });

      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.floor(sv.width * dpr);
      canvas.height = Math.floor(sv.height * dpr);
      canvas.style.width = `${sv.width}px`;
      canvas.style.height = `${sv.height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      await page.render({ canvasContext: ctx, viewport: sv }).promise;

      // Watermark
      if (user?.email) {
        ctx.save();
        ctx.globalAlpha = 0.03;
        ctx.font = `${Math.max(14, sv.width / 30)}px sans-serif`;
        ctx.fillStyle = '#000';
        ctx.translate(sv.width / 2, sv.height / 2);
        ctx.rotate(-Math.PI / 6);
        const wm = user.email;
        for (let y = -sv.height; y < sv.height; y += 120) {
          for (let x = -sv.width; x < sv.width; x += ctx.measureText(wm).width + 80) {
            ctx.fillText(wm, x, y);
          }
        }
        ctx.restore();
      }

      // Text layer
      if (textLayerRef.current) {
        const tl = textLayerRef.current;
        tl.innerHTML = '';
        tl.style.width = `${sv.width}px`;
        tl.style.height = `${sv.height}px`;
        const textContent = typeof page.streamTextContent === 'function' ? page.streamTextContent() : await page.getTextContent();
        const tli = new pdfjsLib.TextLayer({ textContentSource: textContent, container: tl, viewport: sv });
        await tli.render();
      }
    } catch (err) {
      console.error('Render error:', err);
    } finally {
      renderingRef.current = false;
      setRendering(false);
    }
  }, [fitMode, zoomLevel, user]);

  useEffect(() => {
    if (loadingState === 'ready') renderPage(currentPage);
  }, [fitMode, zoomLevel, renderPage]);

  const goToPage = (p: number) => {
    if (p >= 1 && p <= totalPages) {
      setCurrentPage(p);
      renderPage(p);
    }
  };

  const bgClass = readingMode === 'dark' ? 'bg-zinc-900' : readingMode === 'sepia' ? 'bg-amber-50' : 'bg-white';
  const textClass = readingMode === 'dark' ? 'text-zinc-100' : 'text-foreground';

  if (loadingState === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4 max-w-md">
          <FileTextIcon className="h-16 w-16 mx-auto text-muted" />
          <h2 className="font-heading text-xl font-bold">Cannot Load Paper</h2>
          <p className="text-sm text-muted-foreground">{errorMsg}</p>
          <Button onClick={() => navigate(`/research/${paperId}`)}>Back to Paper</Button>
        </div>
      </div>
    );
  }

  if (loadingState !== 'ready') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <Loader2 className="h-10 w-10 animate-spin mx-auto text-primary" />
          <p className="text-sm text-muted-foreground">Loading paper...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen flex flex-col ${bgClass} ${textClass} select-none`}
      style={{ filter: isBlurred ? 'blur(20px)' : 'none' }}>
      {/* Top Bar */}
      {showControls && (
        <div className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b px-3 py-2">
          <div className="flex items-center justify-between gap-2 max-w-5xl mx-auto">
            <div className="flex items-center gap-2 min-w-0">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(`/research/${paperId}`)}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium truncate max-w-[200px]">{paperTitle}</span>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setZoomLevel(z => Math.max(50, z - 10))}>
                <Minus className="h-3.5 w-3.5" />
              </Button>
              <span className="text-xs w-10 text-center">{zoomLevel}%</span>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setZoomLevel(z => Math.min(200, z + 10))}>
                <Plus className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8"
                onClick={() => setFitMode(f => f === 'width' ? 'page' : 'width')}>
                <BookOpen className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8"
                onClick={() => setReadingMode(m => m === 'light' ? 'dark' : m === 'dark' ? 'sepia' : 'light')}>
                {readingMode === 'dark' ? <Moon className="h-3.5 w-3.5" /> : <Sun className="h-3.5 w-3.5" />}
              </Button>
              {tocItems.length > 0 && (
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowTOC(!showTOC)}>
                  <List className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TOC Sidebar */}
      {showTOC && (
        <div className="fixed right-0 top-12 bottom-0 w-72 bg-background border-l z-40 overflow-y-auto p-4">
          <h3 className="font-heading font-semibold mb-3">Table of Contents</h3>
          <div className="space-y-1">
            {tocItems.map((item, i) => (
              <button key={i} className="w-full text-left text-sm p-2 rounded hover:bg-muted/50 transition-colors"
                onClick={() => { goToPage(item.pageNum); setShowTOC(false); }}>
                {item.title}
                <span className="text-xs text-muted-foreground ml-2">p.{item.pageNum}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Canvas Area */}
      <div ref={containerRef} className="flex-1 overflow-auto flex justify-center py-4"
        onClick={() => setShowControls(!showControls)}>
        <div className="relative">
          <canvas ref={canvasRef} className="shadow-lg" />
          <div ref={textLayerRef} className="absolute top-0 left-0 textLayer opacity-30 pointer-events-none"
            style={{ userSelect: 'none' }} />
          {rendering && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/50">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          )}
        </div>
      </div>

      {/* Bottom Nav */}
      {showControls && (
        <div className="sticky bottom-0 bg-background/95 backdrop-blur border-t px-4 py-2">
          <div className="flex items-center justify-center gap-3 max-w-md mx-auto">
            <Button variant="ghost" size="icon" className="h-8 w-8" disabled={currentPage <= 1}
              onClick={() => goToPage(currentPage - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium">
              Page {currentPage} of {totalPages}
            </span>
            <Button variant="ghost" size="icon" className="h-8 w-8" disabled={currentPage >= totalPages}
              onClick={() => goToPage(currentPage + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

// Simple icon for error state
const FileTextIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14,2 14,8 20,8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <polyline points="10,9 9,9 8,9" />
  </svg>
);

export default ResearchPaperReader;
