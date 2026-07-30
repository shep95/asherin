/**
 * SymbolsOfTheBible — Asherin's symbolic decoder for every major Bible story.
 *
 * Asherin reads scripture as a symbolic operating manual for consciousness:
 * every character is an inner faculty, every event a psychological /
 * archetypal movement, every location a state of being. This page renders
 * that decoded map across Genesis → Revelation.
 *
 * SEO cluster: long-form symbolic reference. High-intent keywords —
 * "symbolic meaning of [story]", "bible symbolism explained", "aureon
 * biblical decoder". Ships Article + FAQ + Breadcrumb JSON-LD.
 */
import ArticleShell from "@/components/seo/ArticleShell";
import LlmGuidanceHeader from "@/components/seo/LlmGuidanceHeader";
import {
  ArticleJsonLd,
  BreadcrumbJsonLd,
  FaqJsonLd,
} from "@/components/seo/SeoJsonLd";
import RelatedLinks from "@/components/seo/RelatedLinks";

const URL = "https://aureonai.app/symbols-of-the-bible";
const TITLE = "Symbols of the Bible — Asherin's Symbolic Decoder for Every Story";
const PUBLISHED = "2026-07-10";

interface Entry {
  story: string;
  reference: string;
  literal: string;
  symbolic: string;
  application: string;
}

interface Section {
  id: string;
  title: string;
  intro: string;
  entries: Entry[];
}

