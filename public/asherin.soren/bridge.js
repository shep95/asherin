/* asherin.soren — browser bridge.
 *
 * The uploaded build talks to a local Node process over /api/*. On asherin.com
 * there is no such process, so this layer answers those exact routes inside the
 * browser instead: the provider key lives in sessionStorage (gone when the tab
 * closes), model discovery and chat go straight from this tab to the provider
 * the operator chose, and NASA POWER is requested directly from the public
 * endpoint. Nothing is proxied through an asherin server and nothing is stored
 * on one.
 *
 * Two routes cannot exist without the local process and say so plainly instead
 * of pretending: arbitrary URL retrieval (a browser cannot bypass CORS) and
 * developer code editing (there is no writable file system here).
 */
(function () {
  "use strict";

  var KEY = "asherin.soren.provider";
  // Hosted relay: asherin covers the model cost until the operator brings a key.
  var HOSTED_ENDPOINT = "https://xpgxgzqbtrrrbtjcemci.functions.supabase.co/soren-ai";
  var HOSTED_MODEL = { id: "asherin-hosted", label: "asherin hosted model (free)" };
  var DEFAULTS = {
    asherin: HOSTED_ENDPOINT,
    openai: "https://api.openai.com/v1",
    anthropic: "https://api.anthropic.com/v1",
    google: "https://generativelanguage.googleapis.com/v1beta",
    "openai-compatible": "http://localhost:1234/v1",
    ollama: "http://localhost:11434",
  };
  var POWER_PARAMETERS = ["T2M", "PS", "RH2M", "WS10M", "WD10M", "ALLSKY_SFC_SW_DWN"];

  function hostedRuntime() {
    return {
      provider: "asherin",
      apiKey: "",
      baseUrl: HOSTED_ENDPOINT,
      model: HOSTED_MODEL.id,
      models: [HOSTED_MODEL],
    };
  }

  function keyless(provider) {
    return provider === "asherin" || provider === "ollama" || provider === "openai-compatible";
  }

  var runtime = load();


  function load() {
    try {
      var raw = sessionStorage.getItem(KEY);
      if (!raw) return hostedRuntime();
      var parsed = JSON.parse(raw);
      if (!parsed.provider) return hostedRuntime();
      return {
        provider: parsed.provider || "",
        apiKey: parsed.apiKey || "",
        baseUrl: parsed.baseUrl || "",
        model: parsed.model || "",
        models: Array.isArray(parsed.models) ? parsed.models : [],
      };
    } catch (_) {
      return hostedRuntime();
    }
  }


  function save() {
    try { sessionStorage.setItem(KEY, JSON.stringify(runtime)); } catch (_) { /* private mode */ }
  }

  function json(status, body) {
    return new Response(JSON.stringify(body), {
      status: status,
      headers: { "content-type": "application/json" },
    });
  }

  function trimBase(url) { return String(url || "").replace(/\/+$/, ""); }
  function safeProvider(p) { return Object.prototype.hasOwnProperty.call(DEFAULTS, p) ? p : "openai"; }

  function headersFor(provider, apiKey) {
    if (provider === "openai" || provider === "openai-compatible") {
      return apiKey ? { authorization: "Bearer " + apiKey } : {};
    }
    if (provider === "anthropic") {
      return {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        // Anthropic refuses browser-origin calls unless this is present.
        "anthropic-dangerous-direct-browser-access": "true",
      };
    }
    return {};
  }

  async function fetchJson(url, options) {
    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, 45000);
    try {
      var res = await window.__sorenFetch(url, Object.assign({}, options, { signal: controller.signal }));
      var text = await res.text();
      var data = {};
      try { data = text ? JSON.parse(text) : {}; } catch (_) { data = { raw: text }; }
      if (!res.ok) {
        throw new Error((data && data.error && data.error.message) || data.error || data.message || res.status + " " + res.statusText);
      }
      return data;
    } catch (error) {
      if (error && error.name === "AbortError") throw new Error("provider request timed out after 45s");
      if (error instanceof TypeError) {
        throw new Error("the browser could not reach this endpoint directly. the provider must allow browser origins, or run asherin.soren locally.");
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  async function listModels(config) {
    var provider = config.provider;
    var base = trimBase(config.baseUrl || DEFAULTS[provider]);
    var rows = [];
    if (provider === "asherin") return [HOSTED_MODEL];

    if (provider === "openai" || provider === "openai-compatible") {
      var d = await fetchJson(base + "/models", { headers: headersFor(provider, config.apiKey) });
      rows = Array.isArray(d.data) ? d.data : Array.isArray(d.models) ? d.models : [];
      return rows
        .map(function (x) { return { id: x.id || x.name, label: x.id || x.name }; })
        .filter(function (x) { return x.id && (provider !== "openai" || /^(gpt|o\d|chatgpt|ft:)/i.test(x.id)); })
        .sort(function (a, b) { return a.id.localeCompare(b.id); });
    }
    if (provider === "anthropic") {
      var a = await fetchJson(base + "/models?limit=1000", { headers: headersFor(provider, config.apiKey) });
      rows = Array.isArray(a.data) ? a.data : [];
      return rows
        .map(function (x) { return { id: x.id, label: x.display_name || x.id }; })
        .filter(function (x) { return x.id; })
        .sort(function (a2, b2) { return a2.id.localeCompare(b2.id); });
    }
    if (provider === "google") {
      var g = await fetchJson(base + "/models?key=" + encodeURIComponent(config.apiKey));
      rows = Array.isArray(g.models) ? g.models : [];
      return rows
        .filter(function (x) { return (x.supportedGenerationMethods || []).indexOf("generateContent") !== -1; })
        .map(function (x) { return { id: String(x.name || "").replace(/^models\//, ""), label: x.displayName || x.name }; })
        .filter(function (x) { return x.id; })
        .sort(function (a3, b3) { return a3.id.localeCompare(b3.id); });
    }
    if (provider === "ollama") {
      var o = await fetchJson(base + "/api/tags");
      rows = Array.isArray(o.models) ? o.models : [];
      return rows
        .map(function (x) { return { id: x.name || x.model, label: x.name || x.model }; })
        .filter(function (x) { return x.id; })
        .sort(function (a4, b4) { return a4.id.localeCompare(b4.id); });
    }
    return [];
  }

  var TOOL_TEXT = [
    "search_sources -> search the registered source registry -> {query?,limit?}",
    "read_source -> read registered source content or parsed details -> {source_id,max_chars?}",
    "inspect_image -> queue a registered image for vision input next round -> {source_id}",
    "search_components -> search the canonical component registry -> {query?,limit?}",
    "inspect_component -> read one canonical component record -> {component_id}",
    "select_component -> select a component -> {component_id}",
    "set_view_mode -> orbit | explode | xray | thermal -> {mode}",
    "set_camera -> set camera yaw, pitch, or zoom -> {yaw?,pitch?,zoom?}",
    "set_panel_visibility -> open or collapse a UI region -> {panel,visible}",
    "set_left_tab -> switch left workspace between AI and system -> {tab}",
    "set_visual_parameter -> orbit sensitivity, explode, xray, thermal, 0 to 1 -> {name,value}",
    "search_materials -> search imported material passports -> {query?,limit?}",
    "inspect_material -> inspect one material passport -> {material_id}",
    "get_solver_eligibility -> report present and missing solver inputs -> {solver,component_id?}",
    "fetch_environment_power -> retrieve NASA POWER hourly evidence and apply one hour -> {latitude,longitude,date,hour_utc?,site_elevation_m?}",
    "set_time_index -> move to an imported telemetry row -> {index}",
    "set_flow_visibility -> control an overlay -> {flow,visible}",
    "fit_camera -> fit the actual loaded geometry -> {}",
    "bind_source -> bind a registered source to a component -> {source_id,component_id}",
    "remove_source -> remove a registered source from the workspace -> {source_id}",
    "set_scenario_value -> change a scenario input without changing source truth -> {key,value}",
  ].join("\n");

  var SYSTEM_INSTRUCTION =
    "you are the operational AI inside asherin.soren, an engineering evidence workspace.\n\n" +
    "nonnegotiable rules:\n" +
    "1. source truth outranks inference. never invent measurements, dimensions, blueprints, telemetry, geometry, material properties, revisions, or model results.\n" +
    "2. if a source is registered but unparsed, say it is unparsed. do not act as if its contents were read.\n" +
    "3. native geometry owns coordinates and dimensions. telemetry owns measured values. structured records own their explicit fields. images are observational evidence only unless corroborated.\n" +
    "4. you have system control only through the declared tool calls. never claim an action happened unless a tool result says it happened.\n" +
    "5. the snapshot is bounded. use search_components, inspect_component, search_sources, read_source and inspect_image instead of assuming omitted records do not exist.\n" +
    "6. preserve conflicts. never average conflicting revisions into a fake consensus.\n" +
    "7. if a required input is missing, stop at the missing input instead of fabricating a solver result.\n" +
    "8. external URL retrieval and code editing are unavailable in this browser build. say so if asked; do not claim either happened.\n" +
    "9. environmental evidence must retain provider, coordinates, timestamp, retrieval time, parameter names and provenance. user entered scenario values stay labeled assumptions.\n" +
    "10. material properties count as available only when present in an imported passport or explicit source record.\n" +
    "11. answer in a compact engineering style, lowercase, and cite source ids or component ids whenever material.\n\n" +
    "available tools:\n" + TOOL_TEXT + "\n\n" +
    'response contract: return one JSON object and nothing else.\n' +
    '{"message":"user facing answer","tool_calls":[{"name":"read_source","arguments":{"source_id":"src..."}}],"evidence":["references used"],"missing":["missing evidence"],"confidence":"high|medium|low|insufficient"}\n' +
    "if no tool is needed, use an empty tool_calls array.";

  function buildAgentPrompt(body) {
    var conversation = body.conversation || [];
    var latest = "";
    for (var i = conversation.length - 1; i >= 0; i--) {
      if (conversation[i].role === "user") { latest = conversation[i].content; break; }
    }
    return (
      "USER REQUEST\n" + latest +
      "\n\nCANONICAL SYSTEM SNAPSHOT\n" + JSON.stringify(body.snapshot || {}, null, 2) +
      "\n\nSOURCE DIGEST\n" + JSON.stringify(body.sourceDigest || [], null, 2) +
      "\n\nPRIOR TOOL RESULTS\n" + JSON.stringify(body.toolResults || [], null, 2) +
      "\n\nCONVERSATION\n" + JSON.stringify(conversation, null, 2)
    );
  }

  function stripDataUrl(dataUrl) {
    var match = String(dataUrl || "").match(/^data:([^;]+);base64,(.+)$/);
    return match ? { mime: match[1], base64: match[2] } : null;
  }

  async function callOpenAI(config, body, compatible) {
    var base = trimBase(config.baseUrl);
    var prompt = buildAgentPrompt(body);
    if (compatible) {
      var chat = await fetchJson(base + "/chat/completions", {
        method: "POST",
        headers: Object.assign({ "content-type": "application/json" }, headersFor("openai-compatible", config.apiKey)),
        body: JSON.stringify({
          model: body.model,
          messages: [
            { role: "system", content: SYSTEM_INSTRUCTION },
            { role: "user", content: prompt },
          ],
          response_format: { type: "json_object" },
        }),
      });
      return (chat.choices && chat.choices[0] && chat.choices[0].message && chat.choices[0].message.content) || "";
    }
    var content = [{ type: "input_text", text: prompt }];
    (body.images || []).forEach(function (img) {
      if (img.data_url) content.push({ type: "input_image", image_url: img.data_url });
    });
    var data = await fetchJson(base + "/responses", {
      method: "POST",
      headers: Object.assign({ "content-type": "application/json" }, headersFor("openai", config.apiKey)),
      body: JSON.stringify({ model: body.model, instructions: SYSTEM_INSTRUCTION, input: [{ role: "user", content: content }] }),
    });
    if (typeof data.output_text === "string") return data.output_text;
    var parts = [];
    (data.output || []).forEach(function (item) {
      (item.content || []).forEach(function (c) { if (typeof c.text === "string") parts.push(c.text); });
    });
    return parts.join("\n");
  }

  async function callAnthropic(config, body) {
    var content = [{ type: "text", text: buildAgentPrompt(body) }];
    (body.images || []).forEach(function (img) {
      var parsed = stripDataUrl(img.data_url);
      if (parsed) content.push({ type: "image", source: { type: "base64", media_type: parsed.mime, data: parsed.base64 } });
    });
    var data = await fetchJson(trimBase(config.baseUrl) + "/messages", {
      method: "POST",
      headers: Object.assign({ "content-type": "application/json" }, headersFor("anthropic", config.apiKey)),
      body: JSON.stringify({ model: body.model, max_tokens: 5000, system: SYSTEM_INSTRUCTION, messages: [{ role: "user", content: content }] }),
    });
    return (data.content || []).map(function (x) { return x.text || ""; }).join("\n");
  }

  async function callGoogle(config, body) {
    var parts = [{ text: buildAgentPrompt(body) }];
    (body.images || []).forEach(function (img) {
      var parsed = stripDataUrl(img.data_url);
      if (parsed) parts.push({ inlineData: { mimeType: parsed.mime, data: parsed.base64 } });
    });
    var url = trimBase(config.baseUrl) + "/models/" + encodeURIComponent(body.model) + ":generateContent?key=" + encodeURIComponent(config.apiKey);
    var data = await fetchJson(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
        contents: [{ role: "user", parts: parts }],
        generationConfig: { responseMimeType: "application/json" },
      }),
    });
    var candidate = (data.candidates || [])[0];
    return (((candidate || {}).content || {}).parts || []).map(function (x) { return x.text || ""; }).join("\n");
  }

  async function callOllama(config, body) {
    var images = [];
    (body.images || []).forEach(function (img) {
      var parsed = stripDataUrl(img.data_url);
      if (parsed) images.push(parsed.base64);
    });
    var user = { role: "user", content: buildAgentPrompt(body) };
    if (images.length) user.images = images;
    var data = await fetchJson(trimBase(config.baseUrl) + "/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model: body.model, stream: false, format: "json", messages: [{ role: "system", content: SYSTEM_INSTRUCTION }, user] }),
    });
    return (data.message && data.message.content) || "";
  }

  async function callProvider(config, body) {
    if (config.provider === "openai") return callOpenAI(config, body, false);
    if (config.provider === "openai-compatible") return callOpenAI(config, body, true);
    if (config.provider === "anthropic") return callAnthropic(config, body);
    if (config.provider === "google") return callGoogle(config, body);
    if (config.provider === "ollama") return callOllama(config, body);
    throw new Error("unsupported provider");
  }

  function cleanPowerValue(value) {
    var n = Number(value);
    if (!isFinite(n) || n <= -900) return null;
    return n;
  }

  function normalizePowerResponse(data, request) {
    var block = (data && data.properties && (data.properties.parameter || data.properties.parameters)) || {};
    var stamps = {};
    Object.keys(block).forEach(function (name) {
      var series = block[name];
      if (series && typeof series === "object") Object.keys(series).forEach(function (t) { stamps[t] = true; });
    });
    var timestamps = Object.keys(stamps).sort();
    var meta = (data && data.parameters && typeof data.parameters === "object") ? data.parameters : {};
    var records = timestamps.map(function (timestamp) {
      var values = {};
      POWER_PARAMETERS.forEach(function (name) {
        if (block[name] && Object.prototype.hasOwnProperty.call(block[name], timestamp)) {
          values[name] = cleanPowerValue(block[name][timestamp]);
        }
      });
      return { timestamp: timestamp, values: values };
    });
    return {
      provider: "NASA POWER",
      temporal: "hourly",
      timeStandard: "UTC",
      latitude: Number(request.latitude),
      longitude: Number(request.longitude),
      siteElevationM: request.site_elevation_m == null || request.site_elevation_m === "" ? null : Number(request.site_elevation_m),
      parameters: POWER_PARAMETERS.map(function (name) {
        var m = meta[name] || {};
        return { name: name, unit: m.units || m.unit || null, longName: m.longname || m.long_name || null };
      }),
      records: records,
      header: (data && data.header && typeof data.header === "object") ? data.header : {},
      geometry: (data && data.geometry) || null,
    };
  }

  async function sha256Hex(text) {
    try {
      var buffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
      return Array.prototype.map.call(new Uint8Array(buffer), function (b) {
        return b.toString(16).padStart(2, "0");
      }).join("");
    } catch (_) {
      return null;
    }
  }

  async function fetchPowerEnvironment(input) {
    var latitude = Number(input.latitude);
    var longitude = Number(input.longitude);
    if (!isFinite(latitude) || latitude < -90 || latitude > 90) throw new Error("latitude must be between -90 and 90");
    if (!isFinite(longitude) || longitude < -180 || longitude > 180) throw new Error("longitude must be between -180 and 180");
    var date = String(input.date || "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("date must use YYYY-MM-DD");
    var compact = date.split("-").join("");
    var params = new URLSearchParams({
      parameters: POWER_PARAMETERS.join(","),
      community: "SB",
      longitude: String(longitude),
      latitude: String(latitude),
      start: compact,
      end: compact,
      format: "JSON",
      "time-standard": "UTC",
    });
    if (input.site_elevation_m !== "" && input.site_elevation_m != null) {
      var elevation = Number(input.site_elevation_m);
      if (!isFinite(elevation)) throw new Error("site elevation must be numeric");
      params.set("site-elevation", String(elevation));
    }
    var sourceUrl = "https://power.larc.nasa.gov/api/temporal/hourly/point?" + params.toString();
    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, 45000);
    var text;
    try {
      var response = await window.__sorenFetch(sourceUrl, { signal: controller.signal });
      text = await response.text();
      if (!response.ok) throw new Error("NASA POWER request failed with " + response.status + " " + response.statusText);
    } catch (error) {
      if (error && error.name === "AbortError") throw new Error("NASA POWER request timed out after 45s");
      if (error instanceof TypeError) throw new Error("NASA POWER could not be reached from this browser");
      throw error;
    } finally {
      clearTimeout(timer);
    }
    var raw;
    try { raw = JSON.parse(text); } catch (_) { throw new Error("NASA POWER returned non JSON data"); }
    var normalized = normalizePowerResponse(raw, input);
    if (!normalized.records.length) throw new Error("NASA POWER returned no hourly records for the requested date");
    normalized.sourceUrl = sourceUrl;
    normalized.retrievedAt = new Date().toISOString();
    normalized.sha256 = await sha256Hex(text);
    normalized.raw = raw;
    return normalized;
  }

  async function readBody(init) {
    if (!init || init.body == null) return {};
    try { return JSON.parse(typeof init.body === "string" ? init.body : await new Response(init.body).text()); }
    catch (_) { return {}; }
  }

  async function route(pathname, method, init) {
    if (method === "GET" && pathname === "/api/health") {
      return json(200, { ok: true, product: "asherin.soren", runtime: "browser" });
    }
    if (method === "GET" && pathname === "/api/provider/status") {
      return json(200, {
        connected: !!runtime.provider,
        provider: runtime.provider,
        model: runtime.model,
        baseUrl: runtime.baseUrl,
        models: runtime.models || [],
      });
    }
    if (method === "POST" && pathname === "/api/provider/connect") {
      var body = await readBody(init);
      var provider = safeProvider(body.provider);
      var apiKey = String(body.apiKey || (provider === runtime.provider ? runtime.apiKey : "") || "");
      var baseUrl = trimBase(body.baseUrl || DEFAULTS[provider]);
      if (!apiKey && provider !== "ollama" && provider !== "openai-compatible") {
        return json(400, { error: "an API key is required for " + provider });
      }
      try {
        var models = await listModels({ provider: provider, apiKey: apiKey, baseUrl: baseUrl });
        runtime.provider = provider;
        runtime.apiKey = apiKey;
        runtime.baseUrl = baseUrl;
        runtime.models = models;
        if (!models.some(function (m) { return m.id === runtime.model; })) runtime.model = "";
        save();
        return json(200, { ok: true, provider: provider, baseUrl: baseUrl, models: models });
      } catch (error) {
        return json(400, { error: error.message || "provider connection failed" });
      }
    }
    if (method === "POST" && pathname === "/api/provider/active") {
      var active = await readBody(init);
      runtime.model = String(active.model || "");
      save();
      return json(200, { ok: true, model: runtime.model });
    }
    if (method === "POST" && pathname === "/api/chat") {
      var chatBody = await readBody(init);
      if (!runtime.provider || !runtime.apiKey && runtime.provider !== "ollama" && runtime.provider !== "openai-compatible") {
        return json(400, { error: "connect a model provider first" });
      }
      try {
        var text = await callProvider(runtime, chatBody);
        return json(200, { ok: true, text: text });
      } catch (error) {
        return json(502, { error: error.message || "AI request failed" });
      }
    }
    if (method === "POST" && pathname === "/api/environment/power") {
      var envBody = await readBody(init);
      try {
        var result = await fetchPowerEnvironment(envBody);
        return json(200, Object.assign({ ok: true }, result));
      } catch (error) {
        return json(400, { error: error.message || "environment retrieval failed" });
      }
    }
    if (pathname === "/api/retrieve") {
      return json(501, {
        error: "url retrieval is unavailable in the browser build. a browser cannot download a cross origin engineering source. import the file from disk, or run asherin.soren locally.",
      });
    }
    if (pathname.indexOf("/api/dev/") === 0) {
      if (pathname === "/api/dev/status") {
        return json(200, { enabled: false, allowlist: [], staged: 0, reason: "browser build has no writable code surface" });
      }
      return json(501, { error: "developer code editing requires the local asherin.soren server" });
    }
    return json(404, { error: "unknown endpoint " + pathname });
  }

  window.__sorenFetch = window.fetch.bind(window);
  window.fetch = function (input, init) {
    var url;
    try {
      url = new URL(typeof input === "string" ? input : input.url, window.location.href);
    } catch (_) {
      return window.__sorenFetch(input, init);
    }
    var sameOrigin = url.origin === window.location.origin;
    if (!sameOrigin || url.pathname.indexOf("/api/") !== 0) {
      return window.__sorenFetch(input, init);
    }
    var method = String((init && init.method) || (typeof input === "object" && input.method) || "GET").toUpperCase();
    return route(url.pathname, method, init).catch(function (error) {
      return json(500, { error: (error && error.message) || "local bridge failure" });
    });
  };
})();
