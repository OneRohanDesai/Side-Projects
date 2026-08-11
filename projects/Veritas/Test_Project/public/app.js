const cart = new Map(); // id -> { id, name, price, qty }

const $ = (id) => document.getElementById(id);

async function api(path, opts) {
  const res = await fetch(path, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

function money(n) {
  return `$${Number(n).toFixed(2)}`;
}

function renderCart() {
  const list = $('cart-list');
  const btn = $('btn-checkout');
  if (!cart.size) {
    list.className = 'cart-list empty';
    list.textContent = 'Empty';
    btn.disabled = true;
    $('cart-total').textContent = '$0.00';
    return;
  }
  list.className = 'cart-list';
  let total = 0;
  list.innerHTML = '';
  for (const item of cart.values()) {
    total += item.price * item.qty;
    const row = document.createElement('div');
    row.className = 'cart-line';
    row.innerHTML = `<span>${item.name} × ${item.qty}</span><span>${money(item.price * item.qty)}</span>`;
    list.appendChild(row);
  }
  $('cart-total').textContent = money(total);
  btn.disabled = false;
}

function addToCart(item) {
  const cur = cart.get(item.id) || { ...item, qty: 0 };
  cur.qty += 1;
  cart.set(item.id, cur);
  renderCart();
}

async function loadCatalog() {
  const el = $('catalog');
  el.textContent = 'Loading…';
  try {
    const data = await api('/api/catalog');
    el.innerHTML = '';
    for (const item of data.items) {
      const row = document.createElement('div');
      row.className = 'item';
      row.innerHTML = `
        <div>
          <div class="name">${item.name}</div>
          <div style="color:var(--mute);font-size:0.8rem">${item.id}</div>
        </div>
        <div style="display:flex;align-items:center">
          <span class="price">${money(item.price)}</span>
          <button type="button" class="btn">Add</button>
        </div>`;
      row.querySelector('button').onclick = () => addToCart(item);
      el.appendChild(row);
    }
  } catch (e) {
    el.textContent = `Failed: ${e.message}`;
  }
}

async function loadOrders() {
  const el = $('orders');
  try {
    const data = await api('/api/orders');
    el.innerHTML = data.orders
      .map((o) => `${o.id} · ${o.status}`)
      .join('<br/>') || 'No orders';
  } catch (e) {
    el.textContent = e.message;
  }
}

async function loadStats() {
  try {
    const s = await api('/api/stats');
    const kpi = $('kpi');
    const vals = [
      s.requests,
      Math.round(s.latency_p99_ms),
      s.errors,
    ];
    [...kpi.querySelectorAll('.k')].forEach((n, i) => {
      n.textContent = vals[i];
    });
    $('status').textContent = `${s.service}@${s.version} · live`;
    $('status').className = 'status ok';
  } catch {
    $('status').textContent = 'API offline';
    $('status').className = 'status bad';
  }
}

async function checkout() {
  const msg = $('checkout-msg');
  msg.className = 'msg';
  msg.textContent = 'Placing order…';
  try {
    const data = await api('/api/checkout', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        items: [...cart.values()].map((i) => ({ id: i.id, qty: i.qty })),
      }),
    });
    msg.className = 'msg ok';
    msg.textContent = `Order ${data.order_id} · ${data.status} · ${data.latency_ms}ms`;
    cart.clear();
    renderCart();
    loadOrders();
    loadStats();
  } catch (e) {
    msg.className = 'msg err';
    msg.textContent = `Checkout failed: ${e.message}`;
    loadStats();
  }
}

$('btn-refresh').onclick = () => {
  loadCatalog();
  loadStats();
};
$('btn-orders').onclick = loadOrders;
$('btn-checkout').onclick = checkout;

loadCatalog();
loadOrders();
loadStats();
setInterval(loadStats, 4000);
