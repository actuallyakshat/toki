import { describe, expect, it } from 'vitest';
import { extractCapture, mayBeProductPage } from '@/utils/extract';

function parse(html: string, url: string) {
  document.documentElement.innerHTML = html;
  return extractCapture(document, url);
}

const ld = (obj: unknown) => `<head><script type="application/ld+json">${JSON.stringify(obj)}</script></head>`;

describe('JSON-LD', () => {
  it('reads a Product with a string price and availability', () => {
    const { capture, confident, source } = parse(
      ld({
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: 'Sony WH-1000XM5',
        image: ['/img/a.jpg'],
        offers: {
          '@type': 'Offer',
          price: '24,990.00',
          priceCurrency: 'INR',
          availability: 'https://schema.org/InStock',
        },
      }),
      'https://shop.example.in/p/xm5',
    );
    expect(capture).toMatchObject({
      title: 'Sony WH-1000XM5',
      image_url: 'https://shop.example.in/img/a.jpg',
      price_minor: 2499000,
      currency: 'INR',
      in_stock: true,
      retailer: 'generic',
    });
    expect(confident).toBe(true);
    expect(source).toBe('json-ld');
  });

  it('handles @graph, arrays and AggregateOffer', () => {
    const { capture } = parse(
      ld({
        '@graph': [
          { '@type': 'WebSite', name: 'Shop' },
          {
            '@type': ['Product', 'Thing'],
            name: 'Kettle',
            image: { '@type': 'ImageObject', url: 'https://cdn.example/k.jpg' },
            offers: [
              { '@type': 'AggregateOffer', lowPrice: 1499, priceCurrency: 'INR' },
              { '@type': 'Offer', price: 1999, priceCurrency: 'INR', availability: 'OutOfStock' },
            ],
          },
        ],
      }),
      'https://x.example/k',
    );
    expect(capture?.price_minor).toBe(149900);
    expect(capture?.image_url).toBe('https://cdn.example/k.jpg');
  });

  it('marks out of stock and ignores broken JSON-LD blocks', () => {
    const html = `<head><script type="application/ld+json">{oops</script>${ld({
      '@type': 'Product',
      name: 'Lamp',
      offers: { '@type': 'Offer', price: 800, availability: 'https://schema.org/OutOfStock' },
    }).replace('<head>', '')}</head>`;
    const { capture } = parse(html, 'https://x.example/l');
    expect(capture?.in_stock).toBe(false);
    expect(capture?.currency).toBe('INR');
  });
});

describe('meta and microdata', () => {
  it('reads OpenGraph product price', () => {
    const { capture, source } = parse(
      `<head><meta property="og:title" content="Desk"><meta property="og:image" content="https://i/x.jpg">
       <meta property="product:price:amount" content="7,499.00"><meta property="product:price:currency" content="INR"></head>`,
      'https://x.example/d',
    );
    expect(capture).toMatchObject({ title: 'Desk', price_minor: 749900 });
    expect(source).toBe('meta');
  });

  it('reads itemprop price', () => {
    const { capture, source } = parse(
      `<body><h1 itemprop="name">Chair</h1><span itemprop="price" content="3499"></span><meta itemprop="priceCurrency" content="INR"></body>`,
      'https://x.example/c',
    );
    expect(capture).toMatchObject({ title: 'Chair', price_minor: 349900 });
    expect(source).toBe('microdata');
  });
});

