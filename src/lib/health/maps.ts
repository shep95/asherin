// asherin.health — regional maps: dermatomes, myotomes, cerebral vascular territories,
// lymphatic drainage chains and organ zone maps. reference knowledge only, not derived
// from any live signal.
export interface RegionalEntry {
  id: string;
  label: string;
  detail: string;
  territoryKeys: string[];
}

export const DERMATOMES: RegionalEntry[] = [
  { id: "C2", label: "C2 — back of the head", detail: "occipital scalp sensation.", territoryKeys: ["spinal-cord"] },
  { id: "C3", label: "C3 — upper neck / lower jaw line", detail: "sensation over the neck.", territoryKeys: ["spinal-cord"] },
  { id: "C4", label: "C4 — shoulder point", detail: "sensation over the top of the shoulder.", territoryKeys: ["spinal-cord"] },
  { id: "C5", label: "C5 — outer upper arm", detail: "lateral shoulder and upper arm.", territoryKeys: ["spinal-cord"] },
  { id: "C6", label: "C6 — thumb", detail: "thumb and radial forearm.", territoryKeys: ["spinal-cord"] },
  { id: "C7", label: "C7 — middle finger", detail: "middle finger, central palm.", territoryKeys: ["spinal-cord"] },
  { id: "C8", label: "C8 — little finger", detail: "little finger, ulnar hand.", territoryKeys: ["spinal-cord"] },
  { id: "T4", label: "T4 — nipple line", detail: "chest at nipple level.", territoryKeys: ["spinal-cord"] },
  { id: "T10", label: "T10 — umbilicus", detail: "skin at the navel.", territoryKeys: ["spinal-cord"] },
  { id: "L1", label: "L1 — groin", detail: "inguinal region.", territoryKeys: ["spinal-cord"] },
  { id: "L4", label: "L4 — medial shin / big toe", detail: "inner shin to big toe.", territoryKeys: ["spinal-cord"] },
  { id: "L5", label: "L5 — top of foot", detail: "dorsum of the foot and middle toes.", territoryKeys: ["spinal-cord"] },
  { id: "S1", label: "S1 — outer foot / sole", detail: "lateral foot and sole.", territoryKeys: ["spinal-cord"] },
  { id: "S2-S4", label: "S2–S4 — saddle region", detail: "perineal / saddle sensation; new loss here is an emergency sign.", territoryKeys: ["spinal-cord", "pelvic-floor"] },
  { id: "S5", label: "S5 — perianal", detail: "skin immediately around the anus.", territoryKeys: ["spinal-cord"] },
];

export const MYOTOMES: RegionalEntry[] = [
  { id: "C5m", label: "C5 — shoulder abduction", detail: "raising the arm out to the side.", territoryKeys: ["shoulder", "muscle"] },
  { id: "C6m", label: "C6 — wrist extension", detail: "cocking the wrist back.", territoryKeys: ["muscle"] },
  { id: "C7m", label: "C7 — elbow extension", detail: "straightening the elbow.", territoryKeys: ["muscle"] },
  { id: "C8m", label: "C8 — finger flexion", detail: "making a fist.", territoryKeys: ["muscle"] },
  { id: "T1m", label: "T1 — finger abduction", detail: "spreading the fingers.", territoryKeys: ["muscle"] },
  { id: "L2m", label: "L2 — hip flexion", detail: "lifting the thigh toward the chest.", territoryKeys: ["hip", "muscle"] },
  { id: "L3m", label: "L3 — knee extension", detail: "straightening the knee.", territoryKeys: ["knee", "muscle"] },
  { id: "L4m", label: "L4 — ankle dorsiflexion", detail: "pulling the foot upward.", territoryKeys: ["muscle"] },
  { id: "L5m", label: "L5 — big toe extension", detail: "lifting the big toe.", territoryKeys: ["muscle"] },
  { id: "S1m", label: "S1 — ankle plantarflexion", detail: "pushing the foot down / standing on toes.", territoryKeys: ["muscle"] },
];

