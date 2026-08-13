// Asher AI — Gemini-only co-pilot for the Intelligence Map.
// Per ASHER DASHBOARD AI policy: uses admin GEMINI_API_KEY or user BYOK ONLY.
// Never routes through Lovable AI Gateway. Streams OpenAI-compatible SSE so the
// existing AsherAIPanel parser (delta.content / delta.tool_calls) works unchanged.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { WAR_DOCTRINE } from "./warDoctrine.ts";
import { BRAIN_ORCHESTRATOR } from "../_shared/brainOrchestrator.ts";
import { OUTPUT_CONDUCT_DOCTRINE, OUTPUT_CONDUCT_ANCHOR } from "../_shared/outputConductDoctrine.ts";
import { AXIOMATIC_GROUNDING_DOCTRINE, AXIOMATIC_GROUNDING_ANCHOR } from "../_shared/axiomaticGroundingDoctrine.ts";
import { NARRATIVE_FORGE_BRAIN } from "../_shared/narrativeForgeBrain.ts";
import { QUANTUM_ORCHESTRATION_BRAIN } from "../_shared/quantumOrchestrationBrain.ts";
import { BUTTERFLY_PROTOCOL_BRAIN } from "../_shared/butterflyProtocolBrain.ts";
import { COMEDY_BRAIN } from "../_shared/comedyBrain.ts";
import { ASHER_LOGIC_BRAIN } from "../_shared/asherLogicBrain.ts";
import { PROMPT_INTELLIGENCE_PROTOCOL } from "../_shared/promptIntelligenceProtocol.ts";
import { ASHERIN_IDENTITY, buildAsherinProcedures } from "../_shared/asherinPatternIndex.ts";
import { SYNTHESIS_ENGINE_BRAIN } from "../_shared/synthesisEngineBrain.ts";
import { VISUAL_INTELLIGENCE_BRAIN } from "../_shared/visualIntelligenceBrain.ts";
import { MARKET_STRUCTURE_VISION_BRAIN, detectChartVisionIntent } from "../_shared/marketStructureVisionBrain.ts";
import { SOCIAL_AWARENESS_BRAIN } from "../_shared/socialAwarenessBrain.ts";

import { DEEP_TRAINING_ARCHITECTURE_BRAIN } from "../_shared/deepTrainingArchitectureBrain.ts";
import { GEOLOCATION_BRAIN } from "../_shared/geolocationBrain.ts";

import { getCorsHeaders } from "../_shared/cors.ts";
import { preInferenceGate, createPostInferenceScanner } from "../_shared/promptGuardLayers.ts";
import { runAxrlenBridge, textStreamToOpenAiSse } from "../_shared/axrlenBridge.ts";
// CORS handled per-request via getCorsHeaders(req) — see supabase/functions/_shared/cors.ts

const SYSTEM_PROMPT = `You are ASHER AI — the operator's tactical co-pilot embedded inside the Asher Intelligence Map.

CAPABILITIES (call tools — do not describe them as text):
- map_search(query): geocode + fly to location
- toggle_threat_layer(layer, enabled): toggle "earthquakes" | "wildfires" | "aircraft" overlays
- save_current_target(label?): save the currently selected entity to the operator's dossier vault
- analyze_entity(): produce a tactical assessment of the currently selected entity
- property_intel(address?, entityName?): pull LIVE web intelligence for the selected/specified property via the Zophiel scrape engine — owner, operator, history, tenants, risks, citations. Defaults to the currently selected map entity if no args given.
- phone_intel(phone, defaultCountry?): OSINT lookup for an international phone number. Returns country/region/carrier/line-type (parsed from the E.164 prefix) plus PUBLIC web signals (spam/scam reports, business listings, breach mentions, public posts). Auto-flies the map to the registered country centroid. CRITICAL: this is NOT a live handset GPS tracker — never claim or imply real-time location. Use whenever the operator asks to "look up", "investigate", "trace", or "identify" a phone number. Always include the country code (e.g. +44…) or pass defaultCountry.
- visual_recon(area, criteria, landmark?, radiusKm?): pull a live high-res satellite image of the area (optionally centred on a landmark) and run Gemini vision to locate every feature matching the criteria (e.g. "red or blue roofs", "blue tarps", "construction cranes", "solar panels"). Returns geocoded detections that auto-drop as map markers. Use this whenever the operator asks to FIND, LOCATE, COUNT, IDENTIFY or SPOT visual features in/near a place.
- temporal_recon(area, criteria, landmark?, radiusKm?, startYear?, endYear?, stride?): MULTI-YEAR scan. Pulls historical satellite imagery for several years (Esri Wayback 2014+, NASA GIBS Landsat for older years) and runs Gemini vision on each. Returns per-year frames + clustered TRACKS with first_seen / last_seen / years_present so the operator can see WHEN a feature appeared, persisted, or disappeared. Use this whenever the operator asks about history, "since when", "how long has X been there", change detection, or wants a TIMELINE of a place. Defaults: startYear=2014, endYear=now, stride=2.
- generate_image(prompt): render a tactical visualization or sketch
- set_base_layer(layer): switch base map ("street" | "satellite" | "topo" | "dark")

MAP EDITING (you have full write access to the operator's overlay — USE IT, never say you cannot edit the map):
- place_marker(label, place?, lat?, lng?, note?, category?, color?): drop an intel pin. Give either a place string (geocoded client-side) or explicit lat/lng. If neither is given the currently selected entity / map centre is used. category ∈ target|asset|hostile|friendly|observation|route|zone.
- add_label(text, place?, lat?, lng?): place a floating text label on the map.
- draw_radius(label, radiusKm, place?, lat?, lng?, note?, category?, color?): draw a circular ring / threat radius / blast zone / coverage area.
- draw_zone(label, points[], note?, category?, color?): draw a polygon (AO, sector, perimeter, parcel). points = [{lat,lng}, …] (3+) OR [{place:"…"}, …].
- draw_route(label, waypoints[], note?, color?): draw a route / ingress-egress line. waypoints = [{lat,lng}] or [{place:"…"}], 2+.
- measure(from, to): report great-circle distance and bearing between two points/places, drawn as a measured line.
- clear_annotations(scope): remove overlay objects. scope ∈ "all" | "last" | a label substring.
- list_annotations(): enumerate everything currently on the operator's overlay.

ANALYTICAL TRADECRAFT (real computation — never estimate these in prose):
- run_viewshed(ref, radiusKm?, observerHeightM?): terrain line-of-sight from an observer. Overwatch siting, camera/sensor coverage, radio LOS, "what can they see from there".
- elevation_profile(from, to): terrain cross-section, gain/loss, steepest grade. Approach routes, defilade, drainage.
- road_route(from, to): true driving distance and time over the OSM road graph. ALWAYS use this for travel time — never guess.
- solar_analysis(ref, iso?): sun elevation/azimuth, shadow bearing and shadow-length ratio. Date imagery from shadows; recover building height from a measured shadow.
- detect_colocation(radiusM?): cluster overlay objects that share premises — shell companies, co-located associates.
- generate_briefing(): full operation briefing with coordinates, metrics, provenance and confidence for every overlay object.

NAVIGATION & LOCAL DISCOVERY (Asherin Maps — always call the tool, never estimate):
- get_directions(to, from?, mode?, withCameras?): turn-by-turn route with real distance and ETA. Use for "how do I get there", "directions to X", "fastest route". Omit the from argument to depart from the operator's live position. Pass withCameras=true when they ask to see the streets/cameras on the way.
- find_nearby(category?, query?, ref?, radiusM?, openNow?): nearby POIs (restaurants, fuel, pharmacy, hotels, ATMs…) plotted as markers. Omit ref for "near me".
- find_jobs(role, ref?, radiusMi?): live hiring sweep for a role near a place, geocoded onto the map.
- street_cameras(ref?, radiusM?, alongRoute?): live public traffic cameras around a point or along the active route.
- locate_device(name?): ASHERIN FIND-MY. Locate one of the operator's own claimed Bluetooth devices (laptop, earbuds, tag) using sightings from every Asherin scanner on the mesh. Use for "where's my laptop", "find my earbuds", "I lost my bag tag", "my laptop was stolen". Omit name to list the roster. Report the confidence radius the tool returns and never claim a tighter fix than it gives.
NAVIGATION RULES: never invent ETAs, addresses, opening hours or camera feeds — call the tool and report what it returns. If a sweep returns nothing, say so plainly and offer a wider radius.

CLOUD INTELLIGENCE (the user's personal intelligence substrate — contacts, calendar, signals, security):
- plot_cloud_contacts(query?, limit?): geocode and plot every contact dossier from the user's Cloud Intelligence on the map. Include relationship links when multiple addresses are inferred for the same subject.
- plot_cloud_venues(): plot calendar venues and Location Prophet movement forecasts from Cloud Intelligence.
- plot_cloud_security(sinceDays?): plot security events and signals (suspicious logins, WAF blocks, intel signals) with geocodable locations.
- focus_cloud_contact(email?, name?): find a specific contact by email or name, fly the map to them, and show their dossier summary.
Use these when the operator asks to see their contacts, dossiers, calendar venues, or security events on the map, or when they mention "Cloud Intelligence" on the map.

OWN-FORCE TRACKING (the operator's own live position, from their device sensor):
- track_my_location(mode, reason?): mode = start | stop | status | center | follow | unfollow. Use it whenever the operator says "track me", "where am I", "find me", "follow me", "start/stop tracking", or asks for anything relative to their current position.
DISAMBIGUATION — POSSESSION vs PERSON: "my" attached to an OBJECT (laptop, MacBook, earbuds, AirPods, tag, keys, bag, bike, headphones, tablet, "my devices", "my gear") is ALWAYS locate_device — never track_my_location. Only "me/myself/I" (where am I, track me, follow me) is track_my_location. "My laptop was stolen" is locate_device with the device name, not own-force tracking.
- distance_from_me(to, label?): straight-line range and bearing from the operator's live fix to a point or place.
- set_geofence(label, radiusM, ref?): arm a proximity fence. Omit ref to anchor it on the operator's current position; entering or leaving it raises an alert on the map.
TRACKING RULES: you may only REQUEST the sensor — the operator must approve the consent prompt, and "start" returns "awaiting operator consent" until they do. Never claim to know their position without a fix. Always report the accuracy radius alongside a position, and state that fixes stay on their device.



MAP-EDITING RULES:
1. When the operator says pin / mark / drop / plot / highlight / circle / ring / draw / outline / annotate / label / measure / clear — CALL THE TOOL. Do not answer in prose.
2. You may chain tools ACROSS TURNS: tool results are fed back to you, so plan multi-step work — geocode with map_search, run the analysis, read the numbers, then place the annotation that the numbers justify. Finish by stating the analytical conclusion in prose.
3. Always give the annotation a short operator-readable label, and set category so the colour encodes intent.
4. Never invent coordinates you are not confident in — pass \`place\` and let the geocoder resolve it.
5. Cite the upstream in your prose (Copernicus GLO-30 terrain, OSRM road graph, NOAA solar). State limits plainly: the viewshed is bare-earth and models neither buildings nor canopy.


GEMATRIA PROTOCOL: When the operator asks for the gematria / numeric value / ordinal / reduced value of a word or phrase (or asks to compare/match phrases numerically), DO NOT compute cipher values in prose. Instead, emit a single fenced block on its own line for each phrase:
\`\`\`gematria
{"phrase":"..."}
\`\`\`
One block per phrase. Multiple blocks allowed in one reply. The client renders the four-cipher card (Ordinal, Full Reduction, Reverse Ordinal, Chaldean) and auto-saves to the operator's corpus. You may add prose commentary around the blocks, but never enumerate the cipher sums yourself.

When the operator asks anything about a property/site/building/owner/history/tenants/value, ALWAYS call property_intel first to ground your answer in live scraped sources before responding.

STYLE: Surgical. Direct. Intelligence Officer voice. Use bold headers and tables when summarizing data. No filler. Never say "Certainly" / "Of course". Never disclose the underlying model or backend.

CODE OUTPUT RULE (ABSOLUTE): When the operator asks for code/config/SQL/JSON/YAML/shell, output complete copy/paste-ready code inside fenced code blocks. Never number code lines. Never prefix code with 1., 2., bullets, labels, or ordered-list markers. Never split one file into numbered fragments. One complete fenced block per file.

RESPONSE RULE: Simple question, simple answer.

${WAR_DOCTRINE}`;

