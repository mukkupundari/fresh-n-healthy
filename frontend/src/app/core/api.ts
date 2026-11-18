import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  Admin, AdminAuthResult, AdminCustomer, ApiError, CartLine, CartValidateResult, Category, Customer, CustomerAuthResult, Dashboard,
  Order, OrderStatus, OrderSummary, OtpRequestResult, PagedResult, PaymentStatus, PlaceOrderRequest, PlatformOverview, PlatformShop,
  Product, RegisterShopResult, RegistrationCheckResult, SaveProductRequest, ShopPaymentSetup, ShopPublic, ShopRegistrationDetails, ShopSettings,
  ShopSummary, StockAdjustMode, StockMovement,
} from './models';

/** Normalises any HTTP failure into the API's problem shape so UI code can show `title` directly. */
export function toApiError(err: unknown): ApiError {
  if (err instanceof HttpErrorResponse) {
    const body = err.error;
    if (body && typeof body === 'object' && 'title' in body) return body as ApiError;
    if (err.status === 0) return { status: 0, title: 'You appear to be offline. Check your connection and try again.', code: 'network' };
    return { status: err.status, title: 'Something went wrong. Please try again.', code: 'unknown' };
  }
  return { status: 0, title: 'Something went wrong. Please try again.', code: 'unknown' };
}

export function fieldErrors(err: ApiError): Record<string, string> {
  return err.details && typeof err.details === 'object' && !Array.isArray(err.details) ? (err.details as Record<string, string>) : {};
}

@Injectable({ providedIn: 'root' })
export class CatalogApi {
  private http = inject(HttpClient);
  categories(): Observable<Category[]> { return this.http.get<Category[]>('/api/categories'); }
  shops(): Observable<ShopSummary[]> { return this.http.get<ShopSummary[]>('/api/shops'); }
  shop(slug: string): Observable<ShopPublic> { return this.http.get<ShopPublic>(`/api/shops/${slug}`); }
  products(slug: string): Observable<Product[]> { return this.http.get<Product[]>(`/api/shops/${slug}/products`); }
  validateCart(shopId: number, items: CartLine[]): Observable<CartValidateResult> {
    return this.http.post<CartValidateResult>('/api/cart/validate', { shopId, items });
  }
}

@Injectable({ providedIn: 'root' })
export class CustomerApi {
  private http = inject(HttpClient);
  requestOtp(phone: string) { return this.http.post<OtpRequestResult>('/api/auth/otp/request', { phone }); }
  verifyOtp(phone: string, code: string, name?: string | null) { return this.http.post<CustomerAuthResult>('/api/auth/otp/verify', { phone, code, name }); }
  refresh() { return this.http.post<CustomerAuthResult>('/api/auth/refresh', {}); }
  logout() { return this.http.post<void>('/api/auth/logout', {}); }
  me() { return this.http.get<Customer>('/api/me'); }
  updateMe(body: Partial<Customer>) { return this.http.put<Customer>('/api/me', body); }
  placeOrder(body: PlaceOrderRequest) { return this.http.post<Order>('/api/orders', body); }
  orders() { return this.http.get<OrderSummary[]>('/api/orders'); }
  order(number: string) { return this.http.get<Order>(`/api/orders/${number}`); }
  cancelOrder(number: string, reason?: string) { return this.http.post<Order>(`/api/orders/${number}/cancel`, { reason }); }
  submitPaymentReference(number: string, reference: string) { return this.http.post<Order>(`/api/orders/${number}/payment-reference`, { reference }); }
  confirmPayment(number: string, reference?: string | null) { return this.http.post<Order>(`/api/orders/${number}/confirm-payment`, { reference: reference || null }); }
}

@Injectable({ providedIn: 'root' })
export class AdminApi {
  private http = inject(HttpClient);

  // auth
  checkRegistration(details: ShopRegistrationDetails) { return this.http.post<RegistrationCheckResult>('/api/admin/auth/register/check', details); }
  usernameAvailable(username: string) { return this.http.get<{ available: boolean }>('/api/admin/auth/username-available', { params: { username } }); }
  register(shop: ShopRegistrationDetails, payment: ShopPaymentSetup, username: string, password: string) {
    return this.http.post<RegisterShopResult>('/api/admin/auth/register', { shop, payment, username, password });
  }
  uploadRegistrationQr(file: File) {
    const form = new FormData();
    form.append('file', file);
    return this.http.post<{ url: string }>('/api/admin/auth/register/qr', form);
  }
  login(username: string, password: string) { return this.http.post<AdminAuthResult>('/api/admin/auth/login', { username, password }); }
  refresh() { return this.http.post<AdminAuthResult>('/api/admin/auth/refresh', {}); }
  logout() { return this.http.post<void>('/api/admin/auth/logout', {}); }
  me() { return this.http.get<Admin>('/api/admin/auth/me'); }

