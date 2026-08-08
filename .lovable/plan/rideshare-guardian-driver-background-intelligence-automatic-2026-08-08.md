# Rideshare Guardian — driver background intelligence, automatic and in the background

## The narrative

You order an Uber. Between the moment the driver is assigned and the moment you close the door, you have about ninety seconds of real decision time. Today you spend that window looking at a first name, a photo, a car model and a plate. Asherin already knows how to build a dossier on a person from a name plus a vehicle plus a city — it just has never been pointed at the one person you are about to get into a car with.

Rideshare Guardian points it there. The moment a ride is assigned, Asherin captures the driver identity signal, runs a full Cloud Intelligence sweep in the background, scores the result against a rider-safety rubric, and pushes the verdict to your phone as a notification and to your inbox as a formal report — before the car arrives. You never open the app. The app opens itself only if something is wrong.

### Where the driver signal comes from (the honest part)

Uber has no public rider API. There is no legitimate integration that hands us "your current driver." So the capture layer is deliberately plural, and every path is one the rider controls:

1. **Share sheet capture (primary).** Uber's "Share my trip" produces a public trip link with driver first name, photo, vehicle and plate. You share that link into Asherin — one tap from the Uber app. Asherin parses it server-side and starts the sweep.
2. **Screenshot capture.** You screenshot the driver card, share it to Asherin. The Imagine v2 vision pipeline already reads plates, names and vehicle detail out of an image; it becomes the extractor.
3. **Trip receipt email (fully automatic).** You already have Gmail wired into the Google Intelligence Substrate. Uber receipts and "your driver is arriving" mails land there. Mesh Sentinel watches for them, extracts driver name + plate + city, and fires the sweep with zero rider action. This is the path that makes the feature feel invisible.
4. **Manual entry.** Name + plate + city, for anything the other three miss.

Path 3 is the one that satisfies "works in the background." Paths 1, 2 and 4 exist so the feature still works the first time, before a receipt has ever arrived.

### What the sweep actually does

The driver record — first name, plate, vehicle, city, photo — enters the existing intelligence stack rather than a new one:

- Plate to registration-state and vehicle-history surfaces where public.
- Name + city through the jurisdictional identity resolver, which already produces ranked candidates instead of one guess. A first name and a city is thin evidence, so the resolver runs in candidate mode: it returns several possible humans with confidence bands, never a single confident accusation.
- Court and public-record surfaces for the resolved candidates, weighted only where identity confidence clears a floor.
- Face match between the Uber driver photo and any resolved public profile photo, as a confidence multiplier, not as a verdict.
- Three-hop relationship expansion, capped, for pattern context only.

The output is scored against a rider-specific rubric — violent history, vehicle/plate mismatch, identity that will not resolve at all, recent address instability near your pickup — and collapses into one of four states: **CLEAR**, **THIN** (not enough public record to say anything), **WATCH**, **AVOID**.

### The flaws worth designing against, before any code

- **False accusation is the real risk, not false comfort.** A common name in a large city will surface a stranger's felony record. The rubric must refuse to escalate above THIN when identity confidence is below a hard floor, and every alert must display the confidence band and the reason it was assigned, not just the verdict.
- **Latency versus usefulness.** A report that lands after you are dropped off is theatre. The sweep runs in two phases: a fast pass (plate, vehicle, obvious flags) targeted under fifteen seconds, then the deep pass that fills in the emailed report. The notification fires on the fast pass and updates on the deep pass.
- **Notification fatigue.** If every ride pings you, you stop reading. Default is silent-unless-flagged: CLEAR and THIN write to history without a push; WATCH and AVOID push loudly. The email report always sends, because that is the audit trail.
- **Anxiety as a side effect.** An AVOID with no explanation makes a rider panic in a parking lot. Every alert carries a one-line reason and a "what to do" action — cancel, verify plate, share trip with a contact.
- **Privacy of the driver.** The subject is a working person who did not consent. Reports are private to the rider, never shared or published, auto-expire, and are scrubbed of anything not relevant to rider safety.
- **Abuse.** Rate-limited per rider, gated to the $399 Cloud Intelligence tier, and every sweep written to the audit log with its trigger source.

### Notifications — three channels, one payload

- **In-app**, live via realtime subscription on the ride row.
- **Device push**, Web Push with a service-worker handler, so the alert lands on the lock screen with the app closed. Riders on iOS must have added Asherin to the home screen; the UI states that plainly rather than silently failing.
- **Email**, the formal report — House of Asher branded, the same generator already used for intelligence reports.

---

## Your phone-messages question

Cloud Intelligence cannot read your SMS, and no configuration will change that. The Google Substrate is wired to Gmail, Calendar, Drive, Contacts and location history — that is what `scopesForTier` requests. Google publishes no API that exposes phone SMS to a web app. Android Messages and iMessage are both closed to third-party servers; Google Voice has no public API either. So the gap is a platform boundary, not a bug in our code.

Three routes actually exist, and the plan below only builds the first unless you say otherwise:

1. **Paste or forward.** You forward a message thread into Asherin (or paste it); it is parsed, attributed, and written into the mesh vault as a message-source dossier — full report, same analysis depth as email threads.
2. **A dedicated Asherin number (Twilio).** You get a real number inside Asherin. Anything sent to it is fully readable and fully analysed. It does not see your existing carrier messages.
3. **An Android companion app.** The only path to your actual carrier SMS, and it needs Play Store review and a native build. Out of scope here.

---

## Technical plan

**Data**
- `rideshare_rides` — rider_id, source (`share_link` | `screenshot` | `email` | `manual`), platform, driver_first_name, plate, vehicle, city, pickup point, status, verdict, confidence, created_at. RLS scoped to `auth.uid()`, GRANTs for `authenticated` + `service_role`.
- `rideshare_reports` — ride_id, phase (`fast` | `deep`), payload jsonb, score, verdict, delivered_channels.
- `push_subscriptions` — rider_id, endpoint, keys, user_agent.
- `message_sources` — rider_id, channel (`sms_paste` | `sms_forward`), raw, parsed jsonb, dossier_id.

**Edge functions**
- `rideshare-capture` — validates the four input shapes with Zod, resolves a share link server-side (SSRF allow-list on the Uber host only), inserts the ride, returns immediately, and kicks the sweep.
- `rideshare-sweep` — two-phase. Reuses `jurisdictionalIntel`, `intelGraph`, `contactOsint` and the existing scoring instead of new engines. Bounded concurrency, per-branch timeout, idempotency key = (rider, plate, day) so a retry never re-bills.
- `rideshare-notify` — Web Push via VAPID plus the existing email sender; records delivered channels so a retry cannot double-send.
- `message-source-ingest` — parse/attribute pasted threads, produce the dossier.
- Mesh Sentinel gains an Uber-receipt matcher on the Gmail path so path 3 needs no rider action.

**Secrets** — `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY`, generated, not asked for.

**Frontend**
- New `Guardian` module inside Cloud Intelligence: ride history, live verdict card with the four-state rubric, confidence band always visible, per-ride report view, alert-threshold settings.
- Service worker `push` + `notificationclick` handlers, registered only in production, never in preview.
- A Web Share Target manifest entry so Uber's share sheet lists Asherin directly.
- Messages tab for paste/forward ingest and its dossiers.

**Verification** — a real share-link parse, a real receipt-email parse through the Gmail path, a live sweep against a real plate/name pair with the verdict and confidence inspected, and a real push delivered to a device before this is called done.