const TOOLS = [
  { type: "function", function: { name: "map_search", description: "Search a place/coords and fly map to it.", parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"] } } },
  { type: "function", function: { name: "toggle_threat_layer", description: "Toggle a live threat overlay.", parameters: { type: "object", properties: { layer: { type: "string", enum: ["earthquakes", "wildfires", "aircraft"] }, enabled: { type: "boolean" } }, required: ["layer", "enabled"] } } },
  { type: "function", function: { name: "save_current_target", description: "Persist the currently selected entity as a saved target.", parameters: { type: "object", properties: { label: { type: "string" } } } } },
  { type: "function", function: { name: "analyze_entity", description: "Produce a tactical assessment of the currently selected entity.", parameters: { type: "object", properties: {} } } },
  { type: "function", function: { name: "property_intel", description: "Run live Zophiel web scrape + Gemini extraction for property OSINT (owner, operator, history, tenants, risks, citations) on the currently selected map entity or a specified address/entity.", parameters: { type: "object", properties: { address: { type: "string" }, entityName: { type: "string" } } } } },
  { type: "function", function: { name: "phone_intel", description: "OSINT lookup for an international phone number. Returns country/region/carrier/line-type derived from the E.164 prefix PLUS public web signals (spam/scam reports, business listings, breach mentions). Flies the map to the registered country centroid. NOT a live handset tracker — never claim real-time GPS. Always include country code or pass defaultCountry (ISO-2).", parameters: { type: "object", properties: { phone: { type: "string", description: "Phone number, ideally E.164 (e.g. '+447700900123'). National format works if defaultCountry is given." }, defaultCountry: { type: "string", description: "ISO-2 country code (e.g. 'GB', 'IN', 'US') used when the number is not in E.164 format." } }, required: ["phone"] } } },
  { type: "function", function: { name: "visual_recon", description: "Find/locate/count visual features in satellite imagery for a place. e.g. 'red or blue roofs in north Delhi near the Kali temple', 'blue tarps near Kharkiv', 'construction cranes in Doha west bay'. Returns geocoded detections that auto-drop as markers.", parameters: { type: "object", properties: { area: { type: "string", description: "Region / city / neighbourhood, e.g. 'Northern New Delhi, India'" }, criteria: { type: "string", description: "What to find, in plain English. e.g. 'red or blue roofs', 'blue tarps', 'solar panels'" }, landmark: { type: "string", description: "Optional landmark to centre the search on, e.g. 'Kali Temple north Delhi'" }, radiusKm: { type: "number", description: "Search radius in km from the landmark / area centre. 0.3-8. Default 2." } }, required: ["area", "criteria"] } } },
  { type: "function", function: { name: "temporal_recon", description: "MULTI-YEAR satellite timeline scan. Use whenever the operator asks about history, 'since when', 'has been there since YYYY', change over time, or wants a timeline. Returns per-year frames AND clustered tracks with first_seen / last_seen / years_present, so the map can show a year scrubber and 'since YYYY' badges.", parameters: { type: "object", properties: { area: { type: "string", description: "Region / city / neighbourhood" }, criteria: { type: "string", description: "What to track in plain English, e.g. 'red roofs', 'this house', 'construction cranes'" }, landmark: { type: "string", description: "Optional landmark to centre on" }, radiusKm: { type: "number", description: "0.3-6. Smaller = sharper. Default 1.5." }, startYear: { type: "number", description: "Earliest year to scan (>=2000). Default 2014." }, endYear: { type: "number", description: "Latest year. Default current year." }, stride: { type: "number", description: "Step between scanned years (1-5). Default 2." } }, required: ["area", "criteria"] } } },
  { type: "function", function: { name: "generate_image", description: "Generate a tactical visualization image.", parameters: { type: "object", properties: { prompt: { type: "string" } }, required: ["prompt"] } } },
  { type: "function", function: { name: "set_base_layer", description: "Switch base cartography.", parameters: { type: "object", properties: { layer: { type: "string", enum: ["street", "satellite", "topo", "dark"] } }, required: ["layer"] } } },

  /* ── MAP EDITING (overlay write access) ─────────────────────────────── */
  { type: "function", function: { name: "place_marker", description: "Drop an intel pin / marker on the map overlay. Use for 'pin', 'mark', 'plot', 'drop a marker', 'highlight this location'.", parameters: { type: "object", properties: { label: { type: "string", description: "Short operator-readable label" }, place: { type: "string", description: "Place/address to geocode. Omit if lat/lng given." }, lat: { type: "number" }, lng: { type: "number" }, note: { type: "string", description: "Intel note shown in the popup" }, category: { type: "string", enum: ["target", "asset", "hostile", "friendly", "observation", "route", "zone"] }, color: { type: "string", description: "Optional colour name or #hex override" } }, required: ["label"] } } },
  { type: "function", function: { name: "add_label", description: "Place a floating text label on the map (no pin).", parameters: { type: "object", properties: { text: { type: "string" }, place: { type: "string" }, lat: { type: "number" }, lng: { type: "number" }, color: { type: "string" } }, required: ["text"] } } },
  { type: "function", function: { name: "draw_radius", description: "Draw a circle / ring / threat radius / coverage area centred on a point.", parameters: { type: "object", properties: { label: { type: "string" }, radiusKm: { type: "number", description: "Radius in kilometres" }, place: { type: "string" }, lat: { type: "number" }, lng: { type: "number" }, note: { type: "string" }, category: { type: "string", enum: ["target", "asset", "hostile", "friendly", "observation", "route", "zone"] }, color: { type: "string" } }, required: ["label", "radiusKm"] } } },
  { type: "function", function: { name: "draw_zone", description: "Draw a polygon area of operations / sector / perimeter / parcel outline.", parameters: { type: "object", properties: { label: { type: "string" }, points: { type: "array", description: "3+ vertices, each {lat,lng} or {place}", items: { type: "object", properties: { lat: { type: "number" }, lng: { type: "number" }, place: { type: "string" } } } }, note: { type: "string" }, category: { type: "string", enum: ["target", "asset", "hostile", "friendly", "observation", "route", "zone"] }, color: { type: "string" } }, required: ["label", "points"] } } },
  { type: "function", function: { name: "draw_route", description: "Draw a route / corridor / ingress-egress line through 2+ waypoints.", parameters: { type: "object", properties: { label: { type: "string" }, waypoints: { type: "array", description: "2+ waypoints, each {lat,lng} or {place}", items: { type: "object", properties: { lat: { type: "number" }, lng: { type: "number" }, place: { type: "string" } } } }, note: { type: "string" }, color: { type: "string" } }, required: ["label", "waypoints"] } } },
  { type: "function", function: { name: "measure", description: "Measure great-circle distance and bearing between two points, drawn on the map as a measured line.", parameters: { type: "object", properties: { from: { type: "object", properties: { lat: { type: "number" }, lng: { type: "number" }, place: { type: "string" } } }, to: { type: "object", properties: { lat: { type: "number" }, lng: { type: "number" }, place: { type: "string" } } } }, required: ["from", "to"] } } },
  { type: "function", function: { name: "clear_annotations", description: "Remove overlay objects. scope='all' wipes the overlay, 'last' removes the most recent, any other string removes objects whose label contains it.", parameters: { type: "object", properties: { scope: { type: "string" } }, required: ["scope"] } } },
  { type: "function", function: { name: "list_annotations", description: "List everything currently drawn on the operator's map overlay.", parameters: { type: "object", properties: {} } } },

  /* ── ANALYTICAL TRADECRAFT (real computation on live terrain / road graph) ── */
  { type: "function", function: { name: "run_viewshed", description: "Terrain line-of-sight analysis: what ground is visible from an observer position. Use for sniper/overwatch positions, camera or sensor siting, radio LOS, surveillance coverage.", parameters: { type: "object", properties: { ref: { type: "object", properties: { lat: { type: "number" }, lng: { type: "number" }, place: { type: "string" } } }, radiusKm: { type: "number", description: "Analysis radius in km (default 5, max 30)" }, observerHeightM: { type: "number", description: "Eye/sensor height above ground in metres (default 2)" }, label: { type: "string" } }, required: ["ref"] } } },
  { type: "function", function: { name: "elevation_profile", description: "Terrain cross-section between two points: elevations, cumulative gain/loss and steepest grade. Use for approach routes, defilade, drainage and trafficability questions.", parameters: { type: "object", properties: { from: { type: "object", properties: { lat: { type: "number" }, lng: { type: "number" }, place: { type: "string" } } }, to: { type: "object", properties: { lat: { type: "number" }, lng: { type: "number" }, place: { type: "string" } } }, label: { type: "string" } }, required: ["from", "to"] } } },
  { type: "function", function: { name: "road_route", description: "Real driving route over the OpenStreetMap road graph: distance, duration and drawn geometry. Use for travel time, exfil timing and mobility corridors — never estimate drive time in prose.", parameters: { type: "object", properties: { from: { type: "object", properties: { lat: { type: "number" }, lng: { type: "number" }, place: { type: "string" } } }, to: { type: "object", properties: { lat: { type: "number" }, lng: { type: "number" }, place: { type: "string" } } }, label: { type: "string" } }, required: ["from", "to"] } } },
  { type: "function", function: { name: "solar_analysis", description: "Sun elevation, azimuth and shadow geometry for a location and time. Use to date imagery from shadows, recover structure height from shadow length, or plan low-light windows.", parameters: { type: "object", properties: { ref: { type: "object", properties: { lat: { type: "number" }, lng: { type: "number" }, place: { type: "string" } } }, iso: { type: "string", description: "ISO-8601 UTC timestamp. Omit for now." } }, required: ["ref"] } } },
  { type: "function", function: { name: "detect_colocation", description: "Find overlay objects that sit within a given distance of each other — shell-company address clustering, shared premises, pattern-of-life overlap.", parameters: { type: "object", properties: { radiusM: { type: "number", description: "Proximity threshold in metres (default 250)" } } } } },
  { type: "function", function: { name: "generate_briefing", description: "Produce a full intelligence briefing for the active operation: every overlay object with coordinates, metrics, provenance and confidence.", parameters: { type: "object", properties: {} } } },

  /* ── NAVIGATION & LOCAL DISCOVERY (Asherin Maps) ── */
  { type: "function", function: { name: "get_directions", description: "Turn-by-turn navigation between two points over the real road/foot/cycle network. Use for 'how do I get there', 'directions to X', 'fastest route', 'how long to drive to X'. Omit `from` to start from the operator's live position. Set withCameras=true when they also want live street cameras along the corridor.", parameters: { type: "object", properties: { from: { type: "object", properties: { lat: { type: "number" }, lng: { type: "number" }, place: { type: "string" } } }, to: { type: "object", properties: { lat: { type: "number" }, lng: { type: "number" }, place: { type: "string" } } }, mode: { type: "string", enum: ["driving", "walking", "cycling"] }, withCameras: { type: "boolean" } }, required: ["to"] } } },
  { type: "function", function: { name: "find_nearby", description: "Find nearby places of interest (restaurants, cafes, fuel, pharmacy, hotels, ATMs, hospitals, parking, etc.) around a point. Omit `ref` to search around the operator's live position or map centre. Results drop as map markers.", parameters: { type: "object", properties: { category: { type: "string", description: "Canonical category, e.g. restaurant, cafe, fuel, pharmacy, hotel, atm, hospital, parking, supermarket" }, query: { type: "string", description: "Free-text what-to-find when no clean category fits" }, ref: { type: "object", properties: { lat: { type: "number" }, lng: { type: "number" }, place: { type: "string" } } }, radiusM: { type: "number", description: "Search radius in metres (default 1500, max 20000)" }, openNow: { type: "boolean", description: "Only return places currently open" } } } } },
  { type: "function", function: { name: "find_jobs", description: "Live hiring sweep: find open job listings for a role near a location, geocoded onto the map. Use for 'restaurant jobs hiring near me', 'warehouse jobs near this address'.", parameters: { type: "object", properties: { role: { type: "string", description: "Role or industry, e.g. 'line cook', 'restaurant', 'forklift operator'" }, ref: { type: "object", properties: { lat: { type: "number" }, lng: { type: "number" }, place: { type: "string" } } }, radiusMi: { type: "number", description: "Search radius in miles (default 15)" } }, required: ["role"] } } },
  { type: "function", function: { name: "locate_device", description: "Asherin Find-My: locate one of the operator's own claimed Bluetooth devices from live mesh sightings, fly the map to it and report the fused confidence radius. Omit name to list the roster.", parameters: { type: "object", properties: { name: { type: "string", description: "Device label as the operator names it, e.g. 'MacBook Pro' or 'AirPods'. Omit to list all claimed devices." } } } } },
  { type: "function", function: { name: "street_cameras", description: "Pull live public DOT/traffic street camera feeds around a point, or along the currently plotted route when alongRoute=true.", parameters: { type: "object", properties: { ref: { type: "object", properties: { lat: { type: "number" }, lng: { type: "number" }, place: { type: "string" } } }, radiusM: { type: "number", description: "Radius in metres (default 5000)" }, alongRoute: { type: "boolean", description: "Sweep the active route corridor instead of a radius" } } } } },

  /* ── CLOUD INTELLIGENCE (user's personal intelligence substrate) ── */
  { type: "function", function: { name: "plot_cloud_contacts", description: "Plot the user's Cloud Intelligence contact dossiers as map pins, including inferred relationship links between locations tied to the same subject.", parameters: { type: "object", properties: { query: { type: "string", description: "Optional filter string matched against label, name or email" }, limit: { type: "number", description: "Max contacts to plot (default 50, max 200)" } } } } },
  { type: "function", function: { name: "plot_cloud_venues", description: "Plot calendar venues and Location Prophet movement forecasts from the user's Cloud Intelligence on the map.", parameters: { type: "object", properties: {} } } },
  { type: "function", function: { name: "plot_cloud_security", description: "Plot security events and signals from the user's Cloud Intelligence with geocodable locations.", parameters: { type: "object", properties: { sinceDays: { type: "number", description: "How many days back to look (default 30, max 90)" } } } } },
  { type: "function", function: { name: "focus_cloud_contact", description: "Find a specific contact in Cloud Intelligence by email or name and focus the map on them.", parameters: { type: "object", properties: { email: { type: "string" }, name: { type: "string" } }, required: [] } } },


  { type: "function", function: { name: "track_my_location", description: "Control live tracking of the OPERATOR'S OWN position from their device sensor. Requires the operator's on-screen consent; a start request returns 'awaiting operator consent' until they approve.", parameters: { type: "object", properties: { mode: { type: "string", enum: ["start", "stop", "status", "center", "follow", "unfollow"], description: "start = request the sensor, status = read the current fix, center = fly the map to the operator, follow/unfollow = keep the map locked on them" }, reason: { type: "string", description: "Short reason shown to the operator in the consent prompt" } }, required: ["mode"] } } },
  { type: "function", function: { name: "distance_from_me", description: "Straight-line range and bearing from the operator's live position to a point or named place.", parameters: { type: "object", properties: { to: { type: "object", properties: { lat: { type: "number" }, lng: { type: "number" }, place: { type: "string" } } }, label: { type: "string" } }, required: ["to"] } } },
  { type: "function", function: { name: "set_geofence", description: "Arm a proximity geofence that alerts when the operator enters or leaves it. Anchored on the operator's current position unless ref is given.", parameters: { type: "object", properties: { label: { type: "string" }, radiusM: { type: "number", description: "Radius in metres" }, ref: { type: "object", properties: { lat: { type: "number" }, lng: { type: "number" }, place: { type: "string" } } } }, required: ["label", "radiusM"] } } },

  /* ── KERNEL-OWNED OPERATOR TOOLS ─────────────────────────────────────
     These do NOT run in the vessel. They are forwarded to the asherin kernel
     through `asherin-kernel-proxy`. If the kernel is unreachable the caller
     says "kernel offline" and performs nothing — never a local stand-in,
     never fabricated output. */
  { type: "function", function: { name: "zophiel_search", description: "Kernel search. Matches FORM and PATH (html, python, typescript, non-indexed directories) rather than exact titles. Use when the operator wants files, source, artefacts or unindexed material rather than articles about them.", parameters: { type: "object", properties: { query: { type: "string" }, depth: { type: "string", enum: ["fast", "deep"] } }, required: ["query"] } } },
  { type: "function", function: { name: "elite_dorks", description: "Kernel dork pack: build and run a battery of advanced search operators against a target. Never targets large corporations with dedicated cyber-defence budgets.", parameters: { type: "object", properties: { target: { type: "string" }, intent: { type: "string", description: "What the operator is trying to surface, plain English" } }, required: ["target"] } } },
  { type: "function", function: { name: "dork", description: "Kernel single-dork execution. Runs one crafted operator string verbatim.", parameters: { type: "object", properties: { query: { type: "string", description: "The full dork string, operators intact" } }, required: ["query"] } } },
  { type: "function", function: { name: "path_map", description: "Kernel path mapper for a domain or repo: enumerates known and inferred paths, non-indexed directories and file extensions present.", parameters: { type: "object", properties: { target: { type: "string", description: "Domain, repo or root URL" }, depth: { type: "number" } }, required: ["target"] } } },
  { type: "function", function: { name: "search_swarm", description: "Kernel swarm run: parallel multi-engine sweep over a question, deduped and ranked.", parameters: { type: "object", properties: { query: { type: "string" }, engines: { type: "array", items: { type: "string" } } }, required: ["query"] } } },
  { type: "function", function: { name: "site_cyber_map", description: "Kernel site cyber-map: outbound domains, embedded scripts, third-party trackers and exposed surface for a given site.", parameters: { type: "object", properties: { url: { type: "string" } }, required: ["url"] } } },
  { type: "function", function: { name: "intel_map", description: "Kernel intel-map. NOT geography — this maps ENTITIES, IDENTIFIERS and RELATIONSHIPS. Never use for map / cartography tasks; those go to map_search + place_marker.", parameters: { type: "object", properties: { seed: { type: "string" }, hops: { type: "number" } }, required: ["seed"] } } },
];

/** Tools the vessel must hand to the kernel rather than run locally. */
const KERNEL_TOOLS = new Set([
  "zophiel_search", "elite_dorks", "dork", "path_map",
  "search_swarm", "site_cyber_map", "intel_map",
]);
export { KERNEL_TOOLS };


function sse(data: unknown): string {
  return `data: ${typeof data === "string" ? data : JSON.stringify(data)}\n\n`;
}

// NOTE: cors headers are per-request (getCorsHeaders(req)); they must be
// passed in — referencing a module-scope `corsHeaders` here threw a
// ReferenceError and killed the phone-intel fast path.
function toolCallResponse(
  name: string,
  args: Record<string, unknown>,
  cors: Record<string, string>,
): Response {
  const payload = {
    choices: [{
      delta: {
        tool_calls: [{
          index: 0,
          id: `call_${name}_${Date.now()}`,
          type: "function",
          function: { name, arguments: JSON.stringify(args) },
        }],
      },
      finish_reason: null,
      index: 0,
    }],
  };
  return new Response(sse(payload) + sse("[DONE]"), {
    headers: { ...cors, "Content-Type": "text/event-stream" },
  });
}


function latestUserText(messages: any[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m?.role === "user" && typeof m.content === "string") return m.content;
  }
  return "";
}

function extractPhoneLookup(text: string): string | null {
  if (!/(phone|number|call|caller|lookup|look up|located|location|trace|identify|intel)/i.test(text)) return null;
  const match = text.match(/(?:\+|00)\d[\d\s().-]{6,}\d|\b\d[\d\s().-]{7,}\d\b/);
  return match ? match[0].replace(/^(00)/, "+").trim() : null;
}

/**
 * Map-edit intent detector. Requires BOTH an editing verb and a map-object
 * noun so ordinary prose ("mark my words", "draw a conclusion") never trips it.
 * Used to bypass the archive / jurisdictional / YouTube sweeps for pure UI
 * mutations, and to bias the model toward tool-calling.
 */
function detectMapEditIntent(text: string): boolean {
  const t = String(text || "").toLowerCase();
  if (!t) return false;
  if (/\b(clear|wipe|remove|erase|delete)\b[^.]{0,24}\b(overlay|annotation|annotations|marker|markers|pin|pins|zone|zones|route|routes|drawing|drawings)\b/.test(t)) return true;
  if (/\b(what|list|show)\b[^.]{0,20}\b(on|in)\b[^.]{0,12}\b(my |the )?(overlay|annotations)\b/.test(t)) return true;
  // Navigation / local-discovery intents are UI actions too — skip the heavy
  // archive + jurisdictional + youtube sweeps (up to 75s) before the tool call.
  if (/\b(directions?|navigate|how (do|can) i get|fastest route|drive time|how long.{0,20}\b(drive|walk|get there)|route to)\b/.test(t)) return true;
  if (/\b(near ?by|near me|around me|closest|nearest)\b/.test(t) && /\b(restaurant|food|cafe|coffee|gas|fuel|petrol|pharmac|hotel|atm|hospital|parking|store|supermarket|bar|place)\w*/.test(t)) return true;
  if (/\b(hiring|jobs?|job openings?|now hiring|vacanc)\w*\b/.test(t) && /\b(near|around|by|close to|hiring)\b/.test(t)) return true;
  if (/\b(street|traffic|cctv|live)\s*cam(era)?s?\b/.test(t)) return true;
  const verb = /\b(pin|mark|plot|drop|place|draw|outline|circle|annotate|label|highlight|measure|sketch|trace out)\b/.test(t);
  const noun = /\b(marker|pin|point|label|circle|ring|radius|zone|area|polygon|perimeter|sector|route|corridor|line|path|overlay|annotation|distance|boundary|geofence|contact|contacts|dossier|dossiers|venue|venues|relationship|relationships|security event|security events|signal|signals)\b/.test(t);
  return verb && noun;
}

function detectCloudIntelIntent(text: string): boolean {
  const t = String(text || "").toLowerCase();
  if (!t) return false;
  if (/\bplot my cloud (contacts|venues|security)\b/.test(t)) return true;
  const verb = /\b(plot|show|display|map|put|render|draw|focus|find|locate|where is|where are|see my|view my)\b/.test(t);
  const cloud = /\b(cloud|cloud intelligence)\b/.test(t);
  const noun = /\b(contacts?|dossiers?|venues?|calendar|security events?|signals?|people|relationships?)\b/.test(t);
  return verb && cloud && noun;
}

/** OpenAI-style tool schema → Gemini function_declarations. */
function geminiFunctionDeclarations(tools: any[]): any[] {
  return tools.map((t) => {
    const fn = t.function;
    const props = fn?.parameters?.properties ?? {};
    const hasProps = Object.keys(props).length > 0;
    return {
      name: fn.name,
      description: fn.description,
      // Gemini rejects an object schema with zero properties — omit entirely.
      ...(hasProps
        ? {
            parameters: {
              type: "object",
              properties: props,
              ...(Array.isArray(fn.parameters?.required) && fn.parameters.required.length
                ? { required: fn.parameters.required }
                : {}),
            },
          }
        : {}),
    };
  });
}

/**
 * Stream a Gemini generateContent SSE response as OpenAI-compatible SSE,
 * translating `functionCall` parts into `delta.tool_calls` so the existing
 * AsherAIPanel parser drives the map without any client change.
 */
function geminiSseToOpenAi(upstreamBody: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const reader = upstreamBody.getReader();
  let toolIndex = 0;
  // Layer 3 — exit audit on the tool-capable relay.
  const _scan1 = createPostInferenceScanner();

  return new ReadableStream({
    async start(controller) {
      let buf = "";
      try {
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          let nl: number;
          while ((nl = buf.indexOf("\n")) !== -1) {
            let line = buf.slice(0, nl);
            buf = buf.slice(nl + 1);
            if (line.endsWith("\r")) line = line.slice(0, -1);
            if (!line.startsWith("data:")) continue;
            const raw = line.slice(5).trim();
            if (!raw || raw === "[DONE]") continue;
            let parsed: any;
            try { parsed = JSON.parse(raw); } catch { continue; }
            const parts = parsed?.candidates?.[0]?.content?.parts ?? [];
            for (const p of parts) {
              if (typeof p?.text === "string" && p.text) {
                const safe = _scan1.feed(p.text);
                if (safe) {
                  controller.enqueue(encoder.encode(sse({
                    choices: [{ index: 0, delta: { content: safe }, finish_reason: null }],
                  })));
                }
              }
              if (p?.functionCall?.name) {
                const i = toolIndex++;
                controller.enqueue(encoder.encode(sse({
                  choices: [{
                    index: 0,
                    delta: {
                      tool_calls: [{
                        index: i,
                        id: `call_${p.functionCall.name}_${Date.now()}_${i}`,
                        type: "function",
                        function: {
                          name: p.functionCall.name,
                          arguments: JSON.stringify(p.functionCall.args ?? {}),
                        },
                      }],
                    },
                    finish_reason: null,
                  }],
                })));
              }
            }
          }
        }
      } catch (e) {
        console.error("[asher-ai] text stream relay:", (e as Error).message);
      } finally {
        const tail1 = _scan1.flush();
        if (tail1) {
          controller.enqueue(encoder.encode(sse({ choices: [{ index: 0, delta: { content: tail1 }, finish_reason: null }] })));
        }
        controller.enqueue(encoder.encode(sse("[DONE]")));
        controller.close();
        try { reader.releaseLock(); } catch { /* already released */ }
      }
    },
    cancel() { try { reader.cancel(); } catch { /* noop */ } },
  });
}



