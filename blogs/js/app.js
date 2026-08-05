(function () {
  const root = document.documentElement;
  const fixedTopic = root.dataset.topic || "";
  const params = new URLSearchParams(location.search);
  const topicFilter = fixedTopic || params.get("topic") || "";
  const qInput = document.getElementById("search");
  const feed = document.getElementById("feed");
  const href = (p) => (window.InkPaths ? InkPaths.href(p) : p);

  const TOPICS = ["game-theory", "poker", "geopolitics", "geography"];
  const counts = {};
  for (const t of TOPICS) {
    counts[t] = document.querySelector('[data-count="' + t + '"]');
  }

  // Nav active states
  document.querySelectorAll(".nav-chip").forEach((el) => {
    const t = el.dataset.topic ?? "";
    if (t === topicFilter || (!topicFilter && t === "")) el.classList.add("active");
  });

  // World cards → topic folders
  document.querySelectorAll(".world").forEach((el) => {
    el.addEventListener("click", () => {
      const t = el.dataset.topic;
      if (t) location.href = href("/" + t + "/");
    });
  });

  // Fix brand / write links if present
  document.querySelectorAll("[data-ink-href]").forEach((el) => {
    el.setAttribute("href", href(el.getAttribute("data-ink-href")));
  });

  async function load() {
    if (!feed) return;
    feed.innerHTML = `<div class="empty">Loading the ledger…</div>`;
    try {
      const data = await InkAPI.posts({
        topic: topicFilter || undefined,
        status: "published",
        q: (qInput && qInput.value.trim()) || undefined,
      });
      renderFeed(data.posts || []);
      updateCounts();
    } catch (err) {
      feed.innerHTML = `<div class="empty">Could not reach Inkboard API.<br/><span style="color:var(--danger)">${InkRender.esc(err.message)}</span></div>`;
    }
  }

  async function updateCounts() {
    try {
      const all = await InkAPI.posts({ status: "published" });
      const tally = { "game-theory": 0, poker: 0, geopolitics: 0, geography: 0 };
      for (const p of all.posts || []) {
        if (tally[p.topic] != null) tally[p.topic]++;
      }
      for (const k of Object.keys(counts)) {
        if (counts[k]) {
          counts[k].textContent = tally[k] + (tally[k] === 1 ? " piece" : " pieces");
        }
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
        const meta = InkRender.TOPIC_META[p.topic] || {};
        const label = meta.label || InkRender.TOPIC_LABEL[p.topic] || p.topic;
        const color = meta.color || "#d4b483";
        const num = String(i + 1).padStart(2, "0");
        const date = (p.publishedAt || p.updatedAt || "").slice(0, 10);
        return `
          <a class="card" href="${href("/post/?slug=" + encodeURIComponent(p.slug))}" data-topic="${p.topic}" style="--topic: ${color}">
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

  let t;
  if (qInput) {
    qInput.addEventListener("input", () => {
      clearTimeout(t);
      t = setTimeout(load, 220);
    });
  }

  const writeBtn = document.getElementById("writeBtn");
  if (writeBtn) {
    writeBtn.setAttribute("href", href("/write/"));
    InkAPI.me()
      .then((m) => {
        if (m.admin) writeBtn.hidden = false;
      })
      .catch(() => {});
  }

  // Topic page hero color
  if (topicFilter && InkRender.TOPIC_META[topicFilter]) {
    document.documentElement.style.setProperty(
      "--topic",
      InkRender.TOPIC_META[topicFilter].color
    );
  }

  load();
})();
