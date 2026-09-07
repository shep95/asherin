// asherin.health — base anatomy model.
// geometry: BodyParts3D 4.0 (© Database Center for Life Science, CC BY 4.0), adapted:
// millimetres/Z-up → metres/Y-up, simplified with meshoptimizer, normals quantised to
// signed 16-bit, packed into binary chunks served from the asherin cdn.
import atlasPointer from "@/assets/atlas/atlas.json.asset.json";

export type SystemId =
  | "skeletal"
  | "muscular"
  | "arterial"
  | "venous"
  | "nervous"
  | "digestive"
  | "respiratory"
  | "urinary"
  | "reproductive"
  | "lymphatic"
  | "endocrine"
  | "integumentary"
  | "connective"
  | "sensory"
  | "cardiac";

export interface SystemDef {
  id: SystemId;
  name: string;
  color: string;
  description: string;
}

export const SYSTEMS: SystemDef[] = [
  {
    id: "skeletal",
    name: "skeleton",
    color: "#e2d9ba",
    description:
      "bone forms the supporting frame, protects organs and anchors muscle. its interior stores minerals and makes blood cells.",
  },
  {
    id: "muscular",
    name: "muscle",
    color: "#a85b50",
    description:
      "skeletal muscle moves joints by pulling on its attachments, holds posture and produces heat.",
  },
  {
    id: "cardiac",
    name: "heart",
    color: "#b96760",
    description:
      "a four-chambered muscular pump. its valves keep blood moving forward through the pulmonary and systemic circuits.",
  },
  {
    id: "sensory",
    name: "sensory organs",
    color: "#b0c8ce",
    description:
      "eye, ear and related structures. specialised tissue turns light, sound and motion into nerve signal.",
  },
  {
    id: "arterial",
    name: "arteries",
    color: "#c05245",
    description: "arteries carry blood away from the heart to the tissues, and to the lungs in the pulmonary circuit.",
  },
  {
    id: "venous",
    name: "veins",
    color: "#527c9f",
    description: "veins return blood toward the heart. superficial and deep networks drain the tissues.",
  },
  {
    id: "nervous",
    name: "nervous system",
    color: "#d8b565",
    description:
      "brain, spinal cord and peripheral nerves carry and process signal: sensation, movement, coordination and automatic regulation.",
  },
  {
    id: "respiratory",
    name: "respiratory",
    color: "#b98991",
    description:
      "airways conduct air to the lungs, where oxygen and carbon dioxide exchange across the alveolar surface.",
  },
  {
    id: "digestive",
    name: "digestive",
    color: "#b8916b",
    description:
      "the tract breaks food down, absorbs nutrients and water and moves waste on. accessory organs add bile and enzymes.",
  },
  {
    id: "urinary",
    name: "urinary",
    color: "#b47961",
    description:
      "the kidneys filter blood and hold fluid, electrolyte and acid–base balance. urine passes to the bladder through the ureters.",
  },
  {
    id: "lymphatic",
    name: "lymphatic",
    color: "#879f7c",
    description: "lymph vessels return tissue fluid to the circulation. nodes and lymphoid organs run immune surveillance.",
  },
  {
    id: "endocrine",
    name: "endocrine",
    color: "#c5a09a",
    description:
      "endocrine organs release hormones into blood to coordinate metabolism, growth, stress response and reproduction.",
  },
  {
    id: "reproductive",
    name: "reproductive",
    color: "#bda098",
    description: "the reproductive structures represented in this reference body, with their hormonal roles.",
  },
  {
    id: "integumentary",
    name: "body surface",
    color: "#ba9b7d",
    description:
      "the outer surface: barrier, sensation and temperature regulation. shown translucent so the interior stays visible.",
  },
  {
    id: "connective",
    name: "connective tissue",
    color: "#aec3bb",
    description: "cartilage, ligament and related tissue support, connect and separate structures and stabilise joints.",
  },
];

export const SYSTEM_BY_ID: Record<SystemId, SystemDef> = Object.fromEntries(
  SYSTEMS.map((s) => [s.id, s]),
) as Record<SystemId, SystemDef>;

export const DEFAULT_VISIBLE: SystemId[] = [
  "cardiac",
  "sensory",
  "skeletal",
  "muscular",
  "arterial",
  "venous",
  "nervous",
  "respiratory",
  "digestive",
  "urinary",
  "lymphatic",
  "endocrine",
  "reproductive",
  "connective",
];

