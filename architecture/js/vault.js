(function () {
  "use strict";

  const state = {
    all: [],
    kind: "all",
    q: "",
    era: "all",
  };

  const $ = (id) => document.getElementById(id);
  const timeline = $("timeline");
  const countEl = $("countStat");
  const drawer = $("drawer");
  const drawerBody = $("drawerBody");
  const eraRail = $("eraRail");
  const bootScreen = $("bootScreen");

  const GLYPH = { "man-made": "△", natural: "◎" };

  function formatYear(y) {
    if (y === 0) return "Living";
    if (y < -1000000) return Math.round(Math.abs(y) / 1e6) + " Ma";
    if (y < 0) return Math.abs(y) + " BCE";
    return String(y);
  }

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function matches(s) {
    if (state.kind !== "all" && s.kind !== state.kind) return false;
    if (state.era !== "all" && s.era !== state.era) return false;
    if (!state.q) return true;
    const hay = [s.name, s.place, s.era, s.region, s.blurb, ...(s.tags || [])]
      .join(" ")
      .toLowerCase();
    return hay.includes(state.q);
  }

  function sorted(list) {
    return list.slice().sort((a, b) => a.year - b.year || a.name.localeCompare(b.name));
  }

  function hideBoot() {
    if (!bootScreen) return;
    bootScreen.classList.add("done");
    setTimeout(() => bootScreen.remove(), 500);
  }

  function buildEraRail() {
    if (!eraRail) return;
    const eras = [];
    const seen = new Set();
    for (const s of sorted(state.all)) {
      if (!seen.has(s.era)) {
        seen.add(s.era);
        eras.push(s.era);
      }
    }
    eraRail.innerHTML =
      `<button type="button" class="active" data-era="all">Full span</button>` +
      eras.map((e) => `<button type="button" data-era="${esc(e)}">${esc(e)}</button>`).join("");
  }

  function render() {
    const list = sorted(state.all.filter(matches));
    if (countEl) {
      countEl.innerHTML = `<b>${list.length}</b> plates in the room`;
    }

    if (!list.length) {
      timeline.innerHTML = `<div class="empty">No plates match this filter.</div>`;
      return;
    }

    timeline.innerHTML = list
      .map((s) => {
        const kindClass = s.kind === "natural" ? "natural" : "man-made";
        const glyph = GLYPH[s.kind] || "·";
        const tags = (s.tags || [])
          .slice(0, 4)
          .map((t) => `<span class="tag">${esc(t)}</span>`)
          .join("");
        const src = s.image || null;
        const media = src
          ? `<div class="plate-media">
               <div class="plate-wait" aria-hidden="true"><span></span><span></span><span></span></div>
               <img data-src="${esc(src)}" alt="" decoding="async" width="140" height="140" />
             </div>`
          : `<span class="glyph" aria-hidden="true">${glyph}</span>`;

        return `
          <button type="button" class="entry ${kindClass}" id="s-${esc(s.id)}" data-open="${esc(s.id)}">
            <div class="year-block">
              ${esc(formatYear(s.year))}
              <small>${esc(s.era)}</small>
            </div>
            <div class="plate ${src ? "has-img loading" : ""}" style="--tone:${esc(s.tone || "#b56a45")}">
              ${media}
            </div>
            <div class="entry-body">
              <div class="kind">${esc(s.kind === "natural" ? "Natural form" : "Man-made work")}</div>
              <h2>${esc(s.name)}</h2>
              <div class="place">${esc(s.place)} · ${esc(s.region)}</div>
              <p>${esc(s.blurb)}</p>
              <div class="tags">${tags}</div>
            </div>
          </button>`;
      })
      .join("");

    observeImages();
  }

  function observeImages() {
    const plates = timeline.querySelectorAll(".plate.has-img");
    if (!plates.length) return;

    const arm = (plate) => {
      const img = plate.querySelector("img[data-src]");
      if (!img || img.dataset.done) return;
      img.dataset.done = "1";
      plate.classList.add("loading");
      plate.classList.remove("ready");

      // Progressive: blur while decoding; clear only when fully loaded
      img.classList.add("soft");
      const finish = () => {
        // decode() waits for full image when supported
        const clear = () => {
          img.classList.remove("soft");
          img.classList.add("loaded");
          plate.classList.remove("loading");
          plate.classList.add("ready");
        };
        if (img.decode) {
          img.decode().then(clear).catch(clear);
        } else {
          clear();
        }
      };

      img.onload = finish;
      img.onerror = () => {
        plate.classList.remove("has-img", "loading");
        plate.innerHTML = `<span class="glyph" aria-hidden="true">△</span>`;
      };
      img.src = img.dataset.src;
    };

    if (!("IntersectionObserver" in window)) {
      plates.forEach(arm);
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            arm(e.target);
            io.unobserve(e.target);
          }
        }
      },
      { rootMargin: "160px 0px", threshold: 0.01 }
    );
    plates.forEach((p) => io.observe(p));
  }

  function openDrawer(id) {
    const s = state.all.find((x) => x.id === id);
    if (!s || !drawer) return;
    const glyph = GLYPH[s.kind] || "·";
    const imgBlock = s.image
      ? `<div class="hero-plate has-img loading" style="--tone:${esc(s.tone || "#b56a45")}">
           <div class="plate-wait"><span></span><span></span><span></span></div>
           <img data-src="${esc(s.image)}" alt="" class="soft" />
         </div>`
      : `<div class="hero-plate" style="--tone:${esc(s.tone || "#b56a45")}">${glyph}</div>`;

    drawerBody.innerHTML = `
      <button type="button" class="close" id="drawerClose" aria-label="Close">✕</button>
      <div class="eyebrow">${esc(s.kind === "natural" ? "Natural form" : "Man-made work")}</div>
      <h2>${esc(s.name)}</h2>
      ${imgBlock}
      <p class="blurb">${esc(s.blurb)}</p>
      <dl>
        <dt>When</dt><dd>${esc(formatYear(s.year))} · ${esc(s.era)}</dd>
        <dt>Place</dt><dd>${esc(s.place)}</dd>
        <dt>Region</dt><dd>${esc(s.region)}</dd>
        <dt>Tags</dt><dd>${esc((s.tags || []).join(", "))}</dd>
      </dl>
    `;
    drawer.classList.add("open");
    drawer.setAttribute("aria-hidden", "false");
    $("drawerClose")?.addEventListener("click", closeDrawer);

    const hp = drawerBody.querySelector(".hero-plate.has-img");
    const img = hp?.querySelector("img[data-src]");
    if (img) {
      img.onload = () => {
        const done = () => {
          img.classList.remove("soft");
          img.classList.add("loaded");
          hp.classList.remove("loading");
          hp.classList.add("ready");
        };
        if (img.decode) img.decode().then(done).catch(done);
        else done();
      };
      img.src = img.dataset.src;
    }
  }

  function closeDrawer() {
    drawer?.classList.remove("open");
    drawer?.setAttribute("aria-hidden", "true");
  }

  function wire() {
    document.querySelectorAll("[data-kind]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.kind = btn.dataset.kind;
        document.querySelectorAll("[data-kind]").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        render();
      });
    });

    eraRail?.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-era]");
      if (!btn) return;
      state.era = btn.dataset.era;
      eraRail.querySelectorAll("button").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      render();
    });

    let t;
    $("search")?.addEventListener("input", (e) => {
      clearTimeout(t);
      t = setTimeout(() => {
        state.q = e.target.value.trim().toLowerCase();
        render();
      }, 150);
    });

    timeline?.addEventListener("click", (e) => {
      const open = e.target.closest("[data-open]");
      if (open) openDrawer(open.dataset.open);
    });

    drawer?.addEventListener("click", (e) => {
      if (e.target === drawer) closeDrawer();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeDrawer();
    });
  }

  async function loadCatalog() {
    // Prefer live API; fall back to static JSON so GitHub Pages still works offline
    try {
      if (window.VaultAPI && VaultAPI.base()) {
        const data = await VaultAPI.plates();
        if (data.plates?.length) return data.plates;
      }
    } catch (e) {
      console.warn("Vault API unavailable, trying local catalog", e);
    }
    const res = await fetch("./data/structures.json", { cache: "no-cache" });
    if (!res.ok) throw new Error("Could not load catalog");
    const data = await res.json();
    return (data.structures || []).map((s) =>
      Object.assign({}, s, { image: s.image || null, imageKey: s.imageKey || null })
    );
  }

  async function boot() {
    wire();
    const minSplash = new Promise((r) => setTimeout(r, 700));
    try {
      const [plates] = await Promise.all([loadCatalog(), minSplash]);
      state.all = plates;
      buildEraRail();
      render();
      hideBoot();
    } catch (err) {
      await minSplash;
      hideBoot();
      timeline.innerHTML = `<div class="empty">${esc(err.message)}</div>`;
    }
  }

  boot();
})();
