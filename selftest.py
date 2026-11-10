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
              "js/admin.js", "js/scanner.js", "supabase/migrations/0001_init.sql",
              "supabase/migrations/0002_email_status.sql", "supabase/functions/send-confirmation/index.ts", "README.md"]
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
    refs = re.findall(r'(?:src|href)="((?!https?:|#|mailto:)[^"?]+\.(?:js|css|jpg|png))(?:\?[^"]*)?"', html)
    for ref in refs:
        check(f"{page} references {ref}", (ROOT / ref).is_file())
    check(page + " has viewport meta", 'name="viewport"' in html)
    check(page + " has doctype", html.lstrip().lower().startswith("<!doctype html>"))

# 2b. cache-busting: every local css/js link carries the same ?v= stamp in both pages
stamps = set(re.findall(r'(?:css/style\.css|js/\w+\.js)\?v=([A-Za-z0-9]+)"', read("index.html") + read("admin.html")))
check("asset links carry the same ?v= stamp", len(stamps) == 1, f"{stamps}")

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
check("config has no service_role or Resend key", "service_role" not in cfg and not re.search(r"\bre_[A-Za-z0-9_]{20,}", cfg) and not re.search(r"eyJ[A-Za-z0-9_-]{30,}\.eyJ", cfg))
check("config has the Supabase and contact settings", all(k in cfg for k in ["SUPABASE_URL", "SUPABASE_ANON_KEY", "CONTACT_EMAIL"]))
for rel in TEXT_FILES:
    txt = read(rel)
    check("no secret-looking token in " + rel, not re.search(r"(sb_secret_|service_role|sk_live_|ghp_[A-Za-z0-9]{20,})", txt))

# 6. no em dashes anywhere (ORIGIN rule)
for rel in TEXT_FILES:
    check("no em dash in " + rel, "—" not in read(rel))

# 7. schema: RLS, explicit grants, guest functions granted to anon, anon has no table rights
sql = read("supabase/migrations/0001_init.sql")
check("schema enables RLS", "enable row level security" in sql)
check("schema revokes table from anon", re.search(r"revoke all on table public\.rsvps from anon", sql) is not None)
check("schema grants authenticated", "grant select, insert, update on table public.rsvps to authenticated" in sql)
for fn in ["rsvp_register", "rsvp_lookup", "rsvp_mark_emailed"]:
    check(f"0001 defines and grants {fn}", f"function public.{fn}(" in sql and re.search(rf"grant execute on function public\.{fn}\(.*to anon, authenticated", sql) is not None)
check("schema functions are security definer", sql.count("security definer") >= 3)

# 8. the pages call the functions the schema defines
rsvp_js = read("js/rsvp.js")
for fn in ["rsvp_register", "rsvp_lookup"]:
    check(f"rsvp.js calls {fn}", f"rpc('{fn}'" in rsvp_js)
check("rsvp.js never reads the table directly", ".from('rsvps')" not in rsvp_js)
for rel in ["index.html", "admin.html", "js/rsvp.js", "js/admin.js", "js/config.js"]:
    check("no EmailJS left in " + rel, "emailjs" not in read(rel).lower())

# 8b. Resend path: migration 0002, the edge function, the dashboard resend button
m2 = read("supabase/migrations/0002_email_status.sql")
check("0002 adds email_attempts and email_error", "email_attempts" in m2 and "email_error" in m2)
check("0002 drops rsvp_mark_emailed", "drop function if exists public.rsvp_mark_emailed" in m2)
check("0002 schedules the hourly catch-up", "cron.schedule" in m2 and "send-confirmation" in m2)
fn_src = read("supabase/functions/send-confirmation/index.ts")
check("function reads RESEND_API_KEY from secrets", 'Deno.env.get("RESEND_API_KEY")' in fn_src and not re.search(r"\bre_[A-Za-z0-9_]{20,}", fn_src))
check("function re-reads the row and skips sent ones", 'from("rsvps").select("*")' in fn_src and "already sent" in fn_src)
check("function replies to the committee mailbox", "eventmastersxjll@gmail.com" in fn_src)
check("function venue matches config", "Golden Bay Fresh Seafood Restaurant, Pasay City" in fn_src and "Golden Bay Fresh Seafood Restaurant, Pasay City" in cfg)
admin_js = read("js/admin.js")
check("admin.js has the Resend button calling the function", "functions.invoke('send-confirmation'" in admin_js)
check("admin.js shows email status", "emailMark" in admin_js)
check("function carries the client's thank-you text", "Thank you for confirming your attendance" in fn_src and "Diosdado Macapagal" in fn_src)
idx = read("index.html")
check("index.html has the done pop-up", 'id="doneModal"' in idx and "No need to register again" in idx)
check("rsvp.js opens the pop-up after a new RSVP", "showDone(res)" in rsvp_js)
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
