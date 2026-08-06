// IMAGINE INTELLIGENCE — STAGE 4 SUPPORT: ASTRONOMICAL ADJUDICATION
//
// Deterministic solar-position mathematics (NOAA Solar Calculator formulation).
// The vision model may claim "shadows point north-east, so it is mid-morning" —
// that claim is only admissible if the sun could physically be in that position
// at the hypothesised latitude/longitude/date. This module answers that question
// with arithmetic instead of belief.
//
// All times are UTC. Callers must never pass a "GMT+N" style string.

export interface SolarPosition {
  /** Degrees above the horizon; negative means the sun is down. */
  elevationDeg: number;
  /** Degrees clockwise from true north (0 = N, 90 = E, 180 = S, 270 = W). */
  azimuthDeg: number;
}

const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

function julianDay(date: Date): number {
  return date.getTime() / 86_400_000 + 2440587.5;
}

/** NOAA solar position for a UTC instant at a geodetic point. */
export function solarPosition(date: Date, latDeg: number, lonDeg: number): SolarPosition {
  const jd = julianDay(date);
  const t = (jd - 2451545.0) / 36525.0; // Julian centuries since J2000.0

  const meanLong = (280.46646 + t * (36000.76983 + t * 0.0003032)) % 360;
  const meanAnom = 357.52911 + t * (35999.05029 - 0.0001537 * t);
  const eccent = 0.016708634 - t * (0.000042037 + 0.0000001267 * t);

  const sunEqCtr =
    Math.sin(rad(meanAnom)) * (1.914602 - t * (0.004817 + 0.000014 * t)) +
    Math.sin(rad(2 * meanAnom)) * (0.019993 - 0.000101 * t) +
    Math.sin(rad(3 * meanAnom)) * 0.000289;

  const trueLong = meanLong + sunEqCtr;
  const omega = 125.04 - 1934.136 * t;
  const appLong = trueLong - 0.00569 - 0.00478 * Math.sin(rad(omega));

  const meanObliq = 23 + (26 + (21.448 - t * (46.815 + t * (0.00059 - t * 0.001813))) / 60) / 60;
  const obliqCorr = meanObliq + 0.00256 * Math.cos(rad(omega));

  const declination = deg(Math.asin(Math.sin(rad(obliqCorr)) * Math.sin(rad(appLong))));

  const y = Math.tan(rad(obliqCorr / 2)) ** 2;
  const eqTime =
    4 *
    deg(
      y * Math.sin(2 * rad(meanLong)) -
        2 * eccent * Math.sin(rad(meanAnom)) +
        4 * eccent * y * Math.sin(rad(meanAnom)) * Math.cos(2 * rad(meanLong)) -
        0.5 * y * y * Math.sin(4 * rad(meanLong)) -
        1.25 * eccent * eccent * Math.sin(2 * rad(meanAnom)),
    );

  const utcMinutes = date.getUTCHours() * 60 + date.getUTCMinutes() + date.getUTCSeconds() / 60;
  const trueSolarTime = (utcMinutes + eqTime + 4 * lonDeg + 1440) % 1440;
  const hourAngle = trueSolarTime / 4 < 0 ? trueSolarTime / 4 + 180 : trueSolarTime / 4 - 180;

  const zenith = deg(
    Math.acos(
      Math.min(
        1,
        Math.max(
          -1,
          Math.sin(rad(latDeg)) * Math.sin(rad(declination)) +
            Math.cos(rad(latDeg)) * Math.cos(rad(declination)) * Math.cos(rad(hourAngle)),
        ),
      ),
    ),
  );
  const elevation = 90 - zenith;

  let azimuth: number;
  const denom = Math.cos(rad(latDeg)) * Math.sin(rad(zenith));
  if (Math.abs(denom) > 1e-9) {
    const c = Math.min(
      1,
      Math.max(-1, (Math.sin(rad(latDeg)) * Math.cos(rad(zenith)) - Math.sin(rad(declination))) / denom),
    );
    azimuth = hourAngle > 0 ? (deg(Math.acos(c)) + 180) % 360 : (540 - deg(Math.acos(c))) % 360;
  } else {
    azimuth = latDeg > 0 ? 180 : 0;
  }

  return { elevationDeg: Math.round(elevation * 10) / 10, azimuthDeg: Math.round(azimuth * 10) / 10 };
}

const COMPASS: Record<string, number> = {
  N: 0, NNE: 22.5, NE: 45, ENE: 67.5, E: 90, ESE: 112.5, SE: 135, SSE: 157.5,
  S: 180, SSW: 202.5, SW: 225, WSW: 247.5, W: 270, WNW: 292.5, NW: 315, NNW: 337.5,
};

/** Parse "NE", "north-east", "approximately WSW" → bearing degrees, or null. */
export function bearingFromText(text: string | null | undefined): number | null {
  if (!text) return null;
  const t = text.toLowerCase();
  const numeric = t.match(/(\d{1,3}(?:\.\d+)?)\s*(?:°|deg)/);
  if (numeric) {
    const v = parseFloat(numeric[1]);
    if (v >= 0 && v <= 360) return v % 360;
  }
  const spelled = t
    .replace(/north/g, "n").replace(/south/g, "s")
    .replace(/east/g, "e").replace(/west/g, "w")
    .replace(/[^nsew]/g, "");
  // Longest compass token wins so "nne" is not read as "n".
  const keys = Object.keys(COMPASS).sort((a, b) => b.length - a.length);
  for (const k of keys) {
    if (spelled.includes(k.toLowerCase())) return COMPASS[k];
  }
  return null;
}

