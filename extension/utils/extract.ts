import { parsePriceMinor } from './money';
import type { Capture, Retailer } from './types';

/** Pure functions over a Document. Used in the page (popup capture) and in the offscreen document (refresh). */

export interface ExtractHints {
  /** `window.__myx.pdpData` from the Myntra page, read from the MAIN world. */
  myx?: unknown;
}

export interface ExtractResult {
  capture: Capture | null;
  /** False when the price came from the generic text scan. */
  confident: boolean;
  /** Which layer supplied the price, for debugging. */
  source: Layer | null;
}

type Layer = 'json-ld' | 'meta' | 'microdata' | 'adapter' | 'generic';

interface Fields {
  title?: string;
  image?: string;
  price?: number;
  currency?: string;
  original?: number;
  inStock?: boolean;
}

export function retailerFor(url: string, doc?: Document): Retailer {
  let host = '';
  try {
    host = new URL(url).hostname;
  } catch {
    return 'generic';
  }
  if (/(^|\.)amazon\.in$/.test(host)) return 'amazon_in';
  if (/(^|\.)flipkart\.com$/.test(host)) return 'flipkart';
  if (/(^|\.)myntra\.com$/.test(host)) return 'myntra';
  if (doc?.querySelector('script[src*="cdn.shopify.com"], link[href*="cdn.shopify.com"]')) return 'shopify';
  return 'generic';
}

export function extractCapture(doc: Document, url: string, hints: ExtractHints = {}): ExtractResult {
  const retailer = retailerFor(url, doc);
  const layers: [Layer, () => Fields][] = [
    ['json-ld', () => fromJsonLd(doc)],
    ['meta', () => fromMeta(doc)],
    ['microdata', () => fromMicrodata(doc)],
    ['adapter', () => fromAdapter(doc, retailer, hints)],
    ['generic', () => fromGeneric(doc)],
  ];

  const merged: Fields = {};
  let source: Layer | null = null;
  for (const [layer, read] of layers) {
    const fields = safely(read);
    if (merged.price === undefined && fields.price !== undefined) {
      merged.price = fields.price;
      merged.currency = fields.currency;
      merged.original = fields.original;
      source = layer;
    }
    merged.title ||= fields.title;
    merged.image ||= fields.image;
    merged.inStock ??= fields.inStock;
  }

  const title = clean(merged.title) || clean(doc.title);
  if (!title && merged.price === undefined) return { capture: null, confident: false, source };

  const capture: Capture = {
    source_url: url,
    title,
    image_url: absolute(merged.image, url),
    price_minor: merged.price ?? 0,
    currency: merged.currency ?? 'INR',
    original_price_minor:
      merged.original !== undefined && merged.price !== undefined && merged.original > merged.price
        ? merged.original
        : null,
    in_stock: merged.inStock ?? true,
    retailer,
  };
  return { capture, confident: source !== null && source !== 'generic', source };
}

function safely(read: () => Fields): Fields {
  try {
    return read();
  } catch {
    return {};
  }
}

function clean(text: string | null | undefined): string {
  return (text ?? '').replace(/\s+/g, ' ').trim();
}

function absolute(src: string | undefined, base: string): string {
  if (!src) return '';
  try {
    return new URL(src, base).href;
  } catch {
    return '';
  }
}

function currencyFrom(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const text = raw.trim().toUpperCase();
  if (/^[A-Z]{3}$/.test(text)) return text;
  if (/₹|RS\.?|INR/.test(text)) return 'INR';
  return undefined;
}

function textOf(doc: Document, selectors: string[]): string | undefined {
  for (const selector of selectors) {
    const text = clean(doc.querySelector(selector)?.textContent);
    if (text) return text;
  }
  return undefined;
}

function priceOf(doc: Document, selectors: string[]): number | undefined {
  for (const selector of selectors) {
    for (const el of Array.from(doc.querySelectorAll(selector)).slice(0, 4)) {
      const price = parsePriceMinor(el.getAttribute('content') ?? el.textContent ?? '');
      if (price) return price;
    }
  }
  return undefined;
}

/* ---------------------------------------------------------------- JSON-LD */

type Json = Record<string, unknown>;

function asArray<T>(value: T | T[] | undefined | null): T[] {
  return value === undefined || value === null ? [] : Array.isArray(value) ? value : [value];
}

