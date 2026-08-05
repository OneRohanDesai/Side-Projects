(function (global) {
  function base() {
    return String(global.VAULT_API || "").replace(/\/$/, "");
  }

  function token() {
    return localStorage.getItem("vault_token") || "";
  }

  function setToken(t) {
    if (t) localStorage.setItem("vault_token", t);
    else localStorage.removeItem("vault_token");
  }

  async function req(path, opts = {}) {
    const headers = Object.assign({}, opts.headers || {});
    if (!(opts.body instanceof FormData)) {
      headers["content-type"] = headers["content-type"] || "application/json";
    }
    const t = token();
    if (t) headers.authorization = "Bearer " + t;

    const res = await fetch(base() + path, {
      method: opts.method || "GET",
      headers,
      body:
        opts.body instanceof FormData
          ? opts.body
          : opts.body != null
            ? JSON.stringify(opts.body)
            : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data.error || res.statusText || "Request failed");
      err.status = res.status;
      throw err;
    }
    return data;
  }

  function mediaUrl(key) {
    if (!key) return null;
    if (/^https?:\/\//i.test(key) || key.startsWith("data:")) return key;
    return base() + "/api/media/" + encodeURIComponent(key);
  }

  function normalizePlate(p) {
    if (!p) return p;
    const imageKey = p.imageKey || p.image_key || null;
    // if image looks like a key, resolve; if already absolute, keep
    let image = p.image || null;
    if (imageKey) image = mediaUrl(imageKey);
    else if (image && !/^https?:\/\//i.test(image)) image = mediaUrl(image);
    return Object.assign({}, p, { imageKey, image, tags: p.tags || [] });
  }

  global.VaultAPI = {
    base,
    token,
    setToken,
    mediaUrl,
    health: () => req("/api/health"),
    plates: (params = {}) => {
      const q = new URLSearchParams();
      if (params.kind) q.set("kind", params.kind);
      if (params.q) q.set("q", params.q);
      const s = q.toString();
      return req("/api/plates" + (s ? "?" + s : "")).then((d) => ({
        plates: (d.plates || []).map(normalizePlate),
      }));
    },
    plate: (id) => req("/api/plates/" + encodeURIComponent(id)).then((d) => ({ plate: normalizePlate(d.plate) })),
    create: (body) => req("/api/plates", { method: "POST", body }).then((d) => ({ plate: normalizePlate(d.plate) })),
    update: (id, body) =>
      req("/api/plates/" + encodeURIComponent(id), { method: "PUT", body }).then((d) => ({
        plate: normalizePlate(d.plate),
      })),
    remove: (id) => req("/api/plates/" + encodeURIComponent(id), { method: "DELETE" }),
    login: async (password) => {
      const data = await req("/api/auth/login", { method: "POST", body: { password } });
      setToken(data.token);
      return data;
    },
    logout: async () => {
      try {
        await req("/api/auth/logout", { method: "POST", body: {} });
      } catch (_) {}
      setToken("");
    },
    me: () => req("/api/auth/me"),
    upload: (file) => {
      const fd = new FormData();
      fd.append("file", file);
      return req("/api/media", { method: "POST", body: fd });
    },
  };
})(window);
