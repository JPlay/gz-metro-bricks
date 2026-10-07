#!/usr/bin/env python3
"""Optional offline-production ASR sanity check via Bailian. Not used at runtime.
Reads credentials only from environment. Logs only asset IDs and safe status.
Stores only expected text and transcription, never raw API data or signed URLs.
"""
import os,base64,json,pathlib,requests,concurrent.futures,re
ROOT=pathlib.Path(__file__).resolve().parents[3];AUDIO=ROOT/'assets/audio'
key=os.environ.get('DASHSCOPE_API_KEY')
if not key:raise SystemExit('DASHSCOPE_API_KEY is missing')
host=os.environ.get('DASHSCOPE_HOST','dashscope.aliyuncs.com').rstrip('/')
if not host.startswith('https://'):host='https://'+host
if not host.endswith('/api/v1'):host+='/api/v1'
import argparse
p=argparse.ArgumentParser();p.add_argument('--only',default='');p.add_argument('--report',default='transcription-check.json');args=p.parse_args()
m=json.loads((AUDIO/'manifest.json').read_text());jobs=[a for a in m['assets'] if a['group']=='voice' or a['id']=='train.roll']
if args.only:jobs=[a for a in jobs if args.only in a['id']]

def check(a):
    data=base64.b64encode((AUDIO/a['file']).read_bytes()).decode()
    payload={'model':'qwen3-asr-flash','input':{'messages':[{'role':'user','content':[{'audio':'data:audio/mpeg;base64,'+data}]}]},'parameters':{'result_format':'message','asr_options':{'enable_itn':False}}}
    try:
        r=requests.post(host+'/services/aigc/multimodal-generation/generation',json=payload,headers={'Authorization':'Bearer '+key,'Content-Type':'application/json'},timeout=(15,90))
        if r.status_code!=200:return {'id':a['id'],'status':r.status_code}
        j=r.json();content=j.get('output',{}).get('choices',[{}])[0].get('message',{}).get('content',[])
        text=' '.join(c.get('text','') for c in content if isinstance(c,dict)) if isinstance(content,list) else str(content)
        return {'id':a['id'],'status':200,'expected':a.get('text',''),'recognized':text}
    except Exception as ex:return {'id':a['id'],'error_type':type(ex).__name__}

results=[]
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
 for r in pool.map(check,jobs):
  results.append(r);print(r['id'],r.get('status',r.get('error_type')),flush=True)
  (ROOT/('_dev/tools/audio/'+args.report)).write_text(json.dumps({'model':'qwen3-asr-flash','results':results},ensure_ascii=False,indent=2)+'\n')
print('Transcription sanity check finished',flush=True)
