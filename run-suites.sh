#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Run every preview suite and report an HONEST total.
#
# Why this exists: a hand-rolled `for` loop that greps for a summary line
# silently scores a CRASHED suite as "0 passed / 0 failed". Seven broken
# suites once hid behind a green-looking total that way. This runner treats a
# missing summary as a hard failure, which is what it is.
#
# Usage:  ./run-suites.sh            # all suites
#         ./run-suites.sh inbox dest # named suites only
# ---------------------------------------------------------------------------
set -u
cd "$(dirname "$0")"

bash ./sync.sh > /dev/null || { echo "sync.sh FAILED"; exit 1; }
cd preview || exit 1

ALL="access admin alerts apic arena arenapulse menusheet shopbuilder dukabook trust personal membersdesk fees rewards gate mshikano batch1 camp circleops capture commerce chain dest econ engine feedcards group groupui inbox ing joins loops media nav news onboard orchestration parse person pmatch pure pursuit quests resale routes session stories sys"
SUITES="${*:-$ALL}"

tot_p=0; tot_f=0; broken=""

for f in $SUITES; do
  if ! npx esbuild "$f.jsx" --bundle --platform=node --outfile=".tmp.$f.cjs" \
       --format=cjs --loader:.tsx=tsx --loader:.webp=empty --external:jsdom > ".tmp.$f.build" 2>&1; then
    printf "  %-9s BUILD FAILED\n" "$f"
    head -5 ".tmp.$f.build" | sed 's/^/      /'
    broken="$broken $f"; rm -f ".tmp.$f.cjs" ".tmp.$f.build"; continue
  fi
  rm -f ".tmp.$f.build"

  out=$(timeout 180 node ".tmp.$f.cjs" 2>&1); code=$?
  rm -f ".tmp.$f.cjs"

  line=$(echo "$out" | grep -Ei "^(pass [0-9]+|PASSED [0-9]+)" | tail -1)
  p=$(echo "$line" | grep -oEi "(pass|PASSED) +[0-9]+" | grep -oE "[0-9]+")
  fl=$(echo "$line" | grep -oEi "(fail|FAILED) +[0-9]+" | grep -oE "[0-9]+")

  # No summary line means the suite died before finishing. Never score it 0/0.
  if [ -z "$line" ]; then
    printf "  %-9s CRASHED / NO SUMMARY (exit %s)\n" "$f" "$code"
    echo "$out" | grep -E "TypeError|ReferenceError|Error:" | head -3 | sed 's/^/      /'
    broken="$broken $f"; continue
  fi

  printf "  %-9s %4s passed  %4s failed\n" "$f" "${p:-0}" "${fl:-0}"
  [ "${fl:-0}" != "0" ] && echo "$out" | grep "FAIL " | head -8 | sed 's/^/      /'
  tot_p=$((tot_p + ${p:-0})); tot_f=$((tot_f + ${fl:-0}))
done

echo "-------------------------------------------------"
echo "TOTAL: $tot_p passed / $tot_f failed"
if [ -n "$broken" ]; then
  echo "CRASHED SUITES:$broken"
  echo "RESULT: NOT GREEN"
  exit 1
fi
[ "$tot_f" != "0" ] && { echo "RESULT: NOT GREEN"; exit 1; }
echo "RESULT: GREEN"
