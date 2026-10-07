// Playwright run-code expression. Use a fresh owned Chromium context exactly once.
async page => {
 const errors=[];
 page.on('pageerror',e=>errors.push(String(e)));
 page.on('console',m=>{if(m.type()==='error'&&!m.location().url.endsWith('/favicon.ico'))errors.push(m.text());});
 await page.addInitScript(()=>{
  const Original=window.AudioContext;
  window.AudioContext=class extends Original {constructor(opts){super(Object.assign({},opts,{sampleRate:48000}));}};
 });
 const cdp=await page.context().newCDPSession(page);
 await cdp.send('Emulation.setCPUThrottlingRate',{rate:6});
 await page.goto('http://localhost:8080/_dev/audio-test.html?qa=audio-perf-cold-cpu6');
 await page.waitForFunction(()=>GZ.Audio.getState().loaded,undefined,{timeout:60000});
 await page.locator('#enable').click();
 await page.waitForFunction(()=>GZ.Audio.getState().context==='running');
 const result=await page.evaluate(async()=>{
  const A=GZ.Audio,wait=ms=>new Promise(r=>setTimeout(r,ms)),initial=A.getState();
  let phase='warmup',running=true,previous=0,windowAt=0,windowFrames=0;
  const intervals=[],windows=[],captions=[],snapshots=[];
  window.addEventListener('gz-audio-caption',e=>{
   if(e.detail)captions.push({at:performance.now(),phase,...e.detail});
  });
  function frame(now){
   if(!running)return;
   if(previous)intervals.push({at:now,phase,ms:now-previous});
   previous=now;
   if(!windowAt)windowAt=now;
   windowFrames++;
   if(now-windowAt>=1000){
    const s=A.getState();
    windows.push({at:now,phase,fps:windowFrames*1000/(now-windowAt)});
    snapshots.push({phase,decodedBytes:s.decodedBytes,voiceCacheBytes:s.voiceCacheBytes,pendingVoiceDecodes:s.pendingVoiceDecodes,spatialPannerCount:s.spatialPannerCount,hrtfPannerCount:s.hrtfPannerCount,level:A.getLevel()});
    windowAt=now;windowFrames=0;
   }
   requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  A.setStationAnnouncements({enabled:true,initialDelay:600,minInterval:600,maxInterval:600});
  A.setStationAudio({concourseSpeakers:[{x:2,y:18,z:1}],platformSpeakers:[{x:2,y:18,z:1}],trainSpeakers:[{x:2,y:10,z:1}]});
  A.setListener({x:0,y:5,z:0},{x:0,y:0,z:-1});
  await wait(1200);
  phase='cold-next';A.setZone('train');
  const before=performance.now(),sequence=await A.announce('next',{station:'njs',dir:1});
  const sequenceSeconds=(performance.now()-before)/1000;
  phase='cold-safety';A.setZone('concourse');
  const safety=await A.stationAnnouncement('care');
  phase='cold-library';A.stopAll();
  const cache=[];
  for(const asset of A.getManifest().assets.filter(a=>a.group==='voice')){
   const duration=A.preview(asset.id);
   while(A.getState().pendingVoiceDecodes)await wait(20);
   A.stopAll();await wait(20);
   const s=A.getState();cache.push({id:asset.id,duration,decodedBytes:s.decodedBytes,voiceCacheBytes:s.voiceCacheBytes});
  }
  phase='settle';await wait(1300);running=false;
  return {initial,sequence,sequenceSeconds,safety,captions,cache,windows,intervals,snapshots,final:A.getState()};
 });
 await cdp.send('Emulation.setCPUThrottlingRate',{rate:1});
 await page.screenshot({path:'_dev/shots/audio/perf/audio-perf-cold-cpu6.png'});
 return {scope:'Isolated native Web Audio cold first-decode/frame scheduling under CPU6 and actual forced48kHz context. No Three renderer. Not A12/Safari certification.',browser:page.context().browser().version(),...result,errors};
}
