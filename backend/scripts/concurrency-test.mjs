// Fires N simultaneous orders for the same product from different customers and checks that stock never oversells.
// Usage: node concurrency-test.mjs [baseUrl] [shopSlug] [productName] [qtyPerOrder] [customers]
import crypto from 'node:crypto';

const [base = 'http://localhost:5168', slug = 'green-basket', productName = 'Green Chilli', qtyArg = '3', countArg = '10'] = process.argv.slice(2);
const qty = Number(qtyArg);
const count = Number(countArg);

async function api(path, body, token) {
  const res = await fetch(base + path, {
    method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, data: text ? JSON.parse(text) : null };
}

const shop = (await api(`/api/shops/${slug}`)).data;
const product = (await api(`/api/shops/${slug}/products`)).data.find((p) => p.name === productName);
console.log(`${productName}: stock before = ${product.stockQuantity}, ${count} customers each ordering ${qty}`);

const tokens = [];
for (let i = 0; i < count; i++) {
  const phone = `70000000${String(i).padStart(2, '0')}`;
  const { data } = await api('/api/auth/otp/request', { phone });
  const verify = await api('/api/auth/otp/verify', { phone, code: data?.devCode, name: `Load Tester ${i}` });
  if (verify.status !== 200) throw new Error(`Login failed for ${phone}: ${verify.status} ${JSON.stringify(verify.data)}`);
  tokens.push(verify.data.accessToken);
}

const results = await Promise.all(tokens.map((token, i) => api('/api/orders', {
  shopId: shop.id,
  items: [{ productId: product.id, quantity: qty }],
  paymentMethod: 'Cod',
  fulfillment: 'Pickup',
  customerName: `Load Tester ${i}`,
  idempotencyKey: crypto.randomUUID(),
}, token)));

const ok = results.filter((r) => r.status === 200);
const conflicts = results.filter((r) => r.status === 409);
const after = (await api(`/api/shops/${slug}/products`)).data.find((p) => p.id === product.id);
console.log(`succeeded: ${ok.length}, rejected (409): ${conflicts.length}, other: ${results.length - ok.length - conflicts.length}`);
if (conflicts[0]) console.log('sample rejection:', conflicts[0].data.title, JSON.stringify(conflicts[0].data.details?.[0]));
console.log(`stock after = ${after.stockQuantity} (expected ${product.stockQuantity - ok.length * qty})`);
console.log(after.stockQuantity >= 0 && after.stockQuantity === product.stockQuantity - ok.length * qty ? 'PASS: no overselling' : 'FAIL');
