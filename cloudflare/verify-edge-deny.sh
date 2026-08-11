#!/usr/bin/env bash
# Retest harness for the Asherin edge hardpass (REPORT 1).
# Usage: ./verify-edge-deny.sh [https://asherin.com]
set -uo pipefail

BASE="${1:-https://asherin.com}"
fail=0

deny_paths=(
  "/.git/HEAD" "/.git/config" "/.git/logs/HEAD" "/.svn/entries"
  "/.env" "/.env.local" "/.aws/credentials" "/.ssh/id_rsa"
  "/package.json" "/bun.lockb" "/tsconfig.json" "/vite.config.ts"
  "/backup.sql" "/db.bak" "/private.pem" "/wp-admin/" "/phpmyadmin/"
  "/debug" "/debug/vars" "/api/internal/status" "/rest/v1/" "/functions/v1/"
  "/storage/v1/object/public" "/auth/v1/token" "/graphql/v1"
)
allow_paths=( "/" "/.well-known/security.txt" "/pricing" "/blog" )

echo "== DENY (expect 404 text/plain, no x-deployment-id) =="
for p in "${deny_paths[@]}"; do
  hdr="$(curl -sS -o /tmp/edge_body -D - -m 20 "$BASE$p")"
  code="$(printf '%s' "$hdr" | awk 'NR==1{print $2}')"
  ctype="$(printf '%s' "$hdr" | tr -d '\r' | grep -i '^content-type:' | head -1 | cut -d' ' -f2-)"
  depid="$(printf '%s' "$hdr" | tr -d '\r' | grep -ic '^x-deployment-id:')"
  ok="PASS"
  [[ "$code" == "404" ]] || ok="FAIL"
  [[ "$ctype" == text/plain* ]] || ok="FAIL"
  [[ "$depid" == "0" ]] || ok="FAIL"
  [[ "$ok" == "PASS" ]] || fail=1
  printf '%-6s %-28s %s  %s  depid=%s\n' "$ok" "$p" "$code" "${ctype:-none}" "$depid"
done

echo
echo "== ALLOW (expect 200, app must keep working) =="
for p in "${allow_paths[@]}"; do
  code="$(curl -sS -o /dev/null -w '%{http_code}' -m 20 "$BASE$p")"
  ok="PASS"; [[ "$code" == "200" ]] || { ok="FAIL"; fail=1; }
  printf '%-6s %-28s %s\n' "$ok" "$p" "$code"
done

echo
echo "== SECURITY HEADERS on / (expect all present) =="
hdr="$(curl -sS -o /dev/null -D - -m 20 "$BASE/" | tr -d '\r')"
for h in content-security-policy x-frame-options x-content-type-options referrer-policy strict-transport-security permissions-policy; do
  if printf '%s' "$hdr" | grep -qi "^$h:"; then printf 'PASS   %s\n' "$h"; else printf 'FAIL   %s missing\n' "$h"; fail=1; fi
done
if printf '%s' "$hdr" | grep -i '^content-security-policy:' | grep -q "frame-ancestors 'none'"; then
  echo "PASS   csp frame-ancestors 'none'"
else
  echo "FAIL   csp frame-ancestors missing"; fail=1
fi

echo
[[ $fail -eq 0 ]] && echo "ALL CHECKS PASSED" || echo "CHECKS FAILED — edge deny not fully applied"
exit $fail
