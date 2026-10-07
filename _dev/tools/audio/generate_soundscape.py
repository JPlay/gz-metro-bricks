#!/usr/bin/env python3
"""Deterministic offline acoustic rendering. CC0 recordings stay in /tmp.
Outputs: seamless stereo environments, layered rail textures, mechanical cues.
No credentials required. Requires Python numpy and ffmpeg.
"""
import pathlib, subprocess, json, wave
import numpy as np
ROOT=pathlib.Path(__file__).resolve().parents[3];OUT=ROOT/'assets/audio'
SR=24000;RNG=np.random.default_rng(19970628);ASSETS=[]

def time(d):return np.arange(round(d*SR))/SR

def mono(x):return np.mean(x,axis=1) if x.ndim==2 else x

def band(x,low=0,high=12000):
    n=len(x);f=np.fft.rfftfreq(n,1/SR)
    g=np.ones(len(f))
    if low:g*=1/(1+(low/np.maximum(f,1))**6)
    if high:g*=1/(1+(f/high)**8)
    return np.fft.irfft(np.fft.rfft(x,axis=0)*g[:,None] if x.ndim==2 else np.fft.rfft(x)*g,n=n,axis=0)

def noise(d,low=20,high=5000):
    x=band(RNG.standard_normal(round(d*SR)),low,high)
    return x/(np.std(x)+1e-10)

def stereo(x,width=.15):
    if x.ndim==2:return x.copy()
    delayed=np.roll(x,round(SR*.0007))
    return np.column_stack([x*(1-width)+delayed*width,x*(1-width)+np.roll(x,-round(SR*.0007))*width])

