#!/usr/bin/env python3
"""Supplemental deterministic acoustic reconstruction; no credentials needed.
Shares the first-round rendering primitives, without rerendering unrelated assets.
"""
import pathlib,json
HELPERS=pathlib.Path(__file__).with_name('generate_soundscape.py')
exec(compile(HELPERS.read_text().split('# Small mechanical cues:')[0],str(HELPERS),'exec'))
# Actual world mechanical travel: doors 1.25 s, gate wings .60 s.
for key,opening,psd in [('doorOpen',True,False),('doorClose',False,False),('psdOpen',True,True),('psdClose',False,True)]:
    d=1.25;t=time(d);travel=np.sin(np.pi*np.clip((t-.04)/1.12,0,1))**.65
    x=(.055*noise(d,150,4800)+.1*noise(d,70,1100))*travel
    f=490 if psd else 320;phase=2*np.pi*np.cumsum(f+38*travel)/SR
    x+=(np.sin(phase)*.075+np.sin(phase*2)*.021)*travel
    place(x,impact(.16),.015,.42 if opening else .24)
    place(x,impact(.15),1.10,.4 if opening else .8)
    if opening:x+=noise(d,1000,6000)*.032*np.exp(-t*9)
    # Reflections must fit inside the animation duration; no hidden post-travel extension.
    save('sfx.'+key,space(x,.12 if not psd else .23),('屏蔽门' if psd else '车门')+('开启' if opening else '关闭')+' · 1.25秒行程',bitrate='80k',provenance='original reconstruction; world mechanical travel 1.25s')
d=.6;t=time(d);travel=np.sin(np.pi*t/d)**.8
x=(noise(d,220,4200)*.03+np.sin(2*np.pi*(310*t+70*t*t))*.12)*travel
place(x,impact(.1),.015,.25);place(x,impact(.1),.5,.4)
save('sfx.gateOpen',space(x,.12),'闸机扇门 · 0.6秒行程',bitrate='64k')
# A localized continuous drive-chain/step-band motor, never global ambience.
d=8;t=time(d);hum=.055*np.sin(2*np.pi*100*t)+.024*np.sin(2*np.pi*200*t)+.015*np.sin(2*np.pi*350*t)
chain=noise(d,160,1600)*.048*(.72+.28*np.sin(2*np.pi*3.2*t)**2)
x=hum+chain+noise(d,40,180)*.03
save('sfx.escalator',x,'扶梯 · 驱动链与梯级循环',True,bitrate='64k')
# Traction inverter: staged switching-frequency changes over accelerating rotor tone.
d=5.2;t=time(d);switch=np.select([t<.8,t<1.65,t<2.55,t<3.5],[180,270,405,590],default=790).astype(float)
# Smooth step transitions by a 35 ms short moving average, avoiding digital clicks.
w=int(SR*.035);switch=np.convolve(np.pad(switch,(w//2,w-1-w//2),mode='edge'),np.ones(w)/w,mode='valid')
f=switch+35*np.sin(np.pi*t/d)+12*np.sin(t*1.9);phase=2*np.pi*np.cumsum(f)/SR
rotor=2*np.pi*np.cumsum(42+65*(t/d)**.75)/SR
fade=np.minimum(t/.15,1)*np.minimum((d-t)/.85,1)
x=(.11*np.sin(phase)+.044*np.sin(phase*2)+.015*np.sin(phase*3)+.055*np.sin(rotor)+.022*noise(d,60,1800))*fade
save('train.tractionStart',stereo(x,.06),'起步 · 牵引逆变器分级升调',bitrate='96k')
# Flange contact: wavering narrow resonances with intermittent stick-slip and scraping.
d=9;t=time(d);contact=.25+.75*np.sin(2*np.pi*.31*t)**4
f=2120+165*np.sin(2*np.pi*.63*t)+35*np.sin(2*np.pi*7.1*t);phase=2*np.pi*np.cumsum(f)/SR
x=(.11*np.sin(phase)+.043*np.sin(phase*.73)+.025*noise(d,1800,7000))*contact
save('train.curve',stereo(x,.12),'过弯 · 轮缘与钢轨摩擦',True,bitrate='96k')
# Stop: compressor/exhaust valve release, two pressure stages and a quiet contact click.
d=1.75;t=time(d);x=noise(d,650,8000)*.16*np.exp(-np.maximum(t-.08,0)*3.4)*(t>.08)
x+=noise(d,140,1000)*.06*np.exp(-np.maximum(t-.12,0)*3)*(t>.12)
place(x,impact(.12),.01,.2);place(x,noise(.55,1600,7000)*.025*np.exp(-time(.55)*6),.95)
save('train.airRelease',stereo(x,.05),'停稳 · 气制动阀放气',bitrate='80k')
p=OUT/'manifest.json';m=json.loads(p.read_text());replaced={a['id'] for a in ASSETS}
m['assets']=[a for a in m['assets'] if a['id'] not in replaced]+ASSETS
m['doorDuration']=1.25;m['gateDuration']=.6
p.write_text(json.dumps(m,ensure_ascii=False,indent=2)+'\n')
print('Round 2 sound manifest ready:',len(m['assets']),'assets')
