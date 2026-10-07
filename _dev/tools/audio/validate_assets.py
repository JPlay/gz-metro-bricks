#!/usr/bin/env python3
"""Validate manifest coverage, budget, decoding, silence and clipping, offline."""
import json,pathlib,subprocess,concurrent.futures,numpy as np
ROOT=pathlib.Path(__file__).resolve().parents[3];OUT=ROOT/'assets/audio'
m=json.loads((OUT/'manifest.json').read_text());ids={a['id'] for a in m['assets']}
assert len(ids)==len(m['assets']), 'Duplicate asset IDs'
assert set(m['routes'])=={s+'_'+d for s in ['gyq','njs','lsly','dsk'] for d in ['up','down']}
for r in m['routes'].values():
 for k in ['next','arrive','welcome']:
  assert all(x in ids for x in r['announcements'][k]), 'Incomplete route'
  assert {x.rsplit('.',1)[-1] for x in r['announcements'][k]}=={'zh','yue','en'}
for name in ['footstep','ticketMachine','tokenDrop','securityBeep','gateBeep','gateOpen','doorChime','doorOpen','doorClose','psdOpen','psdClose','horn']:assert 'sfx.'+name in ids
for name in ['motor','roll','joints','brake','approach','depart','tractionStart','curve','airRelease']:assert 'train.'+name in ids
for name in ['street','concourse','platform','train']:assert 'ambience.'+name in ids
assert 'sfx.escalator' in ids
assert len(m['stationSafety'])==6
for entry in m['stationSafety'].values():
 assert len(entry['ids'])==2 and all(i in ids for i in entry['ids'])
 assert {i.rsplit('.',1)[-1] for i in entry['ids']}=={'zh','yue'}
for a in m['assets']:
 if a['id'] in {'sfx.doorOpen','sfx.doorClose','sfx.psdOpen','sfx.psdClose'}:assert abs(a['duration']-1.25)<.01
files=list(OUT.rglob('*.mp3'));size=sum(p.stat().st_size for p in files)
assert size<=20_000_000,'Audio budget exceeded'
assert len(files)==len(m['assets']),'Manifest and files differ'

def inspect(a):
 p=OUT/a['file'];assert p.exists(),a['id']+' missing'
 result=subprocess.run(['ffmpeg','-nostdin','-v','error','-i',str(p),'-f','f32le','-ac','2','-ar','24000','pipe:1'],capture_output=True)
 assert result.returncode==0,a['id']+' cannot decode'
 x=np.frombuffer(result.stdout,dtype='<f4').reshape(-1,2);assert len(x)>1000,a['id']+' too short'
 peak=float(np.max(np.abs(x)));rms=float(np.sqrt(np.mean(x*x)))
 assert np.isfinite(x).all(),a['id']+' invalid samples'
 assert rms>.0001,a['id']+' silent'
 assert peak<.999,a['id']+' clipped'
 assert abs(len(x)/24000-a['duration'])<.15,a['id']+' duration mismatch'
 return {'id':a['id'],'duration':round(len(x)/24000,3),'peakDb':round(20*np.log10(peak),2),'rmsDb':round(20*np.log10(rms),2),'bytes':p.stat().st_size}
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:results=list(pool.map(inspect,m['assets']))
report={'passed':True,'files':len(files),'voiceFiles':sum(a['group']=='voice' for a in m['assets']),'routes':len(m['routes']),'bytes':size,'megabytes':round(size/1048576,3),'durationSeconds':round(sum(a['duration'] for a in results),2),'assets':results}
(ROOT/'_dev/tools/audio/validation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({k:v for k,v in report.items() if k!='assets'},ensure_ascii=False))
