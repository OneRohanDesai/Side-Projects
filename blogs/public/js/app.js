(function () {
  const params = new URLSearchParams(location.search);
  const topicFilter = params.get("topic") || "";
  const qInput = document.getElementById("search");
  const feed = document.getElementById("feed");
  const counts = {
    "game-theory": document.querySelector('[data-count="game-theory"]'),
    poker: document.querySelector('[data-count="poker"]'),
    geopolitics: document.querySelector('[data-count="geopolitics"]'),
  };

  document.querySelectorAll(".nav-chip").forEach((el) => {
    if (el.dataset.topic === topicFilter) el.classList.add("active");
    if (!topicFilter && el.dataset.topic === "") el.classList.add("active");
  });

  document.querySelectorAll(".world").forEach((el) => {
    el.addEventListener("click", () => {
      location.href = "./?topic=" + encodeURIComponent(el.dataset.topic);
    });
  });

  async function load() {
    feed.innerHTML = `<div class="empty">Loading the ledger…</div>`;
    try {
      const data = await InkAPI.posts({
        topic: topicFilter || undefined,
        status: "published",
        q: (qInput && qInput.value.trim()) || undefined,
      });
      const posts = data.posts || [];
      renderFeed(posts);
      updateCounts();
    } catch (err) {
      feed.innerHTML = `<div class="empty">Could not reach Inkboard API. Is the worker running?<br/><span style="color:var(--danger)">${InkRender.esc(err.message)}</span></div>`;
    }
  }

  async function updateCounts() {
    try {
      const all = await InkAPI.posts({ status: "published" });
      const tally = { "game-theory": 0, poker: 0, geopolitics: 0 };
      for (const p of all.posts || []) {
        if (tally[p.topic] != null) tally[p.topic]++;
      }
      for (const k of Object.keys(counts)) {
        if (counts[k]) counts[k].textContent = tally[k] + (tally[k] === 1 ? " piece" : " pieces");
      }
    } catch (_) {}
  }

  function renderFeed(posts) {
    if (!posts.length) {
      feed.innerHTML = `<div class="empty">No published pieces here yet. The page is warm and waiting.</div>`;
      return;
    }
    feed.innerHTML = posts
      .map((p, i) => {
        const label = InkRender.TOPIC_LABEL[p.topic] || p.topic;
        const num = String(i + 1).padStart(2, "0");
        const date = (p.publishedAt || p.updatedAt || "").slice(0, 10);
        return `
          <a class="card" href="./post.html?slug=${encodeURIComponent(p.slug)}" data-topic="${p.topic}" style="--topic: ${topicColor(p.topic)}">
            <div class="idx">${num}</div>
            <div>
              <h4>${InkRender.esc(p.title)}</h4>
              <div class="excerpt">${InkRender.esc(p.excerpt || "")}</div>
              <div class="meta">
                <span class="pill topic">${InkRender.esc(label)}</span>
                <span class="pill">${p.readingMinutes} min</span>
              </div>
            </div>
            <div class="side">${InkRender.esc(date)}</div>
          </a>`;
      })
      .join("");
  }

  function topicColor(t) {
    if (t === "poker") return "#7dcea0";
    if (t === "geopolitics") return "#6b8cae";
    if (t === "game-theory") return "#c4a0ff";
    return "#d4b483";
  }

  let t;
  if (qInput) {
    qInput.addEventListener("input", () => {
      clearTimeout(t);
      t = setTimeout(load, 220);
    });
  }

  // Write button visibility
  const writeBtn = document.getElementById("writeBtn");
  if (writeBtn) {
    InkAPI.me()
      .then((m) => {
        if (m.admin) writeBtn.hidden = false;
      })
      .catch(() => {});
  }

  load();
})();
