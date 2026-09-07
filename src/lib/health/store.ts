// the health record is held on this device only. it is never uploaded by this room, which
// is the single most important property of a health surface a person will actually use.
import type { LabValue } from "./labs";
import type { MedicationEntry } from "./medications";
import type { GeneEntry } from "./genetics";
import type { ExposureEntry, FamilyEntry, NutritionEntry, SurgeryEntry } from "./records";
import type { PainReport } from "./pain";
import type { SymptomEntry } from "./symptoms";
import type { BodyModelState } from "./bodyModel";
import { EMPTY_BODY_MODEL } from "./bodyModel";
import type { SurfaceObservation } from "./surface";

export interface HealthRecord {
  version: 1;
  updatedAt: string;
  labs: LabValue[];
  medications: MedicationEntry[];
  genes: GeneEntry[];
  nutrition: NutritionEntry[];
  exposures: ExposureEntry[];
  surgeries: SurgeryEntry[];
  family: FamilyEntry[];
  pain: PainReport[];
  symptoms: SymptomEntry[];
  herbs: string[];
  /** guided four-view body modelling: captures, measurements, solves. device-local. */
  body: BodyModelState;
  /** visible-surface readings tracked against the person's own baseline. */
  observations: SurfaceObservation[];
}

export const EMPTY_RECORD: HealthRecord = {
  version: 1,
  updatedAt: new Date(0).toISOString(),
  labs: [],
  medications: [],
  genes: [],
  nutrition: [],
  exposures: [],
  surgeries: [],
  family: [],
  pain: [],
  symptoms: [],
  herbs: [],
  body: EMPTY_BODY_MODEL,
  observations: [],
};

const KEY_PREFIX = "asherin.health.record";

function storageKey(scope: string | null): string {
  return scope ? `${KEY_PREFIX}.${scope}` : KEY_PREFIX;
}

export function loadRecord(scope: string | null): HealthRecord {
  if (typeof localStorage === "undefined") return EMPTY_RECORD;
  try {
    const raw = localStorage.getItem(storageKey(scope));
    if (!raw) return EMPTY_RECORD;
    const parsed = JSON.parse(raw) as Partial<HealthRecord>;
    if (parsed.version !== 1) return EMPTY_RECORD;
    // older records predate the body model and surface log; merge defaults so a
    // saved record from an earlier build still opens instead of resetting.
    return {
      ...EMPTY_RECORD,
      ...parsed,
      body: { ...EMPTY_BODY_MODEL, ...(parsed.body ?? {}) },
      observations: parsed.observations ?? [],
      version: 1,
    };
  } catch {
    return EMPTY_RECORD;
  }
}

export function saveRecord(scope: string | null, record: HealthRecord): boolean {
  if (typeof localStorage === "undefined") return false;
  try {
    localStorage.setItem(storageKey(scope), JSON.stringify({ ...record, updatedAt: new Date().toISOString() }));
    return true;
  } catch {
    return false;
  }
}

export function clearRecord(scope: string | null): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(storageKey(scope));
  } catch {
    /* storage may be blocked; the in-memory record still applies for this session. */
  }
}

export function exportRecord(record: HealthRecord): string {
  return JSON.stringify(record, null, 2);
}

export function importRecord(text: string): { record: HealthRecord | null; error: string | null } {
  try {
    const parsed = JSON.parse(text) as Partial<HealthRecord>;
    if (parsed.version !== 1) return { record: null, error: "that file is not an asherin.health export." };
    return {
      record: {
        ...EMPTY_RECORD,
        ...parsed,
        body: { ...EMPTY_BODY_MODEL, ...(parsed.body ?? {}) },
        observations: parsed.observations ?? [],
        version: 1,
      },
      error: null,
    };
  } catch {
    return { record: null, error: "that file could not be read as json." };
  }
}

export function recordCount(record: HealthRecord): number {
  return (
    record.labs.length +
    record.medications.length +
    record.genes.length +
    record.nutrition.length +
    record.exposures.length +
    record.surgeries.length +
    record.family.length +
    record.pain.length +
    record.symptoms.length +
    record.herbs.length +
    record.observations.length +
    record.body.solves.length
  );
}

export function newId(prefix: string): string {
  const rand = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10);
  return `${prefix}-${rand}`;
}
