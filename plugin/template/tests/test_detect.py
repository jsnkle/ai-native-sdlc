import json
import subprocess
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from ops import detect  # noqa: E402

BANDS = {"metric": "ci_test_failure_rate", "window": 5, "baseline": 30, "min_baseline_rate": 0.05,
         "tiers": {"1sigma": {"action": "log"}, "2sigma": {"action": "diagnose", "tools": "Read"},
                   "3sigma": {"action": "propose", "routes": ["pull_request"]}}}


def runs_from(pattern: str) -> list[dict]:
    """'F' = failure, '.' = success, 'c' = cancelled, 'p' = in progress. Newest first."""
    t0 = datetime(2026, 9, 2, tzinfo=timezone.utc)
    out = []
    for i, ch in enumerate(pattern):
        conclusion = {"F": "failure", ".": "success", "c": "cancelled", "p": None}[ch]
        out.append({"databaseId": 1000 + i, "conclusion": conclusion,
                    "createdAt": (t0 - timedelta(minutes=i)).isoformat(), "headBranch": "main",
                    "event": "push", "url": f"https://example/runs/{1000 + i}"})
    return out


def test_clean_history_is_within_bands():
    r = detect.detect(BANDS, runs_from("." * 40))
    assert r["tier"] == 0 and r["action"] == "none" and r["evidence"] == []


def test_baseline_rate_is_floored_not_zero():
    r = detect.detect(BANDS, runs_from("." * 40))
    assert r["baseline_rate"] == 0.05


def test_one_failure_in_clean_window_is_one_sigma():
    r = detect.detect(BANDS, runs_from("F...." + "." * 30))
    assert r["tier"] == 1 and r["action"] == "log"


def test_two_failures_in_window_breach_three_sigma():
    r = detect.detect(BANDS, runs_from("FF..." + "." * 30))
    assert r["tier"] == 3
    assert r["action"] == "propose" and r["routes"] == ["pull_request"]
    assert [e["id"] for e in r["evidence"]] == [1000, 1001]


def test_noisy_baseline_absorbs_the_same_failures():
    # Baseline of 30 runs with 40% failures: two failures in five is normal.
    r = detect.detect(BANDS, runs_from("FF..." + "FF..." * 6))
    assert r["tier"] == 0


def test_cancelled_and_in_progress_runs_are_not_evidence():
    r = detect.detect(BANDS, runs_from("pcFF...." + "." * 30))
    assert r["runs_considered"] == 36 and r["tier"] == 3


def test_two_of_three_windows_beyond_two_sigma_is_tier_three():
    # Older windows carried the breach; the newest window alone is only at 1 sigma.
    zs = [1.5, 2.4, 2.2]
    assert detect.tier_for(zs) == (3, "two of three windows beyond 2 sigma")


def test_four_of_five_windows_beyond_one_sigma_is_tier_two():
    assert detect.tier_for([1.2, 1.1, 0.4, 1.3, 1.6]) == (2, "four of five windows beyond 1 sigma")


def test_no_baseline_is_tier_zero():
    assert detect.tier_for([]) == (0, "no baseline")
    assert detect.detect(BANDS, runs_from("FFFFF"))["tier"] == 0


def test_cli_exit_code_is_the_tier(tmp_path):
    bands = tmp_path / "bands.yaml"
    bands.write_text(
        "metric: ci_test_failure_rate\nwindow: 5\nbaseline: 30\n"
        "tiers:\n  1sigma: {action: log}\n  2sigma: {action: diagnose}\n  3sigma: {action: propose}\n")
    runs = tmp_path / "runs.json"
    runs.write_text(json.dumps(runs_from("FF..." + "." * 30)))
    proc = subprocess.run([sys.executable, "ops/detect.py", "--bands", str(bands), "--source", str(runs), "--quiet"],
                          capture_output=True, text=True)
    assert proc.returncode == 3
    assert json.loads(proc.stdout)["tier"] == 3


@pytest.mark.parametrize("key", ["metric", "window", "baseline", "tiers"])
def test_missing_band_keys_fail_loudly(tmp_path, key):
    cfg = {"metric": "m", "window": 5, "baseline": 30, "tiers": {}}
    del cfg[key]
    p = tmp_path / "b.yaml"
    p.write_text("\n".join(f"{k}: {json.dumps(v)}" for k, v in cfg.items()) + "\n")
    with pytest.raises(SystemExit):
        detect.load_bands(p)


def test_draft_pr_runs_are_excluded_when_configured():
    runs = runs_from("FFFF." + "." * 30)
    for r in runs[:4]:
        r["event"] = "pull_request"; r["headBranch"] = "wip/thing"; r["draft"] = True
    on = dict(BANDS, ignore_draft_prs=True)
    assert detect.detect(on, runs)["tier"] == 0
    assert detect.detect(on, runs)["runs_ignored"] == 4
    assert detect.detect(BANDS, runs)["tier"] == 3  # default: drafts count


def test_ignored_branch_globs_always_apply():
    runs = runs_from("FF..." + "." * 30)
    for r in runs[:2]:
        r["headBranch"] = "spike/try-things"
    assert detect.detect(dict(BANDS, ignore_branches=["spike/*"]), runs)["tier"] == 0


def test_mark_drafts_only_touches_pull_request_runs():
    runs = runs_from("FF")
    runs[0]["event"] = "pull_request"; runs[0]["headBranch"] = "wip/x"
    runs[1]["event"] = "push"; runs[1]["headBranch"] = "wip/x"
    detect.mark_drafts(runs, {"wip/x"})
    assert runs[0].get("draft") is True and "draft" not in runs[1]
