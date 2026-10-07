#!/usr/bin/env python3
"""Check same-source evidence; the tester still decides each visual defect manually."""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path

BASE = Path('_dev/shots/play/round3')
AUDIO = Path('_dev/shots/audio/round3')
STATIONS = ('gyq', 'njs', 'lsly', 'dsk')
PAIRS = {(a, b) for a in range(4) for b in range(4) if a != b}
CATEGORIES = {'cameraGeometry', 'undergroundOpenRay', 'npcPersonalSpace', 'npcOverlap',
              'npcStaticCollider', 'npcUnsupportedFeet', 'npcInteractionObstruction',
              'unsupportedFeet', 'trainPlatformIntersection', 'missingContract'}
WORLD_CATEGORIES = {'pathObstruction', 'pathClearance', 'unsupported', 'enclosure',
                    'doorAlignment', 'trainClearance'}


def read(p):
    s = p.read_text()
    return json.JSONDecoder().raw_decode(s[s.index('{'):])[0]


def sha(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()


def check_source(source, issues, label):
    for p, h in source.items():
        if not Path(p).is_file() or sha(Path(p)) != h:
            issues.append(label + ': changed source ' + p)


def parse_snapshot(p):
    return {line.split(maxsplit=1)[1].lstrip('*'): line.split(maxsplit=1)[0]
            for line in p.read_text().splitlines() if line.strip()}


def main(args):
    issues = []
    manifest = read(args.manifest)
    source = manifest['sourceSHA256']
    check_source(source, issues, 'joint freeze')
    spec = importlib.util.spec_from_file_location('audio_perf_check', Path(__file__).with_name('check-performance.py'))
    perf_check = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(perf_check)
    reviewed = read(AUDIO / 'reviewed-frames.json')
    evidence = []
    independent_pairs = set()
    for name in args.independent:
        root = AUDIO / name
        data = read(root / 'verification.json')
        verdict = perf_check.check(data, manifest)
        issues.extend(name + ': ' + s for s in verdict['issues'])
        final = data['final']
        independent_pairs.add((final['origin'], final['destination']))
        door = read(root / 'door-spatial-check.json')
        if door.get('ok') is not True or door.get('allGeometryCaptured') is not True:
            issues.append(name + ': door audio spatial/motion check not passed')
        entry = reviewed.get(name, {})
        shots = sorted(root.glob('*.png'))
        if not entry.get('done') or entry.get('total') != len(shots) or entry.get('viewed') != len(shots) or len(shots) != data.get('screenshots'):
            issues.append(name + ': every actual PNG has not been reviewed')
        image_hash = entry.get('imageSHA256', {})
        for shot in shots:
            if image_hash.get(shot.name) != sha(shot):
                issues.append(name + ': reviewed PNG SHA missing/changed ' + shot.name)
        for side in ('source-before.json', 'source-after.json'):
            if read(root / side) != source:
                issues.append(name + ': source snapshot differs from joint freeze')
        evidence.append({'path': str(root / 'verification.json'), 'sha256': sha(root / 'verification.json'),
                         'screenshots': len(shots), 'cleanFPSMinimum': verdict['cleanFrameWindowMinimum']})
    expected = {('gyq', 'njs'), ('njs', 'dsk'), ('dsk', 'lsly'), ('lsly', 'gyq')}
    if independent_pairs != expected:
        issues.append('independent four: origins/destinations/directions/right-door coverage incomplete')
    for kind, name in [('CPU6', args.cpu6), ('audit', args.audit), ('native', args.native)]:
        root = BASE / name
        for side in ('source-before.sha256', 'source-after.sha256'):
            if parse_snapshot(root / side) != source:
                issues.append(kind + ': batch source differs from joint freeze')
        files = sorted(root.glob('route-*.json'))
        seen = set()
        for p in files:
            d = read(p)
            pair = tuple(d['route'])
            seen.add(pair)
            s = d['state']
            fail = []
            if not d.get('complete') or s.get('stage') != 'complete' or not d.get('wasSeated') or len(s.get('coinHistory', [])) != 4 or s.get('token') or s.get('travelled') != abs(pair[1] - pair[0]):
                fail.append('incomplete real journey')
            if s.get('errors') or s.get('audio', {}).get('errors'):
                fail.append('runtime/audio errors')
            if d.get('relocateFailures'):
                fail.append('NPC actual relocation failures')
            looks = d.get('lookChecks', [])
            scans = d.get('scanCoverage', [])
            if not looks or any(e.get('yawError', 99) > .08 or e.get('pitchError', 99) > .08 for e in looks):
                fail.append('actual real-drag camera coverage missing/failed')
            if not scans or any(s.get('lastCheck', 0) - s.get('firstCheck', 0) != 7 for s in scans):
                fail.append('four horizontal/up/down/restore sweep proof missing/failed')
            if not (perf_check.STAGES - {'complete'}).issubset({s.get('stage') for s in scans}):
                fail.append('real camera sweeps missing a natural stage')
            for label, stats in [('initial', d.get('versions', {}).get('initialPhysics', {})), ('final', s.get('npc', {}).get('physics', {}))]:
                if any(stats.get(k) != 0 for k in ('unresolved', 'precomputedUnresolved', 'hiddenBySolver')):
                    fail.append(label + ' solver failure/missing evidence')
            if kind == 'audit':
                a = d.get('audit', {})
                if a.get('enabled') is not True or set(a.get('counts', {})) != CATEGORIES or any(a.get('counts', {}).values()) or a.get('total') != 0 or a.get('frames', 0) < 1000:
                    fail.append('explicit audit ten-category zero proof failed')
            else:
                a = d.get('audit', {})
                if a.get('enabled') is not False or a.get('frames') != 0 or d.get('cpuRate') != (6 if kind == 'CPU6' else 1):
                    fail.append('default-audit / CPU-rate contract')
                gpu = d.get('versions', {}).get('gpu', '')
                if not gpu or any(w in gpu.lower() for w in ('swiftshader', 'llvmpipe', 'swrast', 'software', 'unknown')):
                    fail.append('actual native GPU missing/software')
                if not isinstance(d.get('forbiddenCalls'), dict) or any(d.get('forbiddenCalls', {}).values()):
                    fail.append('default real-geometry/old-solver call')
                versions = d.get('versions', {})
                if versions.get('exactGeometryPresent') is not False or versions.get('shadowMapEnabled') is not False:
                    fail.append('default geometry/realtime-shadow disabled proof missing/failed')
                if versions.get('devicePixelRatio') != 2 or versions.get('initialPixelRatio') != 1.5:
                    fail.append('initial native DPR2/renderer1.5 pressure')
                windows = d.get('frameWindows', [])
                clean = [w for w in windows if not w.get('containsQACapture') and w.get('stage') != 'selection']
                if not clean:
                    fail.append('capture-free one-second diagnostic evidence missing')
                if any(w.get('devicePixelRatio') != 2 for w in windows):
                    fail.append('actual one-second device DPR2 lost')
                for stage in perf_check.STAGES:
                    e = d.get('performance', {}).get('stages', {}).get(stage, {})
                    if e.get('frames', 0) < 1 or e.get('fps', 0) < 50 or e.get('drawCalls', 151) > 150 or e.get('triangles', 180001) > 180000 or e.get('deviceDprMin') != 2 or e.get('deviceDprMax') != 2 or e.get('rendererDprMax', 2) > 1.5 or e.get('rendererDprMin', 0) < 1:
                        fail.append(stage + ' frame/render/DPR budget')
                    if kind == 'native' and (e.get('scriptMedian', 99) > 2.000001 or e.get('scriptP95', 99) > 5.000001):
                        fail.append(stage + ' native median/P95 budget')
                    if kind == 'native' and e.get('scriptWorst', 99) > 12.000001:
                        fail.append(stage + ' transition spike above12ms')
                    if kind == 'native' and (e.get('spikeCount', 99) > 3 or len(e.get('spikes', [])) != min(e.get('spikeCount', 99), 4)):
                        fail.append(stage + ' transition spikes above3/missing original contexts')
            if not d.get('doorAudio', {}).get('ok'):
                fail.append('door audio')
            issues.extend(kind + ' ' + str(pair) + ': ' + f for f in fail)
            evidence.append({'path': str(p), 'sha256': sha(p), 'kind': kind, 'auditFrames': d.get('audit', {}).get('frames')})
        expected = PAIRS if kind != 'native' else {(0, 3), (3, 0)}
        if seen != expected or len(files) != len(expected):
            issues.append(kind + ': required routes missing/duplicated')
    budget = read(args.world_budget)
    check_source(budget['sourceSHA256'], issues, 'world render budget')
    if not budget.get('ok') or budget.get('crowdCapacity') != 60 or budget.get('dpr') != 1.5 or budget.get('shadow') is not False or budget.get('drawCallMax', 151) > 150 or budget.get('triangleMax', 180001) > 180000 or budget.get('trainDrawCallMax', 151) > 150 or budget.get('trainTriangleMax', 180001) > 180000:
        issues.append('current frozen world module render proof failed')
    world = read(args.world_geometry)
    check_source(world['sourceSHA256'], issues, 'world geometry')
    seen = {(c.get('station'), c.get('dir')) for c in world.get('cases', [])}
    if not world.get('ok') or seen != {(s, d) for s in STATIONS for d in (1, -1)}:
        issues.append('world eight geometry cases failed/missing')
    for c in world.get('cases', []):
        if c.get('ok') is not True or set(c.get('counts', {})) != WORLD_CATEGORIES or any(c.get('counts', {}).values()):
            issues.append('world case counts nonzero/missing')
    return {'automatedEvidenceOK': not issues, 'finalAccepted': False,
            'scope': 'Same-version source, independent4 CPU6/images/doors, owner12 CPU6/12 explicit geometry/2 actual native timings, current World8/module6192. Coordinator20:30 uses stage averages and native median/P95 with permitted transition spikes; low seconds remain diagnostic. DEFECTS manual verdict and negative/visual reviews remain required; no A12/Safari hardware claim.',
            'sourceSHA256': source, 'issues': issues, 'evidence': evidence}


if __name__ == '__main__':
    p = argparse.ArgumentParser()
    p.add_argument('manifest', type=Path)
    p.add_argument('cpu6')
    p.add_argument('audit')
    p.add_argument('native')
    p.add_argument('independent', nargs=4)
    p.add_argument('--world-budget', type=Path, default=Path('_dev/shots/world/perf/r14/report.json'))
    p.add_argument('--world-geometry', type=Path, default=Path('_dev/shots/world/perf/r14/report.json'))
    p.add_argument('--output', type=Path, default=AUDIO / 'joint-evidence-check.json')
    args = p.parse_args()
    result = main(args)
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'automatedEvidenceOK': result['automatedEvidenceOK'], 'issues': result['issues']}, ensure_ascii=False))
    raise SystemExit(0 if result['automatedEvidenceOK'] else 1)
