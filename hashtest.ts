(globalThis as any).Deno = { env: { get: (k: string) => process.env[k] } };
const m = await import("./supabase/functions/_shared/identityHash.ts");
console.log("abc =", m.sha256Hex("abc"));
for (const i of ["a"+"shernewtonx@gmail.com", "S"+"hepherdnewtonx@Gmail.com  ", "a.s"+"hernewtonx+ops@googlemail.com", "randomuser9182@gmail.com"])
  console.log(JSON.stringify(i), "->", m.canonicalizeEmail(i), m.emailHash(i), "pro=", m.isInternalProEmail(i), "staff=", m.isStaffEmail(i));
console.log("null pro=", m.isInternalProEmail(null), "empty staff=", m.isStaffEmail(""));
console.log("product=", m.INTERNAL_PRO_PRODUCT_ID);
