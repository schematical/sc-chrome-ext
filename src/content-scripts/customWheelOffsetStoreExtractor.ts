// src/content-scripts/customWheelOffsetStoreExtractor.ts
// Extract filters and products from Custom Wheel Offset store pages

type FilterOption = {
  label: string;
  value: string;
  url: string;
};

type FilterGroup = {
  key: string;
  name: string;
  options: FilterOption[];
};

type RangeFilter = {
  key: 'price' | 'weight';
  name: string;
  min?: number;
  max?: number;
  currentMin?: number;
  currentMax?: number;
};

type ProductCard = {
  url: string;
  image?: string;
  brand?: string;
  model?: string;
  size?: string; // e.g., 20x12 -51
  price?: number;
  originalPrice?: number;
  rating?: number; // 1-5
  reviewCount?: number;
  badges?: string[];
};

type Pagination = {
  currentPage?: number;
  totalPages?: number;
  nextUrl?: string;
  prevUrl?: string;
};

type StoreData = {
  filters: FilterGroup[];
  rangeFilters: RangeFilter[];
  products: ProductCard[];
  pagination: Pagination;
  meta: { url: string; title: string };
};

const PARAM_LABELS: Record<string, string> = {
  year: 'Year',
  make: 'Make',
  model: 'Model',
  trim: 'Trim',
  drive: 'Drive',
  dia: 'Wheel Diameter',
  width: 'Wheel Width',
  offset: 'Wheel Offset',
  brand: 'Brand',
  mat: 'Material',
  color: 'Finish',
  reviews: 'Avg. Customer Review',
  bolt: 'Bolt Pattern',
  price: 'Price',
  weight: 'Weight',
  min: 'Price Min',
  max: 'Price Max',
  minWeight: 'Weight Min',
  maxWeight: 'Weight Max',
  price_min: 'Price Min',
  price_max: 'Price Max',
  weight_min: 'Weight Min',
  weight_max: 'Weight Max',
};

const KNOWN_PARAMS = new Set(Object.keys(PARAM_LABELS));

function absoluteUrl(href: string): string {
  try {
    return new URL(href, location.origin).toString();
  } catch {
    return href;
  }
}

function extractFiltersFromLinks(): FilterGroup[] {
  const groups = new Map<string, FilterGroup>();
  const anchors = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href*="/store/wheels"]'));

  for (const a of anchors) {
    const href = a.getAttribute('href') || '';
    const url = absoluteUrl(href);
    let u: URL | null = null;
    try { u = new URL(url); } catch { continue; }
    if (!u.pathname.includes('/store/wheels')) continue;

    // For each known param present, add an option using the link label
    for (const [key, value] of u.searchParams.entries()) {
      if (!KNOWN_PARAMS.has(key)) continue;

      const label = (a.textContent || value).trim().replace(/\s+/g, ' ');
      if (!label) continue;

      const group = groups.get(key) || {
        key,
        name: PARAM_LABELS[key] || key,
        options: [],
      };

      // Deduplicate by value
      if (!group.options.some((opt) => opt.value === value)) {
        group.options.push({ label, value, url });
      }

      groups.set(key, group);
    }
  }

  // Sort options alphabetically per group for stable output
  for (const g of groups.values()) {
    g.options.sort((a, b) => a.label.localeCompare(b.label));
  }

  // Order groups in a useful order
  const order = ['year', 'make', 'model', 'trim', 'drive', 'brand', 'dia', 'width', 'offset', 'bolt', 'mat', 'color', 'reviews', 'price', 'weight'];
  return Array.from(groups.values()).sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));
}

function parseNumber(text?: string): number | undefined {
  if (!text) return undefined;
  const cleaned = text.replace(/[^0-9.\-]/g, '');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : undefined;
}

function extractRangeFilterByHeading(headingText: string, key: RangeFilter['key']): RangeFilter | null {
  // Find heading by text and then scan nearby for spinbuttons or number inputs
  const headings = Array.from(document.querySelectorAll<HTMLElement>('h2, h3'));
  const heading = headings.find(h => (h.textContent || '').trim().toLowerCase() === headingText.toLowerCase());
  if (!heading) return null;

  // Look within the same section block
  const section = heading.closest('*');
  if (!section) return null;

  const inputs = Array.from(section.querySelectorAll<HTMLInputElement>('input[role="spinbutton"], input[type="number"], input[aria-valuenow]'));
  if (inputs.length < 1) return { key, name: headingText };

  // Try to detect min/max by label proximity or order
  let currentMin: number | undefined;
  let currentMax: number | undefined;
  for (const input of inputs) {
    const valNow = input.getAttribute('aria-valuenow') || input.value;
    const n = parseNumber(valNow);
    if (n === undefined) continue;
    if (currentMin === undefined) currentMin = n; else currentMax = n;
  }

  return { key, name: headingText, currentMin, currentMax };
}

function extractRangeFilters(): RangeFilter[] {
  const res: RangeFilter[] = [];
  const price = extractRangeFilterByHeading('Price', 'price');
  if (price) res.push(price);
  const weight = extractRangeFilterByHeading('Weight', 'weight');
  if (weight) res.push(weight);
  return res;
}

