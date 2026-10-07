#!/usr/bin/env python3
"""Check observed natural door motion against actual emitted sound positions.

Reads independent Chromium verification.json; never changes the game or audit.
New captures include the real train-door geometry and live Audio panner state.
Old captures still detect two different Spanish-side openings at one position.
"""
import argparse
import json
import math
from pathlib import Path


def distance(a, b):
    return math.sqrt(sum((a[k] - b[k]) ** 2 for k in ("x", "y", "z")))


def check(data):
    events = [e for e in data["qa"]["events"] if e.get("name") == "sfx"
              and e.get("args", [None])[0] in
              ("doorOpen", "psdOpen", "doorClose", "psdClose")]
    trace = data["qa"]["trace"]
    groups = []
    for event in events:
        if not groups or event["at"] - groups[-1][0]["at"] > 80:
            groups.append([])
        groups[-1].append(event)
    failures, observations, old_open = [], [], {}
    for group in groups:
        event = group[0]
        at = event["at"]
        geometry = event.get("doorGeometry")
        before = [s for s in trace if s["at"] < at]
        after = [s for s in trace if at + 160 <= s["at"] < at + 800]
        if not before or not after:
            failures.append({"at": at, "reason": "Missing observed door-motion samples"})
            continue
        baseline = geometry["starts"] if geometry else {
            "boarding": before[-1]["doors"], "alight": before[-1]["alight"]}
        changes = {"boarding": max(after, key=lambda s: abs(s["doors"] - baseline["boarding"]))["doors"] - baseline["boarding"],
                   "alight": max(after, key=lambda s: abs(s["alight"] - baseline["alight"]))["alight"] - baseline["alight"]}
        sides = {side: ("Open" if delta > 0 else "Close")
                 for side, delta in changes.items() if abs(delta) > .075}
        current = after[0]["current"]
        observed = {"at": at, "current": current, "changes": changes,
                    "movingSides": sides, "geometryCaptured": bool(geometry), "sounds": group}
        observations.append(observed)
        if not sides:
            failures.append({"at": at, "reason": "Sound without observed door motion"})
        if geometry:
            for side, action in sides.items():
                expected = geometry[side]
                for kind in ("door", "psd"):
                    matching = [e for e in group if e["args"][0] == kind + action
                                and distance(e["args"][1]["position"], expected) <= .001]
                    if len(matching) != 1:
                        failures.append({"at": at, "side": side, "kind": kind,
                                         "expected": expected, "reason": "Moving door lacks exactly one correctly placed sound"})
            for e in group:
                opts = e["args"][1]
                matching_side = [side for side, action in sides.items()
                                 if e["args"][0].endswith(action)
                                 and distance(opts["position"], geometry[side]) <= .001]
                if len(matching_side) != 1:
                    failures.append({"at": e["at"], "reason": "Sound belongs to a stationary or wrong door", "sound": e})
                if abs(opts.get("duration", 0) - 1.25) > .001 or abs(e.get("result", 0) - 1.25) > .001:
                    failures.append({"at": e["at"], "reason": "Mechanical duration differs from the actual 1.25-second doors"})
                panners = e.get("panners", [])
                if not any(distance(p["position"], opts["position"]) <= .001 for p in panners):
                    failures.append({"at": e["at"], "reason": "Live Audio panner does not match the call position"})
        if current == "gyq" and len(sides) == 1 and next(iter(sides.values())) == "Open":
            side = next(iter(sides))
            sound = next((e for e in group if e["args"][0] == "doorOpen"), None)
            if sound:
                previous = old_open.get(current)
                if previous and previous["side"] != side and distance(previous["position"], sound["args"][1]["position"]) < 1:
                    failures.append({"at": at, "reason": "Different Spanish-side openings use the same sound position", "previous": previous})
                old_open[current] = {"side": side, "position": sound["args"][1]["position"]}
    return {"runName": data["runName"], "ok": bool(groups) and not failures,
            "groups": len(groups), "allGeometryCaptured": all(o["geometryCaptured"] for o in observations),
            "failures": failures, "observations": observations}


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("verification", type=Path)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    report = check(json.loads(args.verification.read_text()))
    target = args.output or args.verification.parent / "door-spatial-check.json"
    target.write_text(json.dumps(report, ensure_ascii=False, indent=2))
    print(json.dumps({k: report[k] for k in ("runName", "ok", "groups", "allGeometryCaptured", "failures")}, ensure_ascii=False))
    raise SystemExit(0 if report["ok"] else 1)
