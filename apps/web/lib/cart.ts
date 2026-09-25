import type { ProductResponse } from '@kletak/contracts';

export type CartItem = {
  product: ProductResponse;
  quantity: number;
};

const CART_KEY = 'kletak_cart_v1';

export function readCart(): CartItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const value = localStorage.getItem(CART_KEY);
    if (!value) return [];
    const parsed = JSON.parse(value) as CartItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function writeCart(items: CartItem[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(CART_KEY, JSON.stringify(items));
}

export function addToCart(product: ProductResponse, quantity = 1) {
  const items = readCart();
  const existing = items.find((item) => item.product.id === product.id);
  if (existing) {
    existing.quantity = Math.min(existing.quantity + quantity, product.stockAvailable || 99);
  } else {
    items.push({ product, quantity: Math.min(quantity, product.stockAvailable || quantity) });
  }
  writeCart(items);
  window.dispatchEvent(new Event('kletak-cart-updated'));
}

export function updateCartQuantity(productId: string, quantity: number) {
  const items = readCart()
    .map((item) => (item.product.id === productId ? { ...item, quantity } : item))
    .filter((item) => item.quantity > 0);
  writeCart(items);
  window.dispatchEvent(new Event('kletak-cart-updated'));
}

export function clearCart() {
  writeCart([]);
  window.dispatchEvent(new Event('kletak-cart-updated'));
}

export function cartCount(items = readCart()) {
  return items.reduce((sum, item) => sum + item.quantity, 0);
}
