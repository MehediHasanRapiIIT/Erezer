export interface Product {
  id: string;
  slug: string;
  name: string;
  description: string;
  price: number;
  image: string;
  category: 'Tops' | 'Outerwear' | 'Bottoms' | 'Accessories';
  sizes: string[];
  rating: number;
  isFeatured?: boolean;
  inStock: number;
}

export interface CartItem {
  productId: string;
  variantId: number | null;
  quantity: number;
  size: string;
  // Self-contained display/pricing data so the cart renders without depending
  // on the products() list and reflects per-variant pricing.
  unitPrice: number;
  name: string;
  image: string | null;
}

export interface UserProfile {
  name: string;
  email: string;
  address: string;
  city: string;
  country: string;
}

export interface Order {
  id: string;
  items: CartItem[];
  payment: {
    method: 'Card' | 'Cash on Delivery' | 'Mobile Wallet';
    status: 'Pending' | 'Paid' | 'Failed';
    transactionId: string;
  };
  delivery: {
    status: 'Processing' | 'Packed' | 'Shipped' | 'Out for Delivery' | 'Delivered';
    estimatedDate: string;
    trackingNumber: string;
  };
  shippingAddress: UserProfile;
  subtotal: number;
  shippingFee: number;
  discount: number;
  total: number;
  appliedPromoCode?: string;
  createdAt: string;
}

export interface Review {
  id: string;
  productId: string;
  name: string;
  rating: 1 | 2 | 3 | 4 | 5;
  comment: string;
  createdAt: string;
}