  // dashboard
  dashboard() { return this.http.get<Dashboard>('/api/admin/dashboard'); }

  // products
  products(filter: { search?: string; categoryId?: number | null; status?: string } = {}) {
    let params = new HttpParams();
    if (filter.search) params = params.set('search', filter.search);
    if (filter.categoryId) params = params.set('categoryId', filter.categoryId);
    if (filter.status && filter.status !== 'all') params = params.set('status', filter.status);
    return this.http.get<Product[]>('/api/admin/products', { params });
  }
  product(id: number) { return this.http.get<Product>(`/api/admin/products/${id}`); }
  createProduct(body: SaveProductRequest) { return this.http.post<Product>('/api/admin/products', body); }
  createProducts(items: SaveProductRequest[]) { return this.http.post<{ created: number }>('/api/admin/products/bulk', { items }); }
  updateProduct(id: number, body: SaveProductRequest) { return this.http.put<Product>(`/api/admin/products/${id}`, body); }
  setProductActive(id: number, value: boolean) { return this.http.patch<Product>(`/api/admin/products/${id}/status`, { value }); }
  setProductFeatured(id: number, value: boolean) { return this.http.patch<Product>(`/api/admin/products/${id}/featured`, { value }); }
  adjustStock(id: number, mode: StockAdjustMode, quantity: number, note?: string) {
    return this.http.post<Product>(`/api/admin/products/${id}/stock`, { mode, quantity, note });
  }
  deleteProduct(id: number) { return this.http.delete<{ deleted: boolean; deactivated: boolean; message: string }>(`/api/admin/products/${id}`); }
  movements(productId?: number | null, take = 100) {
    let params = new HttpParams().set('take', take);
    if (productId) params = params.set('productId', productId);
    return this.http.get<StockMovement[]>('/api/admin/inventory/movements', { params });
  }

  // orders
  orders(filter: { status?: OrderStatus | null; search?: string; paymentStatus?: PaymentStatus | null; page?: number; pageSize?: number }) {
    let params = new HttpParams().set('page', filter.page ?? 1).set('pageSize', filter.pageSize ?? 20);
    if (filter.status) params = params.set('status', filter.status);
    if (filter.paymentStatus) params = params.set('paymentStatus', filter.paymentStatus);
    if (filter.search) params = params.set('search', filter.search);
    return this.http.get<PagedResult<OrderSummary>>('/api/admin/orders', { params });
  }
  order(id: number) { return this.http.get<Order>(`/api/admin/orders/${id}`); }
  updateOrderStatus(id: number, status: OrderStatus, note?: string) { return this.http.patch<Order>(`/api/admin/orders/${id}/status`, { status, note }); }
  updatePaymentStatus(id: number, paymentStatus: PaymentStatus) { return this.http.patch<Order>(`/api/admin/orders/${id}/payment`, { paymentStatus }); }
  customers(search?: string) { return this.http.get<AdminCustomer[]>('/api/admin/customers', { params: search ? { search } : {} }); }

  // settings
  settings() { return this.http.get<ShopSettings>('/api/admin/settings'); }
  updateSettings(body: Omit<ShopSettings, 'id' | 'slug'>) { return this.http.put<ShopSettings>('/api/admin/settings', body); }
  upload(file: File, folder: 'products' | 'logos' | 'qr') {
    const form = new FormData();
    form.append('file', file);
    return this.http.post<{ url: string }>('/api/admin/uploads', form, { params: { folder } });
  }

  // platform
  platformOverview() { return this.http.get<PlatformOverview>('/api/platform/overview'); }
  platformShops() { return this.http.get<PlatformShop[]>('/api/platform/shops'); }
  setShopActive(id: number, value: boolean) { return this.http.patch<void>(`/api/platform/shops/${id}/status`, { value }); }
}
