/* Play: first-person journey, child-sized UI, module integration. No build/runtime dependencies. */
(function () {
'use strict';
var GZ=window.GZ=window.GZ||{},T=window.THREE,C=GZ.config,$=function(id){return document.getElementById(id);};
var queryFlags=new URLSearchParams(location.search),auditEnabled=queryFlags.get('audit')==='1',perfEnabled=queryFlags.get('perf')==='1',runtime,gameGeometry,perfTier=0,perfStages={},perfWindowFrames=0,perfWindowTime=0,perfScript=0,perfBadge,perfClockBuffer=new Float64Array(9),modulePrewarm=[];
var scene,camera,renderer,station,train,tunnel,crowd,strapSpots,track,trackIdx=0,door,doorIdx=0;
var origin=0,destination=3,current=0,dir=1,stage='loading',elapsed=0,journeyStarted=0,travelled=0;
var moving=false,path=[],pathIdx=0,onWalkEnd=null,feet=new T.Vector3(),targetPoint=new T.Vector3(),marker,markerRing;
var yaw=0,pitch=-.08,seated=false,trainAttached=false,token=false,muted=false,doorOpen=0,speed=0;
var alightOpen=0,approachDuration=15,stageTimer=0,rideDuration=22,voiceDone=true,goalAction=null,secondAction=null,toastTimer=0,footstepTimer=0;
var pointer={down:false,x:0,y:0,lastX:0,lastY:0,moved:false},lookHold=0;
var v=new T.Vector3(),projected=new T.Vector3(),lookVector=new T.Vector3(),ray=new T.Raycaster(),ndc=new T.Vector2(),plane=new T.Plane();
var lastFrame=0,fps=60,frames=0,frameTime=0,moduleState={world:false,audio:false,placeholder:true},errors=[];
var trainParams={speed:0,inside:false,braking:false,curve:0};
var viewAssist=null,headLocal=new T.Vector3(),headWorld=new T.Vector3(),audioForward=new T.Vector3(),doorLook=new T.Vector3();
var interaction=null,coinHeld=false,coinBusy=false,coinDrag=null,doorMotion=null,closingMotion=false,boardingRelease=false,closingSoundTimer=-1;
var playerShoes=[],bodyYaw=0,walkEscalator=false,audioZone='none',lookHelpTimer=8,nextNpcSound=0;
var interactionPoint=new T.Vector3(),coinHistory=[],nextInteractionLayout=0;
var announcements=[],runtimeNotices=[],journeyEpoch=0,geometry,audit,physics=GZ.PlayPhysics,frontReserve=new T.Vector3(),stationIndex,trainIndex,collisionSet;
window.addEventListener('error',function(e){errors.push(e.message);});
window.addEventListener('unhandledrejection',function(e){errors.push(String(e.reason));});
function toast(text,seconds){$('toast').textContent=text;$('toast').classList.add('show');toastTimer=seconds||4;}
function audioCall(name,arg,opts){try{return GZ.Audio&&GZ.Audio[name]?GZ.Audio[name](arg,opts):undefined;}catch(e){runtimeNotices.push(name+': '+e.message);return undefined;}}
function positionedSound(name,position,duration,volume){audioCall('sfx',name,{position:position,duration:duration,volume:volume===undefined?.6:volume});}
function configureStationAudio(){
 var n=station.nav,z=track.z,carX=door.x;
 audioCall('setStationAudio',{
  concourseSpeakers:[{x:n.security.x,y:21.8,z:n.security.z},{x:n.tvm.x,y:21.8,z:n.tvm.z},{x:n.gateOut[0].x,y:21.8,z:n.gateOut[0].z}],
  platformSpeakers:[{x:-60,y:10,z:trackIdx? -5:5},{x:door.x,y:10,z:trackIdx? -5:5},{x:60,y:10,z:trackIdx? -5:5}],
  trainSpeakers:[{x:carX-10,y:8,z:z},{x:carX+10,y:8,z:z}],
  escalators:[{id:'entrance',position:{x:-69,y:21,z:27},zone:'concourse'},
   {id:'platform-down',position:{x:-23,y:8,z:2},zone:'platform'},
   {id:'platform-up',position:{x:-23,y:8,z:-2},zone:'platform'},
   {id:'outer-up',position:{x:32,y:8,z:trackIdx?-25.6:25.6},zone:'platform'},
   {id:'exit',position:{x:57,y:21,z:27},zone:'concourse'}]
 });
}
function guideLook(points,duration,done){lookHold=Math.min(lookHold,1.5);viewAssist={points:Array.isArray(points)?points:[points],time:0,duration:duration||1.8,done:done};}
function lookToward(p,dt){
 var dx=p.x-feet.x,dz=p.z-feet.z,dy=p.y-(feet.y+C.EYE_H),horizontal=Math.sqrt(dx*dx+dz*dz);
 if(horizontal<.01)return;
 var wanted=Math.atan2(-dx,-dz),delta=Math.atan2(Math.sin(wanted-yaw),Math.cos(wanted-yaw));
 yaw+=delta*(1-Math.exp(-dt*4));var tilt=Math.max(interaction?-.95:-.55,Math.min(.35,Math.atan2(dy,horizontal)));pitch+=(tilt-pitch)*(1-Math.exp(-dt*4));
}
function cameraGuide(dt){
 if(pointer.down||lookHold>0)return;
 if(stage==='approaching'){
  headWorld.copy(headLocal).add(train.group.position);
  if((headWorld.x-feet.x)*dir<45)lookToward(headWorld,dt);
  else {doorLook.set(door.x,train.floorY+2.8,track.z+door.z);lookToward(doorLook,dt);}
  return;
 }
 if(!viewAssist||moving)return;
 var tour=viewAssist; tour.time+=dt;var segment=Math.min(tour.points.length-1,Math.floor(tour.time/tour.duration*tour.points.length));lookToward(tour.points[segment],dt);
 if(tour.time>=tour.duration+1){viewAssist=null;if(tour.done)tour.done();}
}
function clearInteraction(){interaction=null;coinHeld=false;coinBusy=false;coinDrag=null;$('toast').classList.remove('show');$('findInteraction').hidden=true;$('interactionTarget').hidden=true;$('handCoin').hidden=true;$('coinFlight').hidden=true;}
function machinePoint(machine,x,y,z){var g=machine.group;return{x:(g?g.position.x:feet.x)+x,y:(g?g.position.y:feet.y)+y,z:(g?g.position.z:feet.z+3)+z};}
function coinTask(kind,point,label,coin){
 nextInteractionLayout=0;$('handCoin').style.cssText='';$('findInteraction').style.cssText='';interaction={kind:kind,point:point};interactionPoint.set(point.x,point.y,point.z);coinHeld=false;coinBusy=false;
 $('findInteraction').hidden=false;$('findInteraction').textContent=kind==='pickup'?'↪ 看回取票口':'↪ 看回机器';$('interactionTarget').textContent=label;$('interactionTarget').hidden=false;$('handCoin').hidden=!coin;$('handCoin').classList.remove('held');$('handCoin').classList.toggle('payment',coin==='payment');
 $('handCoin').querySelector('.coin').textContent=coin==='payment'?'¥':'1';$('handCoin').querySelector('b').textContent=coin==='payment'?'点起购票硬币':'点起绿色票币';
 marker.visible=false;$('worldTarget').hidden=true;guideLook(point,1.5);
}
function flyCoin(done){
 coinBusy=true;var start=$('handCoin').getBoundingClientRect(),end=$('interactionTarget').getBoundingClientRect(),fly=$('coinFlight');if(coinDrag&&coinDrag.moved)start={left:end.left+end.width/2-36,top:end.top,height:end.height};
 fly.classList.toggle('payment',interaction.kind==='pay');fly.textContent=interaction.kind==='pay'?'¥':'1';fly.hidden=false;fly.style.left=(start.left+36)+'px';fly.style.top=(start.top+start.height/2)+'px';$('handCoin').hidden=true;
 var animation=fly.animate([{left:(start.left+36)+'px',top:(start.top+start.height/2)+'px',transform:'translate(-50%,-50%) scale(1)'},{left:(end.left+end.width/2)+'px',top:(end.top+end.height/2)+'px',transform:'translate(-50%,-50%) scale(.6)'}],{duration:650,easing:'ease-in-out',fill:'forwards'}),epoch=journeyEpoch;
 animation.onfinish=function(){fly.hidden=true;animation.cancel();if(epoch===journeyEpoch){coinBusy=false;done();}};
}
function touchCoin(){audioCall('unlock');if(!interaction||coinBusy)return;coinHeld=true;$('handCoin').classList.add('held');$('handCoin').querySelector('b').textContent=interaction.kind==='pay'?'再点售票机投币口':interaction.kind==='brush'?'再点感应区，贴一下':'再点投币口，投进去';}
function touchMachine(){
 audioCall('unlock');if(!interaction||coinBusy)return;var kind=interaction.kind;
 if(kind==='screen'){
  var tvm=station.interact.tvm;tvm.setMessage&&tvm.setMessage('去 '+C.STATIONS[destination].name);
  setGoal('投一枚硬币买票','先点起手里的购票硬币，再点售票机投币口。',null,null);
  coinTask('pay',machinePoint(tvm,.87,1.8,-1.14),'投币口','payment');return;
 }
 if(kind==='pickup'){
  station.interact.tvm.close&&station.interact.tvm.close();coinHistory.push('亲手取票');clearInteraction();token=true;$('token').hidden=false;toast('拿好了！绿色币要留到出站。');gateGoal();return;
 }
 if(!coinHeld){toast('先点起你手里的币，再送到这里。');return;}
 flyCoin(function(){
  coinHistory.push(kind==='pay'?'投硬币买票':kind==='brush'?'贴币进闸':'投币出闸');
  if(kind==='pay'){
   var tvm=station.interact.tvm;positionedSound('ticketMachine',tvm.group.position);tvm.buy();
   setGoal('绿色票币出来啦！','点一下机器下方的绿色币，把票拿到手里。',null,null);
   coinTask('pickup',machinePoint(tvm,-.2,.7,-1.3),'拿绿色票币',null);
  }else{
   var gate=kind==='brush'?station.interact.gatesIn[0]:station.interact.gatesOut[0];
   positionedSound(kind==='brush'?'gateBeep':'tokenDrop',gate.group.position);positionedSound('gateOpen',gate.group.position,gate.duration||.6);
   if(kind==='brush')gate.open();else{gate.insertToken();token=false;$('token').hidden=true;}
   clearInteraction();toast(kind==='brush'?'嘀！币还在手里，可以过闸啦。':'票币投进去回收了，可以出闸啦。');
   setGoal(kind==='brush'?'扇门打开了，走过去吧':'扇门打开了，出闸吧','等扇门完全打开，再跟着脚印走。',null,null);
   var epoch=journeyEpoch;setTimeout(function(){if(epoch!==journeyEpoch)return;walk([kind==='brush'?station.nav.gateInExit[0]:station.nav.gateOutExit[0]],function(){gate.close();if(kind==='brush')platformGoal();else streetExitGoal();});},(gate.duration||.6)*1000+100);
  }
 });
}
var interactionWidth=78,interactionHeight=64,interactionFooterTop=innerHeight-90;
function dockControl(r,footer,avoid,preferred){
 var margin=12;
 function clear(x,y){if(x<margin||x+r.width>innerWidth-margin||y<80||y+r.height>footer.top-margin)return false;for(var i=0;i<avoid.length;i++){var a=avoid[i];if(x<a.right+margin&&x+r.width>a.left-margin&&y<a.bottom+margin&&y+r.height>a.top-margin)return false;}return true;}
 var chosen=null;if(clear(r.left,r.top))chosen={x:r.left,y:r.top};
 for(var i=0;!chosen&&i<preferred.length;i++){var q=preferred[i];if(clear(q.x,q.y))chosen=q;}
 for(var row=0;!chosen&&row<5;row++)for(var col=0;!chosen&&col<3;col++){var x=margin+(innerWidth-r.width-margin*2)*col/2,y=86+Math.max(0,footer.top-r.height-margin-86)*row/4;if(clear(x,y))chosen={x:x,y:y};}
 return chosen?{left:chosen.x,top:chosen.y,right:chosen.x+r.width,bottom:chosen.y+r.height,width:r.width,height:r.height}:null;
}
function layoutInteraction(x,y,shown){
 // Read every size before writing positions. Target avoidance uses its next screen position.
 var target=$('interactionTarget'),helper=$('findInteraction'),coin=$('handCoin'),tr=target.getBoundingClientRect(),h=helper.getBoundingClientRect(),cr=coin.getBoundingClientRect(),footer=$('objective').getBoundingClientRect(),avoid=[];
 if(tr.width){interactionWidth=tr.width;interactionHeight=tr.height;}interactionFooterTop=footer.top;x=Math.max(interactionWidth/2+16,Math.min(innerWidth-interactionWidth/2-16,x));y=Math.max(80+interactionHeight/2,Math.min(footer.top-interactionHeight/2-12,y));if(shown&&tr.width)avoid.push({left:x-tr.width/2,right:x+tr.width/2,top:y-tr.height/2,bottom:y+tr.height/2});
 var hr=dockControl(h,footer,avoid,[{x:18,y:footer.top-h.height-12},{x:18,y:86}]);if(hr)avoid.push(hr);
 var placed=!coin.hidden&&!coinDrag?dockControl(cr,footer,avoid,[{x:innerWidth-cr.width-24,y:86},{x:24,y:86},{x:innerWidth-cr.width-24,y:footer.top-cr.height-12},{x:24,y:Math.max(86,innerHeight/2-cr.height/2)}]):null;
 function apply(el,r){if(!r)return;el.style.left=r.left+'px';el.style.right='auto';el.style.top=(r.top+(el.id==='handCoin'&&coinHeld?5:0))+'px';el.style.bottom='auto';}
 apply(helper,hr);apply(coin,placed);
}
function interactionUpdate(){
 if(!interaction){if(!$('interactionTarget').hidden)$('interactionTarget').hidden=true;if(!$('findInteraction').hidden)$('findInteraction').hidden=true;return;}
 projected.copy(interactionPoint);projected.project(camera);
 var shown=projected.z<=1&&projected.z>=-1&&Math.abs(projected.x)<=1&&Math.abs(projected.y)<=1,x=Math.max(.07,Math.min(.93,projected.x*.5+.5))*innerWidth,y=Math.max(.15,Math.min(.76,-projected.y*.5+.5))*innerHeight;
 if(elapsed>=nextInteractionLayout){layoutInteraction(x,y,shown);nextInteractionLayout=elapsed+.1;}
 x=Math.max(interactionWidth/2+16,Math.min(innerWidth-interactionWidth/2-16,x));y=Math.max(80+interactionHeight/2,Math.min(interactionFooterTop-interactionHeight/2-12,y));$('interactionTarget').hidden=!shown;$('interactionTarget').style.left=x+'px';$('interactionTarget').style.top=y+'px';
}
function animateDoors(open,alight,done){
 var duration=train.doorDuration||1.25;doorMotion={open:open,alight:alight,done:done};
 function soundSide(target,current,d){
  if(Math.abs(target-current)<.001)return;
  var sound=target>current?'Open':'Close',position=worldTrainPoint(d);
  positionedSound('door'+sound,position,duration,.55);positionedSound('psd'+sound,position,duration,.4);
 }
 soundSide(open,doorOpen,door);
 if(station.spanishLayout)soundSide(alight,alightOpen,exitDoor());
}
function doorUpdate(dt){
 if(!doorMotion)return;var m=doorMotion,delta=dt/(train.doorDuration||1.25);
 doorOpen+=Math.sign(m.open-doorOpen)*Math.min(Math.abs(m.open-doorOpen),delta);
 alightOpen+=Math.sign(m.alight-alightOpen)*Math.min(Math.abs(m.alight-alightOpen),delta);
 train.setDoors(track.side,doorOpen);station.psd.setOpen(trackIdx,doorOpen);
 if(station.spanishLayout){train.setDoors(track.alightSide,alightOpen);station.psd.setAlightOpen(trackIdx,alightOpen);}
 if(Math.abs(m.open-doorOpen)<.001&&Math.abs(m.alight-alightOpen)<.001){doorMotion=null;if(m.done)m.done();}
}
function npcFootsteps(){
 if(elapsed<nextNpcSound)return;
 var nearest=null,best=225;
 for(var i=0;i<crowd.count;i++){
  var a=crowd.actors[i];if(!a.visible||!a.walking||a.renderVisible===false||elapsed<a.nextFootstep)continue;
  var px=a.position.x+(trainAttached?train.group.position.x:0),py=a.position.y+(trainAttached?train.group.position.y:0),pz=a.position.z+(trainAttached?train.group.position.z:0);
  var dx=px-feet.x,dz=pz-feet.z,distance=dx*dx+dz*dz;
  if(Math.abs(py-feet.y)<4&&distance<best){best=distance;nearest=a;}
 }
 if(nearest){nearest.soundPosition.copy(nearest.position);if(trainAttached)nearest.soundPosition.add(train.group.position);nearest.soundPosition.y+=.1;nearest.nextFootstep=elapsed+.48;nextNpcSound=elapsed+.17;audioCall('sfx','footstep',nearest.soundOpts);}
}
function say(key,idx){var item={key:key,station:C.STATIONS[idx===undefined?current:idx].id,dir:dir};announcements.push(item);var result;try{result=GZ.Audio.announce(key,{station:item.station,dir:dir,platform:trackIdx+1});}catch(e){runtimeNotices.push(e.message);}return Promise.resolve(result).catch(function(e){runtimeNotices.push('广播: '+e.message);});}
function boundedVoice(key,idx){return Promise.race([say(key,idx),new Promise(function(resolve){setTimeout(resolve,45000);})]);}
function setProgress(n,text){$('loadProgress').value=n;$('loadText').textContent=text;}
function loadScript(url){return fetch(url,{method:'HEAD',cache:'no-store'}).then(function(r){if(!r.ok)return false;return new Promise(function(resolve){var script=document.createElement('script');script.src=url+'?v='+Date.now();script.onload=function(){resolve(true);};script.onerror=function(){resolve(false);};document.head.appendChild(script);});}).catch(function(){return false;});}
// Contract substitutes let Play develop before colleagues' files arrive. Real modules always win.
function substitutes(){
 if(!GZ.Audio)GZ.Audio={preload:function(cb){if(cb)cb(1);return Promise.resolve();},unlock:function(){},setMuted:function(){},setZone:function(){},sfx:function(){},trainSound:function(){},trainApproach:function(){return 5;},trainDepart:function(){return 5;},announce:function(){return Promise.resolve();}};
 function box(parent,x,y,z,w,h,d,color){var m=new T.Mesh(new T.BoxGeometry(w,h,d),new T.MeshLambertMaterial({color:color}));m.position.set(x,y,z);parent.add(m);return m;}
 if(!GZ.Train)GZ.Train={create:function(){var g=new T.Group();box(g,0,1,0,40,2,10,0xf6cf1b);box(g,0,8.8,0,40,.5,10,0xf6cf1b);box(g,0,4,5,40,6,.2,0xf6cf1b);return {group:g,length:40,floorY:2,doors:[{car:0,side:-1,x:0,z:-5},{car:0,side:1,x:0,z:5}],seats:[{car:0,x:-6,y:2.95,z:3.5,yaw:Math.PI,position:{x:-6,y:2.95,z:3.5}}],standSpots:[{car:0,x:0,y:2,z:0}],walkBounds:{minX:-18,maxX:18,minZ:-3,maxZ:3},setDoors:function(){},setRoute:function(){},setLights:function(){},update:function(){}};}};
 if(!GZ.Station)GZ.Station={build:function(opts){var g=new T.Group(),nav={paths:{}};function p(n,x,y,z){return nav[n]={x:x,y:y,z:z};}p('streetSpawn',-25,28,0);p('entranceTop',-12,28,0);p('entranceBottom',0,14,0);p('security',4,14,0);p('securityExit',10,14,0);p('tvm',12,14,-8);p('platformCenter',0,2,0);p('platformEscalatorTop',22,14,0);p('platformEscalatorBottom',38,2,0);p('exitBottom',15,14,-15);p('exitTop',0,28,-28);p('landmark',-12,28,-32);nav.gateIn=[{x:18,y:14,z:-8}];nav.gateInExit=[{x:23,y:14,z:-8}];nav.gateOut=[{x:20,y:14,z:-16}];nav.gateOutExit=[{x:14,y:14,z:-16}];nav.platformDoorSpotsByTrack=[[{x:0,y:2,z:7.5}],[{x:0,y:2,z:-7.5}]];nav.platformDoorSpots=nav.platformDoorSpotsByTrack[opts.dir===1?0:1];nav.paths.enter=[nav.streetSpawn,nav.entranceTop,nav.entranceBottom,nav.security];nav.paths.buyTicket=[nav.securityExit,nav.tvm];nav.paths.toGate=[nav.tvm,nav.gateIn[0]];nav.paths.toPlatform=[nav.gateInExit[0],nav.platformEscalatorTop,nav.platformEscalatorBottom,nav.platformCenter];nav.paths.exitPlatform=[nav.platformCenter,nav.platformEscalatorBottom,nav.platformEscalatorTop,nav.gateOut[0]];nav.paths.leave=[nav.gateOutExit[0],nav.exitBottom,nav.exitTop,nav.landmark];nav.pathToDoor=function(i,t){return [nav.platformCenter,nav.platformDoorSpotsByTrack[t][0]];};box(g,0,1,0,70,2,18,0xd1d5c8);box(g,10,13,0,70,1,55,0xe8dfc7);box(g,-10,27,0,90,1,90,0xcbdcb2);box(g,12,16,-10,4,4,2,0x37938c);var noop=function(){};var gate={open:noop,close:noop,insertToken:noop};return {group:g,trackY:0,platformY:2,nav:nav,tracks:[{z:14.6,stopX:0,side:-1,platformZ:9.4},{z:-14.6,stopX:0,side:1,platformZ:-9.4}],interact:{tvm:{buy:noop,close:noop},gatesIn:[gate],gatesOut:[gate]},psd:{setOpen:noop},pids:{set:noop},setStation:noop,setDirection:noop,setZone:noop,update:noop};},buildTunnel:function(){var g=new T.Group();return{group:g,update:function(){}};}};
}
function point(p){return {x:p.x,y:p.y,z:p.z,kind:p.kind,speed:p.speed,escalator:p.escalator};}
function worldTrainPoint(p){return {x:p.x+train.group.position.x,y:(p.y===undefined?train.floorY:p.y)+train.group.position.y,z:p.z+train.group.position.z};}
function setup(){
 scene=new T.Scene();scene.background=new T.Color(0xc6e6f2);scene.fog=new T.Fog(0xc6e6f2,180,450);
 camera=new T.PerspectiveCamera(65,innerWidth/innerHeight,.12,900);camera.rotation.order='YXZ';
 renderer=new T.WebGLRenderer({canvas:$('scene'),antialias:true,alpha:false,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5));renderer.setSize(innerWidth,innerHeight);renderer.outputEncoding=T.sRGBEncoding;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1;renderer.shadowMap.enabled=false;
 scene.add(new T.HemisphereLight(0xffffff,0x89999a,1.0));var sun=new T.DirectionalLight(0xfff4d4,.8);sun.position.set(40,100,30);scene.add(sun);
 train=GZ.Train.create();scene.add(train.group);strapSpots=train.strapSpots||GZ.NPC.fitTrainStraps(train);
 var doorXs=train.doors.filter(function(d){return d.side===-1;}).map(function(d){return d.x;});
 station=GZ.Station.build({station:C.STATIONS[origin],dir:dir,doorXs:doorXs});scene.add(station.group);
 tunnel=GZ.Station.buildTunnel();scene.add(tunnel.group);tunnel.group.visible=false;
 crowd=GZ.NPC.create({scene:scene,count:60});
 stationIndex=new physics.Spatial(station.colliders);trainIndex=new physics.Spatial(train.colliders);
 runtime=new physics.Runtime(station,train);gameGeometry=runtime;crowd.enableFast(runtime);crowd.ground=function(p){if(crowd.group.parent===train.group){var local=runtime.trainField.ground(p.x,p.y,p.z);if(local||!crowd.currentActor||!crowd.currentActor.transit)return local;runtime.local.copy(p).add(train.group.position);var g=runtime.ground(runtime.local,false);if(g)g.y-=train.group.position.y;return g;}return runtime.ground(p,false);};crowd.colliders=runtime;
 if(auditEnabled){geometry=new physics.Geometry([station.group,train.group,tunnel.group],crowd.group);geometry.sync();}
 if(auditEnabled)audit=new physics.Audit(function(){return {active:document.body.classList.contains('playing')&&stage!=='selection',stage:stage,interaction:interaction,feet:feet,bodyYaw:bodyYaw,moving:moving,camera:camera,geometry:geometry,station:station,train:train,crowd:crowd};});
 var material=new T.MeshBasicMaterial({color:0xffdc48,transparent:true,opacity:.75,depthWrite:false});
 marker=new T.Group();marker.name='下一步的发光脚印';var ring=new T.Mesh(new T.RingGeometry(.9,1.22,32),material);ring.rotation.x=-Math.PI/2;ring.position.y=.05;marker.add(ring);markerRing=ring;
 var shoeGeo=new T.BoxGeometry(.38,.06,.8);for(var i=0;i<2;i++){var shoe=new T.Mesh(shoeGeo,material);shoe.position.set(i===0?-.26:.26,.08,i===0?.13:-.13);marker.add(shoe);}scene.add(marker);marker.visible=false;
 for(var fi=0;fi<2;fi++){var shoe=new T.Mesh(new T.BoxGeometry(.47,.26,.66),new T.MeshLambertMaterial({color:0x344856}));shoe.name='玩家实际落脚 '+fi;shoe.userData.playBody=true;scene.add(shoe);playerShoes.push(shoe);}
 perfBadge=document.createElement('output');perfBadge.id='perfBadge';perfBadge.hidden=!perfEnabled;document.body.appendChild(perfBadge);
 prewarmPopulations();warmRenderer();chooseTrack();feet.copy(station.nav.streetSpawn);updateCamera(0);station.setZone&&station.setZone('street');populate('street');
 window.addEventListener('resize',resize);new ResizeObserver(function(){document.documentElement.style.setProperty('--objective-height',$('objective').getBoundingClientRect().height+'px');}).observe($('objective'));bindInput();requestAnimationFrame(frame);
}
function warmRenderer(){var savedDir=dir,previousTarget=renderer.getRenderTarget(),warmTarget=new T.WebGLRenderTarget(256,192);warmTarget.texture.encoding=renderer.outputEncoding;renderer.setRenderTarget(warmTarget);modulePrewarm=[];for(var warmModule of [{name:'station',module:station},{name:'train',module:train},{name:'tunnel',module:tunnel}])if(warmModule.module.prewarmTextures)modulePrewarm.push({name:warmModule.name,version:station===warmModule.module?GZ.Station.VERSION:GZ.Train.VERSION,result:warmModule.module.prewarmTextures(renderer),panels:warmModule.module.getPanelStats?warmModule.module.getPanelStats():null});train.group.visible=true;tunnel.group.visible=true;crowd.hideAll();crowd.update(0,true);var warmedTextures=new Set();scene.traverse(function(o){var materials=Array.isArray(o.material)?o.material:o.material?[o.material]:[];for(var mi=0;mi<materials.length;mi++){var mat=materials[mi];for(var key in mat){var texture=mat[key];if(texture&&texture.isTexture&&!warmedTextures.has(texture)){warmedTextures.add(texture);renderer.initTexture(texture);}}}});function warmViews(p){camera.position.set(p.x,p.y+C.EYE_H,p.z);for(var wy=0;wy<8;wy++)for(var wp of [0,.65,-1.05]){camera.rotation.set(wp,wy*Math.PI/4,0,'YXZ');renderer.render(scene,camera);}}for(var i=0;i<C.STATIONS.length;i++){station.setStation(C.STATIONS[i]);for(var direction of [1,-1]){dir=direction;chooseTrack();train.setRoute({stations:C.STATIONS,currentIdx:i,nextIdx:Math.max(0,Math.min(3,i+direction)),dir:direction});for(var z of ['street','concourse','platform']){station.group.visible=true;train.group.visible=false;tunnel.group.visible=false;station.setZone&&station.setZone(z);var p=z==='street'?station.nav.streetSpawn:z==='concourse'?station.nav.security:station.nav.platformCenter;warmViews(p);if(z==='platform'){train.group.visible=true;warmViews(p);warmViews({x:door.x,y:train.floorY,z:track.z});}}station.group.visible=false;train.group.visible=true;tunnel.group.visible=true;warmViews({x:door.x,y:train.floorY,z:track.z});station.group.visible=true;}}
 renderer.setRenderTarget(previousTarget);warmTarget.dispose();dir=savedDir;station.setStation(C.STATIONS[origin]);chooseTrack();station.group.visible=true;train.group.visible=false;tunnel.group.visible=false;}
function resize(){nextInteractionLayout=0;camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);}
function chooseTrack(){trackIdx=dir===1?0:1;track=station.tracks[trackIdx];train.group.position.set(track.stopX||0,station.trackY,track.z);tunnel.group.position.set(0,station.trackY,track.z);tunnel.setDirection&&tunnel.setDirection(dir);if(station.setDirection&&station.activeTrackIdx!==trackIdx)station.setDirection(dir);var ds=train.doors.filter(function(d){return d.side===track.side;});doorIdx=0;for(var i=1;i<ds.length;i++)if(Math.abs(ds[i].x)<Math.abs(ds[doorIdx].x))doorIdx=i;door=ds[doorIdx];var hp=train.getHeadPosition?train.getHeadPosition(dir):{x:dir*train.length/2,y:3.85,z:0};headLocal.set(hp.x,hp.y,hp.z);configureStationAudio();updateRoute();}
function updateRoute(){if(tunnel.setStation)tunnel.setStation(C.STATIONS[Math.max(0,Math.min(C.STATIONS.length-1,current+dir))]);train.setRoute({stations:C.STATIONS,currentIdx:current,nextIdx:current+dir,dir:dir});$('trip').textContent=C.STATIONS[origin].name+' → '+C.STATIONS[destination].name;$('routeStrip').innerHTML='';C.STATIONS.forEach(function(st,i){var span=document.createElement('span');span.textContent=st.name;span.className=i===current?'current':i===current+dir?'next':((i-current)*dir<0?'past':'');$('routeStrip').appendChild(span);});}
function zone(z){audioZone=z;audioCall('setZone',z);if(station.setZone)station.setZone(z==='train'?'platform':z);scene.background.set(z==='street'?0xc6e6f2:0x819198);scene.fog.color.copy(scene.background);populate(z);}
function spreadPath(id,route,fraction,opts){
 crowd.setPath(id,route,opts);var a=crowd.actors[id],total=0,k;
 for(k=0;k<(opts&&opts.loop===false?route.length-1:route.length);k++){var u=route[k],w=route[(k+1)%route.length];total+=Math.sqrt(Math.pow(w.x-u.x,2)+Math.pow(w.y-u.y,2)+Math.pow(w.z-u.z,2));}
 var dist=total*fraction;
 for(k=0;k<route.length;k++){var from=route[k],to=route[(k+1)%route.length],len=Math.sqrt(Math.pow(to.x-from.x,2)+Math.pow(to.y-from.y,2)+Math.pow(to.z-from.z,2));if(dist<=len){var t=len?dist/len:0;a.position.set(from.x+(to.x-from.x)*t,from.y+(to.y-from.y)*t,from.z+(to.z-from.z)*t);a.pathIndex=(k+1)%route.length;break;}dist-=len;}
}
var populationCache=new Map();
function populationKey(z){return z+'|'+dir+'|'+(station.spanishLayout?1:0)+'|'+(z==='platform'&&Math.abs(feet.z)>19?1:0);}
function savePopulation(){return crowd.actors.map(function(a){return {position:a.position.clone(),path:a.path.slice(),pathIndex:a.pathIndex,loop:a.loop,speed:a.speed,yaw:a.yaw,scale:a.scale,visible:a.visible,state:a.state,pose:a.pose,backpack:a.backpack,pause:a.pause,followParent:a.followParent,strapAnchor:a.strapAnchor};});}
function populate(z){var cached=populationCache.get(populationKey(z));if(!cached){buildPopulation(z);return;}crowd.attach(z==='train'?train.group:scene);for(var i=0;i<crowd.count;i++){var a=crowd.actors[i],c=cached[i];a.position.copy(c.position);a.path=c.path.slice();a.pathIndex=c.pathIndex;a.loop=c.loop;a.speed=c.speed;a.yaw=c.yaw;a.scale=c.scale;a.visible=c.visible&&!!crowd.mask[i];a.state=c.state;a.pose=c.pose;a.backpack=c.backpack;a.pause=c.pause;a.followParent=c.followParent;a.strapAnchor=c.strapAnchor;a.walking=false;a.escalator=false;a.supportId=null;a.shoeOffsetL=a.shoeOffsetR=0;a.fastBodyKey=null;a.transit=false;}crowd.dirty=true;}
function prewarmPopulations(){var savedDir=dir,savedFeet=feet.clone();for(var stationType of [0,1]){station.setStation(C.STATIONS[stationType]);for(var direction of [1,-1]){dir=direction;chooseTrack();for(var z of ['street','concourse','platform','outer','train']){if(z==='outer'&&!station.spanishLayout)continue;var zoneName=z==='outer'?'platform':z,spawn=zoneName==='street'?station.nav.streetSpawn:zoneName==='concourse'?station.nav.security:zoneName==='train'?{x:door.x,y:train.floorY,z:track.z}:z==='outer'?station.nav.alightSpotsByTrack[trackIdx][doorIdx]:station.nav.platformCenter;feet.copy(spawn);train.group.visible=zoneName==='train';buildPopulation(zoneName);runtime.attached=zoneName==='train';crowd.avoidPlayer(feet.x-(runtime.attached?train.group.position.x:0),feet.y,feet.z-(runtime.attached?train.group.position.z:0),3.5,null);crowd.reservations.length=0;crowd.escalators=runtime.attached?[]:station.escalators;crowd.advanceFast(0);var snapshot=savePopulation();for(var warm=0;warm<12;warm++){station.update(1/60);train.update(1/60,0);crowd.advanceFast(1/60);crowd.update(0,true);}populationCache.set(populationKey(zoneName),snapshot);}}}crowd.physicsStats.precomputedUnresolved=crowd.physicsStats.unresolved;dir=savedDir;feet.copy(savedFeet);station.setStation(C.STATIONS[origin]);chooseTrack();train.group.visible=false;}
function buildPopulation(z){
 crowd.attach(scene);crowd.currentActor=null;crowd.hideAll();
 var nav=station.nav,i,base,route,p;
 if(z==='train'){
   crowd.attach(train.group);var seats=train.seats,car=door.car;crowd.reservedCar=car;crowd.reservedDoorX=door.x;
   var grips=strapSpots.filter(function(p){return p.car!==car||Math.abs(p.x-door.x)>17;}),chosenGrips=[];
   for(i=48;i<60&&grips.length;i++){p=grips[Math.floor((i-48)*grips.length/12)];chosenGrips.push(p);var angle=p.yaw===undefined?(p.z>0?0:Math.PI):p.yaw,standing=p.stand||p.standPosition,hx=-.79,hz=-Math.sin(-2.8)*1.18;crowd.actors[i].scale=1;crowd.place(i,standing||{x:p.x-hx*Math.cos(angle)-hz*Math.sin(angle),y:train.floorY,z:p.z-hz*Math.cos(angle)+hx*Math.sin(angle)},{yaw:angle,pose:'strap'});crowd.actors[i].strapAnchor=p;}
   var candidates=seats.filter(function(s){return (s.car!==car||Math.abs(s.x-door.x)>10.5)&&chosenGrips.every(function(g){var p=g.stand||g.standPosition;return !p||Math.hypot(s.x-p.x,s.z-p.z)>3.4;});});
   for(i=0;i<24&&i<candidates.length;i++){base=candidates[Math.floor(i*candidates.length/24)];var seatTop=gameGeometry.ground(new T.Vector3(base.x+train.group.position.x,base.y+.4+train.group.position.y,base.z+train.group.position.z)),restY=(seatTop?seatTop.y-train.group.position.y:base.y+.185)-.71*crowd.actors[i].scale+.008;crowd.place(i,{x:base.x,y:restY,z:base.z},{seated:true,yaw:base.yaw||0});}
   var walkingCars=train.cars.map(function(c,i){return i;}),standing=train.standSpots.filter(function(s){return s.car!==car||Math.abs(s.x-door.x)>14;});
   for(i=24;i<48;i++){var ci=walkingCars[(i-24)%walkingCars.length],cx=train.cars[ci].x;if(i<24+walkingCars.length){route=[{x:cx-1.7,y:train.floorY,z:0},{x:cx+.4,y:train.floorY,z:0}];spreadPath(i,route,((i-24)%3)/3,{speed:1.3,pose:'normal'});}else{var stand=standing[Math.floor((i-24-walkingCars.length)*standing.length/(24-walkingCars.length))];crowd.place(i,{x:stand.x,y:train.floorY,z:(i%2?1:-1)*.7},{yaw:i%2?Math.PI:0,pose:i%3?'normal':'phone'});}}
 }else if(z==='platform'){
   var spots=nav.platformDoorSpotsByTrack[trackIdx],outer=station.spanishLayout&&Math.abs(feet.z)>19,os=trackIdx===0?1:-1;
   route=outer?[{x:-112,y:2,z:os*22.2},{x:112,y:2,z:os*22.2},{x:112,y:2,z:os*28.5},{x:-112,y:2,z:os*28.5}]:[{x:-112,y:station.platformY||2,z:-6.1},{x:112,y:station.platformY||2,z:-6.1},{x:112,y:station.platformY||2,z:6.1},{x:-112,y:station.platformY||2,z:6.1}];
   for(i=0;i<38;i++)spreadPath(i,route,i/38,{speed:2.8+(i%4)*.1});
   var queueSpots=spots.filter(function(p){return Math.abs(p.x-door.x)>14;});
   for(i=38;i<60;i++){if(outer){crowd.setPath(i,nav.pathFromAlight((i-38)%spots.length,trackIdx).map(point),{loop:false,speed:3.0,delay:(i-38)*.12});continue;}base=queueSpots[(Math.floor((i-38)/2)*2)%queueSpots.length]||spots[0];crowd.place(i,{x:base.x+(i%2?2.4:-2.4),y:base.y,z:base.z+(trackIdx===0?.8:-.8)},{yaw:trackIdx===0?0:Math.PI});}
 }else{
   base=z==='street'?nav.streetSpawn:nav.security;var by=base.y;
   if(z==='street')route=[{x:base.x+2,y:by,z:base.z-2.6},{x:base.x+62,y:by,z:base.z-2.6},{x:base.x+62,y:by,z:base.z+6.4},{x:base.x+2,y:by,z:base.z+6.4}];
   else {var hall=station.walkableRegions.filter(function(r){return r.id==='concourse';})[0],west=hall.minX+5,east=nav.entranceBottom.x-8,north=hall.minZ+7,south=nav.security.z-5;route=[{x:west,y:by,z:north},{x:east,y:by,z:north},{x:east,y:by,z:south},{x:west,y:by,z:south}];}
   for(i=0;i<40;i++)spreadPath(i,route,i/40,{speed:2.6+(i%4)*.1});
   // Purposeful passengers enter, pass security, buy a ticket, use a separate gate, and descend.
   var gi=nav.gateIn[1]||nav.gateIn[0],ge=nav.gateInExit[1]||nav.gateInExit[0];
   var entering=nav.paths.enter.concat(nav.paths.buyTicket.slice(2),[gi,ge],nav.paths.toPlatform.slice(1),nav.pathToDoor(Math.min(doorIdx+2,nav.platformDoorSpots.length-1),trackIdx)).map(function(p){var q=point(p);return q;});
   for(i=40;i<60;i++)spreadPath(i,entering,(i-40+.25)/20,{loop:false,speed:3.1});
  for(i=0;i<36;i+=6){crowd.follow(i,i+1);var child=crowd.actors[i],adult=crowd.actors[i+1];child.position.copy(adult.position);child.position.x+=3.4;}
 }
}
function face(p){guideLook({x:p.x,y:feet.y+2.9,z:p.z},1.5);}
function setGoal(name,detail,label,fn,target,opts){
 opts=opts||{};goalAction=fn;$('goal').textContent=name;$('detail').textContent=detail;$('action').textContent=label;$('action').disabled=!fn;$('action').hidden=!label||!fn;
 secondAction=opts.secondary||null;$('secondary').hidden=!secondAction;$('secondary').textContent=opts.secondaryLabel||'';
 marker.visible=!!target&&!moving;if(target){targetPoint.set(target.x,target.y,target.z);marker.position.copy(targetPoint);$('worldTarget').querySelector('b').textContent=opts.targetLabel||label;}
 $('worldTarget').hidden=!target||moving;$('timerBar').hidden=!opts.timer;$('objectiveTag').textContent=opts.tag||'点脚印，就会自动走过去';
}
var stepNames={street:['1 / 8','来到车站'],security:['2 / 8','安全进站'],ticket:['3 / 8','买单程票'],gate:['3 / 8','刷票进闸'],platform:['4 / 8','去站台'],waiting:['4 / 8','等列车'],approaching:['4 / 8','列车进站'],boarding:['5 / 8','先下后上'],closing:['6 / 8','准备出发'],riding:['6 / 8','正在乘车'],arriving:['6 / 8','列车到站'],arrived:['7 / 8','到站下车'],exit:['7 / 8','出闸回收票'],streetExit:['8 / 8','寻找地标'],complete:['8 / 8','旅程完成']};
function setStage(s){stage=s;stageTimer=0;var name=stepNames[s]||['',''];$('stepCount').textContent=name[0];$('phaseName').textContent=name[1];$('seatControls').hidden=!trainAttached||['boarding','closing','riding','arriving','arrived'].indexOf(s)<0;}
function cameraFree(p){var eye=new T.Vector3(p.x,p.y+C.EYE_H+.03,p.z);return !gameGeometry.nearest(eye,1.025);}
function lineFree(a,b){var n=Math.ceil(Math.hypot(a.x-b.x,a.z-b.z)/.35);for(var j=0;j<=n;j++){var t=n?j/n:0;if(!cameraFree({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,z:a.z+(b.z-a.z)*t}))return false;}return true;}
function carPath(a,b,silent){
 if(lineFree(a,b))return [point(b)];var cell=.55,pad=4,minX=Math.min(a.x,b.x)-pad,maxX=Math.max(a.x,b.x)+pad,minZ=Math.max(train.group.position.z-3.7,Math.min(a.z,b.z)-pad),maxZ=Math.min(train.group.position.z+3.7,Math.max(a.z,b.z)+pad),cols=Math.ceil((maxX-minX)/cell)+1,rows=Math.ceil((maxZ-minZ)/cell)+1,free={},nodes={},open=[];
 function node(x,z){var key=x+','+z;if(nodes[key])return nodes[key];return nodes[key]={key:key,x:x,z:z,p:{x:minX+x*cell,y:train.floorY,z:minZ+z*cell},g:Infinity,f:Infinity};}
 function pass(n){if(free[n.key]===undefined)free[n.key]=cameraFree(n.p);return free[n.key];}
 var start=node(Math.round((a.x-minX)/cell),Math.round((a.z-minZ)/cell)),end=node(Math.round((b.x-minX)/cell),Math.round((b.z-minZ)/cell));start.p={x:a.x,y:train.floorY,z:a.z};start.g=0;start.f=0;open.push(start);var found=null;
 while(open.length){open.sort(function(a,b){return a.f-b.f;});var cur=open.shift();if(cur.closed)continue;cur.closed=true;if(Math.hypot(cur.p.x-b.x,cur.p.z-b.z)<.9&&lineFree(cur.p,b)){found=cur;break;}for(var dx=-1;dx<=1;dx++)for(var dz=-1;dz<=1;dz++){if(!dx&&!dz)continue;var nx=cur.x+dx,nz=cur.z+dz;if(nx<0||nx>=cols||nz<0||nz>=rows)continue;var next=node(nx,nz);if(next.closed||!pass(next)||!lineFree(cur.p,next.p))continue;var g=cur.g+Math.hypot(dx,dz);if(g<next.g){next.g=g;next.f=g+Math.hypot(next.p.x-b.x,next.p.z-b.z)/cell;next.parent=cur;open.push(next);}}}
 if(!found){if(!silent)runtimeNotices.push('车内安全路径暂不可达');return [];}
 var result=[point(b)];while(found&&found.parent){result.unshift(found.p);found=found.parent;}return result;
}
function walk(points,callback,opts){
 opts=opts||{};path.length=0;var first=0;for(var n=0;n<points.length;n++){var sp=points[n];if(sp&&Math.abs(sp.x-feet.x)+Math.abs(sp.y-feet.y)+Math.abs(sp.z-feet.z)<.5)first=n;}for(var i=first;i<points.length;i++)if(points[i])path.push(point(points[i]));pathIdx=0;onWalkEnd=callback;moving=true;seated=false;marker.visible=false;$('worldTarget').hidden=true;$('action').disabled=true;$('secondary').disabled=true;$('detail').textContent=opts.detail||'正在走过去… 可以拖动屏幕看看四周。';
 viewAssist=null;
 if(trainAttached){var planned=[],at=point(feet);for(var pi=0;pi<path.length;pi++){var part=carPath(at,path[pi]);if(!part.length){moving=false;path.length=0;$('action').disabled=!goalAction;toast('先在这里站稳，换一个空位置试试。');return;}planned=planned.concat(part);at=path[pi];}path=planned;}
}
function walkUpdate(dt){
 walkEscalator=false;if(!moving)return;var remain=dt;
 while(remain>0&&pathIdx<path.length){var p=path[pathIdx];v.set(p.x-feet.x,p.y-feet.y,p.z-feet.z);var length=v.length();if(length<.08){pathIdx++;continue;}walkEscalator=p.kind==='escalator'&&Math.abs(v.y)>.08;var velocity=walkEscalator?(p.speed||3.2):12;var seconds=length/velocity;var fraction=Math.min(1,remain/seconds);feet.addScaledVector(v,fraction);var ground=gameGeometry.ground(feet);if(ground&&Math.abs((typeof ground==='number'?ground:ground.y)-feet.y)<.85)feet.y=typeof ground==='number'?ground:ground.y;remain-=Math.min(remain,seconds);
   if(Math.abs(v.x)+Math.abs(v.z)>.001)bodyYaw=Math.atan2(v.x,v.z);var soleGround=gameGeometry.support(feet,bodyYaw,1.2);if(soleGround&&Math.abs(soleGround.y-feet.y)<.85)feet.y=soleGround.y;if(lookHold<=0&&Math.abs(v.x)+Math.abs(v.z)>.1){var desired=Math.atan2(-v.x,-v.z),delta=Math.atan2(Math.sin(desired-yaw),Math.cos(desired-yaw));yaw+=delta*Math.min(1,dt*5);}
   if(fraction===1)pathIdx++;else break;
 }
 if(feet.y>23&&['street','streetExit'].indexOf(stage)>=0){station.setZone&&station.setZone('street');scene.background.set(0xc6e6f2);scene.fog.color.copy(scene.background);}else if(feet.y<23&&feet.y>8&&!trainAttached)station.setZone&&station.setZone('concourse');else if(feet.y<8&&!trainAttached)station.setZone&&station.setZone('platform');
 var az=trainAttached?'train':feet.y>23?'street':feet.y>8?'concourse':'platform';if(az!==audioZone){audioZone=az;audioCall('setZone',az);}
 footstepTimer-=dt;if(footstepTimer<=0&&!walkEscalator){audioCall('sfx','footstep');footstepTimer=.46;}
 if(pathIdx>=path.length){moving=false;$('secondary').disabled=false;var fn=onWalkEnd;onWalkEnd=null;if(fn)fn();}
}
function startJourney(){
 journeyEpoch++;perfStages={};perfWindowFrames=0;perfWindowTime=0;lastFrame=performance.now();if(audit)audit.reset();clearInteraction();doorMotion=null;viewAssist=null;coinHistory.length=0;lookHelpTimer=8;document.body.classList.add('playing');audioCall('unlock');audioCall('stopAll');$('selection').hidden=true;$('finish').hidden=true;$('mapModal').hidden=true;$('hud').hidden=false;
 token=false;$('token').hidden=true;current=origin;dir=destination>origin?1:-1;travelled=0;journeyStarted=elapsed;trainAttached=false;seated=false;moving=false;if(!station.station||station.station.id!==C.STATIONS[current].id)station.setStation(C.STATIONS[current]);chooseTrack();setDoors(0);train.group.visible=false;station.group.visible=true;tunnel.group.visible=false;
 feet.copy(station.nav.streetSpawn);zone('street');setStage('street');face(station.nav.entranceTop);updateRoute();
 setGoal('去地铁入口吧！','看到红色地铁标志了吗？点脚印，我们沿扶梯进站。','👣 走进地铁站',function(){walk(station.nav.paths.enter,function(){zone('concourse');setStage('security');face(station.nav.securityExit);securityGoal();},{detail:'扶好扶手，沿扶梯往下走，前面是安检。'});},station.nav.entranceTop);
}
function securityGoal(){setGoal('先过安检，安全进站','把小背包放上安检机，再走过检测门。','👣 通过安检',function(){positionedSound('securityBeep',station.interact.security?station.interact.security.group.position:station.nav.security);walk([station.nav.security,station.nav.securityExit],function(){toast('安检完成！现在去买绿色单程票。');ticketGoal();});},station.nav.securityExit);}
function ticketGoal(){setStage('ticket');setGoal('买一枚绿色单程票','走到售票机前，亲手选站、投硬币、拿票。','👣 去售票机',function(){var purchasePath=station.nav.paths.buyTicket.map(point),machine=station.interact.tvm.group;purchasePath[purchasePath.length-1]={x:machine.position.x,y:station.concourseY||14,z:machine.position.z-6};walk(purchasePath,function(){
 var tvm=station.interact.tvm;setGoal('点售票机屏幕，选目的地','我们去 '+C.STATIONS[destination].name+'。点亮着的屏幕买单程票。',null,null);
 coinTask('screen',machinePoint(tvm,0,3.1,-1.2),'去 '+C.STATIONS[destination].name,null);
 });},station.nav.tvm);}
function gateGoal(){setStage('gate');setGoal('带绿色币去进闸机','进站是贴一下感应区，票币还要留在手里。','👣 去进闸机',function(){walk(station.nav.paths.toGate,function(){
 var gate=station.interact.gatesIn[0];setGoal('点起绿色币，再贴感应区','把手里的币送到闪亮的感应区，听一声嘀。',null,null);
 coinTask('brush',machinePoint(gate,-.5,2.4,1.28),'贴这里','token');
 });},station.nav.gateIn[0]);}
function platformGoal(){setStage('platform');setGoal('沿扶梯去站台','扶好扶手。我们坐开往'+terminal()+'方向的列车。','👣 下到站台',function(){walk(station.nav.paths.toPlatform,function(){zone('platform');setStage('waiting');var route=station.nav.pathToDoor(doorIdx,trackIdx);walk(route,function(){face(worldTrainPoint(door));beginWait();},{detail:'跟着候车箭头，站在黄色安全线后面。'});});},station.nav.platformEscalatorTop||station.nav.platformCenter);}
function terminal(){return dir===1?C.LINE.terminals.up:C.LINE.terminals.down;}
function beginWait(){
 guideLook([{x:door.x+30,y:5,z:track.z+door.z},{x:-dir*145,y:6,z:track.z},{x:door.x-dir*24,y:5,z:track.z+door.z}],4.2);setStage('waiting');station.pids.set({trackIdx:trackIdx,destination:terminal(),minutes:'即将进站'});voiceDone=false;var epoch=journeyEpoch;boundedVoice('platform').then(function(){if(epoch===journeyEpoch)voiceDone=true;});
 setGoal('在线后等，列车就要来了','站在候车箭头后，先让车里的乘客下车。','列车正在过来…',null,null,{timer:true,tag:'安全候车 · 先下后上'});
}
function approach(){setStage('approaching');lookHold=Math.min(lookHold,1);viewAssist=null;train.group.visible=true;train.group.position.x=-dir*(train.length+170);headWorld.copy(headLocal).add(train.group.position);
 approachDuration=audioCall('trainApproach',{from:{x:headWorld.x,y:headWorld.y,z:headWorld.z},to:{x:headLocal.x,y:headLocal.y,z:headLocal.z+track.z},sourceId:'approaching-train',duration:15})||15;
 setGoal('看，车灯从隧道里过来了！','站在线后，等列车停稳、门完全打开。',null,null);
}
function exitDoor(){var side=track.alightSide===undefined?track.side:track.alightSide;for(var i=0;i<train.doors.length;i++){var d=train.doors[i];if(d.side===side&&Math.abs(d.x-door.x)<.1)return d;}return door;}
function setAlightDoors(open){alightOpen=open;train.setDoors(track.alightSide===undefined?track.side:track.alightSide,open);if(station.psd.setAlightOpen)station.psd.setAlightOpen(trackIdx,open);}
function setDoors(open){doorOpen=open;train.setDoors(track.side,open);station.psd.setOpen(trackIdx,open);if(open===0){train.setDoors(-track.side,0);if(station.psd.setAlightOpen)station.psd.setAlightOpen(trackIdx,0);alightOpen=0;}else if(alightOpen>0){setAlightDoors(Math.min(open,alightOpen));}}
function disembarkCrowd(){
 // Six passengers leave through three adjacent doors first; separate lanes keep the waiting child clear.
 var as=track.alightSide===undefined?track.side:track.alightSide;var ds=train.doors.filter(function(d){return d.side===as&&d.car===door.car&&Math.abs(d.x-door.x)>4;});
 for(var i=48;i<53;i++){var d=ds[(i-48)%ds.length],w=worldTrainPoint(d),sign=as;
 crowd.setPath(i,[{x:w.x,y:w.y,z:i===52?train.group.position.z:w.z-sign*1.3},{x:w.x,y:w.y,z:w.z},{x:w.x,y:w.y,z:w.z+sign*2.8},{x:w.x,y:w.y,z:station.spanishLayout?track.z+sign*8.7:sign*-2.8},{x:w.x+12,y:w.y,z:station.spanishLayout?track.z+sign*8.7:sign*-2.8}],{state:'transit',loop:false,speed:3.5,delay:(i-48)*.24});}
}
function boardingGoal(){setStage('boarding');boardingRelease=false;guideLook({x:door.x,y:4.7,z:track.z+door.z},2);setGoal('先下后上，等乘客走出来','车门正在打开，先让下车的人走出来。',null,null);say('gap');
 animateDoors(station.spanishLayout?0:1,station.spanishLayout?1:0,function(){stageTimer=0;disembarkCrowd();});
}
function boardCrowd(){
 var ds=train.doors.filter(function(d){return d.side===track.side&&d.car===door.car&&Math.abs(d.x-door.x)>4;});
 for(var i=54;i<58&&ds.length;i++){var d=ds[(i-54)%ds.length],w=worldTrainPoint(d),sign=trackIdx===0?-1:1;
 crowd.setPath(i,[{x:w.x,y:w.y,z:sign===-1?7.1:-7.1},{x:w.x,y:w.y,z:w.z},{x:w.x,y:w.y,z:track.z},{x:w.x+1.8,y:w.y,z:track.z+sign*1.2}],{state:'transit',loop:false,speed:3,delay:(i-54)*.15});}
}
function arrivalCrowd(){
 var as=track.alightSide===undefined?track.side:track.alightSide;var ds=train.doors.filter(function(d){return d.side===as&&d.car===door.car&&Math.abs(d.x-door.x)>4;});
 for(var i=54;i<58&&ds.length;i++){var d=ds[(i-54)%ds.length];
 crowd.setPath(i,[{x:d.x,y:train.floorY,z:d.z*.74},{x:d.x,y:train.floorY,z:d.z},{x:d.x,y:train.floorY,z:as*7.6},{x:d.x+8,y:train.floorY,z:as*9.6}],{state:'transit',loop:false,speed:2.8,delay:(i-54)*.22});}
}
function boardingLaneClear(){var w=worldTrainPoint(door);for(var i=0;i<crowd.count;i++){var a=crowd.actors[i];if(!a.visible||Math.abs(a.position.y-feet.y)>3)continue;var p=a.position;if(Math.abs(p.x-w.x)<2.5&&Math.abs(p.z-w.z)<3.8)return false;}return true;}
function allowBoard(){boardCrowd();setGoal('轮到我们上车啦！','跨过门口的小空隙，走进明亮的车厢。','👣 走进车厢',function(){var ds=worldTrainPoint(door),stand=train.standSpots.filter(function(p){return p.car===door.car;})[0]||{x:door.x,y:train.floorY,z:0};stand={x:door.x,y:train.floorY,z:0};walk([ds,worldTrainPoint(stand)],function(){trainAttached=true;zone('train');face(worldTrainPoint({x:door.x+8,y:train.floorY,z:0}));setGoal('站好或坐好，我们要出发啦','可以点座位坐下，也可以站着扶好。准备好了就出发。','车门关好，出发！',closeAndRide,null,{tag:'车厢里 · 扶好站稳'});$('seatControls').hidden=false;toast('车厢里也有走路、找座位的小乘客。');});},worldTrainPoint(door));}
function closeAndRide(){
 if(moving||doorMotion)return;populate('train');setStage('closing');closingMotion=false;setGoal('车门即将关闭','扶好扶手，听一听关门广播。','正在关门…',null,null,{timer:true,tag:'请远离车门'});closingSoundTimer=-1;voiceDone=false;
 var epoch=journeyEpoch;boundedVoice('doorsClosing').then(function(){if(stage==='closing'&&epoch===journeyEpoch)voiceDone=true;});
}
function beginRide(){
 station.group.position.x=0;tunnel.group.position.x=0;tunnel.setEndsOpen&&tunnel.setEndsOpen(false);setDoors(0);setStage('riding');station.group.visible=false;tunnel.group.visible=true;var next=current+dir;updateRoute();voiceDone=false;var epoch=journeyEpoch;boundedVoice('next',next).then(function(){if(stage==='riding'&&epoch===journeyEpoch)voiceDone=true;});
 setGoal('下一站：'+C.STATIONS[next].name,'听普通话、粤语、英语报站。看看窗外掠过的隧道灯。','列车行驶中…',null,null,{timer:true,tag:'开往'+terminal()+'方向'});
}
function beginArrive(){tunnel.group.visible=false;setStage('arriving');voiceDone=false;var next=current+dir;station.setStation(C.STATIONS[next]);station.setZone&&station.setZone('platform');station.group.position.x=dir*30;station.group.visible=true;tunnel.setEndsOpen&&tunnel.setEndsOpen(true);var epoch=journeyEpoch;boundedVoice('arrive',next).then(function(){if(stage==='arriving'&&epoch===journeyEpoch)voiceDone=true;});setGoal(C.STATIONS[next].name+'站就要到了','列车正在减速。等门完全打开，再决定下车或继续坐。','正在进站…',null,null,{timer:true,tag:'即将到站'});}
function arrive(){
 current+=dir;travelled++;speed=0;station.group.position.x=0;tunnel.group.position.x=0;if(!station.station||station.station.id!==C.STATIONS[current].id)station.setStation(C.STATIONS[current]);configureStationAudio();station.group.visible=true;tunnel.group.visible=false;station.setZone&&station.setZone('platform');setStage('arrived');updateRoute();station.pids.set({trackIdx:trackIdx,destination:terminal(),minutes:'本站停靠'});
 var target=worldTrainPoint(exitDoor());guideLook({x:target.x,y:target.y+2.8,z:target.z},2);setGoal(C.STATIONS[current].name+'到了，等门打开','坐好站稳，车门完全打开后再下车。',null,null);
 animateDoors(station.spanishLayout?0:1,station.spanishLayout?1:0,function(){arrivalCrowd();if(station.spanishLayout)animateDoors(1,1,arrivedChoices);else arrivedChoices();});
}
function arrivedChoices(){
 if(C.STATIONS[current].transfer)say('transfer');
 var atDestination=current===destination;toast(atDestination?'到目的地了！带好绿色币，我们下车。':'到站啦，可以下车，也可以继续坐。',6);
 var hasNext=current+dir>=0&&current+dir<C.STATIONS.length;
 setGoal(C.STATIONS[current].name+'到了'+(atDestination?'，我们下车吧！':'！'),station.spanishLayout?'公园前从右边车门下车，再沿外侧扶梯出站。':atDestination?'这就是你选的目的地。下车后还要把票币投进出闸机。':hasNext?'可以在这里下车看地标，也可以继续去下一站。':'这一段积木旅程到这里。带好票币，点脚印下车吧。','👣 到站下车',alight,worldTrainPoint(exitDoor()),{secondary:hasNext?closeAndRide:null,secondaryLabel:'继续坐 · '+(hasNext?C.STATIONS[current+dir].name:''),tag:atDestination?'目的地到了':'到站选择'});
}
function alight(){
 seated=false;var doorWorld=worldTrainPoint(exitDoor()),spot=station.spanishLayout&&station.nav.alightSpotsByTrack?station.nav.alightSpotsByTrack[trackIdx][doorIdx]:station.nav.platformDoorSpotsByTrack[trackIdx][doorIdx];
 // Move down the aisle before crossing the door, even when the player was sitting.
 walk([{x:feet.x,y:train.floorY,z:train.group.position.z},{x:doorWorld.x,y:doorWorld.y,z:train.group.position.z},doorWorld,spot],function(){trainAttached=false;zone('platform');setStage('exit');exitGoal();},{detail:'下车时小心空隙，跟着脚印去出站扶梯。'});
}
function exitGoal(){
 var route=station.nav.paths.exitPlatform,exitTarget=station.spanishLayout&&station.nav.pathFromAlight?station.nav.pathFromAlight(doorIdx,trackIdx)[4]:station.nav.platformExitEscalatorBottom||station.nav.platformCenter;face(exitTarget);
 setGoal('沿扶梯去出闸机','绿色票币还在手里，出站要把它投进去。','👣 去出闸机',function(){
  var toCenter=station.nav.pathToDoor(doorIdx,trackIdx).slice().reverse(),exitPath=station.spanishLayout&&station.nav.pathFromAlight?station.nav.pathFromAlight(doorIdx,trackIdx):toCenter.concat(route);
  walk(exitPath,function(){zone('concourse');var gate=station.interact.gatesOut[0];setGoal('点起绿色币，投入投币口','票币要留在出闸机里。点币，再点投币口。',null,null);coinTask('insert',machinePoint(gate,-1.1,2.4,1.28),'投进去','token');});
 },exitTarget);
}
function streetExitGoal(){setStage('streetExit');setGoal('从'+C.STATIONS[current].exit+'出口去地面','外面就是'+C.STATIONS[current].landmarkName+'。最后跟着脚印走出去！','👣 出站看地标',function(){var lm=station.nav.landmark;var sightseeing=station.nav.paths.leave.map(point);walk(sightseeing,function(){zone('street');setGoal('看，'+C.STATIONS[current].landmarkName+'！','看看地标，我们已经完成整段旅程啦。',null,null);guideLook([{x:lm.x-10,y:lm.y+5,z:lm.z+8},{x:lm.x+10,y:lm.y+5,z:lm.z+8},{x:lm.x,y:lm.y+5,z:lm.z+8}],3.6,function(){setGoal('看，'+C.STATIONS[current].landmarkName+'！','我们从进站买票到出站，完成了整段旅程。','我到啦！',finishJourney);});});},station.nav.exitTop);}
function finishJourney(){viewAssist=null;lookHold=30;var lm=station.nav.landmark,dx=lm.x-feet.x,dz=lm.z+8-feet.z;yaw=Math.atan2(-dx,-dz);pitch=Math.atan2(lm.y+5-feet.y-C.EYE_H,Math.hypot(dx,dz));setStage('complete');$('finishTitle').textContent='到啦！'+C.STATIONS[current].landmarkName;$('finishDetail').textContent='从'+C.STATIONS[origin].name+'出发，坐了'+travelled+'站。你已经会自己坐地铁了！';$('finish').hidden=false;audioCall('trainSound',{speed:0,inside:false,braking:false});}
function seatAvailable(p){for(var i=0;i<crowd.count;i++){var a=crowd.actors[i];if(a.visible&&a.state==='seated'&&Math.abs(a.position.x-p.x)<.8&&Math.abs(a.position.z-p.z)<.8)return false;}return true;}
function sit(chosen){
 if(!trainAttached||moving)return;
 var candidates=train.seats.filter(function(p){return p.car===door.car&&seatAvailable(p);});
 candidates.sort(function(a,b){function rank(p){return chosen&&chosen.x===p.x&&chosen.z===p.z?-1:Math.abs(p.x-feet.x)+Math.abs(p.z+train.group.position.z-feet.z)*.25;}return rank(a)-rank(b);});
 for(var i=0;i<candidates.length;i++){
  var seat=candidates[i],pos=worldTrainPoint(seat);pos.z-=Math.sign(seat.z)*.6;var approach={x:pos.x,y:train.floorY+train.group.position.y,z:pos.z};
  if(!cameraFree(approach))continue;var planned=carPath(feet,approach,true);if(!planned.length)continue;
  walk(planned,function(){feet.set(pos.x,pos.y-1,pos.z);seated=true;yaw=(seat.yaw||0)+Math.PI;pitch=-.05;$('action').disabled=!goalAction;toast('坐好了！看看车窗和门上的线路图。');},{detail:'走到空座位前，再坐下来。'});return;
 }
 toast('请在通道扶好，我们再找一个空座位。');
}
function stand(){if(!trainAttached||moving)return;seated=false;walk([{x:feet.x,y:train.floorY+train.group.position.y,z:train.group.position.z}],function(){yaw=-Math.PI/2;$('action').disabled=!goalAction;toast('站稳啦，请扶好立柱。');},{detail:'从座位走到通道，站稳扶好。'});}
function currentColliders(){
 var localSpace=crowd.group.parent===train.group,offset=localSpace?train.group.position:new T.Vector3(),sources=[];
 if(station.group.visible)sources.push({index:stationIndex,offset:new T.Vector3(station.group.position.x-offset.x,station.group.position.y-offset.y,station.group.position.z-offset.z)});
 if(train.group.visible)sources.push({index:trainIndex,offset:new T.Vector3(train.group.position.x-offset.x,train.group.position.y-offset.y,train.group.position.z-offset.z)});
 if(!collisionSet)collisionSet=new physics.CollisionSet(sources);else collisionSet.sources=sources;return collisionSet;
}
var crowdOffset=new T.Vector3(),reservationPool=[],crowdStepTime=0;
function prepareCrowd(){
 var attached=crowd.group.parent===train.group;crowdOffset.copy(attached?train.group.position:runtime.zero);runtime.attached=attached;
 var next=moving&&path[pathIdx];if(!next&&!trainAttached&&['waiting','approaching','boarding'].indexOf(stage)>=0)next=worldTrainPoint(door);if(next){frontReserve.set(next.x-feet.x,0,next.z-feet.z);var len=frontReserve.length();frontReserve.multiplyScalar(Math.min(6,len)/Math.max(.001,len));frontReserve.add(feet).sub(crowdOffset);}
 crowd.avoidPlayer(feet.x-crowdOffset.x,feet.y-crowdOffset.y,feet.z-crowdOffset.z,interaction?4.3:3.5,next?frontReserve:null);
 crowd.reservations.length=0;if(interaction){var machine=interaction.point,span=Math.hypot(machine.x-feet.x,machine.z-feet.z),count=Math.ceil(span/1.5);for(var i=0;i<=count;i++){var fraction=count?i/count:0,q=reservationPool[i];if(!q)q=reservationPool[i]={p:new T.Vector3(),r:3.2};q.p.set(feet.x+(machine.x-feet.x)*fraction-crowdOffset.x,feet.y-crowdOffset.y,feet.z+(machine.z-feet.z)*fraction-crowdOffset.z);crowd.reservations.push(q);}}
 crowd.escalators=attached?[]:station.escalators;crowd.physicsRevision=(crowd.physicsRevision||0)+1;
}
function exactCrowdGround(p){v.copy(p).add(crowdOffset);var g=geometry.ground(v);return g?{y:g.y-crowdOffset.y,object:g.object}:null;}
function updateCamera(dt){cameraGuide(dt);camera.position.set(feet.x,feet.y+C.EYE_H+(moving&&!seated&&!walkEscalator?Math.sin(elapsed*12)*.055:0),feet.z);if(trainAttached&&speed>0){camera.position.y+=Math.sin(elapsed*3.5)*.018*speed;camera.position.z+=Math.sin(elapsed*2.4)*.04*speed;}camera.rotation.set(pitch,yaw,trainAttached?Math.sin(elapsed*2.5)*.002*speed:0,'YXZ');
 // Keep the physical eye position clear for every yaw/pitch; never hide a wall with clipping.
 for(var pass=0;pass<8;pass++){var near=gameGeometry.nearest(camera.position,1.02);if(!near)break;var away=camera.position.clone().sub(near.point);away.y=0;if(away.length()<.001)away.set(Math.cos(pass*2.4),0,Math.sin(pass*2.4));away.normalize().multiplyScalar(1.025-near.distance);var candidate=feet.clone().add(away),support=gameGeometry.support(candidate,bodyYaw,moving?1.2:0);if(!support||Math.abs(support.y-feet.y)>.8)break;candidate.y=support.y;feet.copy(candidate);camera.position.x=feet.x;camera.position.z=feet.z;camera.position.y=feet.y+C.EYE_H;}
} 
function updatePlayerFeet(){
 if(seated||!document.body.classList.contains('playing')){playerShoes.forEach(function(shoe){shoe.visible=false;});return;}
 var cy=Math.cos(bodyYaw),sy=Math.sin(bodyYaw);for(var i=0;i<2;i++){var side=i?1:-1,x=side*.29,z=.09+side*(moving?1.2:0)/2,shoe=playerShoes[i];shoe.position.set(feet.x+x*cy+z*sy,feet.y,feet.z+z*cy-x*sy);var sole=gameGeometry.sole(shoe.position,bodyYaw);if(sole&&Math.abs(sole.y-feet.y)<.7)shoe.position.y=sole.y;else shoe.position.y+=.2;shoe.position.y+=.13;shoe.rotation.y=bodyYaw;shoe.visible=document.body.classList.contains('playing')&&!seated;}
}
function updateMarker(){
 if(!marker.visible||moving){$('worldTarget').hidden=true;return;}
 markerRing.scale.setScalar(crowd.secondaryAnimations===false?1:1+Math.sin(elapsed*3)*.07);
 projected.copy(targetPoint);projected.y+=1.0;projected.project(camera);
 if(projected.z>1||projected.z< -1||Math.abs(projected.x)>.94||Math.abs(projected.y)>.72){$('worldTarget').hidden=true;return;}
 $('worldTarget').hidden=false;$('worldTarget').style.left=((projected.x*.5+.5)*innerWidth)+'px';$('worldTarget').style.top=((-projected.y*.5+.5)*innerHeight)+'px';
}
function frame(ms){
 var realDt=(ms-lastFrame)/1000||.016,dt=Math.min(realDt,.25);lastFrame=ms;elapsed+=realDt;stageTimer+=realDt;lookHold=Math.max(0,lookHold-dt);
 var scriptStart=performance.now(),perfMarks=perfEnabled?perfClockBuffer:null,perfMarkIndex=1;if(perfMarks)perfMarks[0]=scriptStart;doorUpdate(realDt);if(perfMarks)perfMarks[perfMarkIndex++]=performance.now();for(var worldRemaining=dt;worldRemaining>0;){var worldStep=Math.min(worldRemaining,.05);station.update(worldStep);train.update(worldStep,speed);worldRemaining-=worldStep;}walkUpdate(dt);for(var ni=0;ni<crowd.count;ni++){var na=crowd.actors[ni];var showActor=trainAttached||Math.abs(na.position.y-feet.y)<9;if(na.renderVisible!==showActor)crowd.dirty=true;na.renderVisible=showActor;}if(!trainAttached&&station.interact.gatesIn[1]){var gn=station.nav.gateIn[1],occupied=false;for(ni=40;ni<60;ni++){na=crowd.actors[ni];if(na.visible&&Math.abs(na.position.x-gn.x)<12&&Math.abs(na.position.y-gn.y)<1&&Math.abs(na.position.z-gn.z)<4)occupied=true;}station.interact.gatesIn[1][occupied?'open':'close']();}if(tunnel.group.visible)tunnel.update(dt,speed);
 if(perfMarks)perfMarks[perfMarkIndex++]=performance.now();if(stage==='waiting'){setTimer(stageTimer/6);if(stageTimer>=6&&voiceDone)approach();}
 else if(stage==='approaching'){var t=Math.min(1,stageTimer/approachDuration),smooth=t*t*(3-2*t);train.group.position.x=-dir*(train.length+170)*(1-smooth);headWorld.copy(headLocal).add(train.group.position);audioCall('setSourcePosition','approaching-train',headWorld);setTimer(t);if(t>=1)boardingGoal();}
 else if(stage==='boarding'&&!goalAction&&!doorMotion&&!boardingRelease){if(stageTimer>=4.6&&boardingLaneClear()){boardingRelease=true;if(station.spanishLayout)animateDoors(1,1,allowBoard);else allowBoard();}}
 else if(stage==='closing'){if(voiceDone&&!closingMotion){closingMotion=true;var result=audioCall('sfx','doorChime',{position:worldTrainPoint(door),volume:.7});closingSoundTimer=typeof result==='number'?result:3.62;}else if(closingMotion&&!doorMotion&&closingSoundTimer>=0){closingSoundTimer-=realDt;if(closingSoundTimer<=0){closingSoundTimer=-1;animateDoors(0,0,beginRide);}}}
 else if(stage==='riding'){speed=Math.min(1,stageTimer/5);setTimer(stageTimer/rideDuration);if(stageTimer>=rideDuration&&voiceDone)beginArrive();}
 else if(stage==='arriving'){var arrival=Math.min(1,stageTimer/18),eased=arrival*arrival*(3-2*arrival);speed=Math.max(0,1-arrival);station.group.position.x=dir*30*(1-eased);tunnel.group.position.x=-dir*(train.length+170)*eased;setTimer(arrival);if(stageTimer>=18&&voiceDone)arrive();}
 else speed=0;
 trainParams.speed=speed;trainParams.inside=trainAttached;trainParams.braking=stage==='arriving';trainParams.curve=stage==='riding'&&stageTimer>8&&stageTimer<14?Math.sin((stageTimer-8)/6*Math.PI)*.28:0;audioCall('trainSound',trainParams);
 if(toastTimer>0){toastTimer-=dt;if(toastTimer<=0)$('toast').classList.remove('show');}
 if(perfMarks)perfMarks[perfMarkIndex++]=performance.now();updateCamera(dt);prepareCrowd();if(perfMarks)perfMarks[perfMarkIndex++]=performance.now();var crowdChanged=false;if(document.body.classList.contains('playing')){crowdStepTime+=dt;if(crowdStepTime>=1/30||crowd.dirty){crowd.advanceFast(crowdStepTime);crowdStepTime=0;crowdChanged=true;}else crowdChanged=crowd.enforcePlayerSpace();}if(perfMarks)perfMarks[perfMarkIndex++]=performance.now();if(crowdChanged||crowd.dirty)crowd.update(0,true);updatePlayerFeet();if(perfMarks)perfMarks[perfMarkIndex++]=performance.now();if(auditEnabled){geometry.sync();crowd.groundExact=exactCrowdGround;audit.update(realDt);}audioCall('setListener',camera.position,camera.getWorldDirection(audioForward));npcFootsteps();interactionUpdate();lookHelpTimer=Math.max(0,lookHelpTimer-dt);$('lookHint').style.opacity=lookHelpTimer>0&&!interaction?'1':'0';$('seat').hidden=seated;$('stand').hidden=!seated;updateMarker();if(perfMarks)perfMarks[perfMarkIndex++]=performance.now();renderer.render(scene,camera);if(perfMarks)perfMarks[perfMarkIndex++]=performance.now();frames++;frameTime+=realDt;if(frameTime>=1){fps=Math.round(frames/frameTime);frames=0;frameTime=0;}
 recordPerf(realDt,performance.now()-scriptStart,perfMarks);requestAnimationFrame(frame);
}
function recordPerf(dt,ms,marks){
 perfScript=ms;var key=stage,entry=perfStages[key];if(!entry)entry=perfStages[key]={n:0,seconds:0,sum:0,worst:0,draw:0,triangles:0,times:new Float32Array(16384),spikeCount:0,spikes:[],intervalWorst:0,deviceDprMin:devicePixelRatio,deviceDprMax:devicePixelRatio,rendererDprMin:renderer.getPixelRatio(),rendererDprMax:renderer.getPixelRatio()};entry.times[entry.n%16384]=ms;if(ms>5){entry.spikeCount++;if(entry.spikes.length<4)entry.spikes.push({ms:ms,frame:entry.n,seconds:stageTimer,current:C.STATIONS[current].id,interaction:interaction?interaction.kind:null,moving:moving,doorAnimating:!!doorMotion});}entry.n++;entry.seconds+=dt;entry.sum+=ms;if(ms>entry.worst){entry.worst=ms;if(marks){var labels=['doors','worldAndWalking','flowAndTrainAudio','cameraAndReservations','crowdPhysics','crowdMatricesAndFeet','audioAndUI','render'],parts={};for(var pi=0;pi<labels.length;pi++)parts[labels[pi]]=marks[pi+1]-marks[pi];entry.worstDetails={seconds:stageTimer,current:C.STATIONS[current].id,moving:moving,doorAnimating:!!doorMotion,position:{x:feet.x,y:feet.y,z:feet.z},parts:parts};}}entry.intervalWorst=Math.max(entry.intervalWorst,dt*1000);entry.deviceDprMin=Math.min(entry.deviceDprMin,devicePixelRatio);entry.deviceDprMax=Math.max(entry.deviceDprMax,devicePixelRatio);entry.rendererDprMin=Math.min(entry.rendererDprMin,renderer.getPixelRatio());entry.rendererDprMax=Math.max(entry.rendererDprMax,renderer.getPixelRatio());entry.draw=Math.max(entry.draw,renderer.info.render.calls);entry.triangles=Math.max(entry.triangles,renderer.info.render.triangles);
 perfWindowFrames++;perfWindowTime+=dt;if(perfWindowTime>=2){var average=perfWindowFrames/perfWindowTime;if(average<52&&perfTier<3&&!auditEnabled&&document.body.classList.contains('playing')){perfTier++;renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,[1.5,1.25,1,1][perfTier]));renderer.setSize(innerWidth,innerHeight);crowd.setLimit([60,40,28,28][perfTier]);if(perfTier===3)crowd.secondaryAnimations=false;}perfWindowFrames=0;perfWindowTime=0;}
 if(perfEnabled&&frames%15===0)perfBadge.textContent=fps+' fps · '+ms.toFixed(2)+' ms · '+renderer.info.render.calls+' draw · '+Math.round(renderer.info.render.triangles/1000)+'k △ · DPR '+renderer.getPixelRatio()+' · '+crowd.stats().visible+'人 · 档 '+perfTier+(auditEnabled?' · 审计开':'');
}
function perfReport(){var stages={};Object.keys(perfStages).forEach(function(key){var e=perfStages[key],times=Array.from(e.times.subarray(0,Math.min(e.n,16384))).sort(function(a,b){return a-b;});stages[key]={frames:e.n,fps:e.n/e.seconds,scriptMedian:times[Math.floor(times.length/2)],scriptP95:times[Math.max(0,Math.ceil(times.length*.95)-1)],quantileSamples:times.length,spikeCount:e.spikeCount,spikes:e.spikes,scriptWorst:e.worst,scriptMean:e.sum/e.n,worstDetails:e.worstDetails,intervalWorst:e.intervalWorst,drawCalls:e.draw,triangles:e.triangles,deviceDprMin:e.deviceDprMin,deviceDprMax:e.deviceDprMax,rendererDprMin:e.rendererDprMin,rendererDprMax:e.rendererDprMax};});return {enabled:true,auditEnabled:auditEnabled,prewarm:modulePrewarm,panelStats:{station:station.getPanelStats?station.getPanelStats():null,train:train.getPanelStats?train.getPanelStats():null,tunnel:tunnel.getPanelStats?tunnel.getPanelStats():null},tier:perfTier,scriptMs:perfScript,stages:stages};}

