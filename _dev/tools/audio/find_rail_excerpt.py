#!/usr/bin/env python3
"""Find a CC0 rolling excerpt without intelligible announcements. Env credentials only."""
import os,pathlib,subprocess,numpy as np,requests,json,base64,concurrent.futures
key=os.environ['DASHSCOPE_API_KEY'];host=os.environ.get('DASHSCOPE_HOST','dashscope.aliyuncs.com').rstrip('/')
if not host.startswith('https://'):host='https://'+host
if not host.endswith('/api/v1'):host+='/api/v1'
ROOT=pathlib.Path(__file__).resolve().parents[3]

def check(start):
 p=subprocess.run(['ffmpeg','-v','error','-ss',str(start),'-i','/tmp/gz-audio-source/ride.mp3','-t','9','-af','highpass=f=35,lowpass=f=2400','-ar','16000','-ac','1','-f','wav','pipe:1'],capture_output=True)
 data=base64.b64encode(p.stdout).decode()
 payload={'model':'qwen3-asr-flash','input':{'messages':[{'role':'user','content':[{'audio':'data:audio/wav;base64,'+data}]}]},'parameters':{'result_format':'message','asr_options':{'enable_itn':False}}}
 try:
  r=requests.post(host+'/services/aigc/multimodal-generation/generation',json=payload,headers={'Authorization':'Bearer '+key},timeout=(15,60))
  j=r.json();content=j.get('output',{}).get('choices',[{}])[0].get('message',{}).get('content',[])
  text=' '.join(c.get('text','') for c in content if isinstance(c,dict))
  return {'start':start,'status':r.status_code,'recognized':text}
 except Exception as e:return {'start':start,'error_type':type(e).__name__}
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as p:results=list(p.map(check,[55,83,150,205,258,318,375,430]))
(ROOT/'_dev/tools/audio/rail-excerpt-check.json').write_text(json.dumps(results,indent=2)+'\n')
for r in results:print(r,flush=True)
