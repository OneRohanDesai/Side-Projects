/**
 * Inkboard API (Cloudflare Worker). Static pages on rohandesai.in call this origin.
 */
window.INKBOARD_API = "https://inkboard-blogs.rohandesai98244.workers.dev";

/**
 * Path prefix for static links when hosted under /blogs on the main site.
 * Use "/blogs" in production. For local `python3 -m http.server` inside blogs/, set "".
 */
window.INKBOARD_BASE = "/blogs";
