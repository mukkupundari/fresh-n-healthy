import { Routes } from '@angular/router';
import { adminGuestGuard, shopAdminGuard, superAdminGuard } from '../core/auth';

const shell = () => import('./admin-shell.component').then((m) => m.AdminShellComponent);

export const ADMIN_ROUTES: Routes = [
  { path: 'login', title: 'Shop console · Sign in', canActivate: [adminGuestGuard], loadComponent: () => import('./auth/admin-login.page').then((m) => m.AdminLoginPage) },
  { path: 'register', title: 'Register your shop', canActivate: [adminGuestGuard], loadComponent: () => import('./auth/admin-register.page').then((m) => m.AdminRegisterPage) },
  {
    path: 'platform',
    canActivate: [superAdminGuard],
    loadComponent: shell,
    children: [{ path: '', title: 'Platform · Shops', loadComponent: () => import('./platform.page').then((m) => m.PlatformPage) }],
  },
  {
    path: '',
    canActivate: [shopAdminGuard],
    loadComponent: shell,
    children: [
      { path: '', title: 'Dashboard', loadComponent: () => import('./dashboard.page').then((m) => m.DashboardPage) },
      { path: 'orders', title: 'Orders', loadComponent: () => import('./orders.page').then((m) => m.AdminOrdersPage) },
      { path: 'orders/:id', title: 'Order', loadComponent: () => import('./order-detail.page').then((m) => m.AdminOrderDetailPage) },
      { path: 'products', title: 'Products', loadComponent: () => import('./products.page').then((m) => m.AdminProductsPage) },
      { path: 'products/new', title: 'Add vegetables', loadComponent: () => import('./quick-add.page').then((m) => m.QuickAddPage) },
      { path: 'products/custom', title: 'Add product', loadComponent: () => import('./product-form.page').then((m) => m.ProductFormPage) },
      { path: 'products/:id', title: 'Edit product', loadComponent: () => import('./product-form.page').then((m) => m.ProductFormPage) },
      { path: 'inventory', title: 'Inventory', loadComponent: () => import('./inventory.page').then((m) => m.InventoryPage) },
      { path: 'customers', title: 'Customers', loadComponent: () => import('./customers.page').then((m) => m.CustomersPage) },
      { path: 'settings', title: 'Store settings', loadComponent: () => import('./settings.page').then((m) => m.SettingsPage) },
    ],
  },
];
