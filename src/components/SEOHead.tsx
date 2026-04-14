import { useEffect } from 'react';
import { useSettings } from '@/hooks/useSettings';

interface SEOHeadProps {
  title?: string;
  description?: string;
  canonical?: string;
  ogImage?: string;
  ogType?: string;
  jsonLd?: Record<string, any>;
  article?: {
    publishedTime?: string;
    modifiedTime?: string;
    author?: string;
    tags?: string[];
  };
  breadcrumbs?: { name: string; url: string }[];
  noindex?: boolean;
}

const FALLBACK_NAME = 'Online Textile School';
const FALLBACK_DESC = "Bangladesh's premier online learning platform for textile engineering. Courses in Spinning, Weaving, Dyeing, Knitting, Garments Technology and more.";
const SITE_URL = 'https://onlinetextileschool.com';

const SEOHead = ({
  title,
  description,
  canonical,
  ogImage,
  ogType = 'website',
  jsonLd,
  article,
  breadcrumbs,
  noindex,
}: SEOHeadProps) => {
  const { data: settings } = useSettings();

  const siteName = settings?.site_name || FALLBACK_NAME;
  const siteTagline = settings?.site_tagline || 'Learn Textile Engineering Online';
  const metaDesc = description || settings?.site_description || FALLBACK_DESC;
  const metaKeywords = settings?.meta_keywords || '';
  const defaultOgImage = ogImage || settings?.og_image_url || '';
  const twitterHandle = settings?.twitter_handle || '';
  const googleVerification = settings?.google_site_verification || '';
  const logoUrl = settings?.logo_url || '/logo-192.png';

  const fullTitle = title ? `${title} — ${siteName}` : `${siteName} — ${siteTagline}`;
  const pageUrl = canonical || SITE_URL + window.location.pathname;

  useEffect(() => {
    document.title = fullTitle;

    const setMeta = (property: string, content: string, isName = false) => {
      if (!content) return;
      const attr = isName ? 'name' : 'property';
      let el = document.querySelector(`meta[${attr}="${property}"]`) as HTMLMetaElement | null;
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute(attr, property);
        document.head.appendChild(el);
      }
      el.setAttribute('content', content);
    };

    // Basic meta
    setMeta('description', metaDesc, true);
    if (metaKeywords) setMeta('keywords', metaKeywords, true);
    if (noindex) setMeta('robots', 'noindex, nofollow', true);

    // Google verification
    if (googleVerification) setMeta('google-site-verification', googleVerification, true);

    // Open Graph
    setMeta('og:title', fullTitle);
    setMeta('og:description', metaDesc);
    setMeta('og:type', article ? 'article' : ogType);
    setMeta('og:site_name', siteName);
    setMeta('og:url', pageUrl);
    if (defaultOgImage) setMeta('og:image', defaultOgImage);

    // Article meta
    if (article) {
      if (article.publishedTime) setMeta('article:published_time', article.publishedTime);
      if (article.modifiedTime) setMeta('article:modified_time', article.modifiedTime);
      if (article.author) setMeta('article:author', article.author);
      article.tags?.forEach((tag, i) => setMeta(`article:tag`, tag));
    }

    // Twitter Card
    setMeta('twitter:card', 'summary_large_image', true);
    setMeta('twitter:title', fullTitle, true);
    setMeta('twitter:description', metaDesc, true);
    if (defaultOgImage) setMeta('twitter:image', defaultOgImage, true);
    if (twitterHandle) setMeta('twitter:site', twitterHandle, true);

    // Canonical
    let link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement('link');
      link.setAttribute('rel', 'canonical');
      document.head.appendChild(link);
    }
    link.setAttribute('href', pageUrl);

    // Favicon from settings
    const faviconUrl = settings?.favicon_url || '/logo-192.png';
    let favLink = document.querySelector('link[rel="icon"]') as HTMLLinkElement | null;
    if (!favLink) {
      favLink = document.createElement('link');
      favLink.setAttribute('rel', 'icon');
      document.head.appendChild(favLink);
    }
    favLink.setAttribute('href', faviconUrl);

    // JSON-LD
    const existingScripts = document.querySelectorAll('script[data-seo-jsonld]');
    existingScripts.forEach((s) => s.remove());

    const ldItems: Record<string, any>[] = [];

    // Organization / EducationalOrganization
    const orgLd = jsonLd || {
      '@context': 'https://schema.org',
      '@type': 'EducationalOrganization',
      name: siteName,
      url: SITE_URL,
      description: metaDesc,
      logo: logoUrl.startsWith('http') ? logoUrl : `${SITE_URL}${logoUrl}`,
      sameAs: [
        settings?.facebook_url,
        settings?.youtube_url,
        settings?.linkedin_url,
      ].filter(Boolean),
      address: { '@type': 'PostalAddress', addressCountry: 'BD' },
      contactPoint: settings?.contact_email ? {
        '@type': 'ContactPoint',
        email: settings.contact_email,
        telephone: settings?.contact_phone || undefined,
        contactType: 'customer service',
      } : undefined,
    };
    ldItems.push(orgLd);

    // WebSite with SearchAction (enables Google Sitelinks Search Box)
    ldItems.push({
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: siteName,
      url: SITE_URL,
      potentialAction: {
        '@type': 'SearchAction',
        target: {
          '@type': 'EntryPoint',
          urlTemplate: `${SITE_URL}/courses?q={search_term_string}`,
        },
        'query-input': 'required name=search_term_string',
      },
    });

    // BreadcrumbList
    if (breadcrumbs && breadcrumbs.length > 0) {
      ldItems.push({
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: breadcrumbs.map((bc, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          name: bc.name,
          item: bc.url.startsWith('http') ? bc.url : `${SITE_URL}${bc.url}`,
        })),
      });
    }

    ldItems.forEach((ld, i) => {
      const script = document.createElement('script');
      script.type = 'application/ld+json';
      script.setAttribute('data-seo-jsonld', `true-${i}`);
      script.textContent = JSON.stringify(ld);
      document.head.appendChild(script);
    });

    return () => {
      document.querySelectorAll('script[data-seo-jsonld]').forEach((s) => s.remove());
    };
  }, [fullTitle, metaDesc, canonical, defaultOgImage, ogType, jsonLd, metaKeywords, twitterHandle, googleVerification, siteName, settings, article, breadcrumbs, noindex, pageUrl, logoUrl]);

  return null;
};

export default SEOHead;