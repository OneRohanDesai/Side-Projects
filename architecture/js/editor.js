(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  let plates = [];
  let currentId = null;
  let imageKey = null;

  function toast(msg) {
    const el = $("toast");
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.remove("show"), 1800);
  }

  function showGate(err) {
    $("gate").hidden = false;
    $("studio").hidden = true;
    if (err) {
      $("gateErr").hidden = false;
      $("gateErr").textContent = err;
    }
  }

  function showStudio() {
    $("gate").hidden = true;
    $("studio").hidden = false;
    refreshList();
    resetForm();
  }

  async function boot() {
    if (!VaultAPI.base()) {
      showGate("Set VAULT_API in js/config.js to your Worker URL.");
      return;
    }
    try {
      const me = await VaultAPI.me();
      if (me.admin) showStudio();
      else showGate();
    } catch {
      showGate();
    }
  }

  async function login() {
    $("gateErr").hidden = true;
    try {
      await VaultAPI.login($("password").value);
      toast("Welcome");
      showStudio();
    } catch (e) {
      showGate(e.message || "Invalid password");
    }
  }

  async function refreshList() {
    const q = ($("listSearch").value || "").trim().toLowerCase();
    try {
      const data = await VaultAPI.plates();
      plates = data.plates || [];
    } catch (e) {
      toast(e.message);
      plates = [];
    }
    const list = plates.filter((p) => {
      if (!q) return true;
      return [p.name, p.place, p.era, p.kind].join(" ").toLowerCase().includes(q);
    });
    $("plateList").innerHTML = list
      .map(
        (p) => `
      <button type="button" class="plate-item ${p.id === currentId ? "active" : ""}" data-id="${esc(p.id)}">
        <span class="n">${esc(p.name)}</span>
        <div class="m">${esc(formatYear(p.year))} · ${esc(p.kind)}</div>
      </button>`
      )
      .join("") || `<div class="m" style="padding:12px;color:var(--stone)">No plates yet</div>`;
  }

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

  function resetForm() {
    currentId = null;
    imageKey = null;
    $("formTitle").textContent = "New plate";
    $("fName").value = "";
    $("fYear").value = "";
    $("fEra").value = "";
    $("fKind").value = "man-made";
    $("fPlace").value = "";
    $("fRegion").value = "";
    $("fBlurb").value = "";
    $("fTags").value = "";
    $("fTone").value = "#b56a45";
    $("fImageFile").value = "";
    $("imgPreview").innerHTML = "No image";
    $("deleteBtn").hidden = true;
    refreshList();
  }

  function fillForm(p) {
    currentId = p.id;
    imageKey = p.imageKey || null;
    $("formTitle").textContent = p.name;
    $("fName").value = p.name || "";
    $("fYear").value = p.year;
    $("fEra").value = p.era || "";
    $("fKind").value = p.kind || "man-made";
    $("fPlace").value = p.place || "";
    $("fRegion").value = p.region || "";
    $("fBlurb").value = p.blurb || "";
    $("fTags").value = (p.tags || []).join(", ");
    $("fTone").value = p.tone || "#b56a45";
    $("fImageFile").value = "";
    if (p.image) {
      $("imgPreview").innerHTML = `<img src="${esc(p.image)}" alt="" />`;
    } else {
      $("imgPreview").innerHTML = "No image";
    }
    $("deleteBtn").hidden = false;
    refreshList();
  }

  function readForm() {
    return {
      name: $("fName").value.trim(),
      year: Number($("fYear").value),
      era: $("fEra").value.trim(),
      kind: $("fKind").value,
      place: $("fPlace").value.trim(),
      region: $("fRegion").value.trim(),
      blurb: $("fBlurb").value.trim(),
      tags: $("fTags").value
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      tone: $("fTone").value || "#b56a45",
      imageKey: imageKey,
    };
  }

  async function save() {
    const body = readForm();
    if (!body.name) return toast("Name required");
    if (!Number.isFinite(body.year)) return toast("Year required");
    try {
      if (currentId) {
        const { plate } = await VaultAPI.update(currentId, body);
        fillForm(plate);
        toast("Saved");
      } else {
        const { plate } = await VaultAPI.create(body);
        fillForm(plate);
        toast("Created");
      }
      await refreshList();
    } catch (e) {
      toast(e.message);
    }
  }

  async function remove() {
    if (!currentId) return;
    if (!confirm("Delete this plate forever?")) return;
    try {
      await VaultAPI.remove(currentId);
      toast("Deleted");
      resetForm();
      await refreshList();
    } catch (e) {
      toast(e.message);
    }
  }

  $("loginBtn").onclick = login;
  $("password").addEventListener("keydown", (e) => {
    if (e.key === "Enter") login();
  });
  $("logoutBtn").onclick = async () => {
    await VaultAPI.logout();
    location.reload();
  };
  $("newBtn").onclick = resetForm;
  $("saveBtn").onclick = save;
  $("deleteBtn").onclick = remove;
  $("listSearch").oninput = () => refreshList();
  $("plateList").onclick = (e) => {
    const btn = e.target.closest("[data-id]");
    if (!btn) return;
    const p = plates.find((x) => x.id === btn.dataset.id);
    if (p) fillForm(p);
  };
  $("clearImage").onclick = () => {
    imageKey = null;
    $("fImageFile").value = "";
    $("imgPreview").innerHTML = "No image";
  };
  $("fImageFile").onchange = async () => {
    const file = $("fImageFile").files?.[0];
    if (!file) return;
    try {
      toast("Uploading…");
      const res = await VaultAPI.upload(file);
      imageKey = res.key;
      $("imgPreview").innerHTML = `<img src="${esc(VaultAPI.mediaUrl(res.key))}" alt="" />`;
      toast("Image ready");
    } catch (e) {
      toast(e.message);
    }
  };

  boot();
})();
