// Playwright run-code expression. Fresh owned Chromium context required. Native 48kHz audio, CPU1/6.
async page => {
 const label='audio-perf-recheck', errors=[];page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error'&&!m.location().url.endsWith('/favicon.ico'))errors.push(m.text());});
 await page.addInitScript(()=>{
  window.audioNodeQA={panners:0,pannerPeak:0,hrtfPeak:0,sources:0,sourcePeak:0,createdPanners:0,nodes:[]};
  const C=window.AudioContext||window.webkitAudioContext;
  const p=C.prototype.createPanner,b=C.prototype.createBufferSource;
  C.prototype.createPanner=function(){const n=p.apply(this,arguments),q=audioNodeQA;q.panners++;q.createdPanners++;q.pannerPeak=Math.max(q.pannerPeak,q.panners);q.nodes.push(n);let disconnected=false;const d=n.disconnect;n.disconnect=function(){if(!disconnected){disconnected=true;q.panners--;const i=q.nodes.indexOf(n);if(i>=0)q.nodes.splice(i,1);}return d.apply(this,arguments);};return n;};
  C.prototype.createBufferSource=function(){const n=b.apply(this,arguments),start=n.start;let active=false;n.start=function(){const r=start.apply(this,arguments);if(!active){active=true;audioNodeQA.sources++;audioNodeQA.sourcePeak=Math.max(audioNodeQA.sourcePeak,audioNodeQA.sources);}return r;};n.addEventListener('ended',()=>{if(active){active=false;audioNodeQA.sources--;}});return n;};
 });
 await page.addInitScript(()=>{const Original=window.AudioContext;window.AudioContext=class extends Original {constructor(opts){super(Object.assign({},opts,{sampleRate:48000}));}};});
 await page.goto('http://localhost:8080/_dev/audio-test.html?audioPerf='+label);
 await page.waitForFunction(()=>GZ.Audio.getState().loaded,undefined,{timeout:60000});await page.locator('#enable').click();await page.waitForFunction(()=>GZ.Audio.getState().context==='running');
 const cdp=await page.context().newCDPSession(page), results=[];
 for(const rate of [1,6]){
  await cdp.send('Emulation.setCPUThrottlingRate',{rate});
  for(const scenario of ['concourse','doors','train']){
   results.push(await page.evaluate(async ({scenario,rate})=>{
    const A=GZ.Audio;A.stopAll();await new Promise(r=>setTimeout(r,150));A.setStationAnnouncements({enabled:true,initialDelay:600,minInterval:600,maxInterval:600});
    A.setStationAudio({concourseSpeakers:[{x:8,y:20,z:0}],platformSpeakers:[{x:8,y:20,z:0}],trainSpeakers:[{x:8,y:10,z:0}],escalators:Array.from({length:8},(_,i)=>({id:'probe-escalator-'+i,position:{x:i*7-28,y:4,z:4},zone:'concourse',volume:.4}))});
    A.setZone(scenario==='train'?'train':scenario==='doors'?'platform':'concourse');
    if(scenario==='concourse')A.stationAnnouncement('care');
    if(scenario==='train'){A.trainApproach({from:{x:-80,y:3,z:12},to:{x:10,y:3,z:12},sourceId:'probe-train',duration:7});A.announce('next',{station:'njs',dir:1});}if(scenario==='doors')A.announce('gap',{station:'gyq',dir:1});
    const costs=[], intervals=[], snapshots=[];let previous=0,stepAt=0,doorAt=0;const start=performance.now(),position={x:0,y:5,z:0},forward={x:0,y:0,z:-1};
    await new Promise(resolve=>{function frame(now){const elapsed=(now-start)/1000;if(elapsed>=7){resolve();return;}const begin=performance.now();position.x=Math.sin(elapsed)*10;position.z=Math.cos(elapsed)*5;forward.x=-Math.sin(elapsed*.8);forward.z=-Math.cos(elapsed*.8);A.setListener(position,forward);
     if(scenario==='train')A.trainSound({inside:true,speed:.55+.3*Math.sin(elapsed*.4),curve:.2,braking:false});
     if(elapsed-stepAt>=.17){stepAt=elapsed;A.sfx('footstep',{npc:true,sourceId:'npc-probe',position:{x:position.x+4,y:2,z:position.z+3},volume:.35});}
     if(scenario==='doors'&&elapsed-doorAt>=2){doorAt=elapsed;for(const z of [-5,5]){A.sfx('doorOpen',{position:{x:0,y:2,z},duration:1.25});A.sfx('psdOpen',{position:{x:0,y:2,z},duration:1.25});}}
     const cost=performance.now()-begin;if(elapsed>1){costs.push(cost);if(previous)intervals.push(now-previous);}previous=now;
     if(!snapshots.length||elapsed-snapshots[snapshots.length-1].elapsed>=.5){const q=audioNodeQA,s=A.getState(),hrtf=q.nodes.filter(n=>n.panningModel==='HRTF').length;q.hrtfPeak=Math.max(q.hrtfPeak,hrtf);snapshots.push({elapsed,announcing:s.announcing,stationAnnouncing:s.stationAnnouncing,level:A.getLevel(),active:s.active,beds:s.beds,panners:q.panners,hrtf,sources:q.sources,decodedBytes:s.decodedBytes,spatialSources:s.spatialSources.length});}requestAnimationFrame(frame);}requestAnimationFrame(frame);});
    const sorted=costs.slice().sort((a,b)=>a-b);return {scenario,rate,frames:costs.length,fps:1000*intervals.length/intervals.reduce((a,b)=>a+b,0),minimumOneSecondFps:Math.min(...Array.from({length:5},(_,i)=>intervals.slice(i*Math.floor(intervals.length/5),(i+1)*Math.floor(intervals.length/5))).filter(a=>a.length).map(a=>1000*a.length/a.reduce((s,x)=>s+x,0))),scriptMedianMs:sorted[Math.floor(sorted.length/2)],scriptMaxMs:Math.max(...costs),snapshots,state:A.getState()};
   },{scenario,rate}));
  }
 }
 await cdp.send('Emulation.setCPUThrottlingRate',{rate:1});await page.evaluate(()=>GZ.Audio.stopAll());await page.waitForTimeout(1100);
 const after=await page.evaluate(()=>({state:GZ.Audio.getState(),panners:audioNodeQA.panners,sources:audioNodeQA.sources,createdPanners:audioNodeQA.createdPanners,pannerPeak:audioNodeQA.pannerPeak,sourcePeak:audioNodeQA.sourcePeak,hrtfPeak:audioNodeQA.hrtfPeak}));
 await page.screenshot({path:'_dev/shots/audio/perf/'+label+'.png'});
 return {label,browser:page.context().browser().version(),scope:'Isolated audio module real AudioContext; no Three renderer. CPU6 is a rough A12 proxy, not a real iPad.',results,after,errors};
}
