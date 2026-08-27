(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.ToolData = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function stable(value) {
    if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
    if (value && typeof value === "object") return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`;
    return JSON.stringify(value);
  }

  function createToolDataClient({ baseUrl, toolId, fetch: fetchImpl = globalThis.fetch }) {
    const endpoint = `${baseUrl.replace(/\/$/, "")}/api/data/${toolId}`;
    const localKey = `github-pages-tool-data:${toolId}`;
    const bundledUrl = "./dealer-management.json";

    function readLocal() {
      try {
        const raw = localStorage.getItem(localKey);
        return raw ? JSON.parse(raw)?.state || null : null;
      } catch {
        return null;
      }
    }

    function writeLocal(state) {
      try {
        localStorage.setItem(localKey, JSON.stringify({ savedAt: Date.now(), state }));
      } catch {
        // GitHub Pages is a share/view build. If browser storage is full, keep the session usable.
      }
    }

    async function request(method, state, options = {}) {
      if (method === "PUT") {
        writeLocal(state);
        return { savedAt: Date.now(), state };
      }
      if (method === "DELETE") {
        try { localStorage.removeItem(localKey); } catch {}
        return { savedAt: Date.now(), state: null };
      }
      const local = readLocal();
      if (local) return { savedAt: Date.now(), state: local };
      try {
        const init = { method, headers: {} };
        if (options.discardPrevious) init.headers["X-Discard-Previous"] = "true";
        const response = await fetchImpl(endpoint, init);
        if (response.ok) return response.json();
      } catch {}
      const bundled = await fetchImpl(bundledUrl, { cache: "no-store" });
      if (!bundled.ok) throw new Error(`发布包数据读取失败：${bundled.status}`);
      return { savedAt: Date.now(), state: await bundled.json() };
    }

    async function load() {
      const snapshot = await request("GET");
      return snapshot?.state ?? null;
    }

    async function save(state, options) {
      await request("PUT", state, options);
      const verified = await load();
      if (stable(verified) !== stable(state)) throw new Error("浏览器临时数据写入后校验不一致");
      return verified;
    }

    async function remove() {
      await request("DELETE");
    }

    async function migrate(legacyState, cleanup) {
      const existing = await load();
      if (existing) return existing;
      if (!legacyState) return null;
      const verified = await save(legacyState);
      await cleanup();
      return verified;
    }

    return { load, save, remove, migrate };
  }

  return { createToolDataClient, stable };
});
