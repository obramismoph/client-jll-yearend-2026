"""Self-test for the ONE JLL Year-End Party 2026 RSVP site (TOOL_STANDARD rule 4).
Runs without a database or network. Usage: python selftest.py
"""
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
FORM_LINES = [  # the client's Google Form dropdown, 2026-11-09
    "Business Support", "Capital Markets", "Leasing Advisory", "PDS", "Property Management",
    "Research & Strategic Consulting", "Workplace Management", "VIP Guest", "Others",
]
TEXT_FILES = ["index.html", "admin.html", "css/style.css", "js/config.js", "js/rsvp.js",
              "js/admin.js", "js/scanner.js", "supabase/schema.sql", "README.md"]
checks = []


def check(name, ok, detail=""):
    checks.append(ok)
    print(("ok   " if ok else "FAIL ") + name + ("" if ok or not detail else ": " + detail))


def read(rel):
    return (ROOT / rel).read_text(encoding="utf-8")


# 1. files exist
for rel in TEXT_FILES + ["assets/poster.jpg", ".gitignore"]:
    check("exists " + rel, (ROOT / rel).is_file())

# 2. every local script/css/img referenced by the pages exists
for page in ["index.html", "admin.html"]:
    html = read(page)
    refs = re.findall(r'(?:src|href)="((?!https?:|#|mailto:)[^"]+\.(?:js|css|jpg|png))"', html)
    for ref in refs:
        check(f"{page} references {ref}", (ROOT / ref).is_file())
    check(page + " has viewport meta", 'name="viewport"' in html)
    check(page + " has doctype", html.lstrip().lower().startswith("<!doctype html>"))

# 3. JavaScript parses
for js in ["js/config.js", "js/rsvp.js", "js/admin.js", "js/scanner.js"]:
    r = subprocess.run(["node", "--check", str(ROOT / js)], capture_output=True, text=True)
    check("node --check " + js, r.returncode == 0, r.stderr.strip()[:200])

# 4. business lines match the Google Form exactly, in order
cfg = read("js/config.js")
m = re.search(r"BUSINESS_LINES:\s*\[(.*?)\]", cfg, re.S)
lines = re.findall(r"'([^']+)'", m.group(1)) if m else []
check("business lines match the Google Form", lines == FORM_LINES, f"{lines}")

# 5. no secrets, no service-role key, placeholders are the YOUR_ pattern
check("config has no service_role key", "service_role" not in cfg and not re.search(r"eyJ[A-Za-z0-9_-]{30,}\.eyJ", cfg))
check("config placeholders use YOUR_", all(k in cfg for k in ["SUPABASE_URL", "SUPABASE_ANON_KEY", "EMAILJS_PUBLIC_KEY"]))
for rel in TEXT_FILES:
    txt = read(rel)
    check("no secret-looking token in " + rel, not re.search(r"(sb_secret_|service_role|sk_live_|ghp_[A-Za-z0-9]{20,})", txt))

# 6. no em dashes anywhere (ORIGIN rule)
for rel in TEXT_FILES:
    check("no em dash in " + rel, "—" not in read(rel))

# 7. schema: RLS, explicit grants, guest functions granted to anon, anon has no table rights
sql = read("supabase/schema.sql")
check("schema enables RLS", "enable row level security" in sql)
check("schema revokes table from anon", re.search(r"revoke all on table public\.rsvps from anon", sql) is not None)
check("schema grants authenticated", "grant select, insert, update on table public.rsvps to authenticated" in sql)
for fn in ["rsvp_register", "rsvp_lookup", "rsvp_mark_emailed"]:
    check(f"schema defines and grants {fn}", f"function public.{fn}(" in sql and re.search(rf"grant execute on function public\.{fn}\(.*to anon, authenticated", sql) is not None)
check("schema functions are security definer", sql.count("security definer") >= 3)

# 8. the pages call the functions the schema defines
rsvp_js = read("js/rsvp.js")
for fn in ["rsvp_register", "rsvp_lookup", "rsvp_mark_emailed"]:
    check(f"rsvp.js calls {fn}", f"rpc('{fn}'" in rsvp_js)
check("rsvp.js never reads the table directly", ".from('rsvps')" not in rsvp_js)
check("rsvp.js sends the QR url in the email", "qr_url" in rsvp_js)
check("scanner id pattern matches walk-in ids too", "JLL-W?" in read("js/scanner.js"))

# 9. size limits (TOOL_STANDARD rule 3), soft at 450 lines
for rel in TEXT_FILES:
    n = read(rel).count("\n") + 1
    check(f"{rel} under 450 lines ({n})", n <= 450)

# 10. the form fields the client asked for are all present
idx = read("index.html")
for fid in ["lastName", "firstName", "businessLine", "email", "contact"]:
    check(f"index.html has field {fid}", f'id="{fid}"' in idx)

total, passed = len(checks), sum(checks)
print(f"\n{passed}/{total} checks passed")
sys.exit(0 if passed == total else 1)
