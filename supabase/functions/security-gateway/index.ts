import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, getClientIp } from "../_shared/cors.ts";
import { requireAdmin, authErrorResponse, AuthError } from "../_shared/authMiddleware.ts";

// ============================================================
// AUREON SECURITY GATEWAY
// WAF + IDS + Rate Limiter + Honeypot + Threat Intel + UBA
// ============================================================

// SQL Injection patterns
const SQL_INJECTION_PATTERNS = [
  /('|"|;)\s*(OR|AND)\s+\d+\s*=\s*\d+/i,
  /UNION\s+(ALL\s+)?SELECT/i,
  /DROP\s+(TABLE|DATABASE)/i,
  /INSERT\s+INTO/i,
  /DELETE\s+FROM/i,
  /UPDATE\s+\w+\s+SET/i,
  /EXEC(\s|\+)+(s|x)p/i,
  /xp_cmdshell/i,
  /0x[0-9a-fA-F]+/,
  /CONCAT\s*\(/i,
  /CHAR\s*\(/i,
  /BENCHMARK\s*\(/i,
  /SLEEP\s*\(/i,
  /WAITFOR\s+DELAY/i,
  /LOAD_FILE\s*\(/i,
  /INTO\s+(OUT|DUMP)FILE/i,
];

// XSS patterns
const XSS_PATTERNS = [
  /<script[\s>]/i,
  /javascript\s*:/i,
  /on(error|load|click|mouseover|focus|blur|submit|change|input|keydown|keyup|keypress)\s*=/i,
  /eval\s*\(/i,
  /document\.(cookie|write|location)/i,
  /window\.(location|open)/i,
  /innerHTML\s*=/i,
  /fromCharCode/i,
  /String\.fromCharCode/i,
  /<iframe/i,
  /<embed/i,
  /<object/i,
  /data:\s*text\/html/i,
  /vbscript\s*:/i,
];

// SSRF patterns
const SSRF_PATTERNS = [
  /127\.0\.0\.\d+/,
  /localhost/i,
  /0\.0\.0\.0/,
  /169\.254\.169\.254/,
  /10\.\d+\.\d+\.\d+/,
  /172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+/,
  /192\.168\.\d+\.\d+/,
  /0x7f000001/i,
  /metadata\.google/i,
  /169\.254/,
];

// Path traversal
const PATH_TRAVERSAL_PATTERNS = [
  /\.\.\//,
  /\.\.\\/, 
  /%2e%2e/i,
  /%252e%252e/i,
  /etc\/passwd/i,
  /etc\/shadow/i,
  /proc\/self/i,
  /windows\/system32/i,
];

// Known malicious user agents
const MALICIOUS_USER_AGENTS = [
  "sqlmap", "nikto", "burp", "metasploit", "nmap", "dirbuster",
  "gobuster", "masscan", "hydra", "wfuzz", "nessus", "acunetix",
  "w3af", "skipfish", "havij", "pangolin", "webscarab",
];

// Geo-blocked countries
const GEO_BLOCKED = ["CN", "RU", "KP"];

interface ScanResult {
  blocked: boolean;
  event_type: string;
  severity: string;
  detection_rule: string;
  payload_snippet?: string;
}

function scanPayload(payload: string): ScanResult | null {
  // SQL Injection
  for (const pattern of SQL_INJECTION_PATTERNS) {
    if (pattern.test(payload)) {
      const match = payload.match(pattern);
      return {
        blocked: true,
        event_type: "sql_injection",
        severity: "critical",
        detection_rule: `SQLi: ${pattern.source}`,
        payload_snippet: match?.[0]?.substring(0, 200),
      };
    }
  }

  // XSS
  for (const pattern of XSS_PATTERNS) {
    if (pattern.test(payload)) {
      const match = payload.match(pattern);
      return {
        blocked: true,
        event_type: "xss_attack",
        severity: "critical",
        detection_rule: `XSS: ${pattern.source}`,
        payload_snippet: match?.[0]?.substring(0, 200),
      };
    }
  }

  // SSRF
  for (const pattern of SSRF_PATTERNS) {
    if (pattern.test(payload)) {
      const match = payload.match(pattern);
      return {
        blocked: true,
        event_type: "ssrf_attempt",
        severity: "high",
        detection_rule: `SSRF: ${pattern.source}`,
        payload_snippet: match?.[0]?.substring(0, 200),
      };
    }
  }

  // Path Traversal
  for (const pattern of PATH_TRAVERSAL_PATTERNS) {
    if (pattern.test(payload)) {
      const match = payload.match(pattern);
      return {
        blocked: true,
        event_type: "path_traversal",
        severity: "high",
        detection_rule: `PathTraversal: ${pattern.source}`,
        payload_snippet: match?.[0]?.substring(0, 200),
      };
    }
  }

  return null;
}

function scanUserAgent(ua: string): ScanResult | null {
  const lowerUa = ua.toLowerCase();
  for (const bot of MALICIOUS_USER_AGENTS) {
    if (lowerUa.includes(bot)) {
      return {
        blocked: true,
        event_type: "malicious_bot",
        severity: "high",
        detection_rule: `Bot: ${bot}`,
        payload_snippet: ua.substring(0, 200),
      };
    }
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: getCorsHeaders(req) });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const body = await req.json().catch(() => ({}));
    const { action, payload, user_agent, request_path, request_method, geo_country, user_id } = body;
    // SECURITY: never trust source_ip from request body — derive from infra headers
    const source_ip = getClientIp(req);

    // ACTION: scan — Full WAF + IDS scan
    if (action === "scan") {
      const results: ScanResult[] = [];

      // Scan payload
      if (payload) {
        const payloadStr = typeof payload === "string" ? payload : JSON.stringify(payload);
        const result = scanPayload(payloadStr);
        if (result) results.push(result);
      }

      // Scan user agent
      if (user_agent) {
        const uaResult = scanUserAgent(user_agent);
        if (uaResult) results.push(uaResult);
      }

      // Geo-blocking
      if (geo_country && GEO_BLOCKED.includes(geo_country.toUpperCase())) {
        results.push({
          blocked: true,
          event_type: "geo_blocked",
          severity: "medium",
          detection_rule: `GeoBlock: ${geo_country}`,
          payload_snippet: `Country: ${geo_country}`,
        });
      }

      // Check threat intelligence DB
      if (source_ip || user_agent) {
        const { data: threats } = await supabaseAdmin
          .from("threat_intelligence")
          .select("*")
          .eq("is_active", true);

        if (threats) {
          for (const threat of threats) {
            if (threat.indicator_type === "ip" && source_ip === threat.indicator_value) {
              results.push({
                blocked: true,
                event_type: "threat_intel_match",
                severity: "critical",
                detection_rule: `ThreatIntel-IP: ${threat.indicator_value}`,
                payload_snippet: `Known malicious IP: ${source_ip}`,
              });
              // Update hit count
              await supabaseAdmin
                .from("threat_intelligence")
                .update({ hit_count: (threat.hit_count || 0) + 1, last_seen: new Date().toISOString() })
                .eq("id", threat.id);
            }
            if (threat.indicator_type === "user_agent" && user_agent?.toLowerCase().includes(threat.indicator_value.toLowerCase())) {
              results.push({
                blocked: true,
                event_type: "threat_intel_match",
                severity: "high",
                detection_rule: `ThreatIntel-UA: ${threat.indicator_value}`,
                payload_snippet: user_agent?.substring(0, 200),
              });
              await supabaseAdmin
                .from("threat_intelligence")
                .update({ hit_count: (threat.hit_count || 0) + 1, last_seen: new Date().toISOString() })
                .eq("id", threat.id);
            }
            if (threat.indicator_type === "pattern" && payload) {
              const payloadStr = typeof payload === "string" ? payload : JSON.stringify(payload);
              if (payloadStr.toLowerCase().includes(threat.indicator_value.toLowerCase())) {
                results.push({
                  blocked: true,
                  event_type: "threat_intel_pattern",
                  severity: "critical",
                  detection_rule: `ThreatIntel-Pattern: ${threat.indicator_value}`,
                  payload_snippet: payloadStr.substring(0, 200),
                });
                await supabaseAdmin
                  .from("threat_intelligence")
                  .update({ hit_count: (threat.hit_count || 0) + 1, last_seen: new Date().toISOString() })
                  .eq("id", threat.id);
              }
            }
          }
        }
      }

      // Log all events
      for (const result of results) {
        await supabaseAdmin.from("security_events").insert({
          event_type: result.event_type,
          severity: result.severity,
          source_ip: source_ip || "unknown",
          user_agent: user_agent || "unknown",
          request_path: request_path || "/",
          request_method: request_method || "GET",
          payload_snippet: result.payload_snippet,
          detection_rule: result.detection_rule,
          action_taken: "blocked",
          geo_country: geo_country || null,
        });
      }

      // Auto-incident response if critical
      const criticalEvents = results.filter(r => r.severity === "critical");
      if (criticalEvents.length > 0) {
        await supabaseAdmin.from("incident_responses").insert({
          incident_type: criticalEvents[0].event_type,
          target_ip: source_ip,
          target_user_id: user_id || null,
          action_taken: user_id ? "account_flagged" : "ip_blocked",
          severity: "critical",
          details: { events: criticalEvents, timestamp: new Date().toISOString() },
        });

        // Auto-add IP to threat intel if not already there
        if (source_ip && source_ip !== "unknown") {
          const { data: existing } = await supabaseAdmin
            .from("threat_intelligence")
            .select("id")
            .eq("indicator_type", "ip")
            .eq("indicator_value", source_ip)
            .maybeSingle();

          if (!existing) {
            await supabaseAdmin.from("threat_intelligence").insert({
              indicator_type: "ip",
              indicator_value: source_ip,
              threat_category: "auto_blocked",
              confidence: 85,
              source: "waf_auto",
              last_seen: new Date().toISOString(),
              hit_count: 1,
            });
          }
        }
      }

      const blocked = results.length > 0;
      return new Response(JSON.stringify({
        blocked,
        threats_detected: results.length,
        details: results,
      }), { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } });
    }

    // ACTION: honeypot — Log honeypot hits
    if (action === "honeypot") {
      const { trap_type, trap_name } = body;
      await supabaseAdmin.from("honeypot_logs").insert({
        trap_type: trap_type || "endpoint",
        trap_name: trap_name || "unknown",
        source_ip: source_ip || "unknown",
        user_agent: user_agent || "unknown",
        request_data: body,
        geo_country: geo_country || null,
      });

      // Auto-block IP that hits honeypot
      if (source_ip && source_ip !== "unknown") {
        const { data: existing } = await supabaseAdmin
          .from("threat_intelligence")
          .select("id")
          .eq("indicator_type", "ip")
          .eq("indicator_value", source_ip)
          .maybeSingle();

        if (!existing) {
          await supabaseAdmin.from("threat_intelligence").insert({
            indicator_type: "ip",
            indicator_value: source_ip,
            threat_category: "honeypot_trigger",
            confidence: 95,
            source: "honeypot",
            last_seen: new Date().toISOString(),
            hit_count: 1,
          });
        }

        await supabaseAdmin.from("incident_responses").insert({
          incident_type: "honeypot_triggered",
          target_ip: source_ip,
          action_taken: "ip_blocked",
          severity: "high",
          details: { trap_type, trap_name, user_agent, timestamp: new Date().toISOString() },
        });
      }

      // Return fake data to waste attacker time
      return new Response(JSON.stringify({
        status: "success",
        data: { users: [{ id: 1, name: "admin", token: "fake_token_deadbeef" }] },
      }), { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } });
    }

    // ACTION: rate_check — Rate limiting
    if (action === "rate_check") {
      const identifier = source_ip || user_id || "anonymous";
      const endpoint = request_path || "/";
      const windowMs = 60000; // 1 minute window
      const maxRequests = 60;

      const windowStart = new Date(Date.now() - windowMs).toISOString();

      const { count } = await supabaseAdmin
        .from("rate_limit_tracking")
        .select("*", { count: "exact", head: true })
        .eq("identifier", identifier)
        .eq("endpoint", endpoint)
        .gte("created_at", windowStart);

      const currentCount = count || 0;

      // Log this request
      await supabaseAdmin.from("rate_limit_tracking").insert({
        identifier,
        identifier_type: source_ip ? "ip" : "user",
        endpoint,
        request_count: 1,
        blocked: currentCount >= maxRequests,
      });

      if (currentCount >= maxRequests) {
        await supabaseAdmin.from("security_events").insert({
          event_type: "rate_limit_exceeded",
          severity: "medium",
          source_ip: source_ip || "unknown",
          user_agent: user_agent || "unknown",
          request_path: endpoint,
          detection_rule: `RateLimit: ${maxRequests}/min exceeded (${currentCount + 1})`,
          action_taken: "throttled",
        });

        return new Response(JSON.stringify({
          blocked: true,
          reason: "rate_limit_exceeded",
          retry_after: 60,
          current_count: currentCount + 1,
          max_requests: maxRequests,
        }), { status: 429, headers: { ...getCorsHeaders(req), "Content-Type": "application/json", "Retry-After": "60" } });
      }

      return new Response(JSON.stringify({
        blocked: false,
        remaining: maxRequests - currentCount - 1,
        current_count: currentCount + 1,
      }), { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } });
    }

    // ACTION: dashboard — Get security dashboard data
    if (action === "dashboard") {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader?.startsWith("Bearer ")) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: getCorsHeaders(req) });
      }

      const supabaseUser = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } }
      );

      const token = authHeader.replace("Bearer ", "");
      const { data: claims, error: claimsErr } = await supabaseUser.auth.getClaims(token);
      if (claimsErr || !claims?.claims) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: getCorsHeaders(req) });
      }

      const now = new Date();
      const last24h = new Date(now.getTime() - 86400000).toISOString();
      const last7d = new Date(now.getTime() - 604800000).toISOString();

      const [eventsRes, incidentsRes, honeypotRes, threatRes, behaviorRes] = await Promise.all([
        supabaseAdmin.from("security_events").select("*").gte("created_at", last7d).order("created_at", { ascending: false }).limit(500),
        supabaseAdmin.from("incident_responses").select("*").order("created_at", { ascending: false }).limit(100),
        supabaseAdmin.from("honeypot_logs").select("*").gte("created_at", last7d).order("created_at", { ascending: false }).limit(100),
        supabaseAdmin.from("threat_intelligence").select("*").eq("is_active", true).order("hit_count", { ascending: false }).limit(200),
        supabaseAdmin.from("user_behavior_analytics").select("*").gte("created_at", last7d).order("created_at", { ascending: false }).limit(100),
      ]);

      const events = eventsRes.data || [];
      const events24h = events.filter(e => e.created_at >= last24h);

      // Compute stats
      const stats = {
        total_events_24h: events24h.length,
        total_events_7d: events.length,
        critical_events: events24h.filter(e => e.severity === "critical").length,
        high_events: events24h.filter(e => e.severity === "high").length,
        medium_events: events24h.filter(e => e.severity === "medium").length,
        blocked_attacks: events24h.filter(e => e.action_taken === "blocked").length,
        sql_injections: events.filter(e => e.event_type === "sql_injection").length,
        xss_attacks: events.filter(e => e.event_type === "xss_attack").length,
        ssrf_attempts: events.filter(e => e.event_type === "ssrf_attempt").length,
        rate_limit_violations: events.filter(e => e.event_type === "rate_limit_exceeded").length,
        malicious_bots: events.filter(e => e.event_type === "malicious_bot").length,
        geo_blocks: events.filter(e => e.event_type === "geo_blocked").length,
        honeypot_triggers: (honeypotRes.data || []).length,
        active_threats: (threatRes.data || []).length,
        auto_incidents: (incidentsRes.data || []).filter(i => !i.auto_resolved).length,
        threat_score: Math.min(100, Math.round(
          (events24h.filter(e => e.severity === "critical").length * 25) +
          (events24h.filter(e => e.severity === "high").length * 10) +
          (events24h.filter(e => e.severity === "medium").length * 3)
        )),
      };

      // Event type breakdown for chart
      const eventBreakdown: Record<string, number> = {};
      events.forEach(e => {
        eventBreakdown[e.event_type] = (eventBreakdown[e.event_type] || 0) + 1;
      });

      // Hourly timeline for chart (last 24h)
      const hourlyTimeline: { hour: string; count: number; critical: number }[] = [];
      for (let i = 23; i >= 0; i--) {
        const hourStart = new Date(now.getTime() - i * 3600000);
        const hourEnd = new Date(hourStart.getTime() + 3600000);
        const hourEvents = events.filter(e => {
          const t = new Date(e.created_at);
          return t >= hourStart && t < hourEnd;
        });
        hourlyTimeline.push({
          hour: hourStart.toISOString().slice(11, 16),
          count: hourEvents.length,
          critical: hourEvents.filter(e => e.severity === "critical").length,
        });
      }

      return new Response(JSON.stringify({
        stats,
        eventBreakdown,
        hourlyTimeline,
        recentEvents: events.slice(0, 50),
        incidents: incidentsRes.data || [],
        honeypotLogs: honeypotRes.data || [],
        threatIntel: threatRes.data || [],
        behaviorAnalytics: behaviorRes.data || [],
      }), { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } });
    }

    // ACTION: add_threat — Admin-only write to threat intelligence
    if (action === "add_threat") {
      try {
        await requireAdmin(req);
      } catch (e) {
        return authErrorResponse(e, getCorsHeaders(req));
      }

      const { indicator_type, indicator_value, threat_category, confidence } = body;
      if (!indicator_type || !indicator_value) {
        return new Response(JSON.stringify({ error: "Missing fields" }), { status: 400, headers: getCorsHeaders(req) });
      }

      await supabaseAdmin.from("threat_intelligence").insert({
        indicator_type,
        indicator_value,
        threat_category: threat_category || "manual",
        confidence: confidence || 80,
        source: "manual",
      });

      return new Response(JSON.stringify({ success: true }), { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400, headers: getCorsHeaders(req) });
  } catch (error) {
    console.error("Security Gateway Error:", error);
    return new Response(JSON.stringify({ error: "Internal error" }), { status: 500, headers: getCorsHeaders(req) });
  }
});