function hasType(node: Json, type: string): boolean {
  return asArray(node['@type'] as string | string[]).some((t) => String(t).endsWith(type));
}

function collectNodes(value: unknown, out: Json[], depth = 0): void {
  if (depth > 6 || !value || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    for (const entry of value) collectNodes(entry, out, depth + 1);
    return;
  }
  const node = value as Json;
  out.push(node);
  collectNodes(node['@graph'], out, depth + 1);
  collectNodes(node.mainEntity, out, depth + 1);
  collectNodes(node.hasVariant, out, depth + 1);
}

function availability(value: unknown): boolean | undefined {
  if (typeof value !== 'string') return undefined;
  if (/OutOfStock|SoldOut|Discontinued/i.test(value)) return false;
  if (/InStock|LimitedAvailability|OnlineOnly|PreOrder|BackOrder/i.test(value)) return true;
  return undefined;
}

function imageUrl(value: unknown): string | undefined {
  const first = asArray(value as unknown)[0];
  if (typeof first === 'string') return first;
  if (first && typeof first === 'object') {
    const url = (first as Json).url ?? (first as Json).contentUrl;
    return typeof url === 'string' ? url : undefined;
  }
  return undefined;
}

function offerFields(offer: Json): Fields | null {
  const spec = asArray(offer.priceSpecification as Json | Json[]);
  const priced = spec.find((s) => !/List|Strikethrough|MSRP/i.test(String(s.priceType ?? '')));
  const original = spec.find((s) => /List|Strikethrough|MSRP/i.test(String(s.priceType ?? '')));

  const price =
    parsePriceMinor(offer.price) ??
    parsePriceMinor(offer.lowPrice) ??
    parsePriceMinor(priced?.price);
  if (!price) return null;
  return {
    price,
    currency: currencyFrom(offer.priceCurrency) ?? currencyFrom(priced?.priceCurrency),
    original: parsePriceMinor(original?.price) ?? undefined,
    inStock: availability(offer.availability),
  };
}

function fromJsonLd(doc: Document): Fields {
  const nodes: Json[] = [];
  for (const script of Array.from(doc.querySelectorAll('script[type="application/ld+json"]'))) {
    try {
      collectNodes(JSON.parse(script.textContent ?? ''), nodes);
    } catch {
      // Malformed JSON-LD is common; ignore this block.
    }
  }

  for (const product of nodes.filter((n) => hasType(n, 'Product') || hasType(n, 'ProductGroup'))) {
    const offers: Json[] = [];
    for (const raw of asArray(product.offers as Json | Json[])) {
      offers.push(raw);
      offers.push(...asArray(raw.offers as Json | Json[]));
    }
    const candidates = offers
      .filter((o) => hasType(o, 'Offer') || hasType(o, 'AggregateOffer') || 'price' in o || 'lowPrice' in o)
      .map(offerFields)
      .filter((f): f is Fields => f !== null);
    if (candidates.length === 0) continue;

    // Prefer offers that are in stock, then the cheapest.
    const pool = candidates.filter((c) => c.inStock !== false);
    const best = (pool.length ? pool : candidates).reduce((a, b) => (b.price! < a.price! ? b : a));
    return {
      ...best,
      title: typeof product.name === 'string' ? product.name : undefined,
      image: imageUrl(product.image),
    };
  }

  const named = nodes.find((n) => hasType(n, 'Product'));
  return named
    ? { title: typeof named.name === 'string' ? named.name : undefined, image: imageUrl(named.image) }
    : {};
}

/* ------------------------------------------------------------ meta / microdata */

function meta(doc: Document, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const el = doc.querySelector(`meta[property="${key}"], meta[name="${key}"], meta[itemprop="${key}"]`);
    const content = clean(el?.getAttribute('content'));
    if (content) return content;
  }
  return undefined;
}

function fromMeta(doc: Document): Fields {
  const price = parsePriceMinor(meta(doc, 'product:price:amount', 'og:price:amount', 'twitter:data1'));
  return {
    title: meta(doc, 'og:title', 'twitter:title'),
    image: meta(doc, 'og:image', 'og:image:secure_url', 'twitter:image'),
    price: price ?? undefined,
    currency: currencyFrom(meta(doc, 'product:price:currency', 'og:price:currency')),
    original: parsePriceMinor(meta(doc, 'product:original_price:amount')) ?? undefined,
    inStock: availability(meta(doc, 'product:availability', 'og:availability')),
  };
}

