#!/usr/bin/env python3
"""Project audit script — prints PASS/WARN/FAIL for each check and saves audit_report.json."""

import json
import os
import sys
from datetime import datetime, timezone

ROOT = os.path.dirname(os.path.abspath(__file__))

results = []


def read_file(rel_path):
    """Return file contents as str, or None if missing."""
    try:
        with open(os.path.join(ROOT, rel_path), encoding="utf-8") as f:
            return f.read()
    except FileNotFoundError:
        return None


def check(label, status, detail=""):
    """Record and print one check result."""
    assert status in ("PASS", "WARN", "FAIL")
    icon = {"PASS": "[PASS]", "WARN": "[WARN]", "FAIL": "[FAIL]"}[status]
    msg = f"{icon} {label}"
    if detail:
        msg += f"  ({detail})"
    print(msg)
    results.append({"label": label, "status": status, "detail": detail})


# ── 1. route.js exists ────────────────────────────────────────────────────────
route_path = "app/api/claude/route.js"
route_src = read_file(route_path)
if route_src is not None:
    check("app/api/claude/route.js exists", "PASS")
else:
    check("app/api/claude/route.js exists", "FAIL", "file not found")

# ── 2. route.js contains process.env.ANTHROPIC_API_KEY ───────────────────────
if route_src is None:
    check("route.js uses process.env.ANTHROPIC_API_KEY", "FAIL", "file missing — cannot check")
elif "process.env.ANTHROPIC_API_KEY" in route_src:
    check("route.js uses process.env.ANTHROPIC_API_KEY", "PASS")
else:
    check("route.js uses process.env.ANTHROPIC_API_KEY", "FAIL", "string not found in route.js")

# ── 3. route.js does NOT read apiKey from request body ───────────────────────
if route_src is None:
    check("route.js does NOT read apiKey from request body", "FAIL", "file missing — cannot check")
else:
    # Check for apiKey being destructured from the request body
    bad_patterns = ['"apiKey"', "{ apiKey", "{apiKey"]
    found = [p for p in bad_patterns if p in route_src]
    if not found:
        check("route.js does NOT read apiKey from request body", "PASS")
    else:
        check("route.js does NOT read apiKey from request body", "FAIL",
              f"found patterns: {found}")

# ── 4. App.jsx fetch body does NOT contain apiKey ────────────────────────────
app_src = read_file("src/App.jsx")
if app_src is None:
    check("src/App.jsx fetch body has no apiKey", "WARN", "file not found")
else:
    # Look for apiKey inside a JSON.stringify / fetch body context
    import re
    # Match `apiKey` as a JSON key inside body: JSON.stringify({...apiKey...})
    fetch_bodies = re.findall(r"JSON\.stringify\(\{([^}]*)\}", app_src)
    has_api_key_in_body = any("apiKey" in b for b in fetch_bodies)
    if not has_api_key_in_body:
        check("src/App.jsx fetch body has no apiKey", "PASS")
    else:
        check("src/App.jsx fetch body has no apiKey", "WARN",
              "apiKey found inside JSON.stringify({...})")

# ── 5. App.jsx does NOT save API key to localStorage ─────────────────────────
if app_src is None:
    check("src/App.jsx does NOT save API key to localStorage", "WARN", "file not found")
else:
    bad = [p for p in ["digest_claude_key", "claudeKey"] if p in app_src and "localStorage" in app_src]
    # More precise: check for localStorage.setItem with key-related strings
    ls_set = re.findall(r'localStorage\.setItem\([^)]+\)', app_src)
    has_key_save = any("claude" in s.lower() or "apikey" in s.lower() for s in ls_set)
    if not has_key_save:
        check("src/App.jsx does NOT save API key to localStorage", "PASS")
    else:
        check("src/App.jsx does NOT save API key to localStorage", "WARN",
              f"suspicious localStorage.setItem calls: {ls_set}")

# ── 6. DataDigestApp.jsx does NOT exist in root ──────────────────────────────
if not os.path.exists(os.path.join(ROOT, "DataDigestApp.jsx")):
    check("DataDigestApp.jsx does NOT exist in root", "PASS")
else:
    check("DataDigestApp.jsx does NOT exist in root", "FAIL", "file found at root")

# ── 7. api/claude.js does NOT exist ──────────────────────────────────────────
if not os.path.exists(os.path.join(ROOT, "api", "claude.js")):
    check("api/claude.js does NOT exist", "PASS")
else:
    check("api/claude.js does NOT exist", "FAIL", "file exists at api/claude.js")

# ── 8. .gitignore contains required entries ──────────────────────────────────
gitignore_src = read_file(".gitignore") or ""
required_entries = ["secrets.py", "*.session", ".env", ".next"]
for entry in required_entries:
    lines = [l.strip() for l in gitignore_src.splitlines()]
    if any(l == entry for l in lines):
        check(f".gitignore contains '{entry}'", "PASS")
    else:
        check(f".gitignore contains '{entry}'", "FAIL",
              f"'{entry}' not found as a standalone line in .gitignore")

# ── 9. last_report.json is in .gitignore ─────────────────────────────────────
lines = [l.strip() for l in gitignore_src.splitlines()]
if "last_report.json" in lines:
    check("last_report.json is in .gitignore", "PASS")
else:
    check("last_report.json is in .gitignore", "WARN",
          "'last_report.json' not found in .gitignore")

# ── Summary ───────────────────────────────────────────────────────────────────
counts = {"PASS": 0, "WARN": 0, "FAIL": 0}
for r in results:
    counts[r["status"]] += 1

print()
print("-" * 50)
print(f"  PASS: {counts['PASS']}   WARN: {counts['WARN']}   FAIL: {counts['FAIL']}")
print("-" * 50)

# ── Save JSON report ──────────────────────────────────────────────────────────
report = {
    "generated_at": datetime.now(timezone.utc).isoformat(),
    "summary": counts,
    "checks": results,
}
report_path = os.path.join(ROOT, "audit_report.json")
with open(report_path, "w", encoding="utf-8") as f:
    json.dump(report, f, ensure_ascii=False, indent=2)
print(f"  Report saved to audit_report.json")

sys.exit(1 if counts["FAIL"] > 0 else 0)
