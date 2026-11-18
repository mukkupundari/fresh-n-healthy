export type ProductUnit = 'Kg' | 'Piece' | 'Bunch' | 'Pack';
export type OrderStatus = 'Pending' | 'Confirmed' | 'Processing' | 'ReadyForDelivery' | 'Completed' | 'Cancelled';
export type PaymentMethod = 'Upi' | 'Cod';
export type PaymentStatus = 'Pending' | 'Paid' | 'Failed' | 'Refunded';
export type FulfillmentType = 'Delivery' | 'Pickup';
export type StockMovementReason = 'Initial' | 'Restock' | 'Sale' | 'Cancellation' | 'Correction';

export interface Category { id: number; name: string; slug: string; }

export interface ShopSummary {
  id: number; name: string; slug: string; tagline: string | null; logoUrl: string | null;
  city: string; isOpen: boolean; deliveryEta: string; productCount: number;
}

export interface ShopPublic {
  id: number; name: string; slug: string; tagline: string | null; logoUrl: string | null;
  addressLine: string; city: string; pincode: string; contactPhone: string; isOpen: boolean;
  acceptsUpi: boolean; upiId: string | null; upiPayeeName: string | null; upiQrUrl: string | null; acceptsCod: boolean;
  deliveryEnabled: boolean; pickupEnabled: boolean; deliveryFee: number; freeDeliveryAbove: number | null;
  minOrderAmount: number; deliveryEta: string;
}

export interface Product {
  id: number; shopId: number; categoryId: number; categoryName: string; categorySlug: string;
  name: string; localName: string | null; description: string | null; imageUrl: string; unit: ProductUnit; price: number;
  stockQuantity: number; minOrderQuantity: number; stepQuantity: number; lowStockThreshold: number;
  isActive: boolean; isFeatured: boolean; sortOrder: number; updatedAt: string;
}

export interface CartLine { productId: number; quantity: number; }

export interface StockIssue { productId: number; productName: string; requested: number; available: number; reason: string; }
export interface CartValidateResult { isValid: boolean; products: Product[]; issues: StockIssue[]; subtotal: number; }

export interface Customer {
  id: number; phone: string; name: string; email: string | null;
  addressLine: string | null; landmark: string | null; city: string | null; pincode: string | null;
}
export interface CustomerAuthResult { accessToken: string; expiresAt: string; customer: Customer; }
export interface OtpRequestResult { expiresInSeconds: number; isNewUser: boolean; devCode: string | null; }

export interface OrderItem { productId: number; productName: string; imageUrl: string; unit: ProductUnit; unitPrice: number; quantity: number; lineTotal: number; }
export interface OrderHistory { status: OrderStatus; note: string | null; changedBy: string; changedAt: string; }
export interface ShopPaymentInfo { upiId: string | null; upiPayeeName: string | null; upiQrUrl: string | null; contactPhone: string; }

export interface Order {
  id: number; orderNumber: string; shopId: number; shopName: string; shopSlug: string; status: OrderStatus;
  paymentMethod: PaymentMethod; paymentStatus: PaymentStatus; paymentReference: string | null; fulfillment: FulfillmentType;
  subtotal: number; deliveryFee: number; total: number; customerName: string; customerPhone: string;
  deliveryAddress: string | null; notes: string | null; cancelReason: string | null; createdAt: string; updatedAt: string;
  items: OrderItem[]; history: OrderHistory[]; payment: ShopPaymentInfo;
  paymentClaimedAt: string | null; invoiceSentAt: string | null; seller: SellerInfo;
}
export interface SellerInfo { addressLine: string; city: string; pincode: string; licenseNumber: string | null; gstNumber: string | null; }

export interface OrderSummary {
  id: number; orderNumber: string; shopName: string; status: OrderStatus; paymentMethod: PaymentMethod; paymentStatus: PaymentStatus;
  fulfillment: FulfillmentType; total: number; itemCount: number; customerName: string; customerPhone: string; createdAt: string; thumbnails: string[];
}

