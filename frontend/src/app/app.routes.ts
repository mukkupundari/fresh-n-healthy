import { Routes } from '@angular/router';
import { customerGuard, customerGuestGuard } from './core/auth';

export const routes: Routes = [
  { path: 'admin', loadChildren: () => import('./admin/admin.routes').then((m) => m.ADMIN_ROUTES) },
  { path: 'login', title: 'Sign in', canActivate: [customerGuestGuard], loadComponent: () => import('./customer/login.page').then((m) => m.LoginPage) },
  { path: 'orders/:number/invoice', title: 'Invoice', canActivate: [customerGuard], loadComponent: () => import('./customer/invoice.page').then((m) => m.InvoicePage) },
  {
    path: '',
    loadComponent: () => import('./customer/customer-shell.component').then((m) => m.CustomerShellComponent),
    children: [
      { path: '', title: 'Fresh n Healthy — Farm-fresh vegetables', loadComponent: () => import('./customer/home.page').then((m) => m.HomePage) },
      { path: 'stores', title: 'Choose a store', loadComponent: () => import('./customer/stores.page').then((m) => m.StoresPage) },
      { path: 'product/:id', data: { chrome: 'minimal', hideCart: true }, loadComponent: () => import('./customer/product.page').then((m) => m.ProductPage) },
      { path: 'cart', title: 'Your cart', data: { chrome: 'minimal', hideCart: true }, loadComponent: () => import('./customer/cart.page').then((m) => m.CartPage) },
      { path: 'checkout', title: 'Checkout', canActivate: [customerGuard], data: { chrome: 'minimal', hideCart: true }, loadComponent: () => import('./customer/checkout.page').then((m) => m.CheckoutPage) },
      { path: 'order-success/:number', title: 'Complete payment', canActivate: [customerGuard], data: { chrome: 'minimal', hideCart: true }, loadComponent: () => import('./customer/order-success.page').then((m) => m.OrderSuccessPage) },
      { path: 'orders', title: 'My orders', canActivate: [customerGuard], loadComponent: () => import('./customer/orders.page').then((m) => m.OrdersPage) },
      { path: 'orders/:number', title: 'Order details', canActivate: [customerGuard], data: { chrome: 'minimal', hideCart: true }, loadComponent: () => import('./customer/order-detail.page').then((m) => m.OrderDetailPage) },
      { path: 'profile', title: 'My profile', canActivate: [customerGuard], loadComponent: () => import('./customer/profile.page').then((m) => m.ProfilePage) },
    ],
  },
  { path: '**', redirectTo: '' },
];
