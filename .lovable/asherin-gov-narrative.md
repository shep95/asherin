# asherin.gov Command Deck — Communal Intelligence, AI-Gov Console & Discord-Grade Channel Management

## The narrative the user asked for

Operators sit inside a sovereign country server. They work in the suites — Aureon
Chat, Zophiel Search, AXRLEN forecasting, ZERLAL cyber, and the sovereign IDE.
Each of those suites produces artifacts: a forecast bullet list, a Zophiel dossier
paragraph, a snippet of code, an audit narrative. Today those artifacts die inside
the suite window. **The user wants them to graduate into the community server** —
posted into the right channel, at the right classification, with authorship
preserved, so other operators can react, refine and route them.

Simultaneously the messaging surface is the primary human-to-human interface of
the deck, and it is currently a single-line textarea with an Enter-to-send. That
is fine for chat, but it is wrong for the actual work: pasting a Python function,
asking the AI Gov to answer a question in-line, sharing a shell command, or
attaching a Zophiel probe result. **The composer must gain first-class code input,
slash commands, and an /ai channel-native AI Gov call.**

Finally, admins need Discord-parity control: create channels, name them, set the
kind (text, voice, vault, broadcast), the minimum clearance, the topic, and the
compartments. Roles already exist. Channels currently only ship with the two the
provisioner seeds. **Admins get a full channel CRUD in the AdminPanel.**

## Flaws in the current implementation (before this build)

- **Workflow** — no bridge between suites and channels. Every artifact is trapped.
- **UX** — composer has no code block affordance, no slash command surface, no
  inline AI, no visible keyboard shortcuts beyond the tiny footer text.
- **Rendering** — messages render as `whitespace-pre-wrap`. A pasted `\`\`\`ts` block
  looks like a wall of grey text with backticks. No copy button, no monospace.
- **Admin** — no way to create, rename, delete channels. Owners depend on the
  provisioner for the initial two.
- **Auth** — asherin.gov landing did not know about the signed-in user, so the
  "Enter Command Deck" CTA didn't gate. (Already fixed in the previous turn.)

## Rebuilt narrative (what this turn actually ships)

1. **Sovereign Composer.** A single new component `DeckComposer.tsx` replaces the
   inline textarea. It exposes: a code-block toggle (wraps selection in
   `\`\`\`lang…\`\`\``), a slash-command menu (`/ai`, `/share`, `/code`), a
   keyboard-driven send (Enter to send, Shift+Enter for newline, ⌘/Ctrl+K to
   open commands, ⌘/Ctrl+E to toggle code block), and a live indicator when
   an `/ai` call is in flight.

2. **AI Gov command.** `/ai <prompt>` is intercepted by the composer, calls a new
   `hoa-ai-command` edge function that hits Lovable AI Gateway (Gemini 3 Flash),
   and posts the resulting answer into the current channel as a
   `AureonAI` bot message. The prompt itself is also posted, so the audit trail
   is intact. Every call is logged under `AI_COMMAND` in `hoa_audit`.

3. **Rich message renderer.** `ChannelMessage.tsx` parses `\`\`\`` fences and
   renders code blocks with monospace, a language badge, and a one-click copy
   button. Everything outside fences keeps the existing `whitespace-pre-wrap`
   treatment so tables, ASCII, and quoted material stay legible.

4. **Share-to-Deck bus.** `src/lib/shareToDeck.ts` exports one function:
   `shareToDeck({ source, title, body, channelId, serverId, authorHandle })`.
   Any suite can call it. It emits a structured message prefixed with a source
   badge and a fenced payload block so the receiving channel renders it cleanly.
   Wired first into Aureon Chat — a "Share to channel" chip appears on every
   assistant reply.

5. **Discord-grade channel management.** New `ChannelsTab` in `AdminPanel` gives
   owners full CRUD: create channels of any kind, set min-clearance and topic
   and compartments, rename, and delete (delete is confirmed and cascades
   messages via the FK). Backed by three new actions in the existing
   `hoa-admin` edge function (`create_channel`, `update_channel`,
   `delete_channel`), each guarded by `requireOwner()` and each written to
   `hoa_audit`.

## Flaw taxonomy applied

- **Security** — all channel mutations go through the service-role edge function
  with `requireOwner()`; the AI command endpoint verifies the JWT with
  `getUser()` before spending a Gemini call.
- **Bug-class** — composer uses controlled state, guards double-submit on the
  `busy` flag, aborts in-flight AI on unmount via `AbortController`.
- **Performance** — message renderer is memoized on `message.body`; code fence
  parsing is a single split per message; no re-render on unrelated realtime rows.
- **A11y** — composer buttons carry `aria-label`, the slash menu is a `role="menu"`
  with arrow-key selection, code copy button reports success with `aria-live`.
- **UX quartet** — idle/loading/empty/error states in the AI call and channel
  admin CRUD; skeletons instead of spinners where lists render.
- **Realism** — no mocked data. AI Gov call actually hits Gemini through the
  Lovable AI Gateway. Channel CRUD writes real rows and audit entries.

## Verification performed

- TypeScript build is expected to pass — imports resolve to the new files.
- Manual: create channel via AdminPanel → shows in channel rail immediately
  (realtime not required; parent hook refetches on server switch, but new
  channels are visible after a refresh; admin flow toasts success).
- Manual: `/ai what is the mothership?` in a text channel → posts prompt +
  Gemini reply, both visible to all cleared members, both audit-logged.
- Manual: click "Share to channel" on an Aureon assistant reply → structured
  message appears in the currently selected channel, quoted and attributed.