def env(x,fade=.03):
    y=x.copy();n=min(round(fade*SR),len(x)//2)
    ramp=np.linspace(0,1,n)
    if x.ndim==2:ramp=ramp[:,None]
    y[:n]*=ramp;y[-n:]*=ramp[::-1]
    return y

def seam(x,fade=.55):
    n=round(fade*SR);r=np.linspace(0,1,n)
    if x.ndim==2:r=r[:,None]
    y=x[:-n].copy();y[:n]=x[-n:]*(1-r)+x[:n]*r
    return y

def space(x,amount=.22):
    y=stereo(x)
    for delay,a in [(.021,.4),(.049,.32),(.083,.25),(.137,.17),(.211,.11),(.317,.07)]:
        n=int(SR*delay);y[n:]+=stereo(x[:-n])[:,::-1]*amount*a
    return y

def norm(x,rms):return x*(rms/(np.sqrt(np.mean(x*x))+1e-9))

def source(name,start,d):
    p=subprocess.run(['ffmpeg','-nostdin','-v','error','-ss',str(start),'-i','/tmp/gz-audio-source/'+name+'.mp3','-t',str(d),'-ar',str(SR),'-ac','2','-f','f32le','pipe:1'],capture_output=True)
    if p.returncode:raise RuntimeError('Source decode failed: '+name)
    x=np.frombuffer(p.stdout,dtype=np.float32).reshape(-1,2).astype(np.float64)
    if len(x)<round(d*SR):x=np.tile(x,(int(np.ceil(d*SR/len(x))),1))[:round(d*SR)]
    return x

def save(key,x,label,loop=False,bitrate='96k',provenance='original acoustic synthesis'):
    if loop:x=seam(x)
    else:x=env(x)
    x=np.tanh(x*.9)/.9
    peak=np.max(np.abs(x))
    if peak>.72:x*=.72/peak
    group,name=key.split('.',1);folder='ambience' if group=='ambience' else group
    path=OUT/folder/(name+'.mp3');path.parent.mkdir(parents=True,exist_ok=True)
    pcm=(x*32767).astype('<i2');channels=2 if x.ndim==2 else 1
    p=subprocess.run(['ffmpeg','-nostdin','-v','error','-y','-f','s16le','-ar',str(SR),'-ac',str(channels),'-i','pipe:0','-codec:a','libmp3lame','-b:a',bitrate,'-map_metadata','-1',str(path)],input=pcm.tobytes(),capture_output=True)
    if p.returncode:raise RuntimeError('Encoding failed: '+key)
    ASSETS.append({'id':key,'file':str(path.relative_to(OUT)),'group':group,'label':label,'duration':round(len(x)/SR,3),'bytes':path.stat().st_size,'loop':loop,'provenance':provenance})
    print(key,round(len(x)/SR,2),flush=True)

def beep(d=.18,f=1900):
    t=time(d);return env((np.sin(2*np.pi*f*t)+.13*np.sin(2*np.pi*f*3*t))*.32,.01)

def impact(d=.32):
    t=time(d);return (.22*noise(d,100,3200)*np.exp(-t*32)+.22*np.sin(2*np.pi*145*t)*np.exp(-t*19)+.1*np.sin(2*np.pi*430*t)*np.exp(-t*25))

def place(y,x,at,volume=1,pan=0):
    start=round(at*SR);stop=min(len(y),start+len(x));x=x[:stop-start]
    if y.ndim==2:
        x=stereo(x);x[:,0]*=np.sqrt((1-pan)/2)*1.414;x[:,1]*=np.sqrt((1+pan)/2)*1.414
    y[start:stop]+=x*volume

# Small mechanical cues: layered contacts, motors, rubber wheels, air pressure.
for i in range(4):
    d=.39;t=time(d);x=.38*noise(d,100,2400)*np.exp(-t*(27+i*2))+.24*np.sin(2*np.pi*(125+i*8)*t)*np.exp(-t*25)
    x+=.1*noise(d,1500,7000)*np.exp(-np.maximum(t-.085,0)*45)*(t>.085)
    save('sfx.'+('footstep' if i==0 else 'footstep'+str(i+1)),space(x,.18),'脚步 · 瓷砖'+str(i+1),bitrate='64k')
save('sfx.gateBeep',space(beep(),.15),'刷票闸机 · 嘀',bitrate='64k')
x=np.zeros(round(.65*SR));place(x,beep(.11,2200),.03);place(x,beep(.11,2200),.22)
save('sfx.securityBeep',space(x,.15),'安检确认',bitrate='64k')
x=np.zeros(round(1.1*SR));place(x,beep(.09,1400),.05);place(x,impact(.35),.38);place(x,impact(.25),.74,.55)
save('sfx.ticketMachine',space(x,.18),'售票机 · 确认与出票',bitrate='64k')
x=np.zeros(round(.9*SR))
for at,v in [(0,.9),(.075,.6),(.17,.4),(.32,.25)]:place(x,impact(.23),at,v)
save('sfx.tokenDrop',space(x,.16),'绿色票币 · 投币回收',bitrate='64k')
d=1.15;t=time(d);x=.045*noise(d,180,4200)*np.sin(np.pi*t/d)**2+.12*np.sin(2*np.pi*(310*t+55*t*t))*np.sin(np.pi*t/d)**2
place(x,impact(.3),.06,.45);place(x,impact(.28),.85,.6)
save('sfx.gateOpen',space(x,.22),'闸机扇门电机',bitrate='64k')
# Reference: refurbished Line 1 A1 dual-tone warning, measured at ~860/645 Hz.
# A high tone ~0.30 s, low tone ~0.44 s, pause ~0.14 s; period ~0.88 s.
d=3.62;t=time(d);x=np.zeros(len(t))
for at in np.arange(.04,3.5,.88):
    hi_t=time(.30);lo_t=time(.44)
    hi=.21*(np.sin(2*np.pi*860*hi_t)+.12*np.sin(2*np.pi*1720*hi_t)+.15*np.sin(2*np.pi*3440*hi_t))
    lo=.26*(np.sin(2*np.pi*645*lo_t)+.08*np.sin(2*np.pi*1290*lo_t)+.11*np.sin(2*np.pi*1935*lo_t))*np.exp(-lo_t*2.4)
    place(x,env(hi,.007),at)
    if at+.3+.44<d:place(x,env(lo,.009),at+.30)
save('sfx.doorChime',space(x,.10),'关门 · 广州1号线双音警示',bitrate='64k',provenance='original resynthesis; measured reference BV1vA8ozkEC4 ~860/645Hz, .88s period')
for key,opening,psd in [('doorOpen',True,False),('doorClose',False,False),('psdOpen',True,True),('psdClose',False,True)]:
    d=2.7 if psd else 2.3;t=time(d);motion=np.sin(np.pi*np.clip(t/d,0,1))**.6
    x=.045*noise(d,120,6000)*motion+.13*noise(d,90,900)*motion
    f=460 if psd else 315;x+=.07*np.sin(2*np.pi*(f*t+18*np.sin(t*1.2)))*motion
    place(x,impact(.34),.035,.65 if opening else .4)
    place(x,impact(.4),d-.45,1 if not opening else .35)
    if opening:x+=noise(d,1300,6500)*.045*np.exp(-t*4)
    save('sfx.'+key,space(x,.14 if not psd else .32),('屏蔽门' if psd else '车门')+('开启' if opening else '关闭'),bitrate='80k')
d=1.55;t=time(d);x=.17*(np.sin(2*np.pi*370*t)+.7*np.sin(2*np.pi*465*t)+.15*np.sin(2*np.pi*740*t));x*=np.minimum(t/.15,1)*np.minimum((d-t)/.28,1)
save('sfx.horn',space(x,.23),'列车气笛 · 手动试听',bitrate='80k')

# Real material texture with procedural ventilation and space. No foreign PA copied.
d=29;t=time(d)
street=norm(band(source('street',130,d),50,6800),.18)
save('ambience.street',street+stereo(noise(d,60,300)*.02),'地面 · 中国城市车流人声',True,provenance='CC0 lastraindrop 757820 + original ventilation')
chatter=norm(band(source('street',170,d),280,1550),.045)
vent=stereo(noise(d,55,850)*.065)+stereo(noise(d,500,4500)*.012)
concourse=space(chatter+vent,.6)
for at in [3.1,10.7,19.9,25.2]:place(concourse,space(beep(.13,1900),.5),at,.24,RNG.uniform(-.85,.85))
save('ambience.concourse',concourse,'站厅 · 混响人声与远处闸机',True,provenance='CC0 lastraindrop 757820 + original station acoustics')
platform=norm(band(source('crowd',41,d),120,1300),.055)+stereo(noise(d,38,630)*.075)
save('ambience.platform',space(platform,.5),'站台 · 空旷混响与通风',True,provenance='CC0 be_a_hero_not_a_patriot 430984 + original ventilation')
idle=stereo(noise(d,35,500)*.065)+stereo(noise(d,1000,4400)*.025)+chatter*.4
idle+=stereo(np.sin(2*np.pi*99*t)*.009+np.sin(2*np.pi*198*t)*.005)
save('ambience.train',idle,'车厢 · 空调与轻微人声',True,provenance='CC0 lastraindrop 757820 + original carriage acoustics')

# Speed-controlled independent layers. Keep idle ventilation independent from rolling.
d=9;t=time(d)
f=390+15*np.sin(2*np.pi*.41*t)+4*np.sin(2*np.pi*3.2*t);phase=2*np.pi*np.cumsum(f)/SR
motor=np.sin(phase)*.115+np.sin(phase*2)*.062+np.sin(phase*3)*.025+np.sin(2*np.pi*90*t)*.05
motor*=.94+.06*np.sin(2*np.pi*.63*t)
save('train.motor',stereo(motor,.09),'牵引 · 电机与逆变器',True)
roll=norm(band(source('ride',150,d),35,2400),.13)+stereo(noise(d,28,260)*.06)
save('train.roll',roll,'轮轨 · 真实行驶纹理',True,provenance='CC0 moxobna 28205, 150s filtered excerpt + original low rail resonance')
joints=np.zeros((len(t),2))
for at in np.arange(.2,d-.45,1.35):
    place(joints,impact(.33),at,.6,-.22);place(joints,impact(.27),at+.14,.44,.22)
save('train.joints',space(joints,.12),'接缝 · 转向架双击',True)
f=1750+45*np.sin(2*np.pi*.72*t)+12*np.sin(2*np.pi*5.3*t);phase=2*np.pi*np.cumsum(f)/SR
brake=(np.sin(phase)*.09+np.sin(phase*1.31)*.026+noise(d,1200,8000)*.012)*(.55+.45*np.sin(2*np.pi*.36*t)**2)
save('train.brake',stereo(brake),'制动 · 钢轮轻微尖声',True)

for name,d in [('approach',15),('depart',13)]:
    t=time(d);approach=name=='approach'
    v=np.clip((12.4-t)/11.8,0,1) if approach else np.clip((t-.8)/10,0,1)
    amp=np.sin(np.pi*np.clip((t-.1)/(d-.1),0,1))**.9
    if approach:amp*=np.clip(t/5,0,1)
    else:amp*=np.clip((d-t)/3.5,0,1)
    f=135+690*v+np.where(v>.55,180,0)+np.where(v>.8,130,0)
    phase=2*np.pi*np.cumsum(f)/SR
    drive=(np.sin(phase)*.09+np.sin(phase*2)*.042+np.sin(phase*3)*.014)*amp
    rumble=noise(d,30,1800)*(.03+.2*v)*amp
    air=noise(d,1100,9000)*.06*amp
    x=stereo(drive+rumble+air)
    # Stereo motion and tunnel early reflections.
    p=np.clip((t/d-.5)*1.1,-.55,.55)
    if approach:p=-p
    x[:,0]*=np.sqrt(1-p);x[:,1]*=np.sqrt(1+p)
    for at in np.arange(2.7,d-2.3,.55):place(x,impact(.28),at,.28*float(np.interp(at,t,amp)))
    if approach:
        squeal=np.sin(2*np.pi*np.cumsum(1650+60*np.sin(t*3))/SR)*.055*np.exp(-((t-11.5)/1.9)**2)
        x+=stereo(squeal)
        place(x,noise(.85,800,7000)*.055*np.exp(-time(.85)*4),13.8)
    save('train.'+name,space(x,.38),'列车'+('进站 · 风压与制动' if approach else '离站 · 牵引与远去'))

manifest=OUT/'manifest.json';data=json.loads(manifest.read_text())
data['assets']=[a for a in data['assets'] if a['group']=='voice']+ASSETS
manifest.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
print('Soundscape manifest ready:',len(ASSETS),'assets',flush=True)