export interface SolarVerification {
  checked: boolean;
  consistent: boolean | null;
  /** Confidence delta the adjudicator should apply, clamped to [-25, +12]. */
  confidenceDelta: number;
  sunElevationDeg?: number;
  sunAzimuthDeg?: number;
  expectedShadowBearingDeg?: number;
  claimedShadowBearingDeg?: number;
  bearingErrorDeg?: number;
  verdict: string;
}

/**
 * Verify a model's shadow/time claim against real solar geometry.
 *
 * `claimedLocalTime` is camera-local wall time ("14:30"); it is converted to UTC
 * using the longitude-derived solar offset, which is the honest approximation
 * when the political time zone is unknown (± up to ~1h from zone/DST politics —
 * absorbed by the tolerance band below).
 */
export function verifySolarClaim(args: {
  lat: number;
  lon: number;
  isoDate?: string | null;
  claimedLocalTime?: string | null;
  claimedShadowDirection?: string | null;
  claimedSunPosition?: string | null;
}): SolarVerification {
  const { lat, lon, isoDate, claimedLocalTime, claimedShadowDirection, claimedSunPosition } = args;

  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    return { checked: false, consistent: null, confidenceDelta: 0, verdict: "No usable coordinate to verify against." };
  }
  const timeMatch = (claimedLocalTime || "").match(/(\d{1,2})[:h.](\d{2})\s*(am|pm)?/i);
  if (!timeMatch) {
    return { checked: false, consistent: null, confidenceDelta: 0, verdict: "No parsable local-time claim — solar check not applicable." };
  }
  let hour = parseInt(timeMatch[1], 10);
  const minute = parseInt(timeMatch[2], 10);
  const ampm = (timeMatch[3] || "").toLowerCase();
  if (ampm === "pm" && hour < 12) hour += 12;
  if (ampm === "am" && hour === 12) hour = 0;
  if (hour > 23 || minute > 59) {
    return { checked: false, consistent: null, confidenceDelta: 0, verdict: "Time claim out of range — solar check skipped." };
  }

  // Date: EXIF/model date when supplied, otherwise today (UTC) as the least-assumption default.
  const base = isoDate && /^\d{4}-\d{2}-\d{2}/.test(isoDate) ? new Date(`${isoDate.slice(0, 10)}T00:00:00Z`) : new Date();
  if (Number.isNaN(base.getTime())) {
    return { checked: false, consistent: null, confidenceDelta: 0, verdict: "Unparsable capture date — solar check skipped." };
  }
  const solarOffsetHours = lon / 15;
  const utcInstant = new Date(base.getTime() + (hour + minute / 60 - solarOffsetHours) * 3_600_000);

  const pos = solarPosition(utcInstant, lat, lon);
  const expectedShadow = (pos.azimuthDeg + 180) % 360;
  const claimed = bearingFromText(claimedShadowDirection);

  const notes: string[] = [];
  let delta = 0;
  let consistent: boolean | null = null;

  // Check 1 — is the sun even up at the claimed hour?
  const claimsShadows = Boolean(claimedShadowDirection) || /sun|shadow|overhead|horizon/i.test(claimedSunPosition || "");
  if (pos.elevationDeg < -0.833) {
    if (claimsShadows) {
      consistent = false;
      delta -= 18;
      notes.push(
        `Sun is ${Math.abs(pos.elevationDeg).toFixed(1)}° BELOW the horizon at ${claimedLocalTime} for this coordinate — a sunlit-shadow reading is impossible. Either the time estimate or the location is wrong.`,
      );
    } else {
      notes.push(`Sun below horizon at the claimed hour; consistent with a night scene.`);
      consistent = true;
      delta += 2;
    }
  } else if (claimed === null) {
    notes.push(
      `Sun elevation ${pos.elevationDeg.toFixed(1)}°, azimuth ${pos.azimuthDeg.toFixed(1)}° — geometry computed, but the report gave no shadow bearing to test.`,
    );
  } else {
    // Check 2 — does the claimed shadow bearing match the computed anti-solar bearing?
    let err = Math.abs(((claimed - expectedShadow + 540) % 360) - 180);
    err = Math.round(err * 10) / 10;
    // Tolerance band: 35° absorbs time-zone/DST politics and the model's coarse
    // compass vocabulary; beyond 75° the claim contradicts physics.
    if (err <= 35) {
      consistent = true;
      delta += 12;
      notes.push(
        `Shadow bearing ${claimed.toFixed(0)}° matches the computed anti-solar bearing ${expectedShadow.toFixed(0)}° (Δ${err}°) at ${claimedLocalTime}. Time and coordinate are mutually consistent.`,
      );
    } else if (err <= 75) {
      consistent = null;
      delta -= 6;
      notes.push(
        `Shadow bearing ${claimed.toFixed(0)}° is Δ${err}° off the computed anti-solar bearing ${expectedShadow.toFixed(0)}°. Marginal — plausible only if the time estimate is off by 2-3 hours.`,
      );
    } else {
      consistent = false;
      delta -= 22;
      notes.push(
        `Shadow bearing ${claimed.toFixed(0)}° contradicts the computed anti-solar bearing ${expectedShadow.toFixed(0)}° (Δ${err}°). The location/time pair fails astronomical validation.`,
      );
    }
  }

  return {
    checked: true,
    consistent,
    confidenceDelta: Math.max(-25, Math.min(12, delta)),
    sunElevationDeg: pos.elevationDeg,
    sunAzimuthDeg: pos.azimuthDeg,
    expectedShadowBearingDeg: Math.round(expectedShadow),
    claimedShadowBearingDeg: claimed === null ? undefined : Math.round(claimed),
    bearingErrorDeg:
      claimed === null ? undefined : Math.round(Math.abs(((claimed - expectedShadow + 540) % 360) - 180)),
    verdict: notes.join(" "),
  };
}
