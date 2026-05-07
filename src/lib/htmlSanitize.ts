// Lightweight HTML sanitizer using DOMParser. No external deps.
// Strips Facebook/Word/Docs junk: classes, inline styles, event handlers,
// data-attrs, FB emoji pixel <img>s, scripts/iframes/styles.

const ALLOWED_TAGS = new Set([
  'P', 'BR', 'STRONG', 'B', 'EM', 'I', 'U', 'S', 'STRIKE',
  'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
  'UL', 'OL', 'LI',
  'A', 'BLOCKQUOTE', 'HR', 'IMG', 'CODE', 'PRE',
  'DIV', 'SPAN',
]);

const SAFE_IFRAME_HOSTS = ['youtube.com', 'youtube-nocookie.com', 'youtu.be', 'player.vimeo.com'];

const isFbEmojiImg = (src: string) =>
  /static\.(xx\.)?fbcdn\.net\/images\/emoji\.php/i.test(src) || /emoji\.php\/v\d+/i.test(src);

const stripAttrs = (el: Element) => {
  for (const attr of Array.from(el.attributes)) {
    const name = attr.name.toLowerCase();
    if (
      name === 'style' ||
      name === 'class' ||
      name.startsWith('on') ||
      name.startsWith('data-') ||
      name === 'aria-hidden' ||
      name === 'role'
    ) {
      el.removeAttribute(attr.name);
    }
  }
};

const unwrap = (el: Element) => {
  const parent = el.parentNode;
  if (!parent) return;
  while (el.firstChild) parent.insertBefore(el.firstChild, el);
  parent.removeChild(el);
};

const walk = (root: Element) => {
  const all = Array.from(root.querySelectorAll('*'));
  for (const el of all) {
    const tag = el.tagName.toUpperCase();

    if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'LINK' || tag === 'META') {
      el.remove();
      continue;
    }

    if (tag === 'IFRAME') {
      const src = (el.getAttribute('src') || '').toLowerCase();
      if (!SAFE_IFRAME_HOSTS.some((h) => src.includes(h))) {
        el.remove();
        continue;
      }
      stripAttrs(el);
      continue;
    }

    if (tag === 'IMG') {
      const src = el.getAttribute('src') || '';
      if (!src || isFbEmojiImg(src)) {
        // Replace FB emoji pixels with their alt text (the actual emoji char)
        const alt = el.getAttribute('alt') || '';
        if (alt && el.parentNode) {
          el.parentNode.replaceChild(document.createTextNode(alt), el);
        } else {
          el.remove();
        }
        continue;
      }
      stripAttrs(el);
      el.setAttribute('loading', 'lazy');
      continue;
    }

    if (tag === 'A') {
      stripAttrs(el);
      const href = el.getAttribute('href') || '';
      if (/^javascript:/i.test(href)) el.removeAttribute('href');
      el.setAttribute('target', '_blank');
      el.setAttribute('rel', 'noopener noreferrer');
      continue;
    }

    if (!ALLOWED_TAGS.has(tag)) {
      unwrap(el);
      continue;
    }

    stripAttrs(el);

    // Unwrap empty span/div with no remaining attributes & only text/inline children
    if ((tag === 'SPAN' || tag === 'DIV') && el.attributes.length === 0) {
      // keep it; harmless wrapper
    }
  }
};

export const sanitizeRichHtml = (input: string | null | undefined): string => {
  if (!input) return '';
  const trimmed = String(input).trim();
  if (!trimmed) return '';

  // If looks like plain text (no tags), return as-is wrapped in <p>
  if (!/<[a-z!\/]/i.test(trimmed)) {
    return trimmed
      .split(/\n{2,}/)
      .map((p) => `<p>${p.replace(/\n/g, '<br/>')}</p>`)
      .join('');
  }

  try {
    const doc = new DOMParser().parseFromString(`<div id="__root">${trimmed}</div>`, 'text/html');
    const root = doc.getElementById('__root');
    if (!root) return '';
    walk(root);
    return root.innerHTML.trim();
  } catch {
    return '';
  }
};
