import { useEffect } from 'react';
import { useSettings } from '@/hooks/useSettings';

interface SEOHeadProps {
  title?: string;
  description?: string;
  canonical?: string;
  ogImage?: string;
  ogType?: string;
  jsonLd?: Record<string, any>;
}

const FALLBACK_NAME = 'Online Textile School';
const FALLBACK_DESC = "Bangladesh's premier online learning platform for textile engineering. Courses in Spinning, Weaving, Dyeing, Knitting, Garments Technology and more.";

const SEOHead = ({
  title,
  description,
  canonical,
  ogImage,
  ogType = 'website',
  jsonLd,
}: SEOHeadProps) => {
  const { data: settings } = useSettings();

  const siteName = settings?.site_name || FALLBACK_NAME;
  const siteTagline = settings?.site_tagline || 'Learn Textile Engineering Online';
  const metaDesc = description || settings?.site_description || FALLBACK_DESC;
  const metaKeywords = settings?.meta_keywords || '';
  const defaultOgImage = ogImage || settings?.og_image_url || '';
  const twitterHandle = settings?.twitter_handle || '';
  const googleVerification = settings?.google_site_verification || '';

  const fullTitle = title ? `${title} — ${siteName}` : `${siteName} — ${siteTagline}`;

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

    // Google verification
    if (googleVerification) setMeta('google-site-verification', googleVerification, true);

    // Open Graph
    setMeta('og:title', fullTitle);
    setMeta('og:description', metaDesc);
    setMeta('og:type', ogType);
    setMeta('og:site_name', siteName);
    if (defaultOgImage) setMeta('og:image', defaultOgImage);

    // Twitter Card
    setMeta('twitter:card', 'summary_large_image', true);
    setMeta('twitter:title', fullTitle, true);
    setMeta('twitter:description', metaDesc, true);
    if (defaultOgImage) setMeta('twitter:image', defaultOgImage, true);
    if (twitterHandle) setMeta('twitter:site', twitterHandle, true);

    // Canonical
    let link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    const url = canonical || window.location.origin + window.location.pathname;
    if (!link) {
      link = document.createElement('link');
      link.setAttribute('rel', 'canonical');
      document.head.appendChild(link);
    }
    link.setAttribute('href', url);

    // Favicon from settings
    const faviconUrl = settings?.favicon_url;
    if (faviconUrl) {
      let favLink = document.querySelector('link[rel="icon"]') as HTMLLinkElement | null;
      if (!favLink) {
        favLink = document.createElement('link');
        favLink.setAttribute('rel', 'icon');
        document.head.appendChild(favLink);
      }
      favLink.setAttribute('href', faviconUrl);
    }

    // JSON-LD
    const existingScript = document.querySelector('script[data-seo-jsonld]');
    if (existingScript) existingScript.remove();
    const ldData = jsonLd || {
      '@context': 'https://schema.org',
      '@type': 'EducationalOrganization',
      name: siteName,
      url: window.location.origin,
      description: metaDesc,
      ...(defaultOgImage ? { logo: defaultOgImage } : {}),
      sameAs: [
        settings?.facebook_url,
        settings?.youtube_url,
        settings?.linkedin_url,
      ].filter(Boolean),
      address: { '@type': 'PostalAddress', addressCountry: 'BD' },
    };
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.setAttribute('data-seo-jsonld', 'true');
    script.textContent = JSON.stringify(ldData);
    document.head.appendChild(script);

    return () => {
      const s = document.querySelector('script[data-seo-jsonld]');
      if (s) s.remove();
    };
  }, [fullTitle, metaDesc, canonical, defaultOgImage, ogType, jsonLd, metaKeywords, twitterHandle, googleVerification, siteName, settings]);

  return null;
};

export default SEOHead;
