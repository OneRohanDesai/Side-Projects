(function (global) {
  function base() {
    const b = global.INKBOARD_BASE;
    if (b == null || b === "") return "";
    return String(b).replace(/\/$/, "");
  }
  function href(path) {
    const p = path.startsWith("/") ? path : "/" + path;
    return base() + p;
  }
  global.InkPaths = { base, href };
})(window);
