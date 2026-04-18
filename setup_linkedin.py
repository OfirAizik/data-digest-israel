# -*- coding: utf-8 -*-
"""
setup_linkedin.py
One-time LinkedIn session setup.
Run once manually to save cookies → linkedin_session.json
"""
import json
import subprocess
import sys
import os

# ── Install playwright if missing ──────────────────────────────
try:
    from playwright.sync_api import sync_playwright
except ImportError:
    print("Installing playwright...")
    subprocess.check_call([sys.executable, "-m", "pip", "install", "playwright", "--break-system-packages"])
    subprocess.check_call([sys.executable, "-m", "playwright", "install", "chromium"])
    from playwright.sync_api import sync_playwright

SESSION_FILE = "linkedin_session.json"
GITIGNORE    = ".gitignore"

def ensure_gitignore():
    entries = [SESSION_FILE, "linkedin_session.json"]
    if os.path.exists(GITIGNORE):
        with open(GITIGNORE, "r", encoding="utf-8") as f:
            content = f.read()
    else:
        content = ""
    added = []
    for entry in entries:
        if entry not in content:
            content += f"\n{entry}"
            added.append(entry)
    with open(GITIGNORE, "w", encoding="utf-8") as f:
        f.write(content)
    if added:
        print(f"Added to .gitignore: {', '.join(added)}")

def handle_2fa(page):
    """Detect 2FA checkpoint and ask user for code."""
    for _ in range(60):  # wait up to 90 seconds
        url = page.url
        if any(x in url for x in ["checkpoint", "two-step", "verify", "challenge"]):
            print("\n⚠️  LinkedIn is asking for verification.")
            code = input("Enter the verification code sent to your email/phone: ").strip()
            # Try to find the code input and fill it
            for selector in ["input[name='pin']", "input[id*='input']", "input[type='text']", "input[type='number']"]:
                try:
                    el = page.locator(selector).first
                    if el.is_visible():
                        el.fill(code)
                        page.keyboard.press("Enter")
                        print("Code submitted. Waiting for login...")
                        page.wait_for_timeout(3000)
                        return
                except Exception:
                    pass
            print("Could not auto-fill code. Please fill it manually in the browser.")
            input("Press Enter when done...")
            return
        page.wait_for_timeout(1500)

def wait_for_login(page):
    """Poll until user is logged in."""
    print("\n🌐 Browser opened. Please log in to LinkedIn.")
    print("Waiting for you to complete login...\n")
    for _ in range(200):  # up to 5 minutes
        url = page.url
        if any(x in url for x in ["/feed", "/mynetwork", "/in/", "/jobs"]):
            print("✅ Login detected!")
            return True
        handle_2fa(page)
        page.wait_for_timeout(1500)
    return False

def count_groups(page):
    """Navigate to groups page and count joined groups."""
    try:
        page.goto("https://www.linkedin.com/groups/", wait_until="domcontentloaded", timeout=15000)
        page.wait_for_timeout(3000)
        # Find group links
        links = page.locator("a[href*='/groups/']").all()
        group_urls = set()
        for link in links:
            href = link.get_attribute("href") or ""
            # Filter out nav/utility links - real groups have numeric IDs
            if "/groups/" in href and any(c.isdigit() for c in href):
                group_urls.add(href.split("?")[0])
        return list(group_urls)
    except Exception as e:
        print(f"Warning: Could not count groups: {e}")
        return []

def main():
    ensure_gitignore()

    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=False,
            args=["--start-maximized"],
        )
        context = browser.new_context(
            viewport={"width": 1280, "height": 800},
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        )
        page = context.new_page()
        page.goto("https://www.linkedin.com/login", wait_until="domcontentloaded")

        logged_in = wait_for_login(page)
        if not logged_in:
            print("❌ Login timeout. Please run again.")
            browser.close()
            return

        # Save session
        cookies = context.cookies()
        with open(SESSION_FILE, "w", encoding="utf-8") as f:
            json.dump(cookies, f, indent=2)
        print(f"\n✅ Session saved to {SESSION_FILE}")

        # Count groups
        print("\n🔍 Scanning your LinkedIn groups...")
        groups = count_groups(page)
        print(f"\n📋 Found {len(groups)} groups you're a member of:")
        for i, url in enumerate(groups[:20], 1):
            print(f"  {i}. {url}")
        if len(groups) > 20:
            print(f"  ... and {len(groups)-20} more")

        browser.close()
        print("\n✅ Setup complete! Run linkedin_group_discovery.py next.")

if __name__ == "__main__":
    main()