function setTimer(f){$('timerBar').firstElementChild.style.width=(Math.min(1,f)*100)+'%';}
function activate(){audioCall('unlock');if(goalAction&&!moving)goalAction();}
function bindInput(){
 $('action').addEventListener('click',activate);$('worldTarget').addEventListener('click',activate);$('secondary').addEventListener('click',function(){audioCall('unlock');if(secondAction&&!moving)secondAction();});
 $('findInteraction').addEventListener('click',function(){if(interaction){lookHold=0;guideLook(interaction.point,1.5);}});$('interactionTarget').addEventListener('click',touchMachine);$('handCoin').addEventListener('click',touchCoin);
 $('handCoin').addEventListener('pointerdown',function(e){touchCoin();coinDrag={x:e.clientX,y:e.clientY,moved:false};$('handCoin').setPointerCapture(e.pointerId);});
 $('handCoin').addEventListener('pointermove',function(e){if(!coinDrag)return;coinDrag.moved=coinDrag.moved||Math.abs(e.clientX-coinDrag.x)+Math.abs(e.clientY-coinDrag.y)>8;if(coinDrag.moved){var fly=$('coinFlight');fly.hidden=false;fly.classList.toggle('payment',interaction&&interaction.kind==='pay');fly.style.left=e.clientX+'px';fly.style.top=e.clientY+'px';}});
 $('handCoin').addEventListener('pointerup',function(e){if(coinDrag&&coinDrag.moved){var r=$('interactionTarget').getBoundingClientRect();if(e.clientX>=r.left-20&&e.clientX<=r.right+20&&e.clientY>=r.top-20&&e.clientY<=r.bottom+20)touchMachine();else toast('把币送到闪亮的位置，也可以点币后点那里。');}if(!coinBusy)$('coinFlight').hidden=true;coinDrag=null;});
 $('handCoin').addEventListener('pointercancel',function(){coinDrag=null;$('coinFlight').hidden=true;});$('seat').addEventListener('click',sit);$('stand').addEventListener('click',stand);
 var canvas=$('scene');
 canvas.addEventListener('pointerdown',function(e){audioCall('unlock');pointer.down=true;pointer.moved=false;pointer.x=pointer.lastX=e.clientX;pointer.y=pointer.lastY=e.clientY;canvas.setPointerCapture(e.pointerId);});
 canvas.addEventListener('pointermove',function(e){if(!pointer.down)return;var dx=e.clientX-pointer.lastX,dy=e.clientY-pointer.lastY;if(Math.abs(e.clientX-pointer.x)+Math.abs(e.clientY-pointer.y)>7)pointer.moved=true;if(pointer.moved){if(viewAssist&&viewAssist.done)viewAssist.done();viewAssist=null;yaw-=dx*.004;pitch=Math.max(-1.05,Math.min(.65,pitch-dy*.003));lookHold=8;}pointer.lastX=e.clientX;pointer.lastY=e.clientY;});
 canvas.addEventListener('pointerup',function(e){if(!pointer.down)return;pointer.down=false;if(pointer.moved||moving)return;
   ndc.set(e.clientX/innerWidth*2-1,-e.clientY/innerHeight*2+1);ray.setFromCamera(ndc,camera);
   if(marker.visible){var hit=ray.intersectObject(marker,true);if(hit.length){activate();return;}}
   if(trainAttached&&['boarding','riding','arrived'].indexOf(stage)>=0){plane.normal.set(0,1,0);plane.constant=-(train.floorY+train.group.position.y+.95);if(ray.ray.intersectPlane(plane,v)){for(var si=0;si<train.seats.length;si++){var sp=train.seats[si];if(sp.car===door.car&&Math.abs(v.x-sp.x)<.85&&Math.abs(v.z-train.group.position.z-sp.z)<1.0){sit(sp);return;}}}plane.normal.set(0,1,0);plane.constant=-(train.floorY+train.group.position.y);if(ray.ray.intersectPlane(plane,v)){var bounds=train.walkBounds.cars&&train.walkBounds.cars[door.car]||train.walkBounds;var px=Math.max(bounds.minX,Math.min(bounds.maxX,v.x)),pz=Math.max(bounds.minZ,Math.min(bounds.maxZ,v.z-train.group.position.z));walk([{x:px,y:train.floorY,z:pz+train.group.position.z}],function(){$('action').disabled=!goalAction;toast('在车厢里站稳，扶好扶手。');});}}
 });
 canvas.addEventListener('pointercancel',function(){pointer.down=false;});
 document.addEventListener('dblclick',function(e){e.preventDefault();});document.addEventListener('gesturestart',function(e){e.preventDefault();},{passive:false});
 document.addEventListener('visibilitychange',function(){lastFrame=performance.now();if(document.hidden)audioCall('setZone','none');else audioCall('setZone',trainAttached?'train':stage==='street'||stage==='streetExit'?'street':feet.y<8?'platform':'concourse');});
}
function buildPicker(){var picker=$('stationPicker');picker.innerHTML='';['上车','下车'].forEach(function(label,col){var wrap=document.createElement('div');C.STATIONS.forEach(function(st,i){var b=document.createElement('button');b.type='button';b.dataset.index=i;b.dataset.col=col;b.setAttribute('aria-label',label+'站 '+st.name);b.innerHTML=st.name+'<small>'+st.landmarkName+'</small>';b.addEventListener('click',function(){audioCall('unlock');if(col===0){origin=i;if(destination===origin)destination=(i+1)%C.STATIONS.length;}else{destination=i;if(destination===origin)origin=(i+1)%C.STATIONS.length;}updatePicker();});wrap.appendChild(b);});picker.appendChild(wrap);});updatePicker();}
function updatePicker(){document.querySelectorAll('#stationPicker button').forEach(function(b){var picked=Number(b.dataset.index)===(Number(b.dataset.col)===0?origin:destination);b.classList.toggle('selected',picked);b.setAttribute('aria-pressed',picked?'true':'false');});$('routePreview').textContent=C.STATIONS[origin].name+' → '+C.STATIONS[destination].name;$('farePreview').textContent=Math.abs(destination-origin)+' 站 · '+(destination>origin?C.LINE.terminals.up:C.LINE.terminals.down)+'方向';}
function openSelection(){journeyEpoch++;clearInteraction();doorMotion=null;viewAssist=null;document.body.classList.remove('playing');moving=false;goalAction=null;marker.visible=false;$('worldTarget').hidden=true;audioCall('stopAll');audioCall('setZone','none');$('mapModal').hidden=true;$('finish').hidden=true;$('hud').hidden=true;$('selection').hidden=false;stage='selection';buildPicker();}
function showMap(){if(stage==='loading'||stage==='selection')return;$('mapStations').innerHTML=C.STATIONS.map(function(s,i){return '<span'+(i===current?' style="color:#cf2433"':'')+'>'+s.name+'</span>';}).join('');$('mapText').textContent='上车：'+C.STATIONS[origin].name+'　下车：'+C.STATIONS[destination].name+'　方向：'+terminal();$('mapModal').hidden=false;}
$('start').addEventListener('click',function(){audioCall('unlock');startJourney();});$('restart').addEventListener('click',openSelection);$('routeBtn').addEventListener('click',showMap);$('closeMap').addEventListener('click',function(){$('mapModal').hidden=true;});$('chooseAgain').addEventListener('click',openSelection);$('sound').addEventListener('click',function(){var state=audioCall('getState');audioCall('unlock');if(!(state&&(state.needsGesture||state.context!=='running')))muted=!muted;audioCall('setMuted',muted);$('sound').textContent='声音 '+(muted?'关':'开');$('sound').setAttribute('aria-label',muted?'开启声音':'关闭声音');});
window.addEventListener('gz-audio-state',function(e){$('sound').textContent=e.detail&&e.detail.needsGesture&&!muted?'点我恢复声音':'声音 '+(muted?'关':'开');});

