import { emailHash, canonicalizeEmail, isInternalProEmail, isStaffEmail, sha256Hex } from "./supabase/functions/_shared/identityHash.ts";
console.log("abc =", sha256Hex("abc"));
const inputs = ["a"+"shernewtonx@gmail.com", "S"+"hepherdnewtonx@Gmail.com  ", "a.s.hernewtonx+ops@googlemail.com", "randomuser9182@gmail.com"];
for (const i of inputs) console.log(JSON.stringify(i), canonicalizeEmail(i), emailHash(i), "pro=",isInternalProEmail(i), "staff=",isStaffEmail(i));
console.log("null pro=", isInternalProEmail(null), "empty staff=", isStaffEmail(""));
