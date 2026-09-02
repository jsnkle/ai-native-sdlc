#!/usr/bin/env python3
"""Deterministic control-band detection for one CI metric. No model in this path.

Reads ops/bands.yaml, pulls completed runs of a GitHub Actions workflow (or a JSON file
for tests), computes the failure count in the most recent window against a baseline
estimated from the runs before it, and maps the z-score to a tier with a Western
Electric style rule set. Prints a JSON report and exits with the tier (0 to 3) so a
shell script can branch on it.

usage: detect.py [--bands ops/bands.yaml] [--source gh|FILE] [--repo OWNER/NAME] [--quiet]

Runs on draft pull requests are excluded when bands.yaml sets ignore_draft_prs, and runs on
branches matching ignore_branches globs are always excluded. A file source may carry
"draft": true on a run directly.
"""
from __future__ import annotations

import argparse
import fnmatch
import json
import math
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

import yaml

COMPLETED = {"success", "failure"}  # cancelled, skipped and in-progress runs are not evidence


def load_bands(path: Path) -> dict:
    with path.open() as fh:
        bands = yaml.safe_load(fh)
    for key in ("metric", "window", "baseline", "tiers"):
        if key not in bands:
            raise SystemExit(f"bands file is missing '{key}'")
    bands.setdefault("min_baseline_rate", 0.05)
    bands.setdefault("ignore_draft_prs", False)
    bands.setdefault("ignore_branches", [])
    return bands


def fetch_runs_gh(workflow: str, limit: int, repo: str | None) -> list[dict]:
    cmd = ["gh", "run", "list", "--workflow", workflow, "--limit", str(limit),
           "--json", "databaseId,conclusion,createdAt,headBranch,event,url"]
    if repo:
        cmd += ["--repo", repo]
    out = subprocess.run(cmd, check=True, capture_output=True, text=True).stdout
    return json.loads(out)


def load_runs_file(path: Path) -> list[dict]:
    with path.open() as fh:
        return json.load(fh)


def fetch_draft_branches_gh(repo: str | None) -> set[str]:
    """Head branches of pull requests that are currently drafts (open or closed)."""
    cmd = ["gh", "pr", "list", "--state", "all", "--limit", "200", "--json", "headRefName,isDraft"]
    if repo:
        cmd += ["--repo", repo]
    out = subprocess.run(cmd, check=True, capture_output=True, text=True).stdout
    return {pr["headRefName"] for pr in json.loads(out) if pr.get("isDraft")}


def mark_drafts(runs: list[dict], draft_branches: set[str]) -> list[dict]:
    """Set run["draft"] for pull_request runs whose head branch backs a draft PR."""
    for r in runs:
        if r.get("event") == "pull_request" and r.get("headBranch") in draft_branches:
            r["draft"] = True
    return runs


def is_ignored(run: dict, bands: dict) -> bool:
    if bands.get("ignore_draft_prs") and run.get("draft"):
        return True
    branch = run.get("headBranch") or ""
    return any(fnmatch.fnmatch(branch, pat) for pat in bands.get("ignore_branches", []))


def completed_newest_first(runs: list[dict]) -> list[dict]:
    runs = [r for r in runs if r.get("conclusion") in COMPLETED]
    return sorted(runs, key=lambda r: r["createdAt"], reverse=True)


def z_for_window(series: list[int], start: int, k: int, n: int, floor: float) -> tuple[float, float, int] | None:
    """z-score of failures in series[start:start+k] against the rate of the n runs after it.

    series is newest-first binary (1 = failure). Returns (z, p0, x) or None if there is no
    baseline run at all.
    """
    window = series[start:start + k]
    base = series[start + k:start + k + n]
    if len(window) < k or not base:
        return None
    p0 = min(max(sum(base) / len(base), floor), 0.95)
    x = sum(window)
    sigma = math.sqrt(k * p0 * (1 - p0))
    return (x - k * p0) / sigma, p0, x