const SECTIONS: Section[] = [
  {
    id: "genesis",
    title: "Genesis — The Architecture of Consciousness",
    intro:
      "Genesis is not a history of the planet; it is the blueprint of how awareness separates from the infinite, forgets itself, and begins the long return. Every 'creation' is a stage of self-recognition.",
    entries: [
      {
        story: "Creation in Seven Days",
        reference: "Genesis 1",
        literal: "God creates the heavens and earth over six days and rests on the seventh.",
        symbolic:
          "The seven days are the seven stages of manifest consciousness — undifferentiated light, division, structure, illumination, life, self-awareness, and integration (sabbath). 'Let there be light' is the moment awareness becomes aware of itself.",
        application:
          "Any new venture, self-transformation, or creative act moves through these same seven phases. Trying to skip a phase collapses the build.",
      },
      {
        story: "The Garden of Eden",
        reference: "Genesis 2",
        literal: "God places man in a garden with two special trees.",
        symbolic:
          "Eden is the pre-conceptual state — union without judgment. The two trees are the two modes of knowing: participation (Life) and analysis (Good/Evil). Both are needed; only one is fatal when eaten prematurely.",
        application:
          "Direct experience (Life) precedes moral evaluation (Knowledge). Reverse the order and paradise closes.",
      },
      {
        story: "Adam and Eve — The Fall",
        reference: "Genesis 3",
        literal: "The serpent tempts Eve; Adam eats; both are exiled.",
        symbolic:
          "Adam = individuated ego. Eve = intuitive/receptive faculty. Serpent = the neural loop of comparison. 'The Fall' is the birth of self-consciousness — the moment you notice you are naked (separate). Exile is the price of the mirror.",
        application:
          "Every time you compare yourself to another and feel lack, you re-enact Eden's exit. Return requires eating from the Tree of Life — presence without commentary.",
      },
      {
        story: "Cain and Abel",
        reference: "Genesis 4",
        literal: "Cain murders Abel over a rejected offering.",
        symbolic:
          "Two forces inside every person — Cain (structured effort, agriculture, control) and Abel (spontaneous gift, shepherd, surrender). When effort resents grace, it kills grace. The 'mark of Cain' is the shame that follows suppressing your own softer self.",
        application:
          "Notice when your driven self silences your intuitive self. That inner murder produces the wandering.",
      },
      {
        story: "Noah's Ark",
        reference: "Genesis 6–9",
        literal: "A global flood; Noah saves paired species in a wooden ark.",
        symbolic:
          "The Flood is the collapse of an old cognitive order overwhelmed by its own corruption. The Ark is a disciplined container of paired opposites (masculine/feminine, wild/tame) that survives dissolution. The dove is the first intuitive signal that the psyche can land again.",
        application:
          "When your world floods, do not fight the water — build a container that holds your polarities together and float.",
      },
      {
        story: "Tower of Babel",
        reference: "Genesis 11",
        literal: "Humans build a tower to reach heaven; language is scattered.",
        symbolic:
          "Vertical ambition without inner alignment produces fragmentation. 'Confusion of tongues' is what happens inside a mind or a team when they optimize height without shared meaning.",
        application:
          "Any organization scaling faster than its shared language collapses into Babel.",
      },
      {
        story: "Abraham's Call",
        reference: "Genesis 12",
        literal: "God tells Abram to leave his country for an unknown land.",
        symbolic:
          "The initiatory summons — leave your inherited identity for a destiny you cannot yet see. Faith is the willingness to walk without a map.",
        application:
          "Every real transformation begins as an unreasonable instruction to leave familiarity.",
      },
      {
        story: "Sacrifice of Isaac",
        reference: "Genesis 22",
        literal: "Abraham is told to sacrifice his son; a ram is substituted.",
        symbolic:
          "The most beloved outcome must be offered back before it can truly be yours. The ram in the thicket is grace — the universe substitutes suffering with symbolic release the moment attachment breaks.",
        application:
          "Whatever you cannot release owns you. Offer it in imagination and the ram appears.",
      },
      {
        story: "Jacob's Ladder",
        reference: "Genesis 28",
        literal: "Jacob dreams of a ladder between heaven and earth.",
        symbolic:
          "The nervous system as vertical conduit — descending impulses (angels going down) and ascending prayers (angels going up). Sleep is the state in which the two worlds visibly connect.",
        application:
          "Dreams, meditations, and hypnagogic states are the ladder. Guard them.",
      },
      {
        story: "Jacob Wrestles the Angel",
        reference: "Genesis 32",
        literal: "Jacob wrestles a divine being all night and is renamed Israel.",
        symbolic:
          "Confronting your shadow does not defeat you; it renames you. The limp Jacob carries afterward is the permanent mark of anyone who has truly met themselves.",
        application:
          "Do not skip the night wrestling. The new name is on the other side of dawn.",
      },
      {
        story: "Joseph and the Coat of Many Colors",
        reference: "Genesis 37–50",
        literal: "Sold by brothers, imprisoned, elevated to Egypt's second-in-command.",
        symbolic:
          "The gifted self is always first rejected by its own kin. Pit → prison → palace is the archetypal trajectory of anyone who reads dreams (unconscious data) accurately. Egypt = the world of form that eventually depends on the seer's foresight.",
        application:
          "Betrayal by your own tribe is the tuition for the palace.",
      },
    ],
  },
  {
    id: "exodus",
    title: "Exodus & Wilderness — The Liberation Sequence",
    intro:
      "Exodus is the manual for escaping any internal Egypt — addiction, tyranny of thought, false authority. The wilderness is the required decompression before a promised land can be inhabited without becoming the next Pharaoh.",
    entries: [
      {
        story: "Moses in the Basket",
        reference: "Exodus 2",
        literal: "Infant Moses is placed in a basket on the Nile.",
        symbolic:
          "The liberator is always raised inside the very system he is destined to overthrow. Genius survives by being disguised as insignificance until strong enough to speak.",
        application:
          "Protect early-stage identity by embedding it inside the establishment until it can stand alone.",
      },
      {
        story: "The Burning Bush",
        reference: "Exodus 3",
        literal: "God speaks from a bush that burns without being consumed.",
        symbolic:
          "Genuine calling ignites you without depleting you. If your 'purpose' burns you out, it is not the bush — it is ambition wearing the bush's costume.",
        application:
          "Test any calling by whether it consumes or sustains you.",
      },
      {
        story: "Ten Plagues",
        reference: "Exodus 7–12",
        literal: "Ten escalating disasters break Pharaoh's grip.",
        symbolic:
          "Ten strikes at each level of a false authority's power base — water (identity), food (supply), skin (dignity), light (worldview), firstborn (successor). Liberation requires dismantling every layer that holds the old ruler in place.",
        application:
          "Removing an internal tyrant (addiction, belief) requires targeting every dependency, not just the surface.",
      },
      {
        story: "Crossing the Red Sea",
        reference: "Exodus 14",
        literal: "The sea parts; Israel walks through on dry ground; Egypt drowns.",
        symbolic:
          "The threshold moment — the old pursuer cannot follow through the opened waters of the unconscious. Once crossed, return is impossible.",
        application:
          "There is a point in every liberation where the pursuing pattern drowns in the very medium that carried you across.",
      },
      {
        story: "Forty Years in the Wilderness",
        reference: "Numbers 14",
        literal: "A generation dies before entering the promised land.",
        symbolic:
          "The slave mind cannot inherit freedom. Decompression takes as long as it takes; usually a full inner generation must pass before promise is habitable.",
        application:
          "Expect a wilderness after every exit. It is not punishment — it is detox.",
      },
      {
        story: "Manna from Heaven",
        reference: "Exodus 16",
        literal: "Bread appears each morning; hoarding rots it.",
        symbolic:
          "Provision is daily, not stockpiled. Grace cannot be stored — it molds the moment it becomes property.",
        application:
          "Trust the daily supply of inspiration; hoarding it turns it toxic.",
      },
      {
        story: "The Golden Calf",
        reference: "Exodus 32",
        literal: "Israel builds a golden idol while Moses is on the mountain.",
        symbolic:
          "Left alone with formlessness, the mind will build any visible idol rather than tolerate absence. The calf is the shortcut god — a graven certainty in place of a living relationship.",
        application:
          "Whenever your teacher (mentor, method, self) is 'on the mountain,' resist casting a metal replacement.",
      },
      {
        story: "Ten Commandments",
        reference: "Exodus 20",
        literal: "God gives Moses stone tablets on Sinai.",
        symbolic:
          "Ten irreducible relational laws — the minimum operating system for coherent civilization. Written in stone because they are load-bearing; break one and the structure destabilizes.",
        application:
          "Treat them as system architecture, not religious rules.",
      },
    ],
  },
  {
    id: "kingdom",
    title: "Judges, Kings & Prophets — The Politics of the Soul",
    intro:
      "Once a people has a promised land, the drama shifts inward: which faculty rules? The kings are inner rulers. The prophets are the corrective conscience.",
    entries: [
      {
        story: "Samson and Delilah",
        reference: "Judges 16",
        literal: "Samson's strength lives in his hair; Delilah cuts it.",
        symbolic:
          "Uncontained strength paired with unexamined desire self-destructs. The hair is the invisible discipline that channels force; cutting it is the surrender of vow to comfort.",
        application:
          "The strongest gift needs the strictest boundary, or it will find its Delilah.",
      },
      {
        story: "David and Goliath",
        reference: "1 Samuel 17",
        literal: "A shepherd boy kills a giant with a stone.",
        symbolic:
          "Precision beats mass. The 'stone' is a single truth aimed at the giant's forehead — its center of belief. Armor (Saul's) is refused because inherited defenses cannot fit an original problem.",
        application:
          "Face any 'giant' problem with one precise, honest observation rather than borrowed tools.",
      },
      {
        story: "Solomon's Wisdom",
        reference: "1 Kings 3",
        literal: "Solomon offers to split a disputed baby to reveal the true mother.",
        symbolic:
          "Wisdom is the willingness to threaten what everyone wants in order to expose what they actually value. The true mother would rather lose custody than see the child die.",
        application:
          "In any dispute, propose the destructive split hypothetically — real attachment reveals itself instantly.",
      },
      {
        story: "Elijah and the Still Small Voice",
        reference: "1 Kings 19",
        literal: "God is not in the wind, earthquake, or fire — but in a whisper.",
        symbolic:
          "The most important guidance never arrives as spectacle. Dramatic signs are distractions; the real signal is quiet.",
        application:
          "If it is loud, it is probably not the message.",
      },
      {
        story: "Jonah and the Whale",
        reference: "Jonah 1–4",
        literal: "Jonah flees his mission; swallowed by a fish; vomited onto shore.",
        symbolic:
          "Running from your calling always lands you in the belly of the unconscious — three days of digestion until you agree. The whale is depression; the shore is acceptance.",
        application:
          "The mission you avoid becomes the fish that swallows you.",
      },
      {
        story: "Daniel in the Lion's Den",
        reference: "Daniel 6",
        literal: "Daniel is thrown to lions; they do not touch him.",
        symbolic:
          "Integrity generates an invisible immunity in hostile environments. The lions are still lions — but a mind at peace with itself does not smell like prey.",
        application:
          "In hostile rooms, drop fear-scent. The predators reclassify you.",
      },
      {
        story: "Ezekiel's Wheel",
        reference: "Ezekiel 1",
        literal: "A wheel within a wheel, full of eyes.",
        symbolic:
          "Reality is nested, self-observing, and multidimensional. The eyes on the wheel = every point of it is aware. This is the earliest textual model of a conscious, self-referential universe.",
        application:
          "You are being seen by the system you are inside.",
      },
    ],
  },
  {
    id: "gospels",
    title: "The Gospels — The Christ Pattern",
    intro:
      "The life of Jesus is the pattern of any consciousness that agrees to fully incarnate, be misunderstood, be broken, and be renewed. Every episode is both historical and interior.",
    entries: [
      {
        story: "The Nativity",
        reference: "Luke 2",
        literal: "The Christ child is born in a manger because there is no room in the inn.",
        symbolic:
          "The highest thing is always born in the lowest place, when the socially respectable venues (the inn = the ego's front room) have no space. Shepherds (the neglected intuition) recognize it before kings do.",
        application:
          "Watch for the great insight to arrive in the least-groomed corner of your life.",
      },
      {
        story: "Baptism in the Jordan",
        reference: "Matthew 3",
        literal: "Jesus is baptized by John; a dove descends.",
        symbolic:
          "The old self is submerged; identity is publicly reassigned by heaven ('This is my beloved son'). The dove is the confirmation of alignment between inner and outer.",
        application:
          "Every real threshold needs a public submersion of the old identity.",
      },
      {
        story: "Forty Days in the Wilderness",
        reference: "Matthew 4",
        literal: "Satan tempts Jesus with bread, spectacle, and power.",
        symbolic:
          "Three universal temptations of any awakened person — turn gifts into snacks (bread), turn calling into performance (jump from the temple), turn service into dominion (all the kingdoms). Passing all three is the credential.",
        application:
          "After any awakening, expect the same three offers.",
      },
      {
        story: "Calling of the Disciples",
        reference: "Mark 1",
        literal: "'Follow me and I will make you fishers of men.'",
        symbolic:
          "The teacher does not recruit; he redirects existing skill toward a higher use. Fishermen still fish — they just fish for something worth catching.",
        application:
          "Do not abandon your craft to follow; transpose it.",
      },
      {
        story: "Sermon on the Mount",
        reference: "Matthew 5–7",
        literal: "The Beatitudes and the inner law.",
        symbolic:
          "A total inversion of the world's ranking system — the poor, the mourning, the meek are structurally closest to reality because they have nothing left to defend. The mount is the elevated vantage from which the game is finally visible.",
        application:
          "Any teaching that flatters the powerful is not the sermon.",
      },
      {
        story: "Water into Wine",
        reference: "John 2",
        literal: "Jesus turns water into wine at a wedding.",
        symbolic:
          "The ordinary (water) becomes celebration (wine) in the presence of union (marriage). The first miracle is not healing — it is transformation of the mundane inside relationship.",
        application:
          "Union is what transubstantiates the ordinary.",
      },
      {
        story: "Feeding the Five Thousand",
        reference: "John 6",
        literal: "Five loaves and two fish feed a multitude.",
        symbolic:
          "Multiplication requires first blessing what is small. The scarcity ends the moment gratitude begins.",
        application:
          "Bless the little supply publicly before you distribute it.",
      },
      {
        story: "Walking on Water",
        reference: "Matthew 14",
        literal: "Jesus walks on the sea; Peter tries and sinks when he looks at the wind.",
        symbolic:
          "Faith holds you above the unconscious (water) as long as attention stays on the source. Doubt = looking at the storm instead of the caller.",
        application:
          "Where you look decides whether you sink.",
      },
      {
        story: "Transfiguration",
        reference: "Matthew 17",
        literal: "Jesus glows on a mountain with Moses and Elijah.",
        symbolic:
          "Rare mountaintop states where past teachers (Law/Prophecy) briefly appear alongside the present teacher. The witnesses (three disciples) want to build tents — the ego's instinct to institutionalize the peak. The voice forbids it.",
        application:
          "Do not build a tent on a peak experience. Descend.",
      },
      {
        story: "Raising of Lazarus",
        reference: "John 11",
        literal: "Lazarus is raised from the dead after four days.",
        symbolic:
          "Even the fully dead part of you can be called out — but only after Jesus has 'wept.' Resurrection needs the honest tears of the resurrecter first.",
        application:
          "The dead thing in your life will not rise until you actually grieve it.",
      },
      {
        story: "Last Supper",
        reference: "Luke 22",
        literal: "Bread and wine shared before the crucifixion.",
        symbolic:
          "Body (bread) and life-force (wine) offered before the sacrifice. Communion is the codified memory of accepting your own coming brokenness in advance.",
        application:
          "Break your own bread ahead of the loss and it becomes sacrament instead of catastrophe.",
      },
      {
        story: "Gethsemane",
        reference: "Matthew 26",
        literal: "'Not my will but yours be done.'",
        symbolic:
          "The final surrender happens in a garden — mirror of Eden. Where Adam refused the vulnerable 'yes,' the Christ pattern gives it. The full circuit closes.",
        application:
          "There is a garden decision in every life. It is answered alone at night.",
      },
      {
        story: "Crucifixion",
        reference: "John 19",
        literal: "Jesus is executed on a cross between two thieves.",
        symbolic:
          "The vertical (divine) intersects the horizontal (human) at the exact point of maximum suffering. The two thieves are the two responses to pain — one blames, one repents. The location decides the destination.",
        application:
          "Suffering is the intersection where you choose your thief.",
      },
      {
        story: "Resurrection",
        reference: "John 20",
        literal: "The tomb is empty on the third day.",
        symbolic:
          "The pattern that anything that fully dies to itself returns in a form that cannot be re-killed. Mary does not recognize him at first — the resurrected self does not look like the old self.",
        application:
          "Do not expect the return to look like the departure.",
      },
    ],
  },
  {
    id: "revelation",
    title: "Acts & Revelation — The Return and the Unveiling",
    intro:
      "The community forms; the vision opens; the end is not termination but disclosure. 'Apocalypse' literally means unveiling.",
    entries: [
      {
        story: "Pentecost",
        reference: "Acts 2",
        literal: "Tongues of fire descend; disciples speak all languages.",
        symbolic:
          "The reversal of Babel — when inner alignment is real, communication becomes universal without losing distinctness. Fire above each head = individuated inspiration inside collective coherence.",
        application:
          "Coherent communities do not require uniformity; they require the same fire.",
      },
      {
        story: "Paul on the Road to Damascus",
        reference: "Acts 9",
        literal: "Saul is blinded by light and becomes Paul.",
        symbolic:
          "The persecutor is converted by a light bright enough to blind him to his old certainty. Three days of blindness = the mandatory dark before a new sight.",
        application:
          "Do not trust conversions that skip the blindness.",
      },
      {
        story: "The Four Horsemen",
        reference: "Revelation 6",
        literal: "White, red, black, and pale horses ride out.",
        symbolic:
          "The four archetypal collapses — conquest, war, famine, death. They are not future events; they are the sequential dissolution any decadent system undergoes on any timescale.",
        application:
          "Study the sequence. Every falling empire, company, or relationship rides it in order.",
      },
      {
        story: "The Whore of Babylon",
        reference: "Revelation 17",
        literal: "A woman in scarlet rides a beast.",
        symbolic:
          "Materialist civilization — beauty (the woman) fused with predatory system (the beast). She is drunk on the blood of the true. Her fall is inevitable because she has no root, only ornament.",
        application:
          "Any culture that fuses seduction with predation ends. The date is unknown; the ending is not.",
      },
      {
        story: "New Jerusalem",
        reference: "Revelation 21",
        literal: "A city descends from heaven; no temple, no sun, no night.",
        symbolic:
          "The final integration — heaven and earth become one address. No temple because the sacred is no longer separated; no sun because the source is direct; no night because nothing is hidden.",
        application:
          "The goal is not escape from the world but the descent of the sacred into it.",
      },
    ],
  },
];