export const CEREBRAL_VASCULAR_TERRITORIES: RegionalEntry[] = [
  { id: "ACA", label: "anterior cerebral artery", detail: "supplies the medial frontal and parietal lobes; occlusion typically weakens the opposite leg more than the arm.", territoryKeys: ["frontal-lobe", "parietal-lobe", "cerebral-arteries"] },
  { id: "MCA", label: "middle cerebral artery", detail: "supplies most of the lateral cortex including motor, sensory and language areas; the most common site of ischaemic stroke.", territoryKeys: ["frontal-lobe", "temporal-lobe", "parietal-lobe", "cerebral-arteries"] },
  { id: "PCA", label: "posterior cerebral artery", detail: "supplies the occipital lobe and medial temporal lobe; occlusion classically causes a visual field loss.", territoryKeys: ["occipital-lobe", "temporal-lobe", "cerebral-arteries"] },
  { id: "vertebrobasilar", label: "vertebrobasilar system", detail: "supplies the brainstem and cerebellum; occlusion can affect consciousness, cranial nerves and coordination together.", territoryKeys: ["brainstem", "cerebellum", "cerebral-arteries"] },
  { id: "watershed", label: "watershed (border zone) territory", detail: "the boundary areas between major artery territories, most vulnerable in low blood pressure or cardiac arrest rather than a single vessel blockage.", territoryKeys: ["cerebral-cortex", "cerebral-arteries"] },
];

export const LYMPHATIC_DRAINAGE: RegionalEntry[] = [
  { id: "head-neck", label: "head and neck", detail: "drains to the cervical node chain.", territoryKeys: ["lymph-nodes"] },
  { id: "breast-arm", label: "breast and arm", detail: "drains mainly to the axillary node chain, with a smaller route to internal mammary nodes.", territoryKeys: ["lymph-nodes", "mammary-gland"] },
  { id: "leg-perineum", label: "leg and lower pelvis", detail: "drains to the inguinal node chain.", territoryKeys: ["lymph-nodes"] },
  { id: "abdominal-viscera", label: "abdominal organs", detail: "drains to mesenteric and celiac node chains before entering the cisterna chyli.", territoryKeys: ["lymph-nodes"] },
  { id: "thoracic-duct", label: "thoracic duct", detail: "the main lymphatic trunk returning lymph from most of the body into the venous system at the left neck.", territoryKeys: ["lymphatic"] },
];

export const ORGAN_ZONES: RegionalEntry[] = [
  { id: "liver-seg1-4", label: "liver segments I–IV", detail: "caudate and left lobe segments, surgically resectable independently of the right lobe.", territoryKeys: ["liver"] },
  { id: "liver-seg5-8", label: "liver segments V–VIII", detail: "right lobe segments.", territoryKeys: ["liver"] },
  { id: "lung-upper-lobes", label: "lung upper lobes", detail: "apical zones; tuberculosis classically favours these.", territoryKeys: ["lung"] },
  { id: "lung-lower-lobes", label: "lung lower lobes", detail: "basal zones; aspiration pneumonia classically favours these when lying down.", territoryKeys: ["lung"] },
  { id: "kidney-cortex", label: "renal cortex", detail: "outer kidney zone holding the glomeruli.", territoryKeys: ["kidney", "glomerulus"] },
  { id: "kidney-medulla", label: "renal medulla", detail: "inner kidney zone holding the loops of henle and collecting ducts, organised into pyramids.", territoryKeys: ["kidney", "collecting-duct"] },
  { id: "heart-anterior-wall", label: "anterior cardiac wall", detail: "supplied mainly by the left anterior descending coronary artery.", territoryKeys: ["heart", "coronary"] },
  { id: "heart-inferior-wall", label: "inferior cardiac wall", detail: "supplied mainly by the right coronary artery in most people.", territoryKeys: ["heart", "coronary"] },
  { id: "heart-lateral-wall", label: "lateral cardiac wall", detail: "supplied mainly by the left circumflex coronary artery.", territoryKeys: ["heart", "coronary"] },
  { id: "abdomen-ruq", label: "right upper quadrant", detail: "liver, gallbladder, part of the colon.", territoryKeys: ["liver", "gallbladder", "colon"] },
  { id: "abdomen-luq", label: "left upper quadrant", detail: "spleen, stomach, tail of pancreas.", territoryKeys: ["spleen", "stomach", "pancreas"] },
  { id: "abdomen-rlq", label: "right lower quadrant", detail: "appendix, caecum.", territoryKeys: ["colon"] },
  { id: "abdomen-llq", label: "left lower quadrant", detail: "sigmoid colon.", territoryKeys: ["colon"] },
];

export function findRegional(list: RegionalEntry[], id: string): RegionalEntry | undefined {
  return list.find((e) => e.id === id);
}

export function searchRegional(list: RegionalEntry[], query: string): RegionalEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return list;
  return list.filter((e) => e.label.toLowerCase().includes(q) || e.detail.toLowerCase().includes(q));
}