def tier_for(zs: list[float]) -> tuple[int, str]:
    """Western Electric mapping over the sliding-window z series (index 0 = newest).

    3: latest z >= 3, or two of the last three windows >= 2.
    2: latest z >= 2, or four of the last five windows >= 1.
    1: latest z >= 1, or eight consecutive windows above the baseline mean.
    """
    if not zs:
        return 0, "no baseline"
    z = zs[0]
    if z >= 3:
        return 3, "one window beyond 3 sigma"
    if sum(1 for v in zs[:3] if v >= 2) >= 2:
        return 3, "two of three windows beyond 2 sigma"
    if z >= 2:
        return 2, "one window beyond 2 sigma"
    if sum(1 for v in zs[:5] if v >= 1) >= 4:
        return 2, "four of five windows beyond 1 sigma"
    if z >= 1:
        return 1, "one window beyond 1 sigma"
    if len(zs) >= 8 and all(v > 0 for v in zs[:8]):
        return 1, "eight consecutive windows above the mean"
    return 0, "within bands"


def detect(bands: dict, runs: list[dict]) -> dict:
    k = int(bands["window"])
    n = int(bands["baseline"])
    floor = float(bands["min_baseline_rate"])
    ignored = [r for r in runs if is_ignored(r, bands)]
    runs = completed_newest_first([r for r in runs if not is_ignored(r, bands)])
    series = [1 if r["conclusion"] == "failure" else 0 for r in runs]

    zs: list[float] = []
    latest = None
    for start in range(0, max(1, len(series) - k)):
        res = z_for_window(series, start, k, n, floor)
        if res is None:
            break
        if latest is None:
            latest = res
        zs.append(res[0])

    tier, rule = tier_for(zs)
    tier_key = f"{tier}sigma"
    tier_cfg = bands["tiers"].get(tier_key, {"action": "log"}) if tier else {"action": "none"}
    window_runs = runs[:k]
    report = {
        "metric": bands["metric"],
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "runs_considered": len(runs),
        "runs_ignored": len(ignored),
        "window": k,
        "failures_in_window": latest[2] if latest else sum(series[:k]),
        "baseline_rate": round(latest[1], 4) if latest else None,
        "z": round(latest[0], 3) if latest else None,
        "z_history": [round(v, 3) for v in zs[:8]],
        "tier": tier,
        "rule": rule,
        "action": tier_cfg.get("action"),
        "tools": tier_cfg.get("tools"),
        "routes": tier_cfg.get("routes"),
        "evidence": [
            {"id": r.get("databaseId"), "created_at": r["createdAt"], "branch": r.get("headBranch"),
             "event": r.get("event"), "conclusion": r["conclusion"], "url": r.get("url")}
            for r in window_runs if r["conclusion"] == "failure"
        ],
    }
    return report


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--bands", default="ops/bands.yaml")
    ap.add_argument("--source", default="gh", help="'gh' or a path to a JSON file of runs")
    ap.add_argument("--repo", default=None)
    ap.add_argument("--quiet", action="store_true", help="print only the JSON report")
    args = ap.parse_args(argv)

    bands = load_bands(Path(args.bands))
    if args.source == "gh":
        src = bands.get("source", {})
        runs = fetch_runs_gh(src.get("workflow", "ci"), int(src.get("limit", 200)), args.repo)
        if bands.get("ignore_draft_prs"):
            runs = mark_drafts(runs, fetch_draft_branches_gh(args.repo))
    else:
        runs = load_runs_file(Path(args.source))

    report = detect(bands, runs)
    if not args.quiet:
        print(f"{report['metric']}: tier {report['tier']} ({report['rule']}); "
              f"{report['failures_in_window']} failures in last {report['window']} runs, "
              f"baseline {report['baseline_rate']}, z={report['z']}", file=sys.stderr)
    print(json.dumps(report, indent=2))
    return report["tier"]


if __name__ == "__main__":
    sys.exit(main())
