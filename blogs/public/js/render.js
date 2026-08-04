(function (global) {
  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function mediaSrc(block) {
    if (!block.src) return "";
    return InkAPI.mediaUrl(block.src) || block.src;
  }

  function renderBlock(b) {
    switch (b.type) {
      case "heading": {
        const lvl = Math.min(3, Math.max(1, b.level || 2));
        const tag = "h" + (lvl + 1);
        return `<${tag}>${esc(b.text || "")}</${tag}>`;
      }
      case "quote":
        return `<blockquote class="quote">${esc(b.text || "")}</blockquote>`;
      case "callout":
        return `<div class="callout ${esc(b.tone || "gold")}">${esc(b.text || "")}</div>`;
      case "symbol":
        return `<div class="symbol"><div class="g">${esc(b.glyph || "※")}</div><div class="t">${esc(b.text || "")}</div></div>`;
      case "image":
      case "gif":
        return `<figure><div class="media"><img src="${esc(mediaSrc(b))}" alt="${esc(b.alt || "")}" loading="lazy" /></div>${b.text ? `<figcaption class="cap">${esc(b.text)}</figcaption>` : ""}</figure>`;
      case "video":
        return `<figure><div class="media"><video src="${esc(mediaSrc(b))}" controls playsinline></video></div>${b.text ? `<figcaption class="cap">${esc(b.text)}</figcaption>` : ""}</figure>`;
      case "divider":
        return `<div class="divider" role="separator"></div>`;
      case "code":
        return `<pre><code>${esc(b.text || "")}</code></pre>`;
      case "list": {
        const items = (b.items || []).map((it) => `<li>${esc(it)}</li>`).join("");
        return `<ul>${items}</ul>`;
      }
      case "paragraph":
      default:
        return `<p class="p">${esc(b.text || "")}</p>`;
    }
  }

  function renderBody(blocks) {
    if (!Array.isArray(blocks) || !blocks.length) {
      return `<p class="p" style="color:var(--dim)">This piece is still gathering its words.</p>`;
    }
    return blocks.map(renderBlock).join("");
  }

  const TOPIC_LABEL = {
    "game-theory": "Game Theory",
    poker: "Poker",
    geopolitics: "Geopolitics",
  };

  global.InkRender = { renderBody, renderBlock, esc, TOPIC_LABEL };
})(window);
