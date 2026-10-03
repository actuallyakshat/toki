export interface User {
  id: string;
  email: string;
  name: string;
  created_at: string;
}

export interface Profile {
  currency: string;
  monthly_income_minor: number | null;
  hours_per_week: number | null;
  income_storage: 'server' | 'device';
  alert_mode: 'instant' | 'digest';
  email_alerts: boolean;
}

export interface WishList {
  id: string;
  name: string;
  emoji?: string;
  item_count: number;
}

/** The fields of a saved Item the extension uses. */
export interface SavedItem {
  id: string;
  list_id: string;
  status: 'wanted' | 'bought' | 'removed';
}

export type Retailer = 'amazon_in' | 'flipkart' | 'myntra' | 'shopify' | 'generic';

export interface Capture {
  source_url: string;
  title: string;
  image_url: string;
  price_minor: number;
  currency: string;
  original_price_minor: number | null;
  in_stock: boolean;
  retailer: Retailer;
}

export interface RefreshTask {
  product_id: string;
  url: string;
  retailer: Retailer;
}

export interface RefreshResult {
  product_id: string;
  capture?: Capture;
  error?: string;
}
