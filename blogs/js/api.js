/**
 * Inkboard API client.
 * Same-origin by default (Worker + assets). Override with window.INKBOARD_API.
 */
(function (global) {
  const base = () => (global.INKBOARD_API || "").replace(/\/$/, "");

  function token() {
    return localStorage.getItem("inkboard_token") || "";
  }

  function setToken(t) {
    if (t) localStorage.setItem("inkboard_token", t);
    else localStorage.removeItem("inkboard_token");
  }

  async function req(path, opts = {}) {
    const headers = Object.assign({ "content-type": "application/json" }, opts.headers || {});
    const t = token();
    if (t) headers.authorization = `Bearer ${t}`;
    if (opts.body instanceof FormData) delete headers["content-type"];

    const res = await fetch(base() + path, {
      method: opts.method || "GET",
      headers,
      body: opts.body instanceof FormData ? opts.body : opts.body != null ? JSON.stringify(opts.body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data.error || res.statusText || "Request failed");
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  global.InkAPI = {
    base,
    token,
    setToken,
    health: () => req("/api/health"),
    topics: () => req("/api/topics"),
    posts: (params = {}) => {
      const q = new URLSearchParams();
      if (params.topic) q.set("topic", params.topic);
      if (params.status) q.set("status", params.status);
      if (params.q) q.set("q", params.q);
      const s = q.toString();
      return req("/api/posts" + (s ? "?" + s : ""));
    },
    post: (slugOrId) => req("/api/posts/" + encodeURIComponent(slugOrId)),
    createPost: (body) => req("/api/posts", { method: "POST", body }),
    updatePost: (id, body) => req("/api/posts/" + encodeURIComponent(id), { method: "PUT", body }),
    deletePost: (id) => req("/api/posts/" + encodeURIComponent(id), { method: "DELETE" }),
    login: async (password) => {
      const data = await req("/api/auth/login", { method: "POST", body: { password } });
      setToken(data.token);
      return data;
    },
    logout: async () => {
      try { await req("/api/auth/logout", { method: "POST", body: {} }); } catch (_) {}
      setToken("");
    },
    me: () => req("/api/auth/me"),
    upload: async (file) => {
      const fd = new FormData();
      fd.append("file", file);
      return req("/api/media", { method: "POST", body: fd });
    },
    mediaUrl: (key) => {
      if (!key) return null;
      if (/^(https?:|data:)/i.test(key)) return key;
      return base() + "/api/media/" + encodeURIComponent(key);
    },
  };
})(window);