function fromMicrodata(doc: Document): Fields {
  const price = priceOf(doc, ['[itemprop="price"]']);
  const currencyEl = doc.querySelector('[itemprop="priceCurrency"]');
  const image = doc.querySelector('[itemprop="image"]');
  const stock = doc.querySelector('[itemprop="availability"]');
  return {
    title: clean(doc.querySelector('[itemprop="name"]')?.textContent) || undefined,
    image: image?.getAttribute('content') ?? image?.getAttribute('src') ?? image?.getAttribute('href') ?? undefined,
    price,
    currency: currencyFrom(currencyEl?.getAttribute('content') ?? currencyEl?.textContent),
    inStock: availability(stock?.getAttribute('href') ?? stock?.getAttribute('content') ?? stock?.textContent),
  };
}

/* ---------------------------------------------------------------- retailers */

function fromAdapter(doc: Document, retailer: Retailer, hints: ExtractHints): Fields {
  switch (retailer) {
    case 'amazon_in':
      return fromAmazon(doc);
    case 'flipkart':
      return fromFlipkart(doc);
    case 'myntra':
      return fromMyntra(doc, hints);
    default:
      return {};
  }
}

function fromAmazon(doc: Document): Fields {
  const price = priceOf(doc, [
    '#corePriceDisplay_desktop_feature_div .a-price:not(.a-text-price) .a-offscreen',
    '#corePrice_feature_div .a-price:not(.a-text-price) .a-offscreen',
    '#priceblock_dealprice',
    '#priceblock_ourprice',
    '#price_inside_buybox',
    '#tp_price_block_total_price_ww .a-offscreen',
    '.a-price:not(.a-text-price) .a-offscreen',
  ]) ?? wholePrice(doc);

  const img = doc.querySelector('#landingImage, #imgBlkFront, #main-image');
  let image = img?.getAttribute('data-old-hires') || undefined;
  if (!image) {
    const dynamic = img?.getAttribute('data-a-dynamic-image');
    if (dynamic) {
      try {
        image = Object.keys(JSON.parse(dynamic))[0];
      } catch {
        // fall through to src
      }
    }
  }
  image ||= img?.getAttribute('src') ?? undefined;

  const availabilityText = clean(doc.querySelector('#availability')?.textContent);
  return {
    title: textOf(doc, ['#productTitle', '#title', 'h1#title']),
    image,
    price,
    currency: 'INR',
    original: priceOf(doc, [
      '#corePriceDisplay_desktop_feature_div .a-price.a-text-price .a-offscreen',
      '#corePrice_feature_div .a-text-price .a-offscreen',
      '.basisPrice .a-offscreen',
    ]),
    inStock: doc.querySelector('#outOfStock') || /currently unavailable/i.test(availabilityText) ? false : undefined,
  };
}

function wholePrice(doc: Document): number | undefined {
  const whole = clean(doc.querySelector('.a-price-whole')?.textContent).replace(/[^\d,]/g, '');
  const fraction = clean(doc.querySelector('.a-price-fraction')?.textContent).replace(/\D/g, '');
  if (!whole) return undefined;
  return parsePriceMinor(`${whole}.${fraction || '00'}`) ?? undefined;
}

// Flipkart class names are build hashes and change often, so several generations are listed.
function fromFlipkart(doc: Document): Fields {
  return {
    title: textOf(doc, ['span.VU-ZEz', 'span.B_NuCI', 'h1 span', 'h1']),
    image:
      doc.querySelector('img.DByuf4, img._396cs4, img.vU5WPQ, ._2r_T1I img')?.getAttribute('src') ?? undefined,
    price: priceOf(doc, ['div.Nx9bqj.CxhGGd', 'div.Nx9bqj', 'div._30jeq3._16Jk6d', 'div._30jeq3', 'div[class*="Nx9bqj"]']),
    currency: 'INR',
    original: priceOf(doc, ['div.yRaY8j', 'div._3I9_wc._2p6lqe', 'div._3I9_wc']),
    inStock: /sold out|currently unavailable/i.test(clean(doc.body?.textContent).slice(0, 20000)) ? false : undefined,
  };
}

