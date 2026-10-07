// Playwright run-code expression. Fresh owned Chromium context required. Native 48kHz audio, CPU6.
async page => {
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error'&&!m.location().url.endsWith('/favicon.ico'))errors.push(m.text());});
 await page.addInitScript(()=>{const Original=window.AudioContext;window.AudioContext=class extends Original {constructor(opts){super(Object.assign({},opts,{sampleRate:48000}));}};});
 await page.goto('http://localhost:8080/_dev/audio-test.html?qa=audio-perf1-48k-lifecycle');const cdp=await page.context().newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate:6});
 await page.waitForFunction(()=>GZ.Audio.getState().loaded,undefined,{timeout:60000});await page.locator('#enable').click();await page.waitForFunction(()=>GZ.Audio.getState().context==='running');
 const result=await page.evaluate(async()=>{
  const A=GZ.Audio,wait=ms=>new Promise(r=>setTimeout(r,ms)),initial=A.getState(),captions=[];window.addEventListener('gz-audio-caption',e=>{if(e.detail)captions.push({at:performance.now(),...e.detail});});
  A.setStationAnnouncements({enabled:true,initialDelay:600,minInterval:600,maxInterval:600});A.setStationAudio({concourseSpeakers:[{x:2,y:18,z:1}],platformSpeakers:[{x:2,y:18,z:1}],trainSpeakers:[{x:2,y:10,z:1}]});A.setZone('train');
  const before=performance.now(),sequence=await A.announce('next',{station:'njs',dir:1}),sequenceCaptions=captions.slice();
  const sequenceSeconds=(performance.now()-before)/1000;
  A.setZone('concourse');const pending=A.stationAnnouncement('care'),pendingAtCancel=A.getState();A.stopAll();const safetyCancelled=await pending;await wait(200);const afterSafetyCancel=A.getState(),captionsAfterCancel=captions.length;
  const cache=[];let pcmMax=initial.decodedBytes,voiceMax=0;
  for(const a of A.getManifest().assets.filter(a=>a.group==='voice')){
   const duration=A.preview(a.id);while(A.getState().pendingVoiceDecodes)await wait(15);A.stopAll();await wait(15);const s=A.getState();pcmMax=Math.max(pcmMax,s.decodedBytes);voiceMax=Math.max(voiceMax,s.voiceCacheBytes);cache.push({id:a.id,duration,decodedBytes:s.decodedBytes,voiceCacheBytes:s.voiceCacheBytes,decodedAssets:s.decodedAssetCount,pending:s.pendingVoiceDecodes});
  }
  await wait(800);const final=A.getState();return {initial,sequence,sequenceSeconds,sequenceCaptions,safetyCancelled,pendingAtCancel:{pending:pendingAtCancel.pendingVoiceDecodes,active:pendingAtCancel.active},afterSafetyCancel,captionsAfterCancel,cache,pcmMax,voiceMax,final};
 });
 await page.locator('#suspend-audio').click();await page.waitForFunction(()=>GZ.Audio.getState().context==='suspended');const suspended=await page.evaluate(()=>GZ.Audio.getState());await page.locator('#enable').click();await page.waitForFunction(()=>GZ.Audio.getState().context==='running');await page.evaluate(()=>GZ.Audio.stopAll());await page.waitForTimeout(800);const resumed=await page.evaluate(()=>GZ.Audio.getState());await cdp.send('Emulation.setCPUThrottlingRate',{rate:1});
 await page.screenshot({path:'_dev/shots/audio/perf/audio-perf-recheck-lifecycle.png'});
 return {scope:'Real 48kHz AudioContext forced by test constructor; CPU6; original local assets, lazy decoding and actual playback/cancellation. Not Safari or real A12.',browser:page.context().browser().version(),...result,suspended,resumed,errors};
}
