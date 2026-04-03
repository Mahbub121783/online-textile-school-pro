/**
 * Client-side security hardening
 * Disables console output, right-click, devtools shortcuts, text selection on sensitive areas
 * Only active in production builds
 */

const IS_PROD = import.meta.env.PROD;

function noop() { return undefined; }

export function initSecurity() {
  if (!IS_PROD) return;

  // 1. Suppress all console output
  const methods: (keyof Console)[] = [
    'log', 'debug', 'info', 'warn', 'error', 'table', 'trace',
    'dir', 'dirxml', 'group', 'groupCollapsed', 'groupEnd',
    'clear', 'count', 'countReset', 'assert', 'profile',
    'profileEnd', 'time', 'timeLog', 'timeEnd', 'timeStamp',
  ];
  methods.forEach((method) => {
    try { (console as any)[method] = noop; } catch (_) { /* frozen */ }
  });

  // 2. Disable right-click context menu
  document.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    return false;
  }, { capture: true });

  // 3. Disable common devtools keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    // F12
    if (e.key === 'F12') {
      e.preventDefault();
      return false;
    }
    // Ctrl+Shift+I / Cmd+Option+I (Inspector)
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'I') {
      e.preventDefault();
      return false;
    }
    // Ctrl+Shift+J / Cmd+Option+J (Console)
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'J') {
      e.preventDefault();
      return false;
    }
    // Ctrl+Shift+C / Cmd+Option+C (Element picker)
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'C') {
      e.preventDefault();
      return false;
    }
    // Ctrl+U / Cmd+U (View source)
    if ((e.ctrlKey || e.metaKey) && e.key === 'u') {
      e.preventDefault();
      return false;
    }
    // Ctrl+S / Cmd+S (Save page)
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      return false;
    }
    return true;
  }, { capture: true });

  // 4. Disable drag on images
  document.addEventListener('dragstart', (e) => {
    if (e.target instanceof HTMLImageElement) {
      e.preventDefault();
    }
  }, { capture: true });

  // 5. Disable copy/paste of page content (except inside input/textarea)
  document.addEventListener('copy', (e) => {
    const target = e.target as HTMLElement;
    const tag = target?.tagName?.toLowerCase();
    if (tag === 'input' || tag === 'textarea' || target?.isContentEditable) return;
    e.preventDefault();
  }, { capture: true });

  // 6. Detect devtools via debugger timing (subtle)
  let devtoolsOpen = false;
  const threshold = 160;
  const check = () => {
    const start = performance.now();
    // eslint-disable-next-line no-debugger
    debugger;
    const end = performance.now();
    if (end - start > threshold && !devtoolsOpen) {
      devtoolsOpen = true;
      document.body.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;background:#0a0a0a;color:#fff;text-align:center;padding:2rem"><div><h1 style="font-size:2rem;margin-bottom:1rem">⚠️ Security Alert</h1><p style="color:#999">Developer tools detected. This session has been terminated for security reasons.</p></div></div>';
    }
  };
  // Run check periodically but not too aggressively
  setInterval(check, 4000);

  // 7. Add CSS to prevent text selection on non-interactive elements
  const style = document.createElement('style');
  style.textContent = `
    body { -webkit-user-select: none; -moz-user-select: none; user-select: none; }
    input, textarea, [contenteditable="true"], pre, code, .selectable { -webkit-user-select: text; -moz-user-select: text; user-select: text; }
  `;
  document.head.appendChild(style);
}