function extractProducts(): ProductCard[] {
  const anchors = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href*="/buy-wheel-offset/"]'));
  const seen = new Set<string>();
  const products: ProductCard[] = [];

  for (const a of anchors) {
    const url = absoluteUrl(a.href);
    if (seen.has(url)) continue;

    // Try to ensure we are in the results grid, not a sidebar or header link
    // Heuristic: anchor contains an image + at least a brand/model heading
    const img = a.querySelector('img');
    const brandEl = a.querySelector('h3');
    const modelEl = a.querySelector('h4');
    if (!img && !brandEl && !modelEl) continue;

    const text = (a.textContent || '').replace(/\s+/g, ' ').trim();

    // Extract size like 20x12 -51, 18x9 -12, etc.
    const sizeMatch = text.match(/\b\d{2,2}(?:\.\d+)?x\d{1,2}(?:\.\d+)?(?:\s*[+\-]\d+)?\b/);

    // Extract price(s). Prefer the highest $ value in the card (ea price tends to be the largest)
    const priceMatches = [...text.matchAll(/\$\s*([\d,]+(?:\.\d{2})?)/g)].map(m => parseNumber(m[1]));
    const price = priceMatches.length ? Math.max(...(priceMatches.filter((n): n is number => typeof n === 'number') as number[])) : undefined;

    // Original price (if "Was $NNN")
    const originalMatch = text.match(/Was\s*\$\s*([\d,]+(?:\.\d{2})?)/i);
    const originalPrice = originalMatch ? parseNumber(originalMatch[1]) : undefined;

    // Review count
    const reviewMatch = text.match(/(\d{1,3}(?:,\d{3})*)\s+Reviews/i);
    const reviewCount = reviewMatch ? parseNumber(reviewMatch[1]) : undefined;

    // Rating: count of star characters in card (approx), fallback undefined
    const starCount = (text.match(/★/g) || []).length;
    const rating = starCount ? Math.min(5, starCount) : undefined;

    // Badges
    const badges: string[] = [];
    const badgeKeywords = ['BEST SELLER', 'On Sale', 'Package Discount', 'Sale', 'Free DELIVERY'];
    for (const kw of badgeKeywords) {
      if (text.toLowerCase().includes(kw.toLowerCase())) badges.push(kw);
    }

    // Image src prioritizing data-srcset, srcset, then src
    let image: string | undefined;
    if (img) {
      image = (img.getAttribute('data-srcset') || img.getAttribute('srcset') || img.getAttribute('src') || undefined) || undefined;
    }

    products.push({
      url,
      image,
      brand: brandEl?.textContent?.trim() || undefined,
      model: modelEl?.textContent?.trim() || undefined,
      size: sizeMatch?.[0],
      price,
      originalPrice,
      rating,
      reviewCount,
      badges: badges.length ? badges : undefined,
    });

    seen.add(url);
  }

  return products;
}

function extractPagination(): Pagination {
  const pagination: Pagination = {};
  // Look for "Page X/Y" text anywhere
  const bodyText = document.body.innerText;
  const m = bodyText.match(/Page\s+(\d+)\s*\/\s*(\d+)/i);
  if (m) {
    pagination.currentPage = parseNumber(m[1]);
    pagination.totalPages = parseNumber(m[2]);
  }

  // Next/Prev links
  const next = document.querySelector<HTMLAnchorElement>('a[href*="?store=wheels&page="]:not([aria-disabled="true"])');
  if (next) pagination.nextUrl = absoluteUrl(next.href);

  // Try to find a previous link by text
  const prevByText = Array.from(document.querySelectorAll<HTMLAnchorElement>('a')).find(a => /prev/i.test(a.textContent || ''));
  if (prevByText) pagination.prevUrl = absoluteUrl(prevByText.href);

  return pagination;
}

function extractStoreData(): StoreData {
  return {
    filters: extractFiltersFromLinks(),
    rangeFilters: extractRangeFilters(),
    products: extractProducts(),
    pagination: extractPagination(),
    meta: { url: location.href, title: document.title },
  };
}

// Message handler to be called by background/popup
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request?.type === 'CWO_GET_STORE_DATA') {
    try {
      const data = extractStoreData();
      sendResponse({ success: true, data });
    } catch (error: any) {
      sendResponse({ success: false, error: error?.message || String(error) });
    }
    return true; // async
  } else if (request?.type === 'CWO_GET_VEHICLE_DATA') {
    try {
      // Try page localStorage backup first (set by VehicleStorage in content context)
      let raw: string | null = null;
      try { raw = localStorage.getItem('vehicleData'); } catch {}
      if (raw) {
        try { return sendResponse({ success: true, data: JSON.parse(raw) }); } catch {}
      }
      // Fallback to chrome.storage.local (should be shared across contexts)
      chrome.storage.local.get(['vehicleData'], (res) => {
        if ((chrome.runtime as any).lastError) {
          return sendResponse({ success: false, error: (chrome.runtime as any).lastError.message });
        }
        const data = res['vehicleData'] || null;
        sendResponse({ success: !!data, data, error: data ? undefined : 'No vehicle data in storage' });
      });
    } catch (error: any) {
      sendResponse({ success: false, error: error?.message || String(error) });
    }
    return true; // async
  }
});

// Ensure treated as a module
export {};
