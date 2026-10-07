#!/usr/bin/env python3
"""Validate an independent natural journey; never substitute disabled audit for geometry.

Source manifest is {"sourceSHA256": {relative_file: sha256}} from the joint freeze.
Every stage must meet the CPU6/frame/render and actual device-pixel pressure gates.
Native script timings and explicit geometry are separate same-version evidence.
"""
import argparse
import hashlib
import json
from pathlib import Path
from urllib.parse import unquote, urlparse

STAGES = {
    "street", "security", "ticket", "gate", "platform", "waiting",
    "approaching", "boarding", "closing", "riding", "arriving", "arrived",
    "exit", "streetExit", "complete",
}


def read_json(path):
    text = path.read_text()
    return json.JSONDecoder().raw_decode(text[text.index("{"):])[0]


def check(data, manifest):
    issues = []
    final = data.get("final", {})
    qa = data.get("qa", {})
    perf = data.get("perf", {})
    audit = data.get("audit", {})
    trace = qa.get("trace", [])
    stages = perf.get("stages", {})
    if not data.get("done") or final.get("stage") != "complete":
        issues.append("Natural journey did not complete")
    if final.get("current") != final.get("destination") or final.get("token"):
        issues.append("Wrong destination or ticket not returned")
    if len(final.get("coinHistory", [])) != 4:
        issues.append("Four actual ticket interactions missing")
    if not any(s.get("seated") for s in trace):
        issues.append("No actual seated state observed")
    gpu = data.get("gpuInfo") or {}
    if not gpu.get("unmaskedRenderer") or any(s in str(gpu.get("unmaskedRenderer", "")).lower() for s in ("swiftshader", "llvmpipe", "software", "swrast")):
        issues.append("WebGL backend missing or software rasterizer; not the intended native Chromium proxy")
    if data.get("cpuRate") != 6:
        issues.append("CPU6 not recorded")
    if perf.get("auditEnabled") is not False or final.get("auditEnabled") is not False:
        issues.append("Production audit is not explicitly disabled")
    if audit.get("enabled") is not False or audit.get("frames") != 0:
        issues.append("Default disabled-audit contract failed")
    exact = qa.get("exactGeometryCalls", {})
    legacy = qa.get("legacyPhysicsCalls", {})
    if qa.get("exactGeometryPresent") is not False or not exact or any(exact.values()) or not legacy or any(legacy.values()):
        issues.append("Default gameplay performed exact geometry/legacy per-frame solver calls, or observer proof missing")
    if qa.get("auditUpdateCalls") != 0 or qa.get("worldValidationCalls") != 0:
        issues.append("Default game invoked audit.update/Station.validate, or call proof missing")
    if data.get("runnerErrors"):
        issues.append("Natural browser driver did not finish all interactions/views")
    looks = data.get("lookChecks", [])
    scans = data.get("scanCoverage", [])
    if not looks or any(e.get("yawError", 99) > .08 or e.get("pitchError", 99) > .08 for e in looks):
        issues.append("Actual camera did not achieve requested real-drag views")
    if not (STAGES - {"complete"}).issubset({s.get("stage") for s in scans}):
        issues.append("Actual full360/up/down coverage missing for a natural stage")
    for scan in scans:
        if scan.get("endLook", 0) - scan.get("startLook", 0) != 7 or scan.get("endShot", 0) - scan.get("startShot", 0) != 7:
            issues.append("Incomplete real-drag visual sweep: " + str(scan.get("tag")))
    if data.get("consoleErrors") or final.get("errors") or final.get("audio", {}).get("errors"):
        issues.append("Runtime/audio errors")
    if qa.get("shadowMapEnabled") is not False:
        issues.append("Realtime-shadow disabled proof missing")
    if qa.get("initialPressure") != {"devicePixelRatio": 2, "rendererPixelRatio": 1.5}:
        issues.append("Initial iPad DPR2/renderer1.5 pressure missing")
    if not trace or any(s.get("devicePixelRatio") != 2 for s in trace):
        issues.append("Actual device DPR2 did not persist throughout the journey")
    for stage in sorted(STAGES):
        e = stages.get(stage, {})
        if e.get("frames", 0) < 1:
            issues.append(stage + ": no main-loop frames")
        if e.get("fps", 0) < 50:
            issues.append(stage + ": CPU6 FPS below50")
        if e.get("drawCalls", 151) > 150 or e.get("triangles", 180001) > 180000:
            issues.append(stage + ": render budget exceeded")
        if e.get("deviceDprMin") != 2 or e.get("deviceDprMax") != 2:
            issues.append(stage + ": actual device DPR2 lost")
        if e.get("rendererDprMax", 2) > 1.5 or e.get("rendererDprMin", 0) < 1:
            issues.append(stage + ": renderer DPR outside1–1.5")
    relocations = [e for e in qa.get("events", []) if e.get("name") == "qa-relocation-failed"]
    if relocations:
        issues.append("Avoidance failed during natural movement; inspect safe fallback and geometry")
    physics = data.get("physics", {})
    for label, stats in (("initial", qa.get("initialPhysics", {})), ("final", physics)):
        if any(stats.get(k) != 0 for k in ("unresolved", "precomputedUnresolved", "hiddenBySolver")):
            issues.append(label + ": NPC unresolved/hidden counter nonzero or proof missing")
    if any(s.get("drawCalls", 151) > 150 or s.get("triangles", 180001) > 180000 for s in trace):
        issues.append("Actual trace exceeded render budget")
    loaded = {}
    for item in data.get("loadedSources", []):
        path = unquote(urlparse(item.get("url", "")).path).lstrip("/")
        if item.get("error") or item.get("status") != 200 or item.get("base64Encoded"):
            issues.append("Loaded source response not verifiable: " + path)
        loaded[path] = item.get("sha256")
    required = {"metro.html", "css/metro.css"} | {
        "js/metro/" + f + ".js" for f in
        ("config", "audio", "main", "npc", "play-physics", "station", "train")
    }
    source = manifest.get("sourceSHA256", {})
    for path in sorted(required):
        if path not in source or loaded.get(path) != source[path]:
            issues.append("Browser source differs from joint freeze: " + path)
    for path, expected in source.items():
        p = Path(path)
        if not p.is_file() or hashlib.sha256(p.read_bytes()).hexdigest() != expected:
            issues.append("Current source differs from joint freeze: " + path)
    windows = qa.get("frameWindows", [])
    clean = [w for w in windows if not w.get("containsQACapture") and w.get("stage") != "selection"]
    low_windows = [w for w in clean if w.get("fps", 0) < 50]
    if not clean:
        issues.append("No capture-free one-second FPS evidence")
    return {
        "ok": not issues,
        "runName": data.get("runName"),
        "cpuRate": data.get("cpuRate"),
        "gpuInfo": gpu,
        "stages": stages,
        "issues": issues,
        "relocationFailures": relocations,
        "cleanFrameWindowMinimum": min((w["fps"] for w in clean), default=None),
        "cleanWorstInterval": max((w.get("intervalWorst", 0) for w in clean), default=None),
        "cleanLongFrameWindows": [w for w in clean if w.get("intervalWorst", 0) > 20],
        "cleanLowFrameWindows": low_windows,
        "allFrameWindowMinimum": min((w["fps"] for w in windows), default=None),
        "captureLowWindows": [w for w in windows if w.get("containsQACapture") and w.get("fps", 0) < 50],
        "scope": "Independent natural CPU6 flow/performance/source pressure. Native CPU1 script budget, audit=1 geometry12, and actual iPad remain separate. Coordinator 20:30 gate uses stage average >=50, not single windows. All low windows/capture drops remain visible for diagnosis; never rewrite main-loop frame data.",
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("verification", type=Path)
    parser.add_argument("joint_source_manifest", type=Path)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    result = check(read_json(args.verification), read_json(args.joint_source_manifest))
    target = args.output or args.verification.parent / "performance-check.json"
    target.write_text(json.dumps(result, ensure_ascii=False, indent=2))
    print(json.dumps({k: result[k] for k in ("runName", "ok", "issues", "cleanFrameWindowMinimum")}, ensure_ascii=False))
    raise SystemExit(0 if result["ok"] else 1)
