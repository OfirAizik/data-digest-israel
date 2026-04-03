# -*- coding: utf-8 -*-
"""
setup_scheduler.py
Creates (or replaces) a Windows Task Scheduler task called "DataDigestIL"
that runs telegram_scraper.py on the schedule stored in Supabase app_config.

Schedule keys read from app_config:
  schedule_mode   : "interval" | "specific_days" | "specific_dates"
  interval_days   : integer (used when mode = interval)
  specific_days   : comma-separated day numbers 0=SUN,1=MON,...,6=SAT
                    (used when mode = specific_days)
  specific_dates  : comma-separated dates YYYY-MM-DD
                    (used when mode = specific_dates)
  run_time        : HH:MM  (default 08:00)
"""

import json
import os
import subprocess
import sys
import urllib.request
from datetime import date, timedelta

from secrets import SUPABASE_URL, SUPABASE_SERVICE_KEY

TASK_NAME = "DataDigestIL"

# schtasks day-of-week abbreviations (Sunday=0 … Saturday=6)
_DOW = {0: "SUN", 1: "MON", 2: "TUE", 3: "WED", 4: "THU", 5: "FRI", 6: "SAT"}


# ---------------------------------------------------------------------------
# Supabase helpers
# ---------------------------------------------------------------------------

def fetch_app_config():
    """Return app_config as a flat {key: value} dict. Returns {} on failure."""
    req = urllib.request.Request(
        f"{SUPABASE_URL}/rest/v1/app_config?select=key,value",
        headers={
            "apikey": SUPABASE_SERVICE_KEY,
            "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        },
    )
    try:
        with urllib.request.urlopen(req) as resp:
            rows = json.loads(resp.read().decode("utf-8"))
        if not rows:
            print("app_config is empty.")
            return {}
        return {row["key"]: row["value"] for row in rows}
    except Exception as e:
        print(f"Warning: could not fetch app_config: {e}")
        return {}


# ---------------------------------------------------------------------------
# schtasks wrappers
# ---------------------------------------------------------------------------

def delete_existing_task():
    """Remove the task if it already exists (ignore errors if it doesn't)."""
    subprocess.run(
        ["schtasks", "/Delete", "/TN", TASK_NAME, "/F"],
        capture_output=True,
    )


def run_schtasks(args: list[str]):
    """Run schtasks /Create with the given args and print the result."""
    cmd = ["schtasks", "/Create", "/TN", TASK_NAME, "/RU", os.environ["USERNAME"],
           "/RL", "HIGHEST", "/F"] + args
    print("Running:", " ".join(cmd))
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode == 0:
        print(f"Task '{TASK_NAME}' created successfully.")
    else:
        print(f"schtasks failed (exit {result.returncode}):")
        print(result.stdout)
        print(result.stderr)
        sys.exit(1)


# ---------------------------------------------------------------------------
# Schedule builders
# ---------------------------------------------------------------------------

def schedule_interval(python_exe, scraper_path, run_time, interval_days):
    """Run every N days starting tomorrow."""
    start_date = (date.today() + timedelta(days=1)).strftime("%m/%d/%Y")
    run_schtasks([
        "/TR", f'"{python_exe}" "{scraper_path}"',
        "/SC", "DAILY",
        "/MO", str(interval_days),
        "/ST", run_time,
        "/SD", start_date,
    ])
    print(f"  Schedule: every {interval_days} day(s) at {run_time}, starting {start_date}")


def parse_day_nums(days_str):
    """Parse specific_days from Supabase — handles JSON arrays ("[0,1]") and plain CSV ("0,1")."""
    days_str = days_str.strip()
    if not days_str:
        return []
    # Try JSON first (e.g. "[0]" or "[0, 1, 5]")
    try:
        parsed = json.loads(days_str)
        if isinstance(parsed, list):
            return [int(x) for x in parsed]
        return [int(parsed)]
    except (json.JSONDecodeError, ValueError):
        pass
    # Fall back to comma-separated integers
    return [int(d.strip()) for d in days_str.split(",") if d.strip().lstrip("-").isdigit()]


def schedule_specific_days(python_exe, scraper_path, run_time, days_str):
    """Run on specific days of the week (0=SUN … 6=SAT)."""
    day_nums = parse_day_nums(days_str)
    if not day_nums:
        print("Error: specific_days is empty or invalid.")
        sys.exit(1)
    day_abbrs = ",".join(_DOW[d] for d in day_nums if d in _DOW)
    run_schtasks([
        "/TR", f'"{python_exe}" "{scraper_path}"',
        "/SC", "WEEKLY",
        "/D", day_abbrs,
        "/ST", run_time,
    ])
    print(f"  Schedule: weekly on {day_abbrs} at {run_time}")


def schedule_specific_dates(python_exe, scraper_path, run_time, dates_str):
    """Create one ONCE task per date. Deletes and recreates all."""
    dates = [d.strip() for d in dates_str.split(",") if d.strip()]
    if not dates:
        print("Error: specific_dates is empty.")
        sys.exit(1)

    for i, raw_date in enumerate(dates):
        try:
            parsed = date.fromisoformat(raw_date)
        except ValueError:
            print(f"Skipping invalid date: {raw_date}")
            continue

        task_name_i = f"{TASK_NAME}_{parsed.strftime('%Y%m%d')}"
        sched_date  = parsed.strftime("%m/%d/%Y")

        # Delete previous version of this specific task
        subprocess.run(
            ["schtasks", "/Delete", "/TN", task_name_i, "/F"],
            capture_output=True,
        )

        cmd = [
            "schtasks", "/Create",
            "/TN", task_name_i,
            "/TR", f'"{python_exe}" "{scraper_path}"',
            "/SC", "ONCE",
            "/SD", sched_date,
            "/ST", run_time,
            "/RU", os.environ["USERNAME"],
            "/RL", "HIGHEST",
            "/F",
        ]
        print(f"Running: {' '.join(cmd)}")
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode == 0:
            print(f"  Task '{task_name_i}' created for {sched_date} at {run_time}")
        else:
            print(f"  Failed to create task for {sched_date}: {result.stderr.strip()}")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    python_exe  = sys.executable
    scraper_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "telegram_scraper.py")

    print(f"Python:  {python_exe}")
    print(f"Scraper: {scraper_path}")

    if not os.path.isfile(scraper_path):
        print(f"Error: telegram_scraper.py not found at {scraper_path}")
        sys.exit(1)

    print("\nFetching schedule settings from Supabase app_config...")
    cfg = fetch_app_config()

    mode          = cfg.get("schedule_mode", "interval").strip()
    run_time      = cfg.get("run_time", "08:00").strip()
    interval_days = int(cfg.get("interval_days", "1"))
    specific_days  = cfg.get("specific_days", "")
    specific_dates = cfg.get("specific_dates", "")

    print(f"  schedule_mode   = {mode}")
    print(f"  run_time        = {run_time}")
    print(f"  interval_days   = {interval_days}")
    print(f"  specific_days   = {specific_days or '(not set)'}")
    print(f"  specific_dates  = {specific_dates or '(not set)'}")

    if mode != "specific_dates":
        print(f"\nRemoving existing task '{TASK_NAME}' (if any)...")
        delete_existing_task()

    print(f"\nCreating task (mode={mode})...")

    if mode == "interval":
        schedule_interval(python_exe, scraper_path, run_time, interval_days)
    elif mode == "specific_days":
        schedule_specific_days(python_exe, scraper_path, run_time, specific_days)
    elif mode == "specific_dates":
        schedule_specific_dates(python_exe, scraper_path, run_time, specific_dates)
    else:
        print(f"Error: unknown schedule_mode '{mode}'. Must be interval, specific_days, or specific_dates.")
        sys.exit(1)

    print("\nDone. Verify in Task Scheduler or run:")
    print(f"  schtasks /Query /TN {TASK_NAME} /FO LIST")


if __name__ == "__main__":
    main()
