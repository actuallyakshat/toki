import { describe, expect, it } from 'vitest';
import { extractCapture } from '@/utils/extract';

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
