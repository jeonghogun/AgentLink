export type DeliveryRule = {
  type: string;
  [key: string]: unknown;
};

export type DeliveryInfo = {
  available: boolean;
  base_fee: number;
  rules: DeliveryRule[];
};

export type RatingInfo = {
  score: number;
  count: number;
};

export type Store = {
  id: string;
  name: string;
  region: string;
  status: 'open' | 'closed' | 'paused';
  delivery: DeliveryInfo;
  rating: RatingInfo;
  owner_uid: string;
  created_at?: string;
  updated_at?: string;
};

export type MenuOption = {
  id: string;
  name: string;
  price?: number;
};

export type MenuOptionGroup = {
  id: string;
  name: string;
  type: 'single_choice' | 'multi_select';
  options: MenuOption[];
};

export type Menu = {
  id: string;
  store_id: string;
  name: string;
  price: number;
  currency: string;
  stock: number;
  option_groups: MenuOptionGroup[];
  rating?: RatingInfo;
  images: string[];
  description?: string;
  title: string;
  title_v?: number;
  created_at?: string;
  updated_at?: string;
};

export type OrderTimelineEntry = {
  status: string;
  at: string;
};

export type OrderItem = {
  menu_id: string;
  name: string;
  qty: number;
  selected_options: string[];
  price: number;
};

export type Order = {
  id: string;
  user_id: string;
  status: string;
  payment_status: string;
  receipt_id: string;
  eta_minutes: number;
  items: OrderItem[];
  store_id: string;
  timeline: OrderTimelineEntry[];
  created_at?: string;
  updated_at?: string;
};

export type ApiErrorPayload = {
  code: string;
  message: string;
  hint?: string;
};

export type MenuPayload = {
  name: string;
  price: number;
  currency: string;
  stock: number;
  description?: string;
  option_groups: MenuOptionGroup[];
  images: string[];
};

export type StorePayload = {
  name: string;
  region: string;
  status: Store['status'];
  delivery: DeliveryInfo;
  rating: RatingInfo;
};
