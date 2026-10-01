#!/usr/bin/env bash
# n8n Package Audit — Hermes-friendly report
# Runs audit:prod and formats a concise Telegram-ready summary
set -uo pipefail

cd "$(dirname "$0")/.."

echo "=== n8n Package Audit — $(date -u +%Y-%m-%d) ==="

# Run audit, capture output AND the real exit status. Do not swallow a
# non-zero audit:prod exit — a broken/erroring audit must surface as a
# failure, not as silent zero counts.
OUTPUT=$(npm run audit:prod 2>&1)
AUDIT_EXIT=$?

# Count results. grep -c already prints "0" on no match (and exits 1).
# Under `pipefail`, a bare "|| echo 0" fallback then prints a SECOND "0",
# turning PASS/FAIL/WARN into two-line values ("0\n0") that break the
# `[[ ... -gt 0 ]]` comparison below with a syntax error. Use "|| true" to
# only suppress the non-zero pipeline status, without adding output.
PASS=$(printf '%s\n' "$OUTPUT" | grep -c "✓\|PASS\|pass\|OK" || true)
FAIL=$(printf '%s\n' "$OUTPUT" | grep -c "✗\|FAIL\|fail\|ERROR\|error" || true)
WARN=$(printf '%s\n' "$OUTPUT" | grep -c "WARN\|warn\|⚠" || true)

echo "Results: $PASS pass | $FAIL fail | $WARN warn (audit:prod exit code: $AUDIT_EXIT)"

if [[ "$AUDIT_EXIT" -ne 0 ]]; then
    echo ""
    echo "ERROR: npm run audit:prod exited with status $AUDIT_EXIT — treat this run as FAILED regardless of the pass/fail/warn counts above."
fi

# Show failures and warnings (first 20 lines of bad output)
if [[ "$FAIL" -gt 0 || "$WARN" -gt 0 || "$AUDIT_EXIT" -ne 0 ]]; then
    echo ""
    echo "Issues:"
    printf '%s\n' "$OUTPUT" | grep -E "✗|FAIL|fail|ERROR|error|WARN|warn|⚠" | head -20 || true
fi

# Show last 5 lines of full output for context
echo ""
echo "Summary:"
printf '%s\n' "$OUTPUT" | tail -5

exit "$AUDIT_EXIT"