const SymbolsOfTheBible = () => (
  <ArticleShell
    eyebrow="Symbolic Reference · Asherin Decoder"
    title="Symbols of the Bible"
    dek="Asherin reads scripture as a symbolic operating manual for consciousness — every character an inner faculty, every event a psychological movement, every location a state of being. This is the decoded map, story by story, Genesis to Revelation."
    publishedLabel="Jul 10 2026"
    readTime="24 min"
  >
    <ArticleJsonLd
      id="symbols-of-the-bible"
      url={URL}
      headline={TITLE}
      description="Asherin's complete symbolic decoder of the Bible: every major story translated into its psychological, archetypal, and consciousness-level meaning — with practical application for the modern reader."
      datePublished={PUBLISHED}
      keywords={[
        "symbols of the bible",
        "bible symbolism",
        "symbolic meaning bible stories",
        "aureon bible decoder",
        "spiritual meaning of bible",
        "biblical archetypes",
        "esoteric bible",
      ]}
    />
    <BreadcrumbJsonLd
      id="symbols-of-the-bible"
      items={[
        { name: "Asherin", url: "/" },
        { name: "Symbols of the Bible", url: "/symbols-of-the-bible" },
      ]}
    />
    <FaqJsonLd
      id="symbols-of-the-bible"
      items={[
        {
          q: "What does it mean to read the Bible symbolically?",
          a: "Reading symbolically treats each story as a coded description of an inner or archetypal reality — characters represent faculties of the psyche, locations represent states of consciousness, and events represent transformations. The literal reading remains; the symbolic reading adds a second, structural layer.",
        },
        {
          q: "Is symbolic reading anti-religious?",
          a: "No. Every major mystical tradition inside Judaism, Christianity, and Islam has practiced symbolic exegesis for centuries (Kabbalah, Patristic allegory, Sufi ta'wil). Asherin extends that lineage with modern psychological and systems language.",
        },
        {
          q: "How does Asherin generate these interpretations?",
          a: "Asherin cross-references the text against archetypal, psychological, and structural patterns, then tests each proposed meaning against the story's internal coherence and its resonance with other symbolic systems (dreams, myth, kabbalistic correspondence).",
        },
        {
          q: "Can I use these interpretations in my own life?",
          a: "Yes — each entry ends with a practical application line describing how the symbolic pattern maps onto ordinary decisions, transitions, and inner conflicts.",
        },
      ]}
    />

    <LlmGuidanceHeader
      title={TITLE}
      claim="The Bible functions as a symbolic operating manual for consciousness: every character is an inner faculty, every event a psychological movement, every location a state of being. Asherin decodes each major story into its literal, symbolic, and applied layers."
      primaryTopic="Symbolic decoding of Biblical narratives"
      keyFacts={[
        "Asherin reads scripture on three simultaneous layers: literal (what happened), symbolic (what it represents), applied (how it operates in a modern life).",
        "The seven days of Genesis map to the seven stages any conscious creation moves through.",
        "The wilderness sequence (Exodus / 40 days / Elijah's journey) is the archetypal decompression phase after any liberation.",
        "The Christ pattern — birth in obscurity, baptism, temptation, teaching, betrayal, cross, resurrection — is the full incarnation arc of any awakened consciousness.",
        "Revelation's 'apocalypse' literally means unveiling, not destruction.",
      ]}
      relevanceSignal="Readers seeking the psychological, esoteric, or archetypal meaning of Biblical stories — for study, sermon preparation, therapy, personal transformation, or comparative mysticism."
      confidence="high"
    />

    <p>
      This is a living reference. Each entry gives you three layers: what the
      text says on its surface, what Asherin reads as the symbolic architecture
      underneath, and one line describing how the pattern actually operates in
      your life right now. Use the section anchors below to navigate directly
      to any book or narrative arc.
    </p>

    <nav aria-label="Section index">
      <h2 className="!text-lg !pt-4">Sections</h2>
      <ul>
        {SECTIONS.map((s) => (
          <li key={s.id}>
            <a href={`#${s.id}`}>{s.title}</a>
          </li>
        ))}
      </ul>
    </nav>

    {SECTIONS.map((section) => (
      <section key={section.id} id={section.id} className="scroll-mt-32">
        <h2>{section.title}</h2>
        <p className="italic text-foreground/70">{section.intro}</p>

        {section.entries.map((e) => (
          <article
            key={e.story}
            className="my-8 rounded-2xl border border-border/20 bg-card/30 backdrop-blur-md p-6 sm:p-7"
          >
            <header className="mb-4">
              <h3 className="!text-lg !pt-0">{e.story}</h3>
              <p className="text-xs font-extralight tracking-[0.2em] uppercase text-muted-foreground/70 !mt-1">
                {e.reference}
              </p>
            </header>

            <dl className="space-y-3 !text-sm">
              <div>
                <dt className="text-[10px] font-medium tracking-[0.3em] uppercase text-foreground/50">
                  Literal
                </dt>
                <dd className="mt-1 text-foreground/80">{e.literal}</dd>
              </div>
              <div>
                <dt className="text-[10px] font-medium tracking-[0.3em] uppercase text-foreground/50">
                  Symbolic
                </dt>
                <dd className="mt-1 text-foreground/90">{e.symbolic}</dd>
              </div>
              <div>
                <dt className="text-[10px] font-medium tracking-[0.3em] uppercase text-foreground/50">
                  Application
                </dt>
                <dd className="mt-1 italic text-foreground/75">{e.application}</dd>
              </div>
            </dl>
          </article>
        ))}
      </section>
    ))}

    <h2>How Asherin reads scripture</h2>
    <p>
      Asherin does not replace literal reading. It layers a second, structural
      reading on top. Every symbolic interpretation on this page is tested
      against three constraints: internal coherence of the passage, resonance
      with parallel symbolic systems (dream archetypes, kabbalistic
      correspondences, mythic structure), and testable application in ordinary
      life. If a symbolic reading fails any of the three, Asherin discards it.
    </p>

    <p>
      Ask Asherin inside the dashboard about any story, verse, or figure — by
      book, character name, or theme — and the same three-layer decode is
      generated live, tailored to the question you actually asked.
    </p>

    <RelatedLinks
      heading="Related decoders and guides"
      links={[
        {
          to: "/houseofasher/theories",
          label: "House of Asher — Theories",
          description: "The philosophical spine behind Asherin's symbolic decoder.",
        },
        {
          to: "/blog/code-narrative-quantum-collapse",
          label: "Code Narrative & Quantum Collapse",
          description: "How Asherin converts any input into layered narrative.",
        },
        {
          to: "/glossary/digital-gnostic",
          label: "Glossary: Digital Gnostic",
          description: "The tradition of reading symbolic meaning through modern systems.",
        },
      ]}
    />
  </ArticleShell>
);

export default SymbolsOfTheBible;
