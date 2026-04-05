import subprocess
import sys
import json
import pathlib

# ── 1. Install playwright if needed ──────────────────────────────────────────
try:
    from playwright.sync_api import sync_playwright
except ImportError:
    print("Installing playwright...")
    subprocess.check_call([
        sys.executable, "-m", "pip", "install", "playwright",
        "--break-system-packages"
    ])
    from playwright.sync_api import sync_playwright

# ── 2. Install Chromium browser ───────────────────────────────────────────────
print("Installing Chromium...")
subprocess.check_call([sys.executable, "-m", "playwright", "install", "chromium"])

# ── 3-8. Browser session ──────────────────────────────────────────────────────
with sync_playwright() as p:
    browser = p.chromium.launch(headless=False)
    context = browser.new_context()
    page = context.new_page()

    # 4. Navigate to LinkedIn login
    print("\nOpening LinkedIn login page...")
    page.goto("https://www.linkedin.com/login")

    # 5 & 6. Wait for login; handle 2FA if it appears
    print("Please log in manually in the browser window.")
    print("Waiting for login to complete...\n")

    while True:
        page.wait_for_timeout(1500)
        url = page.url

        # 2FA checkpoint — LinkedIn shows a PIN/code entry page
        if "checkpoint" in url or "two-step" in url or "verify" in url.lower():
            code = input("Enter the verification code sent to your email/phone: ").strip()
            # Try to fill whichever input is visible for the code
            for selector in [
                "input[name='pin']",
                "input[name='verificationCode']",
                "input[type='text']",
                "input[type='number']",
            ]:
                try:
                    locator = page.locator(selector).first
                    if locator.is_visible(timeout=1000):
                        locator.fill(code)
                        page.keyboard.press("Enter")
                        break
                except Exception:
                    pass
            continue

        if "/feed" in url or "/mynetwork" in url:
            print(f"Login successful! Current URL: {url}")
            break

    # 7. Save cookies
    cookies = context.cookies()
    session_path = pathlib.Path("linkedin_session.json")
    session_path.write_text(json.dumps(cookies, indent=2, ensure_ascii=False))
    print(f"\nSaved {len(cookies)} cookies to {session_path}")

    # 8. Verify session — navigate to Groups
    print("\nVerifying session by navigating to LinkedIn Groups...")
    page.goto("https://www.linkedin.com/groups/")
    page.wait_for_load_state("domcontentloaded")
    page.wait_for_timeout(2000)

    # 9. Count groups
    group_cards = page.locator("a[href*='/groups/']").all()
    # Deduplicate hrefs so we count distinct groups, not repeated nav links
    group_hrefs = {
        a.get_attribute("href")
        for a in group_cards
        if a.get_attribute("href") and "/groups/" in (a.get_attribute("href") or "")
        and a.get_attribute("href") not in ("/groups/", "https://www.linkedin.com/groups/")
    }
    print(f"Groups found: {len(group_hrefs)}")

    browser.close()

# ── 10. Add linkedin_session.json to .gitignore ───────────────────────────────
gitignore = pathlib.Path(".gitignore")
entry = "linkedin_session.json"
if gitignore.exists():
    content = gitignore.read_text(encoding="utf-8")
    if entry not in content:
        gitignore.write_text(content.rstrip() + f"\n\n# LinkedIn session\n{entry}\n",
                             encoding="utf-8")
        print(f"\nAdded '{entry}' to .gitignore")
    else:
        print(f"\n'{entry}' already in .gitignore")
else:
    gitignore.write_text(f"# LinkedIn session\n{entry}\n", encoding="utf-8")
    print(f"\nCreated .gitignore with '{entry}'")

print("\nDone. linkedin_session.json is ready for use.")