GZ.debug={
 state:function(){return {stage:stage,travelled:travelled,origin:C.STATIONS[origin].id,destination:C.STATIONS[destination].id,current:C.STATIONS[current].id,dir:dir,trackIdx:trackIdx,door:door?{x:door.x,side:door.side,car:door.car}:null,moving:moving,pathIndex:pathIdx,pathLength:path.length,position:{x:feet.x,y:feet.y,z:feet.z},camera:{yaw:yaw,pitch:pitch},token:token,seated:seated,trainAttached:trainAttached,doors:doorOpen,alightDoors:alightOpen,alightSide:track?track.alightSide:null,spanishLayout:station?station.spanishLayout:false,speed:speed,seconds:Math.round(stageTimer*10)/10,goal:$('goal').textContent,npc:crowd?crowd.stats():null,npcPlayerRadius:crowd?crowd.playerRadius:null,interaction:interaction?interaction.kind:null,coinHeld:coinHeld,coinHistory:coinHistory.slice(),cameraAssist:viewAssist?'guided':stage==='approaching'?'head-tracking':null,doorAnimating:!!doorMotion,drawCalls:renderer?renderer.info.render.calls:0,triangles:renderer?renderer.info.render.triangles:0,fps:fps,perf:{tier:perfTier,scriptMs:perfScript},auditEnabled:auditEnabled,pixelRatio:renderer?renderer.getPixelRatio():0,modules:moduleState,audio:audioCall('getState'),announcements:announcements.slice(-16),errors:errors.slice(),notices:runtimeNotices.slice(-10)};},
 goto:function(s){if(!station)return;journeyEpoch++;clearInteraction();doorMotion=null;document.body.classList.add('playing');audioCall('stopAll');$('loading').hidden=true;$('selection').hidden=true;$('finish').hidden=true;$('mapModal').hidden=true;$('hud').hidden=false;moving=false;token=s!=='street';$('token').hidden=!token;current=origin;dir=destination>origin?1:-1;station.setStation(C.STATIONS[current]);chooseTrack();trainAttached=false;train.group.visible=false;station.group.visible=true;tunnel.group.visible=false;setDoors(0);updateRoute();
   if(s==='street'){startJourney();}
   else if(s==='concourse'){feet.copy(station.nav.security);zone('concourse');setStage('security');face(station.nav.securityExit);securityGoal();}
   else if(s==='platform'){feet.copy(station.nav.platformDoorSpotsByTrack[trackIdx][doorIdx]);zone('platform');face(worldTrainPoint(door));beginWait();}
   else if(s==='boarding'){feet.copy(station.nav.platformDoorSpotsByTrack[trackIdx][doorIdx]);zone('platform');train.group.visible=true;face(worldTrainPoint(door));boardingGoal();}
   else if(s==='riding'||s==='arrived'){train.group.visible=true;trainAttached=true;feet.copy(worldTrainPoint({x:door.x,y:train.floorY,z:0}));zone('train');face(worldTrainPoint({x:door.x+8,y:train.floorY,z:0}));if(s==='riding')beginRide();else{current=Math.max(0,Math.min(C.STATIONS.length-1,destination-dir));arrive();}}
   else if(s==='exit'){current=destination;station.setStation(C.STATIONS[current]);feet.copy(station.spanishLayout&&station.nav.alightSpotsByTrack?station.nav.alightSpotsByTrack[trackIdx][doorIdx]:station.nav.platformDoorSpotsByTrack[trackIdx][doorIdx]);zone('platform');setStage('exit');exitGoal();}
   else throw new Error('未知调试阶段: '+s);return GZ.debug.state();
 },
 npcPositions:function(){return crowd.actors.filter(function(a){return a.visible;}).map(function(a){return {id:a.id,x:a.position.x,y:a.position.y,z:a.position.z,state:a.state,walking:a.walking};});},
 inspect:function(pos,target){if(pos)feet.set(pos.x,pos.y,pos.z);viewAssist=null;lookHold=30;var dx=target.x-feet.x,dz=target.z-feet.z;yaw=Math.atan2(-dx,-dz);pitch=Math.atan2(target.y-(feet.y+C.EYE_H),Math.sqrt(dx*dx+dz*dz));},
 grips:function(){var report=[],matrix=new T.Matrix4(),hand=new T.Vector3(),part=crowd.parts.filter(function(p){return p.spec[0]==='handL';})[0];for(var i=0;i<crowd.count;i++){var a=crowd.actors[i];if(!a.visible||a.pose!=='strap')continue;part.mesh.getMatrixAt(crowd.order?crowd.order.indexOf(i):i,matrix);hand.setFromMatrixPosition(matrix);var best=Infinity;for(var j=0;j<strapSpots.length;j++){var p=strapSpots[j],distance=Math.sqrt(Math.pow(hand.x-p.x,2)+Math.pow(hand.y-p.y,2)+Math.pow(hand.z-p.z,2));best=Math.min(best,distance);}report.push({id:i,distance:best,hand:{x:hand.x,y:hand.y,z:hand.z}});}return {worldAnchors:!!train.strapSpots,holders:report};},
 camera:function(){return camera;},
 perf:{report:perfReport,reset:function(){perfStages={};}},
 world:function(){return {renderer:renderer,runtime:runtime,station:station,train:train,tunnel:tunnel,scene:scene,crowd:crowd,geometry:geometry};},
 audit:{report:function(){return audit?Object.assign({enabled:true},audit.report()):{enabled:false,frames:0,counts:{},total:null,method:'Disabled in gameplay. Explicit ?audit=1 required for geometry acceptance.'};},reset:function(){if(audit)audit.reset();}},
 turn:function(y,p){yaw=y;pitch=Math.max(-1.05,Math.min(.65,p));lookHold=1;viewAssist=null;}
};
async function boot(){
 try {
  setProgress(8,'正在准备积木列车…');var loaded=await loadScript('js/metro/train.js');setProgress(22,'正在打开广州车站…');var sl=await loadScript('js/metro/station.js');moduleState.world=!!(loaded&&sl&&GZ.Train&&GZ.Station);
  setProgress(40,'正在准备地铁声音和三语报站…');var al=await loadScript('js/metro/audio.js');moduleState.audio=!!(al&&GZ.Audio);moduleState.placeholder=!moduleState.world||!moduleState.audio;substitutes();
  try{await GZ.Audio.preload(function(r){setProgress(40+r*45,'正在准备三语广播… '+Math.round(r*100)+'%');});}catch(e){runtimeNotices.push('音频加载失败: '+e.message);moduleState.audio=false;}
  moduleState.placeholder=!moduleState.world||!moduleState.audio;setProgress(90,'小乘客们正在进站…');setup();buildPicker();setProgress(100,'准备好了！');$('loading').hidden=true;$('selection').hidden=false;stage='selection';
 }catch(e){console.error(e);$('loading').hidden=true;$('fatalText').textContent=e.message;$('fatal').hidden=false;}
}
boot();
})();