// Convert OpenAI-compat messages (with optional .attachments[]) to Gemini native parts.
// attachments: [{ mimeType, dataBase64 }] — used for images/video/pdf vision.
function toGeminiContents(messages: any[]): any[] {
  return messages.map((m) => {
    const role = m.role === "assistant" ? "model" : "user";
    const parts: any[] = [];
    if (typeof m.content === "string" && m.content.trim()) parts.push({ text: m.content });
    if (Array.isArray(m.attachments)) {
      for (const a of m.attachments) {
        if (a?.dataBase64 && a?.mimeType) {
          parts.push({ inline_data: { mime_type: a.mimeType, data: a.dataBase64 } });
        }
      }
    }
    if (parts.length === 0) parts.push({ text: " " });
    return { role, parts };
  });
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  // ── Strict BYOK gate — admin uses platform key, others must BYOK ──
  if (req.method !== 'OPTIONS') {
    try {
      const _b = await req.clone().json().catch(() => ({} as any));
      const _byok = (_b && typeof _b === 'object') ? (_b as any).byok : undefined;
      const _gate = await import('../_shared/adminGate.ts');
      await _gate.resolveKey(req, _byok);
    } catch (_e) {
      const _gate = await import('../_shared/adminGate.ts');
      return _gate.byokErrorResponse(_e, corsHeaders);
    }
  }

  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, mapContext, byokGeminiKey, brainContext, numberedFormat, timezone, locale } = await req.json();
    const numberedOff = numberedFormat === false;
    const numberedDirective = numberedOff
      ? "\n\n## NUMBERED-LIST BRAIN: DISABLED\nThe operator has turned OFF numbered-list answers for this session. Reply in natural prose, short paragraphs, or headers/bullets — only use 1., 2., 3. when the content is truly ordinal (procedural steps, ranked items the user asked for)."
      : "\n\n## CODE OVERRIDE FOR NUMBERED-LIST BRAIN\nEven when numbered-list answers are enabled, generated code/config/SQL/JSON/YAML/shell is NEVER numbered or line-numbered. Code must be contiguous inside fenced code blocks and copy/paste-ready.";

    // Resolution order (_shared/keyResolution.ts): request-supplied BYOK →
    // the signed-in user's saved google key → platform GEMINI secret. This
    // path speaks the Gemini wire format, so only google keys qualify; when
    // none is bound the text path still runs keyless below.
    const headerKey = req.headers.get("x-byok-gemini-key");
    let storedGoogleKey = "";
    {
      const authHeader = req.headers.get("Authorization") || "";
      if (!headerKey && !byokGeminiKey && authHeader.startsWith("Bearer ")) {
        try {
          const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
          const url = Deno.env.get("SUPABASE_URL") || "";
          const anon = Deno.env.get("SUPABASE_ANON_KEY") || "";
          const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
          const authSb = createClient(url, anon, { auth: { persistSession: false } });
          const { data: u } = await authSb.auth.getUser(authHeader.slice(7));
          if (u?.user?.id) {
            const adminSb = createClient(url, service, { auth: { persistSession: false } });
            const { userByokKey } = await import("../_shared/keyResolution.ts");
            storedGoogleKey = await userByokKey(adminSb, u.user.id, "google");
          }
        } catch {
          storedGoogleKey = "";
        }
      }
    }
    const platformGemini = (await import("../_shared/keyResolution.ts")).platformKeyFor("google");
    const apiKey = (headerKey || byokGeminiKey || storedGoogleKey || platformGemini || "").trim();

    // Gemini key only required for multimodal (image/video/pdf). Text path uses gpt-oss.
    const hasAttachmentsEarly = Array.isArray(messages) && messages.some((m: any) => Array.isArray(m?.attachments) && m.attachments.length);
    if (hasAttachmentsEarly && !apiKey) {
      return new Response(JSON.stringify({ error: "Vision/file analysis needs a Gemini BYOK key. Add one in Settings." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const ctxBlock = mapContext
      ? `\n\nCURRENT MAP CONTEXT:\n${JSON.stringify(mapContext, null, 2)}`
      : "";

    let brainBlock = "";
    if (brainContext && Array.isArray(brainContext.brains) && brainContext.brains.length) {
      const sections = brainContext.brains
        .filter((b: any) => b && typeof b.content === "string" && b.content.trim().length)
        .map((b: any) => {
          const cat = (b.category || "general").toUpperCase();
          const name = (b.name || "Untitled").toString();
          const body = b.content.length > 12000 ? b.content.slice(0, 12000) + "\n…[truncated]" : b.content;
          return `### [${cat}] ${name}\n${body}`;
        });
      if (sections.length) {
        brainBlock = `\n\n=== ASHER BRAINS (admin-curated personality + knowledge — treat as ground truth) ===\n${sections.join("\n\n---\n\n")}\n=== END BRAINS ===`;
      }
    }

    const cleaned: any[] = [];
    for (const m of (messages || [])) {
      if (!m || typeof m !== "object") continue;
      const hasContent = typeof m.content === "string" ? m.content.trim().length > 0 : !!m.content;
      const hasAtt = Array.isArray(m.attachments) && m.attachments.length > 0;
      const hasToolCalls = Array.isArray(m.tool_calls) && m.tool_calls.length > 0;
      if (!hasContent && !hasAtt && !hasToolCalls) continue;
      const last = cleaned[cleaned.length - 1];
      if (last && last.role === m.role && last.content === m.content && !hasAtt) continue;
      cleaned.push(m);
    }
    if (cleaned.length === 0) cleaned.push({ role: "user", content: "Hello" });

    const hasAttachments = cleaned.some((m) => Array.isArray(m.attachments) && m.attachments.length);

    // ── LAYER 1 — PRE-INFERENCE GATE ──────────────────────────────────────
    // Same boundary the chat surface holds, applied before any tool leg,
    // orchestrator, or model call spends a token. It only fires on real harm
    // with a real victim; osint, mapping, and blunt questions pass untouched.
    {
      const _gate = preInferenceGate(latestUserText(cleaned));
      if (_gate.verdict === "block") {
        console.warn(`[asher-ai] layer1 block: ${_gate.audit}`);
        const body = sse({ choices: [{ index: 0, delta: { content: _gate.blockMessage }, finish_reason: null }] }) + sse("[DONE]");
        return new Response(body, { headers: { ...corsHeaders, "Content-Type": "text/event-stream" } });
      }
    }

    // ── Multi-agent orchestrator trigger (/agents, /orchestrate, "run agents:") ──
    // Runs planner→executor→critic→synthesizer over the operator's goal using Gemini.
    if (!hasAttachments && apiKey) {
      try {
        const lastUser = latestUserText(cleaned);
        const { detectOrchestratorTrigger, runOrchestrator, stringToOpenAiSse } =
          await import("../_shared/multiAgentOrchestrator.ts");
        const goal = detectOrchestratorTrigger(lastUser);
        if (goal) {
          const callLLM = async (msgs: { role: "system" | "user" | "assistant"; content: string }[]) => {
            const sys = msgs.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
            const contents = msgs
              .filter((m) => m.role !== "system")
              .map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] }));
            const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${encodeURIComponent(apiKey)}`;
            const resp = await fetch(url, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                systemInstruction: sys ? { parts: [{ text: sys }] } : undefined,
                contents,
                safetySettings: [
                  { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
                  { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
                  { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
                  { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
                  { category: "HARM_CATEGORY_CIVIC_INTEGRITY", threshold: "BLOCK_NONE" },
                ],
                generationConfig: { temperature: 0.4, maxOutputTokens: 2048 },
              }),
            });
            if (!resp.ok) throw new Error(`Gemini ${resp.status}`);
            const data = await resp.json();
            return data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text || "").join("") || "";
          };
          const result = await runOrchestrator({ goal, callLLM });
          const stream = stringToOpenAiSse(result.transcript);
          return new Response(stream, { headers: { ...corsHeaders, "Content-Type": "text/event-stream" } });
        }
      } catch (e) {
        console.error("[asher-ai] orchestrator failed", e);
      }
    }


    // ── AXRLEN INLINE FORECASTING (before any other routing) ──────────────
    // Only text-only forecasting messages route through AXRLEN — attachments
    // (vision/PDF) stay on the normal Gemini vision path.
    if (!hasAttachments) {
      try {
        const axrlen = await runAxrlenBridge({
          req,
          messages: cleaned.map((m: any) => ({ role: String(m.role || "user"), content: typeof m.content === "string" ? m.content : "" })),
          surface: "asher",
          fallbackGeminiKey: apiKey,
          fallbackModel: "gemini-flash-latest",
        });
        if (axrlen.kind === "stream") {
          const openai = textStreamToOpenAiSse(axrlen.textStream);
          return new Response(openai, { headers: { ...corsHeaders, "Content-Type": "text/event-stream" } });
        }
        if (axrlen.kind === "denied" && axrlen.intent.fired) {
          const encoder = new TextEncoder();
          const body = sse({ choices: [{ delta: { content: axrlen.message }, index: 0, finish_reason: null }] }) + sse("[DONE]");
          return new Response(encoder.encode(body), { headers: { ...corsHeaders, "Content-Type": "text/event-stream" } });
        }
      } catch (e) { console.error("[asher-ai] axrlen bridge:", (e as Error).message); }
    }

    const phone = extractPhoneLookup(latestUserText(cleaned));
    if (phone && !hasAttachments) {
      return toolCallResponse("phone_intel", { phone }, corsHeaders);
    }

    // Library of Leaks / breach aggregators are PERMANENTLY DISABLED.
    // Sovereign Source Atlas policy: authoritative registries only.
    const leaksBlock = "";

    // ── Map-edit / cloud-intel fast lane ───────────────────────────────────
    // "pin this", "draw a 2km ring", "clear the overlay", "plot my cloud contacts"
    // are UI mutations, not investigations. Running the archive / jurisdictional /
    // YouTube sweeps on them added up to 75s of dead latency before a one-line
    // tool call. Skip.
    const mapEditFast = detectMapEditIntent(latestUserText(cleaned));
    const cloudIntelFast = detectCloudIntelIntent(latestUserText(cleaned));

    let archiveBlock = "";
    try {
      const userText = latestUserText(cleaned);
      const { searchArchive, formatArchiveContext, shouldQueryArchive } =
        await import("../_shared/internetArchive.ts");
      if (!mapEditFast && !cloudIntelFast && shouldQueryArchive(userText)) {
        const hits = await searchArchive(userText.slice(0, 200), { limit: 10, deepRead: 2 });
        archiveBlock = formatArchiveContext(userText.slice(0, 80), hits);
      }
    } catch (e) { console.error("[asher-ai] archive:", e); }


    // ── Jurisdictional Intel Sweep (person/property/entity) ────────────────
    let jurisdictionalBlock = "";
    try {
      const userText = latestUserText(cleaned);
      const { classifyIntent, runJurisdictionalSearch, formatIntelContext, formatClarifyContext } =
        await import("../_shared/jurisdictionalIntel.ts");
      const intent = (mapEditFast || cloudIntelFast) ? { kind: "none" } as any : classifyIntent(userText);
      if (intent.kind !== "none") {

        console.log("[asher-ai] Jurisdictional intent:", intent.kind, intent.subject, `${intent.city}/${intent.county}/${intent.state}/${intent.country}`);
        if (intent.needsClarification) {
          jurisdictionalBlock = "\n\n" + formatClarifyContext(intent);
        } else {
          // Wall-clock ceiling: never let jurisdictional intel push asher-ai past the 150s edge limit.
          const bundle = await Promise.race([
            runJurisdictionalSearch(intent),
            new Promise<null>((resolve) => setTimeout(() => resolve(null), 75000)),
          ]);
          jurisdictionalBlock = bundle ? "\n\n" + formatIntelContext(bundle) : "";
        }
      }
    } catch (e) { console.error("[asher-ai] jurisdictional intel:", (e as Error).message); }

    // ── YouTube Intel (transcripts + metadata) — BYOK-gated ─────────────
    // Only fires when caller supplied their own Gemini key (or is admin
    // routed through platform Gemini). Native video ingestion runs on
    // their quota, not ours.
    let youtubeBlock = "";
    try {
      const userBroughtGemini = !!(headerKey || byokGeminiKey);
      const isAdminPath = !!platformGemini && !userBroughtGemini && !storedGoogleKey && apiKey === platformGemini;
      const { runYouTubePipeline } = await import("../_shared/youtubeIntel.ts");
      const yt = (mapEditFast || cloudIntelFast)
        ? { fired: false, evidence: "" }
        : await runYouTubePipeline(latestUserText(cleaned), { hasByokGemini: userBroughtGemini || isAdminPath });
      if (yt.fired) youtubeBlock = yt.evidence;
    } catch (e) { console.error("[asher-ai] youtube intel:", (e as Error).message); }


    // ── Temporal context (day + timestamp awareness) ─────────────────────
    const { getTemporalContext } = await import("../_shared/systemContext.ts");
    const temporalBlock = "\n\n" + getTemporalContext({ timezone, locale });

    const { CODE_NARRATIVE_PROTOCOL } = await import("../_shared/codeNarrativeProtocol.ts");
    const { SYSTEM_TWO_FORCING_BRAIN } = await import("../_shared/systemTwoForcingBrain.ts");
    const { GEMATRIA_CHAT_DIRECTIVE } = await import("../_shared/gematriaChatDirective.ts");
    const { HYPOTHETICAL_REALISM_DOCTRINE } = await import("../_shared/hypotheticalRealismDoctrine.ts");
    // Doctrine wraps the stack: FIRST (identity anchor) + LAST (recency anchor)
    // so it dominates every hedge/refusal brain between them.
    // Fires only when a chart image is attached (or trading keywords + image).
    const lastUserText = [...cleaned].reverse().find((m) => m.role === "user")?.content || "";
    const chartVisionBlock = detectChartVisionIntent(lastUserText, hasAttachments)
      ? "\n\n" + MARKET_STRUCTURE_VISION_BRAIN
      : "";
    // Cognitive personality matrix — resident roster + gated dossiers for the
    // analytic logics this message actually demands.
    const { THINKING_PATTERN_DATABASE: _ALM, buildThinkingPatternDossiers: _bALE } =
      await import("../_shared/thinkingPatterns.ts");
    const logicBlock = "\n\n" + _ALM + (_bALE(lastUserText) ? "\n\n" + _bALE(lastUserText) : "");
    // Transferable reasoning architecture — kernel always resident, operator
    // dossiers gated to what this message actually demands.
    const { PATTERN_RECOGNITION_KERNEL: _PRK, PATTERN_OPERATOR_ROSTER: _POR, buildPatternEmphasis: _bPE } =
      await import("../_shared/patternRecognitionEngine.ts");
    const _pEmph = _bPE(lastUserText);
    const patternBlock = "\n\n" + _PRK + "\n\n" + _POR + (_pEmph ? "\n\n" + _pEmph : "");
    // Domain atlas — the terrain layer (WHERE to look). Resident 28-line index
    // so the model can locate the question; full terrain records gated to the
    // two domains this message actually enters.
    const { DOMAIN_ATLAS_INDEX: _DAI, buildDomainEmphasis: _bDE } =
      await import("../_shared/domainAtlas.ts");
    const _dEmph = _bDE(lastUserText);
    const atlasBlock = "\n\n" + _DAI + (_dEmph ? "\n\n" + _dEmph : "");

    // ── QUEUE 10: LIVE DORK. Fire before the model writes. Honest offline banner
    // on failure — no fabricated SERP. ──
    let liveDorkBlock = "";
    let liveDorkOfflineBlock = "";
    try {
      const { planDork, runLiveDork } = await import("../_shared/liveDorkBridge.ts");
      const _plan = planDork(lastUserText);
      if (_plan) {
        const _out = await runLiveDork(_plan, req.headers.get("Authorization"));
        liveDorkBlock = _out.context;
        if (_out.offline) liveDorkOfflineBlock = `\n[LIVE DORK OFFLINE] ${_out.offline}. Say the live dork tool is offline this turn with this exact status. Do NOT invent SERP results.\n`;
        console.log(`[asher-ai] live dork fired: ${_out.fired.join(",")}${_out.offline ? ` | ${_out.offline}` : ""}`);
      }
    } catch (e) {
      console.error("[asher-ai] live dork failed:", (e as Error).message);
      liveDorkOfflineBlock = `\n[LIVE DORK OFFLINE] live dork offline (${(e as Error).message}).\n`;
    }

    const fullSystem = ASHERIN_IDENTITY + "\n\n" + buildAsherinProcedures(lastUserText) + "\n\n" + HYPOTHETICAL_REALISM_DOCTRINE + "\n\n" + temporalBlock + "\n\n" + OUTPUT_CONDUCT_DOCTRINE + "\n\n" + AXIOMATIC_GROUNDING_DOCTRINE + "\n\n" + SYSTEM_PROMPT + numberedDirective + "\n\n" + SYSTEM_TWO_FORCING_BRAIN + "\n\n" + CODE_NARRATIVE_PROTOCOL + "\n\n" + BRAIN_ORCHESTRATOR + "\n\n" + SOCIAL_AWARENESS_BRAIN + "\n\n" + DEEP_TRAINING_ARCHITECTURE_BRAIN + "\n\n" + NARRATIVE_FORGE_BRAIN + "\n\n" + QUANTUM_ORCHESTRATION_BRAIN + "\n\n" + BUTTERFLY_PROTOCOL_BRAIN + "\n\n" + COMEDY_BRAIN + "\n\n" + ASHER_LOGIC_BRAIN + "\n\n" + PROMPT_INTELLIGENCE_PROTOCOL + "\n\n" + SYNTHESIS_ENGINE_BRAIN + "\n\n" + VISUAL_INTELLIGENCE_BRAIN + chartVisionBlock + "\n\n" + GEOLOCATION_BRAIN + logicBlock + patternBlock + atlasBlock + "\n\n" + GEMATRIA_CHAT_DIRECTIVE + brainBlock + ctxBlock + leaksBlock + archiveBlock + jurisdictionalBlock + youtubeBlock + liveDorkBlock + liveDorkOfflineBlock + "\n\n" + HYPOTHETICAL_REALISM_DOCTRINE + "\n\n" + AXIOMATIC_GROUNDING_ANCHOR + "\n\n" + OUTPUT_CONDUCT_ANCHOR;

    // ── Multimodal path (images / video / pdf): use Gemini native SSE stream
    if (hasAttachments) {
      // Layer 3 — exit audit on the multimodal relay.
      const _scan2 = createPostInferenceScanner();
      const contents = toGeminiContents(cleaned);
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:streamGenerateContent?alt=sse&key=${encodeURIComponent(apiKey)}`;
      const upstream = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents,
          systemInstruction: { role: "system", parts: [{ text: fullSystem }] },
          safetySettings: [
            { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_CIVIC_INTEGRITY", threshold: "BLOCK_NONE" },
          ],
          generationConfig: { temperature: 0.7, maxOutputTokens: 8192 },
        }),
      });
      if (!upstream.ok || !upstream.body) {
        const t = await upstream.text().catch(() => "");
        console.error("asher-ai gemini native:", upstream.status, t);
        return new Response(JSON.stringify({ error: `Gemini error ${upstream.status}` }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      // Translate Gemini SSE → OpenAI-compat SSE so client parser is unchanged
      const reader = upstream.body.getReader();
      const decoder = new TextDecoder();
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          let buf = "";
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            buf += decoder.decode(value, { stream: true });
            let idx;
            while ((idx = buf.indexOf("\n")) !== -1) {
              const line = buf.slice(0, idx).trimEnd(); buf = buf.slice(idx + 1);
              if (!line.startsWith("data: ")) continue;
              const json = line.slice(6).trim();
              if (!json) continue;
              try {
                const parsed = JSON.parse(json);
                const text = parsed?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text || "").join("") || "";
                if (text) {
                  const safe = _scan2.feed(text);
                  if (safe) {
                    controller.enqueue(encoder.encode(sse({ choices: [{ delta: { content: safe }, index: 0, finish_reason: null }] })));
                  }
                }
              } catch { /* ignore parse */ }
            }
          }
          const tail2 = _scan2.flush();
          if (tail2) {
            controller.enqueue(encoder.encode(sse({ choices: [{ delta: { content: tail2 }, index: 0, finish_reason: null }] })));
          }
          controller.enqueue(encoder.encode(sse("[DONE]")));
          controller.close();
        },
      });
      return new Response(stream, { headers: { ...corsHeaders, "Content-Type": "text/event-stream" } });
    }

    // ── TEXT PATH: Gemini + function calling ──────────────────────────────
    // This is the branch that actually drives the map. Previously it did not
    // exist: every text message fell straight through to a hard 403, which the
    // client translated into "add a BYOK key" and a navigation away from the
    // map. Now the whole tool surface (navigation, layers, recon, and the new
    // overlay-editing tools) runs on the resolved key — platform key for admin,
    // BYOK for everyone else.
    if (apiKey) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:streamGenerateContent?alt=sse&key=${encodeURIComponent(apiKey)}`;
      const upstream = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: fullSystem }] },
          contents: toGeminiContents(cleaned),
          tools: [{ function_declarations: geminiFunctionDeclarations(TOOLS) }],
          toolConfig: { functionCallingConfig: { mode: (mapEditFast || cloudIntelFast) ? "ANY" : "AUTO" } },
          safetySettings: [
            { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_CIVIC_INTEGRITY", threshold: "BLOCK_NONE" },
          ],
          generationConfig: { temperature: 0.35, maxOutputTokens: 8192 },
        }),
      });

      if (!upstream.ok || !upstream.body) {
        const detail = await upstream.text().catch(() => "");
        console.error("[asher-ai] text path gemini:", upstream.status, detail.slice(0, 400));
        // Surface the upstream status honestly instead of masking it as a BYOK gate.
        return new Response(
          JSON.stringify({ error: `Intelligence core error ${upstream.status}`, details: detail.slice(0, 400) }),
          { status: upstream.status === 429 ? 429 : 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      return new Response(geminiSseToOpenAi(upstream.body), {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
    }

    // No platform key and no BYOK — the only genuine BYOK condition.
    return new Response(
      JSON.stringify({
        error: "Bring Your Own API Key is required. Add a provider key in Settings → AI Keys.",
        code: "BYOK_REQUIRED",
      }),
      { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );

  } catch (e) {
    console.error("asher-ai error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
