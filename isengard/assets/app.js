const API = '/isengard-api';
const state = { posts: [], category: 'All', query: '' };
const list = document.querySelector('#playbook-list');
const esc = (value = '') => String(value).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
function render() {
  const matches = state.posts.filter(p => (state.category === 'All' || p.category === state.category) && `${p.title} ${p.summary} ${(p.tags || []).join(' ')}`.toLowerCase().includes(state.query));
  document.querySelector('#result-count').textContent = `${matches.length} playbook${matches.length === 1 ? '' : 's'}`;
  list.innerHTML = matches.map(p => `<article class="playbook-card"><div class="card-top"><p class="card-category">${esc(p.category)}</p><span class="read-time">${esc(p.reading_time || 'Field note')}</span></div><h3><a class="card-link" href="post/?slug=${encodeURIComponent(p.slug)}">${esc(p.title)}</a></h3><p class="card-summary">${esc(p.summary)}</p><div class="card-bottom"><div class="tags">${(p.tags || []).map(t => `<span class="tag">${esc(t)}</span>`).join('')}</div><span class="arrow">↗</span></div></article>`).join('');
  document.querySelector('#empty-state').hidden = Boolean(matches.length);
}
function filters() { const categories = ['All', ...new Set(state.posts.map(p => p.category))]; document.querySelector('#filters').innerHTML = categories.map(c => `<button class="filter ${c === state.category ? 'active' : ''}" data-category="${esc(c)}">${esc(c)}</button>`).join(''); }
async function boot() { try { const response = await fetch(`${API}/playbooks`); if (!response.ok) throw Error(); state.posts = await response.json(); filters(); render(); } catch { list.innerHTML = '<p class="empty-state">The library is being prepared. Connect the Cloudflare API to publish your playbooks.</p>'; } }
document.querySelector('#search').addEventListener('input', e => { state.query = e.target.value.toLowerCase().trim(); render(); });
document.querySelector('#filters').addEventListener('click', e => { if (!e.target.matches('[data-category]')) return; state.category = e.target.dataset.category; filters(); render(); });
document.querySelector('#clear-search').onclick = () => { state.query = ''; state.category = 'All'; document.querySelector('#search').value = ''; filters(); render(); };
document.querySelector('#year').textContent = new Date().getFullYear(); boot();
