export type MenuDocument = {
  store_id?: string;
  name?: string;
  price?: number;
  currency?: string;
  stock?: number;
  rating?: {
    score?: number;
    count?: number;
  } | null;
  title?: string;
  title_v?: number | string;
};

export type StoreDocument = {
  name?: string;
  region?: string;
  status?: string;
  delivery?: {
    available?: boolean;
    base_fee?: number;
    rules?: unknown[];
  } | null;
};

const DEFAULTS = {
  region: 'unknown-region',
  storeName: 'unknown-store',
  menuName: 'unknown-menu',
  price: 0,
  baseFee: 0,
  currency: 'KRW',
  ratingScore: 0,
  status: 'unknown-status',
  stock: 0,
} as const;

function normaliseToken(value: unknown): string {
  const raw = value === undefined || value === null ? '' : String(value);
  const trimmed = raw.trim();
  if (!trimmed) {
    return '';
  }
  return trimmed.replace(/\s+/g, '-');
}

export function buildTitle(menuDoc: Partial<MenuDocument> | null | undefined, storeDoc: Partial<StoreDocument> | null | undefined): string {
  const menu = menuDoc ?? {};
  const store = storeDoc ?? {};
  const delivery = store.delivery ?? {};
  const menuRating = menu.rating ?? {};

  const parts = [
    normaliseToken(store.region ?? DEFAULTS.region) || DEFAULTS.region,
    normaliseToken(store.name ?? DEFAULTS.storeName) || DEFAULTS.storeName,
    normaliseToken(menu.name ?? DEFAULTS.menuName) || DEFAULTS.menuName,
    normaliseToken(menu.price ?? DEFAULTS.price) || String(DEFAULTS.price),
    normaliseToken((delivery as { base_fee?: number }).base_fee ?? DEFAULTS.baseFee) || String(DEFAULTS.baseFee),
    normaliseToken(menu.currency ?? DEFAULTS.currency) || DEFAULTS.currency,
    normaliseToken((menuRating as { score?: number }).score ?? DEFAULTS.ratingScore) || String(DEFAULTS.ratingScore),
    normaliseToken(store.status ?? DEFAULTS.status) || DEFAULTS.status,
    normaliseToken(menu.stock ?? DEFAULTS.stock) || String(DEFAULTS.stock),
  ];

  return `${parts.join('_')}__hogun`;
}