export interface Part {
  id: string;
  name: string;
  conceptId: string;
  system: SystemId;
  chunk: number;
  positions: number;
  normals: number;
  indices: number;
  vertexCount: number;
  indexCount: number;
  bounds: [number[], number[]];
}

export interface Concept {
  id: string;
  name: string;
  elements: string[];
}

export interface AtlasChunk {
  url: string;
  bytes: number;
  gzip?: string;
  gzipBytes?: number;
}

export interface Atlas {
  version: string;
  sex?: "male";
  source?: string;
  scope?: string;
  parts: Part[];
  concepts: Concept[];
  chunks: AtlasChunk[];
  triangles: number;
}

export type View = "three-quarter" | "front" | "back" | "side";

/** per-part paint written by the intelligence layers, resolved to rgb in the scene. */
export interface AtlasHighlight {
  partIds: string[];
  color: string;
  /** 0..1 — how strongly the tint replaces the base tissue colour. */
  intensity: number;
  label: string;
  reason: string;
  source: string;
}

export interface SceneState {
  inspectorOpen?: boolean;
  explode: number;
  visible: SystemId[];
  selected: string[];
  isolate: boolean;
  view: View;
  rotate: boolean;
  reset: number;
  highlights: AtlasHighlight[];
}

export const ATLAS_URL: string = atlasPointer.url;

export const ATLAS_ATTRIBUTION =
  "BodyParts3D 4.0, © Database Center for Life Science, CC BY 4.0. adult male reference anatomy adapted for this viewer. educational, not a clinical instrument.";

const EXPLANATIONS: Record<string, string> = {
  heart:
    "a muscular pump in the chest. the right side sends blood to the lungs, the left side drives the systemic circulation.",
  liver:
    "a large organ under the right diaphragm. it processes absorbed nutrients, makes bile and synthesises most plasma proteins.",
  brain:
    "the central organ of the nervous system. its connected regions support perception, movement, memory, language and regulation of the body.",
  stomach:
    "a muscular chamber between oesophagus and small intestine. it stores and mixes food with acid and enzyme before release into the duodenum.",
  spleen: "a lymphoid organ in the upper left abdomen. it filters blood, clears aging red cells and supports immune response.",
  pancreas:
    "digestive and endocrine at once: enzymes to the small intestine, and insulin and glucagon into the blood.",
  "urinary bladder": "a muscular reservoir in the pelvis holding urine that arrives from the kidneys through the ureters.",
  trachea: "the main airway between larynx and bronchi. cartilage rings hold it open through the breathing cycle.",
  diaphragm:
    "the broad muscle between chest and abdomen. when it contracts, chest volume rises and air is drawn into the lungs.",
  kidney:
    "filters plasma, regulates fluid and electrolytes, controls acid–base balance and releases erythropoietin and renin.",
  "thyroid gland": "sets metabolic rate through thyroxine, under pituitary control via tsh.",
};

export function explanation(name: string, system: SystemId): string {
  return EXPLANATIONS[name.toLowerCase()] ?? SYSTEM_BY_ID[system]?.description ?? "";
}

/**
 * static hosts may serve `.gz` as a compressed response or as a gzip file. fetch already
 * decodes content-encoding, so inspect the payload before decompressing a second time.
 */
export async function decodeModelResponse(
  response: Response,
  expectedBytes: number,
  compressed: boolean,
): Promise<ArrayBuffer> {
  if (!response.ok) throw new Error("an anatomy file could not be loaded.");
  const payload = await response.arrayBuffer();
  const signature = new Uint8Array(payload, 0, Math.min(2, payload.byteLength));
  const gzip = compressed && signature[0] === 0x1f && signature[1] === 0x8b;
  const buffer = gzip
    ? await new Response(new Blob([payload]).stream().pipeThrough(new DecompressionStream("gzip"))).arrayBuffer()
    : payload;
  if (buffer.byteLength !== expectedBytes) throw new Error("an anatomy file arrived incomplete. reload the room.");
  return buffer;
}

let cached: Promise<Atlas> | null = null;

/** the catalogue is immutable and large; load it once per tab. */
export function loadAtlas(signal?: AbortSignal): Promise<Atlas> {
  if (!cached) {
    cached = fetch(ATLAS_URL, { signal })
      .then((r) => {
        if (!r.ok) throw new Error("the anatomy catalogue could not be loaded.");
        return r.json() as Promise<Atlas>;
      })
      .catch((error) => {
        cached = null;
        throw error;
      });
  }
  return cached;
}