describe('retailer adapters (fixtures are guesses, not live pages)', () => {
  it('amazon.in', () => {
    const { capture, source } = parse(
      `<head><title>Amazon.in: Echo</title></head><body>
       <span id="productTitle"> Echo Dot (5th Gen) </span>
       <img id="landingImage" src="https://m.media/small.jpg" data-old-hires="https://m.media/big.jpg">
       <div id="corePriceDisplay_desktop_feature_div">
         <span class="a-price a-text-price"><span class="a-offscreen">₹6,499.00</span></span>
         <span class="a-price"><span class="a-offscreen">₹4,499.00</span></span>
       </div><div id="availability">Currently unavailable.</div></body>`,
      'https://www.amazon.in/dp/B0CHX1W1XY',
    );
    expect(capture).toMatchObject({
      title: 'Echo Dot (5th Gen)',
      image_url: 'https://m.media/big.jpg',
      price_minor: 449900,
      original_price_minor: 649900,
      in_stock: false,
      retailer: 'amazon_in',
    });
    expect(source).toBe('adapter');
  });

  it('amazon.in falls back to a-price-whole', () => {
    const { capture } = parse(
      `<span id="productTitle">Book</span><span class="a-price-whole">1,299</span><span class="a-price-fraction">50</span>`,
      'https://www.amazon.in/dp/X',
    );
    expect(capture?.price_minor).toBe(129950);
  });

  it('flipkart', () => {
    const { capture } = parse(
      `<span class="VU-ZEz">Realme Narzo</span><div class="Nx9bqj CxhGGd">₹12,999</div><div class="yRaY8j">₹15,999</div>`,
      'https://www.flipkart.com/realme/p/itm1',
    );
    expect(capture).toMatchObject({ price_minor: 1299900, original_price_minor: 1599900, retailer: 'flipkart' });
  });

  it('myntra from inline window.__myx script', () => {
    const myx = {
      pdpData: {
        name: 'Slim Fit Shirt',
        brand: { name: 'Roadster' },
        price: { mrp: 1999, discounted: 799 },
        media: { albums: [{ images: [{ imageURL: 'http://assets.myntassets.com/h_($height),q_($qualityPercentage),w_($width)/a.jpg' }] }] },
        flags: { outOfStock: false },
      },
    };
    const { capture } = parse(
      `<head><script>window.__myx = ${JSON.stringify(myx)}; window.other = {};</script></head>`,
      'https://www.myntra.com/shirts/roadster/123/buy',
    );
    expect(capture).toMatchObject({
      title: 'Roadster Slim Fit Shirt',
      price_minor: 79900,
      original_price_minor: 199900,
      in_stock: true,
      retailer: 'myntra',
    });
    expect(capture?.image_url).toContain('h_720,q_90,w_540');
  });

  it('myntra from MAIN-world hints', () => {
    document.documentElement.innerHTML = '<head><title>Shirt</title></head>';
    const { capture } = extractCapture(document, 'https://www.myntra.com/x', {
      myx: { name: 'Tee', price: { mrp: 500, discounted: 450 } },
    });
    expect(capture?.price_minor).toBe(45000);
  });
});

describe('generic fallback', () => {
  it('uses the first rupee price and the largest image, flagged low confidence', () => {
    const { capture, confident } = parse(
      `<head><title>Handmade lamp</title></head><body>
       <script>var price = "₹1";</script>
       <img src="/tiny.png" width="20" height="20"><img src="/big.jpg" width="800" height="600">
       <p>Now only Rs. 2,450.00 for a limited time</p></body>`,
      'https://small.example/lamp',
    );
    expect(capture).toMatchObject({ title: 'Handmade lamp', price_minor: 245000, image_url: 'https://small.example/big.jpg' });
    expect(confident).toBe(false);
  });

  it('returns a capture without a price when none is found', () => {
    const { capture } = parse(`<head><title>About us</title></head><body>Hello</body>`, 'https://x.example/about');
    expect(capture?.price_minor).toBe(0);
  });
});

