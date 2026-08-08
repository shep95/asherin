import { fusePosition, deriveState } from "@/lib/asher/findMy";
const fixes = [
 { seen_at:"2026-08-08T02:49:41.172193+00:00", lat:40.7135, lng:-74.0072, accuracy_m:18, rssi:-74, distance_m:12.5 },
 { seen_at:"2026-08-08T02:29:41.172193+00:00", lat:40.71293, lng:-74.00605, accuracy_m:9, rssi:-57, distance_m:2 },
 { seen_at:"2026-08-08T02:14:41.172193+00:00", lat:40.7129, lng:-74.0061, accuracy_m:12, rssi:-61, distance_m:3.4 },
];
const now = Date.parse("2026-08-08T02:55:00Z");
console.log("FUSED", JSON.stringify(fusePosition(fixes, now)));
console.log("SINGLE", JSON.stringify(fusePosition([fixes[0]], now)));
console.log("EMPTY", fusePosition([], now));
console.log("STATE nominal", deriveState({ state:"nominal", missing_after_minutes:60 } as any, 5));
console.log("STATE missing", deriveState({ state:"nominal", missing_after_minutes:60 } as any, 500));
console.log("STATE never", deriveState({ state:"nominal", missing_after_minutes:60 } as any, null));
console.log("STATE stolen wins", deriveState({ state:"stolen", missing_after_minutes:60 } as any, 1));