export interface PlaceOrderRequest {
  shopId: number; items: CartLine[]; paymentMethod: PaymentMethod; fulfillment: FulfillmentType; customerName: string;
  addressLine?: string | null; landmark?: string | null; city?: string | null; pincode?: string | null; notes?: string | null; idempotencyKey: string;
}

export interface ApiError { status: number; title: string; code: string; details?: unknown; }

// ---------- Admin ----------
export interface Admin {
  id: number; fullName: string; username: string; email: string; phone: string; role: 'SuperAdmin' | 'ShopAdmin';
  shopId: number | null; shopName: string | null; shopSlug: string | null; shopLogoUrl: string | null;
}
export interface AdminAuthResult { accessToken: string; expiresAt: string; admin: Admin; }

export interface ShopRegistrationDetails {
  shopName: string; ownerName: string; email: string; phone: string; licenseNumber: string | null; gstNumber: string | null;
  addressLine: string; city: string; pincode: string;
}
export interface ShopPaymentSetup { acceptsUpi: boolean; upiId: string | null; upiPayeeName: string | null; upiQrUrl: string | null; acceptsCod: boolean; }
export interface RegistrationCheckResult { ok: boolean; errors: Record<string, string>; }
export interface RegisterShopResult { shopId: number; shopName: string; username: string; }

export interface SaveProductRequest {
  name: string; localName: string | null; description: string | null; categoryId: number; imageUrl: string; unit: ProductUnit; price: number;
  stockQuantity: number | null; minOrderQuantity: number; stepQuantity: number; lowStockThreshold: number; isActive: boolean; isFeatured: boolean;
}

export type StockAdjustMode = 'Add' | 'Remove' | 'Set';
export interface StockMovement {
  id: number; productId: number; productName: string; change: number; balanceAfter: number; reason: StockMovementReason;
  orderNumber: string | null; note: string | null; createdBy: string; createdAt: string;
}

export interface PagedResult<T> { items: T[]; total: number; page: number; pageSize: number; }

export interface DailySales { date: string; amount: number; orders: number; }
export interface StatusCount { status: OrderStatus; count: number; }
export interface TopProduct { productId: number; name: string; imageUrl: string; quantity: number; revenue: number; unit: ProductUnit; }
export interface Dashboard {
  totalProducts: number; availableProducts: number; soldOutProducts: number; lowStockProducts: number; inactiveProducts: number;
  totalOrders: number; pendingOrders: number; completedOrders: number; cancelledOrders: number;
  totalSales: number; todaySales: number; todayOrders: number; totalCustomers: number;
  salesLast14Days: DailySales[]; statusBreakdown: StatusCount[]; topProducts: TopProduct[]; lowStock: Product[]; recentOrders: OrderSummary[];
}

export interface AdminCustomer { id: number; name: string; phone: string; email: string | null; city: string | null; orders: number; totalSpent: number; lastOrderAt: string | null; joinedAt: string; }

export interface ShopSettings {
  id: number; name: string; slug: string; ownerName: string; email: string; phone: string; licenseNumber: string | null; gstNumber: string | null;
  addressLine: string; city: string; pincode: string; logoUrl: string | null; tagline: string | null;
  contactPhone: string; isOpen: boolean; acceptsUpi: boolean; upiId: string | null; upiPayeeName: string | null; upiQrUrl: string | null;
  acceptsCod: boolean; deliveryEnabled: boolean; pickupEnabled: boolean; deliveryFee: number; freeDeliveryAbove: number | null;
  minOrderAmount: number; deliveryEta: string;
}

export interface PlatformShop {
  id: number; name: string; slug: string; ownerName: string; email: string; phone: string; licenseNumber: string | null; city: string;
  isActive: boolean; isOpen: boolean; products: number; orders: number; sales: number; createdAt: string;
}
export interface PlatformOverview { shops: number; activeShops: number; customers: number; orders: number; sales: number; }