describe('pages with many products', () => {
  const cards = (n: number) =>
    Array.from({ length: n }, (_, i) => `<div><span class="a-price"><span class="a-offscreen">₹${(i + 1) * 1000}</span></span></div>`).join('');

  it('treats the amazon.in home page as a listing, not a product priced from its first card', () => {
    const result = parse(
      `<head><title>Online Shopping site in India</title><meta property="og:title" content="Amazon.in"></head>
       <body><span class="a-price-whole">1,799</span>${cards(8)}</body>`,
      'https://www.amazon.in/',
    );
    expect(result).toMatchObject({ capture: null, listing: true });
  });

  it('treats amazon.in and flipkart search pages as listings', () => {
    expect(parse(`<body>${cards(3)}</body>`, 'https://www.amazon.in/s?k=headphones').listing).toBe(true);
    expect(
      parse(`<div class="Nx9bqj">₹999</div><h1>Phones</h1>`, 'https://www.flipkart.com/search?q=phone').listing,
    ).toBe(true);
  });

  it('keeps an amazon.in product page a product even with many prices in carousels', () => {
    const { capture, listing } = parse(
      `<span id="productTitle">Echo</span>
       <div id="corePrice_feature_div"><span class="a-price"><span class="a-offscreen">₹4,499</span></span></div>${cards(10)}`,
      'https://www.amazon.in/Echo-Dot/dp/B0CHX1W1XY?ref=abc',
    );
    expect(listing).toBe(false);
    expect(capture?.price_minor).toBe(449900);
  });

  it('treats a generic page with many prices and no product data as a listing', () => {
    const prices = Array.from({ length: 8 }, (_, i) => `<p>Lamp ${i} ₹${(i + 1) * 250}</p>`).join('');
    expect(parse(`<head><title>All lamps</title></head><body>${prices}</body>`, 'https://shop.example/lamps')).toMatchObject({
      capture: null,
      listing: true,
    });
  });

  it('trusts product JSON-LD over the price count', () => {
    const prices = Array.from({ length: 8 }, (_, i) => `<p>₹${(i + 1) * 250}</p>`).join('');
    const { capture, listing } = parse(
      `${ld({ '@type': 'Product', name: 'Lamp', offers: { '@type': 'Offer', price: '1999', priceCurrency: 'INR' } })}<body>${prices}</body>`,
      'https://shop.example/lamp',
    );
    expect(listing).toBe(false);
    expect(capture?.price_minor).toBe(199900);
  });

  it('treats an ItemList of different products as a listing', () => {
    const item = (name: string, price: string) => ({ '@type': 'Product', name, offers: { '@type': 'Offer', price } });
    const result = parse(
      ld({
        '@type': 'ItemList',
        itemListElement: [
          { '@type': 'ListItem', item: item('A', '100') },
          { '@type': 'ListItem', item: item('B', '200') },
          { '@type': 'ListItem', item: item('C', '300') },
        ],
      }),
      'https://shop.example/collections/all',
    );
    expect(result).toMatchObject({ capture: null, listing: true });
  });

  it('does not count variants of one product as many products', () => {
    const { capture, listing } = parse(
      ld({
        '@type': 'ProductGroup',
        name: 'Tee',
        hasVariant: ['S', 'M', 'L'].map((size) => ({
          '@type': 'Product',
          name: `Tee ${size}`,
          offers: { '@type': 'Offer', price: '499', priceCurrency: 'INR' },
        })),
      }),
      'https://shop.example/products/tee',
    );
    expect(listing).toBe(false);
    expect(capture?.price_minor).toBe(49900);
  });
});

describe('price refresh of a saved product (knownProduct)', () => {
  it('keeps the guessed price on a page that would otherwise count as a listing', () => {
    const prices = Array.from({ length: 8 }, (_, i) => `<p>₹${(i + 1) * 250}</p>`).join('');
    document.documentElement.innerHTML = `<head><title>Lamp</title></head><body>${prices}</body>`;
    const { capture, listing } = extractCapture(document, 'https://shop.example/lamp', { knownProduct: true });
    expect(listing).toBe(false);
    expect(capture?.price_minor).toBe(25000);
  });

  it('reads a known store URL without a product path', () => {
    document.documentElement.innerHTML = `<span class="VU-ZEz">Phone</span><div class="Nx9bqj">₹9,999</div>`;
    const { capture } = extractCapture(document, 'https://dl.flipkart.com/s/abc', { knownProduct: true });
    expect(capture?.price_minor).toBe(999900);
  });

  it('keeps the first product of a JSON-LD list', () => {
    const item = (name: string, price: string) => ({ '@type': 'Product', name, offers: { '@type': 'Offer', price } });
    document.documentElement.innerHTML = ld([item('A', '100'), item('B', '200'), item('C', '300')]);
    const { capture } = extractCapture(document, 'https://shop.example/a', { knownProduct: true });
    expect(capture).toMatchObject({ title: 'A', price_minor: 10000 });
  });
});

describe('mayBeProductPage', () => {
  const check = (html: string, url: string) => {
    document.documentElement.innerHTML = html;
    return mayBeProductPage(document, url);
  };

  it('passes known stores and pages with product data', () => {
    expect(check('<body></body>', 'https://www.amazon.in/')).toBe(true);
    expect(check(ld({ '@type': 'Product', name: 'Lamp' }), 'https://shop.example/lamp')).toBe(true);
    expect(check('<head><meta property="og:type" content="og:product"></head>', 'https://shop.example/a')).toBe(true);
    expect(check('<span itemprop="price" content="10"></span>', 'https://shop.example/b')).toBe(true);
  });

  it('skips other pages', () => {
    expect(check('<head><title>News</title></head><body>₹100</body>', 'https://news.example/story')).toBe(false);
  });
});
