/**
 * Inkboard block editor — canvas of thought units.
 * Types: paragraph, heading, quote, callout, symbol, image, gif, video, divider, code, list
 */
(function (global) {
  function uid() {
    return crypto.randomUUID ? crypto.randomUUID() : "b-" + Math.random().toString(36).slice(2, 10);
  }

  function emptyBlock(type) {
    const base = { id: uid(), type };
    switch (type) {
      case "heading":
        return { ...base, text: "", level: 2 };
      case "quote":
      case "paragraph":
      case "callout":
      case "code":
        return { ...base, text: "", tone: type === "callout" ? "gold" : undefined };
      case "symbol":
        return { ...base, glyph: "※", text: "" };
      case "image":
      case "gif":
      case "video":
        return { ...base, src: "", alt: "", text: "" };
      case "list":
        return { ...base, items: [""] };
      case "divider":
        return base;
      default:
        return { ...base, type: "paragraph", text: "" };
    }
  }

  function Editor(root, { onChange } = {}) {
    this.root = root;
    this.blocks = [emptyBlock("paragraph")];
    this.onChange = onChange || (() => {});
    this._bind();
    this.render();
  }

  Editor.prototype._bind = function () {
    this.root.addEventListener("input", () => this._harvest());
    this.root.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-act]");
      if (!btn) return;
      const id = btn.closest(".block")?.dataset.id;
      const act = btn.dataset.act;
      if (!id) return;
      if (act === "up") this.move(id, -1);
      if (act === "down") this.move(id, 1);
      if (act === "del") this.remove(id);
      if (act === "upload") this._upload(id, btn);
    });
    this.root.addEventListener("change", (e) => {
      const sel = e.target.closest("select[data-field]");
      if (!sel) return;
      const id = sel.closest(".block")?.dataset.id;
      const b = this.blocks.find((x) => x.id === id);
      if (!b) return;
      if (sel.dataset.field === "level") b.level = Number(sel.value) || 2;
      if (sel.dataset.field === "tone") b.tone = sel.value;
      this.onChange(this.blocks);
    });
  };

  Editor.prototype.setBlocks = function (blocks) {
    this.blocks = Array.isArray(blocks) && blocks.length ? structuredClone(blocks) : [emptyBlock("paragraph")];
    this.render();
  };

  Editor.prototype.getBlocks = function () {
    this._harvest();
    return this.blocks;
  };

  Editor.prototype.add = function (type) {
    this._harvest();
    this.blocks.push(emptyBlock(type));
    this.render();
    this.onChange(this.blocks);
    const last = this.root.querySelector(".block:last-child [contenteditable], .block:last-child input");
    if (last) last.focus();
  };

  Editor.prototype.remove = function (id) {
    this._harvest();
    this.blocks = this.blocks.filter((b) => b.id !== id);
    if (!this.blocks.length) this.blocks = [emptyBlock("paragraph")];
    this.render();
    this.onChange(this.blocks);
  };

  Editor.prototype.move = function (id, dir) {
    this._harvest();
    const i = this.blocks.findIndex((b) => b.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= this.blocks.length) return;
    const t = this.blocks[i];
    this.blocks[i] = this.blocks[j];
    this.blocks[j] = t;
    this.render();
    this.onChange(this.blocks);
  };

  Editor.prototype._upload = async function (id, btn) {
    const input = document.createElement("input");
    input.type = "file";
    const b = this.blocks.find((x) => x.id === id);
    if (!b) return;
    if (b.type === "video") input.accept = "video/*";
    else if (b.type === "gif") input.accept = "image/gif,image/*";
    else input.accept = "image/*";
    input.onchange = async () => {
      const file = input.files && input.files[0];
      if (!file) return;
      btn.textContent = "…";
      try {
        const res = await InkAPI.upload(file);
        b.src = res.key;
        b.alt = b.alt || file.name;
        this.render();
        this.onChange(this.blocks);
        toast("Media uploaded");
      } catch (err) {
        toast(err.message || "Upload failed");
      } finally {
        btn.textContent = "↑";
      }
    };
    input.click();
  };

  Editor.prototype._harvest = function () {
    this.root.querySelectorAll(".block").forEach((el) => {
      const id = el.dataset.id;
      const b = this.blocks.find((x) => x.id === id);
      if (!b) return;
      const ed = el.querySelector("[contenteditable]");
      const glyph = el.querySelector(".glyph-input");
      const listBox = el.querySelector("[data-list]");
      if (glyph) b.glyph = glyph.value || b.glyph;
      if (listBox) {
        b.items = listBox.innerText
          .split("\n")
          .map((s) => s.replace(/^[\s•\-]+/, "").trim())
          .filter(Boolean);
      } else if (ed && b.type !== "divider") {
        b.text = ed.innerText.replace(/\u00a0/g, " ").trimEnd();
      }
      const urlIn = el.querySelector("input[data-url]");
      if (urlIn && urlIn.value.trim()) {
        // allow external URL override
        if (/^https?:\/\//i.test(urlIn.value.trim())) b.src = urlIn.value.trim();
      }
    });
  };

  Editor.prototype.render = function () {
    this.root.innerHTML = this.blocks.map((b) => this._html(b)).join("");
  };

  Editor.prototype._html = function (b) {
    const tools = `
      <div class="tools">
        <button type="button" data-act="up" title="Move up">↑</button>
        <button type="button" data-act="down" title="Move down">↓</button>
        <button type="button" data-act="del" title="Remove">✕</button>
      </div>`;
    const handle = `<div class="handle" title="${b.type}">⠿</div>`;

    if (b.type === "divider") {
      return `<div class="block" data-id="${b.id}">${handle}${tools}<div class="divider"></div></div>`;
    }

    if (b.type === "symbol") {
      return `<div class="block" data-id="${b.id}">${handle}${tools}
        <div class="symbol-row">
          <input class="glyph-input" value="${esc(b.glyph || "※")}" maxlength="4" />
          <div contenteditable="true" data-placeholder="What does this mark mean?">${esc(b.text || "")}</div>
        </div>
      </div>`;
    }

    if (b.type === "image" || b.type === "gif" || b.type === "video") {
      const src = b.src ? InkAPI.mediaUrl(b.src) : "";
      const preview = src
        ? b.type === "video"
          ? `<video src="${esc(src)}" controls style="max-height:280px;margin:0 auto 8px;border-radius:8px"></video>`
          : `<img src="${esc(src)}" alt="" style="max-height:280px;margin:0 auto 8px;border-radius:8px" />`
        : `<div style="padding:24px 0;color:var(--dim)">Drop ${b.type} via upload, or paste a URL below</div>`;
      return `<div class="block" data-id="${b.id}">${handle}${tools}
        <div class="media-frame">
          ${preview}
          <div class="row">
            <button type="button" class="ghost" data-act="upload">Upload ${b.type}</button>
          </div>
          <input data-url placeholder="Or https media URL" value="${/^https?:/i.test(b.src || "") ? esc(b.src) : ""}" style="width:100%;margin-top:10px;border:1px solid var(--line);border-radius:8px;padding:8px;background:var(--bg)" />
          <div contenteditable="true" data-placeholder="Caption (optional)" style="margin-top:10px;text-align:left">${esc(b.text || "")}</div>
        </div>
      </div>`;
    }

    if (b.type === "list") {
      const text = (b.items || []).join("\n");
      return `<div class="block" data-id="${b.id}">${handle}${tools}
        <div data-list contenteditable="true" data-placeholder="One item per line">${esc(text)}</div>
      </div>`;
    }

    if (b.type === "heading") {
      return `<div class="block heading" data-id="${b.id}">${handle}${tools}
        <select data-field="level" style="margin-bottom:8px;border:1px solid var(--line);border-radius:6px;padding:4px 8px;background:var(--bg);color:var(--muted);font-size:0.75rem">
          <option value="1" ${b.level === 1 ? "selected" : ""}>Heading L1</option>
          <option value="2" ${b.level === 2 || !b.level ? "selected" : ""}>Heading L2</option>
          <option value="3" ${b.level === 3 ? "selected" : ""}>Heading L3</option>
        </select>
        <div contenteditable="true" data-placeholder="Section title">${esc(b.text || "")}</div>
      </div>`;
    }

    if (b.type === "callout") {
      return `<div class="block" data-id="${b.id}">${handle}${tools}
        <select data-field="tone" style="margin-bottom:8px;border:1px solid var(--line);border-radius:6px;padding:4px 8px;background:var(--bg);color:var(--muted);font-size:0.75rem">
          ${["gold", "felt", "map", "ink", "alert"]
            .map((t) => `<option value="${t}" ${b.tone === t ? "selected" : ""}>${t}</option>`)
            .join("")}
        </select>
        <div contenteditable="true" data-placeholder="Callout thought">${esc(b.text || "")}</div>
      </div>`;
    }

    if (b.type === "quote") {
      return `<div class="block quote" data-id="${b.id}">${handle}${tools}
        <div contenteditable="true" data-placeholder="A line worth keeping">${esc(b.text || "")}</div>
      </div>`;
    }

    if (b.type === "code") {
      return `<div class="block" data-id="${b.id}">${handle}${tools}
        <div contenteditable="true" data-placeholder="// code or notation" style="font-family:var(--mono);font-size:0.9rem;white-space:pre-wrap">${esc(b.text || "")}</div>
      </div>`;
    }

    return `<div class="block" data-id="${b.id}">${handle}${tools}
      <div contenteditable="true" data-placeholder="Write freely…">${esc(b.text || "")}</div>
    </div>`;
  };

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function toast(msg) {
    let el = document.getElementById("toast");
    if (!el) {
      el = document.createElement("div");
      el.id = "toast";
      el.className = "toast";
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.remove("show"), 2000);
  }

  global.InkEditor = { Editor, emptyBlock, toast };
})(window);