interface MyxPdp {
  name?: string;
  brand?: { name?: string };
  price?: { mrp?: number; discounted?: number };
  mrp?: number;
  media?: { albums?: { images?: { imageURL?: string; secureSrc?: string }[] }[] };
  flags?: { outOfStock?: boolean };
}

function myntraImage(pdp: MyxPdp): string | undefined {
  const raw = pdp.media?.albums?.[0]?.images?.[0];
  const src = raw?.secureSrc ?? raw?.imageURL;
  return src?.replace('($height)', '720').replace('($qualityPercentage)', '90').replace('($width)', '540');
}

/** Finds `window.__myx = {...}` in inline script text by matching braces. */
function myxFromScripts(doc: Document): unknown {
  for (const script of Array.from(doc.querySelectorAll('script:not([src])'))) {
    const text = script.textContent ?? '';
    const start = text.indexOf('window.__myx');
    if (start === -1) continue;
    const open = text.indexOf('{', start);
    if (open === -1) continue;
    let depth = 0;
    let inString: string | null = null;
    for (let i = open; i < text.length; i++) {
      const ch = text[i];
      if (inString) {
        if (ch === '\\') i++;
        else if (ch === inString) inString = null;
      } else if (ch === '"' || ch === "'") inString = ch;
      else if (ch === '{') depth++;
      else if (ch === '}' && --depth === 0) {
        try {
          return JSON.parse(text.slice(open, i + 1));
        } catch {
          return undefined;
        }
      }
    }
  }
  return undefined;
}

function fromMyntra(doc: Document, hints: ExtractHints): Fields {
  const source = (hints.myx ?? myxFromScripts(doc)) as { pdpData?: MyxPdp } | MyxPdp | undefined;
  const pdp = (source && 'pdpData' in source ? source.pdpData : source) as MyxPdp | undefined;

  if (pdp) {
    const discounted = parsePriceMinor(pdp.price?.discounted);
    const mrp = parsePriceMinor(pdp.price?.mrp ?? pdp.mrp);
    const price = discounted ?? mrp ?? undefined;
    return {
      title: [pdp.brand?.name, pdp.name].filter(Boolean).join(' ') || undefined,
      image: myntraImage(pdp),
      price,
      currency: 'INR',
      original: mrp ?? undefined,
      inStock: pdp.flags?.outOfStock === undefined ? undefined : !pdp.flags.outOfStock,
    };
  }

  return {
    title: textOf(doc, ['h1.pdp-title', 'h1.pdp-name']),
    price: priceOf(doc, ['.pdp-price strong', 'span.pdp-price']),
    currency: 'INR',
    original: priceOf(doc, ['.pdp-mrp s', 'span.pdp-mrp']),
    image: doc.querySelector('.image-grid-image, .image-grid-imageContainer img')?.getAttribute('src') ?? undefined,
  };
}

/* ------------------------------------------------------------------ generic */

const RUPEE_PRICE = /(?:₹|Rs\.?|INR)\s*([\d,]+(?:\.\d{1,2})?)/i;

function fromGeneric(doc: Document): Fields {
  let largest: { src: string; area: number } | null = null;
  for (const img of Array.from(doc.querySelectorAll('img'))) {
    const src = img.getAttribute('src') ?? img.getAttribute('data-src');
    if (!src || src.startsWith('data:')) continue;
    const area =
      (Number(img.getAttribute('width')) || (img as HTMLImageElement).naturalWidth || 0) *
      (Number(img.getAttribute('height')) || (img as HTMLImageElement).naturalHeight || 0);
    if (!largest || area > largest.area) largest = { src, area };
  }

  const body = doc.body?.cloneNode(true) as HTMLElement | undefined;
  body?.querySelectorAll('script, style, noscript, template').forEach((el) => el.remove());
  const match = clean(body?.textContent).match(RUPEE_PRICE);

  return {
    title: clean(doc.title) || textOf(doc, ['h1']),
    image: largest?.src,
    price: match ? (parsePriceMinor(match[1]) ?? undefined) : undefined,
    currency: match ? 'INR' : undefined,
  };
}
