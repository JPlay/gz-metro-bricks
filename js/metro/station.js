/* Complete reusable brick metro station and scrolling tunnel. */
(function(){
'use strict';
var GZ=window.GZ=window.GZ||{},T=window.THREE,W=GZ.WorldInternals;
function point(x,y,z,zone,extra){return Object.assign({x:x,y:y,z:z,zone:zone},extra||{});}
function label(builder,mat,w,h,x,y,z,ry){W.panel(builder,mat,w,h,x,y,z,ry);}
function labelOne(builder,mat,w,h,x,y,z,ry){builder.add(new T.PlaneGeometry(w,h),mat,x,y,z,ry);}
function textPanel(lines,bg,fg,w,h){var p=W.canvasMaterial(w||1024,h||256),c=p.ctx;
 c.fillStyle=bg||'#13232a';c.fillRect(0,0,p.canvas.width,p.canvas.height);c.textAlign='center';c.textBaseline='middle';
 for(var i=0;i<lines.length;i++){c.fillStyle=fg||'#ffffff';c.font=(i===0?'bold ':'')+(lines.length===1?76:i===0?58:32)+'px "PingFang SC","Microsoft YaHei",sans-serif';c.fillText(lines[i],p.canvas.width/2,p.canvas.height*(i+.55)/lines.length,p.canvas.width-40);}
 p.texture.needsUpdate=true;return p;}
function boxHoles(b,m,y,x0,x1,z0,z1,holes,thickness){
 thickness=thickness||.48;holes=holes.map(function(h){return[Math.max(x0,h[0]),Math.min(x1,h[1]),Math.max(z0,h[2]),Math.min(z1,h[3])];}).filter(function(h){return h[0]<h[1]&&h[2]<h[3];});
 // Disjoint rectangular floor patches leave real openings for all four escalators.
 var xs=[x0,x1],zs=[z0,z1],i,j,k;holes.forEach(function(h){xs.push(h[0],h[1]);zs.push(h[2],h[3]);});xs.sort(function(a,b){return a-b;});zs.sort(function(a,b){return a-b;});
 for(i=0;i<xs.length-1;i++)for(j=0;j<zs.length-1;j++){var mx=(xs[i]+xs[i+1])/2,mz=(zs[j]+zs[j+1])/2,inside=false;
  for(k=0;k<holes.length;k++){var h=holes[k];if(mx>h[0]&&mx<h[1]&&mz>h[2]&&mz<h[3])inside=true;}
  if(!inside&&xs[i+1]>xs[i]&&zs[j+1]>zs[j])b.box(m,xs[i+1]-xs[i],thickness,zs[j+1]-zs[j],mx,y-thickness/2,mz);
 }
}
function slopeSolid(b,mat,top,bottom,z,depth,height,offset){
 var shape=new T.Shape();shape.moveTo(bottom.x,bottom.y+offset-height/2);shape.lineTo(top.x,top.y+offset-height/2);shape.lineTo(top.x,top.y+offset+height/2);shape.lineTo(bottom.x,bottom.y+offset+height/2);shape.closePath();var geo=new T.ExtrudeGeometry(shape,{depth:depth,bevelEnabled:false,steps:1,curveSegments:1});b.add(geo,mat,0,0,z-depth/2);
}
function batchEscalatorShells(list,builder){
 // Transfer opaque static geometry to the shared layer batch. Collider source
 // groups and moving treads stay intact; only the render submission is merged.
 list.forEach(function(e){e.group.children.slice().forEach(function(mesh){
  if(!mesh.isMesh||mesh.isInstancedMesh||mesh.material.transparent)return;
  var bucket=null;for(var i=0;i<builder.buckets.length;i++)if(builder.buckets[i].mat===mesh.material)bucket=builder.buckets[i];
  if(!bucket){bucket={mat:mesh.material,parts:[]};builder.buckets.push(bucket);}
  bucket.parts.push(mesh.geometry);e.group.remove(mesh);
 });});
}
function escalator(parent,m,name,top,bottom,width,shaftWidth){
 var g=new T.Group();g.name=name+' · 封闭梯井';parent.add(g);var b=new W.Builder(g),dx=top.x-bottom.x,dy=top.y-bottom.y,len=Math.hypot(dx,dy),angle=Math.atan2(dy,dx),mx=(top.x+bottom.x)/2,my=(top.y+bottom.y)/2,z=top.z;
 // Segmented solids follow the slope exactly; their AABBs cannot engulf the stair lane.
 var segments=60;b.slope=dy/dx;b.collisionOnly=true;
 for(var k=0;k<segments;k++){var t=(k+.5)/segments,xx=bottom.x+dx*t,yy=bottom.y+dy*t;
  b.kind='floor';b.supportId=name;b.owner=name+' 扶梯机身';b.box(m.dark,Math.abs(dx)/segments+.025,.95,width,xx,yy-.66,z);
 }
 b.collisionOnly=false;slopeSolid(b,m.dark,top,bottom,z,width,.95,-.66);
 b.kind=null;b.supportId=null;[-1,1].forEach(function(s){b.owner=name+' 栏板扶手';b.collisionOnly=true;for(var ri=0;ri<segments;ri++){var rt=(ri+.5)/segments,rx=bottom.x+dx*rt,ry=bottom.y+dy*rt;
  b.box(m.steel,Math.abs(dx)/segments+.03,.72,.14,rx,ry+.67,z+s*(width/2+.14));b.box(m.black,Math.abs(dx)/segments+.03,.13,.2,rx,ry+1.4,z+s*(width/2+.14));b.box(m.glass,Math.abs(dx)/segments+.03,1.05,.08,rx,ry+.65,z+s*(width/2+.14));}
  b.collisionOnly=false;slopeSolid(b,m.steel,top,bottom,z+s*(width/2+.14),.14,.72,.67);slopeSolid(b,m.black,top,bottom,z+s*(width/2+.14),.2,.13,1.4);slopeSolid(b,m.glass,top,bottom,z+s*(width/2+.14),.08,1.05,.65);[top,bottom].forEach(function(p){b.box(m.steel,1.6,.12,.2,p.x,p.y+1.4,z+s*(width/2+.14));});});
 b.kind='floor';b.owner=name+' 落地平台';[top,bottom].forEach(function(p){var out=(p===top?1:-1)*Math.sign(dx);b.box(m.floor,1.7,.26,width,p.x+out*.8,p.y-.13,z);b.box(m.yellow,.5,.018,width,p.x,p.y+.01,z);});b.kind=null;
 if(shaftWidth){
  b.collisionOnly=true;for(k=0;k<segments;k++){t=(k+.5)/segments;xx=bottom.x+dx*t;yy=bottom.y+dy*t;
   [-1,1].forEach(function(s){b.owner=name+' 梯井侧墙';b.box(m.shaftTile,Math.abs(dx)/segments+.02,12.7,.3,xx,yy+1.35,z+s*shaftWidth/2);b.box(m.band,Math.abs(dx)/segments+.02,.55,.32,xx,yy+2.1,z+s*shaftWidth/2);});
   b.kind='ceiling';b.owner=name+' 连续梯井顶';b.box(m.ceiling,Math.abs(dx)/segments+.03,.32,shaftWidth+.3,xx,yy+7.6,z);b.kind=null;
   if(k%9===0){b.collisionOnly=false;b.box(m.lamp,.8,.075,shaftWidth-.6,xx,yy+7.36,z);b.collisionOnly=true;}
  }b.collisionOnly=false;[-1,1].forEach(function(s){slopeSolid(b,m.shaftTile,top,bottom,z+s*shaftWidth/2,.3,12.7,1.35);slopeSolid(b,m.band,top,bottom,z+s*shaftWidth/2,.32,.55,2.1);});slopeSolid(b,m.ceiling,top,bottom,z,shaftWidth+.3,.32,7.6);
 }
 b.finish();var count=42,pitch=Math.abs(dx)/count,steps=new T.InstancedMesh(new T.BoxGeometry(pitch+.02,.4,width-.08),m.steel,count+2),o=new T.Object3D(),phase=0,positions=[];
 var marks=new T.InstancedMesh(new T.BoxGeometry(.09,.035,width-.12),m.yellow,count+2);steps.instanceMatrix.setUsage(T.DynamicDrawUsage);marks.instanceMatrix.setUsage(T.DynamicDrawUsage);g.add(steps,marks);
 function update(dt){phase=(phase+dt*3.2/len)%(1/count);positions.length=0;for(var i=0;i<count+2;i++){var t=(i-1)/count+phase;if(name==='platformDown'||name==='entrance')t=1-t;
   var px=bottom.x+dx*t,py=bottom.y+dy*Math.max(0,Math.min(1,t));o.position.set(px,py-.2,z);o.updateMatrix();steps.setMatrixAt(i,o.matrix);positions.push({x:px,y:py});o.position.x+=pitch/2-.05;o.position.y+=.22;o.updateMatrix();marks.setMatrixAt(i,o.matrix);}
  steps.instanceMatrix.needsUpdate=true;marks.instanceMatrix.needsUpdate=true;}
 var result={id:name,group:g,top:top,bottom:bottom,width:width,min:{x:Math.min(top.x,bottom.x)-1.3,y:bottom.y-.3,z:z-width/2},max:{x:Math.max(top.x,bottom.x)+1.3,y:top.y+7.8,z:z+width/2},update:update,
 sample:function(x,zq,expectedY){if(Math.abs(zq-z)>width/2-.04||x<result.min.x||x>result.max.x)return null;
  var f=(x-bottom.x)/dx;if(f<0||f>1){var pp=f<0?bottom:top;if(Math.abs(pp.y-expectedY)>1)return null;return{y:pp.y,normal:{x:0,y:1,z:0},id:name+'-landing',kind:'floor'};}
  var nominal=bottom.y+dy*f;if(Math.abs(nominal-expectedY)>1.1)return null;
  var chosen=null;for(var j=0;j<positions.length;j++){var a=positions[j],dd=Math.abs(x-a.x);if(dd<=pitch/2+.01+1e-6&&(!chosen||a.y>chosen.y))chosen=a;}
  return chosen?{y:chosen.y,normal:{x:0,y:1,z:0},id:name+'-step',kind:'escalator'}:{y:f<.5?bottom.y:top.y,normal:{x:0,y:1,z:0},id:name+'-landing',kind:'floor'};
 }};update(0);return result;
}
function gate(parent,m,pos,out,sharedBuilder,sharedScreen){
 var group=new T.Group();group.position.set(pos.x,pos.y,pos.z);group.name=out?'出站投币闸机':'进站刷币闸机';parent.add(group);
 var b=new W.Builder(group);[-1,1].forEach(function(s){b.box(m.steel,4,2.2,.86,0,1.1,s*1.68);b.box(m.dark,3.8,.13,.9,0,2.27,s*1.68);b.box(m.white,.4,1.8,.9,-1.65,.95,s*1.68);});
 b.box(m.black,.65,.055,.62,-.5,2.36,1.68);b.box(m.green,.28,.065,.28,-.5,2.39,1.68);
 if(out){b.box(m.black,.16,.075,.57,-1.1,2.36,1.68);b.box(m.yellow,.25,.025,.68,-1.1,2.35,1.68);b.box(m.black,.08,.07,.45,-1.1,2.39,1.68);}
 var screen=sharedScreen||textPanel([out?'投币出站':'刷币进站','↓'], '#102c29','#65edaf',512,256);label(b,screen.material,1.2,.63,-1.25,1.55,2.135,0);label(b,screen.material,.8,.63,-2.07,1.55,1.68,-Math.PI/2);if(sharedBuilder){b.buckets.forEach(function(bucket){bucket.parts.forEach(function(geo){sharedBuilder.add(geo,bucket.mat,pos.x,pos.y,pos.z);});});b.buckets.length=0;}else b.finish();
 var a=new T.Group(),d=new T.Group();a.name=d.name="闸机扇门";a.position.z=-1.22;d.position.z=1.22;group.add(a,d);
 var leafGeo=new T.BoxGeometry(.12,1.55,1.2),left=new T.Mesh(leafGeo,m.gateGlass),right=new T.Mesh(leafGeo,m.gateGlass);left.position.set(0,1.1,.58);right.position.set(0,1.1,-.58);a.add(left);d.add(right);[left,right].forEach(function(mesh){var geo=mesh.geometry.clone();geo.translate(mesh.position.x,mesh.position.y,mesh.position.z);W.recordCollider({group:mesh.parent,kind:'door',owner:'闸机动态扇门'},geo,'BoxGeometry');geo.dispose();});
 a.userData.worldBatchBoundary=d.userData.worldBatchBoundary=true;
 var token=new T.Mesh(new T.CylinderGeometry(.29,.29,.1,12),m.token);token.userData.worldDynamic=true;token.visible=false;group.add(token);var target=0,open=0,drop=-1,gateDuration=.6;
 return {group:group,duration:gateDuration,getState:function(){return{open:open,target:target};},getOpen:function(){return open;},position:point(pos.x-3,pos.y,pos.z,'concourse'),open:function(){target=1;},close:function(){target=0;},setOpen:function(v){open=target=Math.max(0,Math.min(1,v||0));a.rotation.y=-open*Math.PI/2;d.rotation.y=open*Math.PI/2;var root=parent.parent;W.refreshColliders(root,root.userData.colliderSink.filter(function(c){return c.kind==='door'&&(c._group===a||c._group===d);}));if(root.userData.worldRefreshGates)root.userData.worldRefreshGates();},insertToken:function(){drop=0;token.visible=true;token.position.set(-1.1,3,1.68);target=1;},update:function(dt){var previous=open;open+=Math.sign(target-open)*Math.min(Math.abs(target-open),dt/gateDuration);a.rotation.y=-open*Math.PI/2;d.rotation.y=open*Math.PI/2;if(drop>=0){drop+=dt;token.position.y=3-drop*2.3;if(drop>.7){drop=-1;token.visible=false;}}return previous!==open;}};
}
function tvm(parent,m,x,y,z,sharedBuilder,sharedHead,sharedMessages){
 var group=new T.Group();group.position.set(x,y,z);group.name='自动售票机 · 绿色单程票';parent.add(group);var b=new W.Builder(group);
 b.box(m.steel,2.7,4.9,1.8,0,2.45,0);b.box(m.blue,2.6,3.65,.12,0,2.2,-.95);b.box(m.yellow,2.74,.48,1.9,0,4.66,0);
 b.box(m.dark,1.9,1.42,.15,0,3.1,-1.05);b.box(m.black,.25,.2,.08,.87,1.8,-1.07);b.box(m.steel,.9,.65,.12,.58,2.11,-1.08);b.box(m.black,.3,.035,.035,.64,2.26,-1.16);for(var key=0;key<6;key++)b.box(m.white,.17,.1,.05,.35+(key%3)*.22,2.1-Math.floor(key/3)*.16,-1.17);b.box(m.dark,1.2,.15,.12,-.4,1.5,-1.08);b.box(m.green,.24,.08,.06,.9,1.34,-1.16);b.box(m.black,1.4,.3,.12,-.2,.62,-1.08);
 var p,lastMessage=null;if(!sharedMessages.cache){p=textPanel(['自动售票','单程票  ¥2'],'#113d5b','#eefbff',512,256);sharedMessages.cache=new W.PanelCache(p,function(c,text){if(text===null)return;c.fillStyle='#113d5b';c.fillRect(0,0,512,256);c.fillStyle='#eefbff';c.textAlign='center';c.font='bold 45px sans-serif';c.fillText(String(text),256,143,480);},'station-tvm');sharedMessages.initial=sharedMessages.cache.add('@initial',null).texture;GZ.config.STATIONS.forEach(function(st){var text='去 '+st.name;sharedMessages.cache.add('@message:'+text,text);});}else p={material:new T.MeshBasicMaterial({map:sharedMessages.initial,side:T.FrontSide})};label(b,p.material,1.72,1.17,0,3.1,-1.14,Math.PI);
 var head=sharedHead||textPanel(['自动售票机'],'#f3d03e','#1b262b',512,128);label(b,head.material,2.6,.4,0,4.66,-1.02,Math.PI);if(sharedBuilder){b.buckets.forEach(function(bucket){bucket.parts.forEach(function(geo){sharedBuilder.add(geo,bucket.mat,x,y,z);});});b.buckets.length=0;}else b.finish();
 var token=new T.Mesh(new T.CylinderGeometry(.3,.3,.11,12),m.token);token.userData.worldDynamic=true;token.position.set(-.2,.65,-1.25);token.visible=false;group.add(token);
 return{group:group,position:point(x,y,z-3.4,'concourse'),buy:function(){token.visible=true;},open:function(){token.visible=true;},close:function(){token.visible=false;},setMessage:function(text){text=String(text);if(lastMessage===text)return;lastMessage=text;sharedMessages.cache.select(p.material,'@message:'+text,text);}};
}
GZ.Station={VERSION:'world-round3-14',build:function(opts){
 opts=opts||{};var station=opts.station||GZ.config.STATIONS[0],dir=opts.dir===-1?-1:1;
 var xs=opts.doorXs?opts.doorXs.slice():[],i,s; if(!xs.length)for(i=0;i<6;i++)for(var j=0;j<5;j++)xs.push((i-2.5)*41+(j-2)*7.2);
 var sorted=xs.slice().sort(function(a,b){return a-b;});
 var group=new T.Group();group.name='广州地铁 · 立体积木车站';var colliders=[];group.userData.colliderSink=colliders;
 var street=new T.Group(),hall=new T.Group(),platform=new T.Group(),connections=new T.Group();group.add(street,hall,platform,connections);
 street.name='地面出入口与地标';hall.name='站厅 · 售票与闸机';platform.name='岛式站台';connections.name='楼梯与动态扶梯';
 var m={floor:W.tile(new T.MeshPhongMaterial({color:new T.Color('#aab8af').convertSRGBToLinear(),specular:new T.Color('#667e81').convertSRGBToLinear(),shininess:38}),6,false),white:W.material('#dbdcd1'),steel:W.metal('#8197a1'),dark:W.material('#263d48'),black:W.material('#09171e'),ceiling:W.material('#172a33'),grout:W.material('#475857'),blue:W.material('#155271'),
 yellow:W.material(GZ.config.LINE.color),band:W.material(station.color),wall:W.material(station.color),column:W.material('#edece2'),red:W.material(GZ.config.TRAIN.stripeColor),brick:W.material('#b55e43'),green:W.material('#328461'),token:W.material('#40bc59'),
 glass:W.material('#adcbd2',{transparent:true,opacity:.045,depthWrite:false,side:T.DoubleSide}),gateGlass:W.material('#5baab2',{transparent:true,opacity:.55,depthWrite:false}),
 shadow:new T.MeshBasicMaterial({color:'#1b2d30',transparent:true,opacity:.22,depthWrite:false}),lamp:new T.MeshBasicMaterial({color:'#fff9e7'}),grass:W.material('#6d9d69'),road:W.material('#354752'),vehicleShade:W.material('#304149'),roofTile:W.material('#d5a336')};
 [m.band,m.wall,m.column].forEach(function(mat){mat.userData.worldDynamic=true;});
 m.shaftTile=W.tile(W.material('#c9ccc4'),3,false);Object.keys(m).forEach(function(k){m[k].fog=false;});var platformRoof=new T.Group(),hallRoof=new T.Group(),streetSurface=new T.Group();platform.add(platformRoof);hall.add(hallRoof);street.add(streetSurface);var prb=new W.Builder(platformRoof),hrb=new W.Builder(hallRoof),ssb=new W.Builder(streetSurface);
 var pb=new W.Builder(platform),hb=new W.Builder(hall),sb=new W.Builder(street),cb=new W.Builder(connections);
 pb.owner='岛式站台';var stationSign=W.canvasMaterial(1024,256),entrySign=W.canvasMaterial(1024,256),guide=W.canvasMaterial(1024,256),landSign=W.canvasMaterial(1024,128),route=W.canvasMaterial(1024,512);
 function stationKey(st){return [st.id,st.name,st.en,st.color,st.exit,st.landmark,st.landmarkName,st.transfer].join('|');}
 var stationCache=new W.PanelCache(stationSign,function(c,station){c.fillStyle='#f7f5e9';c.fillRect(0,0,1024,256);c.fillStyle=GZ.config.LINE.color;c.fillRect(0,0,1024,18);c.fillRect(0,238,1024,18);c.textAlign='center';c.fillStyle='#16262d';c.font='bold 106px sans-serif';c.fillText(station.name,560,126);c.font='35px sans-serif';c.fillText(station.en,560,197,820);c.fillStyle=GZ.config.LINE.color;c.beginPath();c.arc(89,124,57,0,Math.PI*2);c.fill();c.fillStyle='#16262d';c.font='bold 70px sans-serif';c.fillText('1',89,148);
},'station-name');
 var entryCache=new W.PanelCache(entrySign,function(c,station){c.fillStyle='#145977';c.fillRect(0,0,1024,256);c.fillStyle='#ffffff';c.font='bold 80px sans-serif';c.textAlign='center';c.fillText(station.name+'站  '+station.exit+'口',512,103);c.font='39px sans-serif';c.fillText(station.en+'   '+station.exit,512,190,990);
},'station-entry');
 var landCache=new W.PanelCache(landSign,function(c,station){c.fillStyle='#f1ebd9';c.fillRect(0,0,1024,128);c.fillStyle='#962f27';c.textAlign='center';c.font='bold 57px sans-serif';c.fillText(station.landmarkName,512,82,980);
},'station-landmark');
 var routeCache=new W.PanelCache(route,function(c,station){c.fillStyle='#f1f1e8';c.fillRect(0,0,1024,512);c.fillStyle='#20313a';c.textAlign='center';c.font='bold 46px sans-serif';c.fillText('1号线  广州地铁',512,60);c.strokeStyle=GZ.config.LINE.color;c.lineWidth=16;c.beginPath();c.moveTo(80,228);c.lineTo(944,228);c.stroke();
   GZ.config.STATIONS.forEach(function(s,i){var x=120+i*784/3;c.fillStyle=s.id===station.id?'#c73039':GZ.config.LINE.color;c.beginPath();c.arc(x,228,20,0,Math.PI*2);c.fill();c.fillStyle='#20313a';c.font='bold 44px sans-serif';c.fillText(s.name,x,316,235);if(s.transfer){c.font='30px sans-serif';c.fillText('换乘 '+s.transfer,x,369);}});c.font='32px sans-serif';c.fillText('← 西塱                      广州东站 →',512,452);
},'station-route');
 var guideCache=new W.PanelCache(guide,function(c,data){var station=data.station,dir=data.dir;c.fillStyle='#12232b';c.fillRect(0,0,1024,256);c.textAlign='center';c.fillStyle='#f4d34f';c.font='bold 59px sans-serif';c.fillText('↓  1号线  '+(dir===1?'广州东站':'西塱')+'方向',512,80);c.fillStyle='#ffffff';c.font='45px sans-serif';c.fillText(station.exit+'口 → '+station.landmarkName,512,160,960);c.font='30px sans-serif';c.fillText(station.transfer?'换乘 '+station.transfer+'  请按导向标识前行':'请先下后上  文明乘车',512,224);},'station-guide');
 GZ.config.STATIONS.forEach(function(st){var key=stationKey(st);stationCache.add(key,st);entryCache.add(key,st);landCache.add(key,st);routeCache.add(key,st);[-1,1].forEach(function(d){guideCache.add(key+'|'+d,{station:st,dir:d});});});
 var panelCaches=[stationCache,entryCache,landCache,routeCache,guideCache],lastStationKey=null;
 var stationFlagColliders=null,stationFlags=Object.create(null),cutaway=false;
 function flagKey(){return(station.id==='gyq'?'gyq':'ordinary')+'|'+station.landmark;}
 function applyStationFlags(){var flags=stationFlags[flagKey()];if(!stationFlagColliders){W.refreshColliderFlags(colliders);return;}if(!flags||cutaway){W.refreshColliderFlags(stationFlagColliders);return;}for(var fi=0;fi<stationFlagColliders.length;fi++)stationFlagColliders[fi].enabled=!!flags[fi];}

 var safety=textPanel(['先下后上  请勿倚靠','请小心列车与站台之间的空隙'],'#182d36','#fff4c1');
 var downSign=textPanel(['↓  1号线  乘车','请站稳扶好'],'#13232a','#fff4c1');
 var customer=textPanel(['客服中心','票务服务  ·  问询'],'#164c62','#ffffff');
 var secure=textPanel(['安检','请把包放进安检机'],'#13232a','#fff4c1');
 var wc=textPanel(['←  洗手间     无障碍电梯  →'],'#13232a','#ffffff');
pb.box(m.dark,280,.35,66,0,-.85,0);
 // Platform, tracks, full-height enclosure and overhead lights.
 pb.owner="站台边缘";pb.box(m.floor,270,1.8,18.8,0,1.1,0);
 pb.owner="站台设施";boxHoles(prb,m.ceiling,12.6,-137,137,-32,32,[[-39.5,-16,-4.1,4.1],[15.5,39,24.9,29.1],[15.5,39,-29.1,-24.9]]);
 [-1,1].forEach(function(side){
  // Retaining walls meet the concourse slab, including the outer-shaft void.
  // The former 12.3 wall top left a real slit above the platform roof edge.
  // End inside the slab [13.52,14], not coplanar with its visible upper face.
  pb.box(m.wall,274,14.8,.6,0,6.4,side*31.8);pb.box(m.band,273,1.05,.65,0,7.75,side*31.43);
  pb.box(m.yellow,265,.04,.35,0,2.025,side*8.47);pb.box(m.dark,274,.5,10.4,0,-.4,side*14.95);
  [-1,1].forEach(function(r){pb.box(m.steel,285,.16,.23,0,-.02,side*14.95+r*2.65);});
  pb.box(m.dark,270,.2,.5,0,10.95,side*20.8);pb.box(m.dark,270,.14,.14,0,6.2,side*31.36);pb.box(m.dark,270,.14,.14,0,5.5,side*31.36);
  pb.box(m.lamp,260,.07,.65,0,12.01,side*5.8);
  for(i=-108;i<=108;i+=54){label(pb,stationSign.material,14,3.5,i,5.5,side*31.08,side===1?Math.PI:0);label(pb,route.material,18,5.6,i+18,6.2,side*31.07,side===1?Math.PI:0);}
 });
 [-1,1].forEach(function(end){pb.box(m.black,.6,13.4,18.8,end*136.6,5.7,0);pb.box(m.black,.6,13.4,11.3,end*136.6,5.7,26.15);pb.box(m.black,.6,13.4,11.3,end*136.6,5.7,-26.15);});
 var sleep=[];for(i=-140;i<=140;i+=2.2){sleep.push([i,-.18,14.95],[i,-.18,-14.95]);}W.instance(platform,new T.BoxGeometry(.7,.24,7.5),m.dark,sleep);
 var col=[];[-115,-88,-61,20,47,74,101,128].forEach(function(x){col.push([x,7.05,0]);pb.box(m.shadow,2.1,.02,2.1,x+.2,2.025,.2);pb.box(m.band,1.64,.75,1.64,x,6.4,0);labelOne(pb,stationSign.material,4.8,1.2,x,8.2,.83,0);labelOne(pb,stationSign.material,4.8,1.2,x,8.2,-.83,Math.PI);});W.instance(platform,new T.BoxGeometry(1.5,10.1,1.5),m.column,col);
 [-78,36,88].forEach(function(x){pb.box(m.steel,9,.2,1.8,x,3,0);pb.box(m.steel,.2,1,1.4,x-3,2.5,0);pb.box(m.steel,.2,1,1.4,x+3,2.5,0);});
 var studs=[];for(i=-132;i<135;i+=2)for(s=-1;s<=1;s+=2)studs.push([i,2.035,s*8.12]);W.instance(platform,new T.CylinderGeometry(.09,.09,.045,6),m.yellow,studs);
 // PSD leaves are merged by side and direction: four transforms for 120 moving leaves.
 pb.owner="屏蔽门固定框架";var psdLeaves=[[],[]];
 for(var tr=0;tr<2;tr++) {
  var side=tr===0?1:-1,z=side*9.4,frame=pb,prev=-135;
  for(var n=0;n<=sorted.length;n++) {var dx=n<sorted.length?sorted[n]:136.6,left=dx-1.6,w=left-prev;
   if(w>0){frame.box(m.glass,w,6.7,.12,(prev+left)/2,5.4,z);frame.box(m.steel,w,.55,.18,(prev+left)/2,2.3,z);}
   if(n<sorted.length){frame.box(m.steel,.16,8.2,.32,dx-1.63,6.1,z);frame.box(m.steel,.16,8.2,.32,dx+1.63,6.1,z);frame.box(m.dark,3.3,.84,.4,dx,9.96,z);
    label(frame,safety.material,3,.74,dx,9.95,z-side*.23,side===1?Math.PI:0);
    frame.box(m.green,.26,.09,.48,dx,10.44,z);
    // Waiting arrows remain a material-independent part of the platform floor.
    for(var ar=-1;ar<=1;ar+=2){frame.box(m.white,.17,.025,1.45,dx+ar*1.75,2.035,side*7.4);frame.box(m.white,.15,.025,.7,dx+ar*1.75-.22,2.035,side*7.93,ar*.65);frame.box(m.white,.15,.025,.7,dx+ar*1.75+.22,2.035,side*7.93,-ar*.65);}
    frame.box(m.yellow,.1,.02,1.6,dx,2.04,side*7.3);
   }prev=dx+1.6;
  }
  frame.box(m.steel,270,.34,.42,0,10.55,z);
  for(var sign=-1;sign<=1;sign+=2){var g=new T.Group();platform.add(g);g.name="屏蔽门滑动叶片";g.userData.worldBatchBoundary=true;var db=new W.Builder(g);db.kind="door";
   for(n=0;n<sorted.length;n++){dx=sorted[n]+sign*.78;db.box(m.glass,1.55,6.7,.11,dx,5.4,z-side*.12);db.box(m.steel,.08,6.7,.17,dx+sign*.74,5.4,z-side*.12);db.box(m.steel,1.55,.6,.2,dx,2.32,z-side*.12);db.box(m.yellow,1.55,.12,.13,dx,6.6,z-side*.2);}
   db.finish();psdLeaves[tr].push({group:g,sign:sign});
  }
 }
 // Gongyuanqian's Spanish layout: central platform boards, exterior platforms alight.
 var spanish=new T.Group();spanish.name='公园前 · 右出左进';platform.add(spanish);var spanishConnections=new T.Group();connections.add(spanishConnections);var spb=new W.Builder(spanish),scb=new W.Builder(spanishConnections),outerLeaves=[[],[]],outerEsc=[];
 spb.owner='外侧站台边缘';var alightSign=textPanel(['下车站台  →  出口','右出左进  ·  公园前'],'#152a32','#fff1b1');
 for(var ot=0;ot<2;ot++){var os=ot===0?1:-1,oz=os*20.5;
  spb.box(m.floor,270,1.8,10,0,1.1,os*25.5);spb.box(m.yellow,265,.04,.35,0,2.03,os*20.45);boxHoles(spb,m.lamp,12.045,-130,130,os*25.8-.325,os*25.8+.325,[[15.5,39,24.9,29.1],[15.5,39,-29.1,-24.9]],.07);
  spb.owner="外侧屏蔽门固定框架";var pr=-135;for(var sn=0;sn<=sorted.length;sn++){var ox=sn<sorted.length?sorted[sn]:136.6,sw=ox-1.6-pr;if(sw>0)spb.box(m.glass,sw,6.7,.12,(pr+ox-1.6)/2,5.4,oz);
   if(sn<sorted.length){spb.box(m.steel,.16,8.2,.32,ox-1.63,6.1,oz);spb.box(m.steel,.16,8.2,.32,ox+1.63,6.1,oz);}pr=ox+1.6;}
  spb.box(m.steel,270,.38,.4,0,10.4,oz);[-75,0,95].forEach(function(x){label(spb,alightSign.material,12,2.5,x,9.2,oz+os*.24,os===1?0:Math.PI);});
  for(var ss=-1;ss<=1;ss+=2){var og=new T.Group();spanish.add(og);og.name="外侧屏蔽门滑动叶片";og.userData.worldBatchBoundary=true;var olb=new W.Builder(og);olb.kind="door";for(sn=0;sn<sorted.length;sn++){ox=sorted[sn]+ss*.78;olb.box(m.glass,1.55,6.7,.12,ox,5.4,oz+os*.12);olb.box(m.steel,.08,6.7,.18,ox+ss*.74,5.4,oz+os*.12);olb.box(m.steel,1.55,.6,.2,ox,2.32,oz+os*.12);}olb.finish();outerLeaves[ot].push({group:og,sign:ss});}
  outerEsc.push(escalator(spanishConnections,m,'outerExit'+ot,point(17,14,os*27),point(47,2,os*27),3,4.2));
  
 }
 batchEscalatorShells(outerEsc,scb);spb.finish();scb.finish();
 pb.owner="站台设施";
 // Live PIDS: one texture per direction, all screens share it.
 var pidsPanels=[W.canvasMaterial(1024,256),W.canvasMaterial(1024,256)],pidsValues=[{},{}];
 [-102,-52,14,65,112].forEach(function(x){pb.box(m.steel,.12,1.5,.12,x,11.2,0);pb.box(m.black,9.1,2.5,.38,x,9.7,0);
  label(pb,pidsPanels[0].material,8.9,2.23,x,9.7,.21,0);label(pb,pidsPanels[1].material,8.9,2.23,x,9.7,-.21,Math.PI);});
 // Concourse: large clear unpaid and paid areas, openings and a genuine barrier line.
 var holes=[[-85.5,-69.5,24.9,29.1],[57.5,73.5,24.9,29.1],[-42,-4,-5,5]];
 boxHoles(hb,m.floor,14,-98,88,-42,42,[[-39.5,-20,-4.1,4.1],[15.5,36,24.9,29.1],[15.5,36,-29.1,-24.9]]);boxHoles(hrb,m.ceiling,24.5,-98,88,-42,42,[[-85.5,-61.5,24.9,29.1],[49.5,73.5,24.9,29.1]]);
 hb.box(m.wall,186,10.5,.6,-5,19.25,42);hb.box(m.band,185,.9,.65,-5,19,41.6);
 hb.box(m.wall,.6,10.5,84,-98,19.25,0);hb.box(m.wall,.6,10.5,84,88,19.25,0);hb.box(m.wall,186,10.5,.6,-5,19.25,-42);
 for(i=-83;i<85;i+=27)for(s=0;s<2;s++){var zc=s?36:8,hcx=i===-83&&s===1?-93:i;hb.box(m.column,1.4,10,1.4,hcx,19.1,zc);hb.box(m.band,1.5,.8,1.5,hcx,18,zc);}
 for(s=0;s<3;s++)hb.box(m.lamp,175,.08,.7,-4,23.91,2+s*16);
 hb.kind='floor';for(i=-96;i<87;i+=6)for(s=-8;s<41;s+=6){var gh=[[-39.5,-20,-4.1,4.1],[15.5,36,24.9,29.1],[15.5,36,-29.1,-24.9]];boxHoles(hb,m.grout,14.0145,i-.014,i+.014,s,s+6,gh,.013);boxHoles(hb,m.grout,14.0145,i,i+6,s-.014,s+.014,gh,.013);}hb.kind=null;
 var securityGroup=new T.Group();hall.add(securityGroup);var secb=new W.Builder(securityGroup);
 secb.box(m.shadow,6.5,.02,3.2,-76,14.025,25);secb.box(m.steel,4.3,2.6,2.6,-76,15.3,25);secb.box(m.dark,6,.4,2.7,-76,15.2,25);secb.box(m.black,.18,1.7,2,-78.2,16.1,25);secb.box(m.black,.18,1.7,2,-73.8,16.1,25);
 secb.box(m.blue,2,.28,1,-76,15.61,25);secb.box(m.dark,.4,5.7,.4,-69,16.85,18.3);secb.box(m.dark,.4,5.7,.4,-69,16.85,22.5);secb.box(m.dark,.4,.4,4.6,-69,19.9,20.4);secb.box(m.green,.55,.1,.55,-69,20.17,20.4);label(secb,secure.material,8,2,-77,21,22,Math.PI);secb.box(m.dark,1.6,1.1,.16,-76,17.05,23.58);var secscreen=textPanel(['X-RAY','行李检测中'],'#102b34','#7bd7bd',256,128);label(secb,secscreen.material,1.45,.9,-76,17.05,23.48,Math.PI);
 for(var strip=0;strip<7;strip++){secb.box(m.steel,.055,1.7,.045,-78.31,16.1,24.2+strip*.26);secb.box(m.steel,.055,1.7,.045,-73.69,16.1,24.2+strip*.26);}secb.box(m.brick,1.3,.68,1,-79.2,15.65,25);secb.box(m.dark,.55,.12,.16,-79.2,16.04,25);secb.box(m.green,.2,.2,.045,-75.1,16.25,23.56);secb.finish();
 var tvmHead=textPanel(['自动售票机'],'#f3d03e','#1b262b',512,128),tvms=[],tvmMessages={cache:null};[-82,-77,-72,-67].forEach(function(x){tvms.push(tvm(hall,m,x,14,39,hb,tvmHead,tvmMessages));});panelCaches.push(tvmMessages.cache);
 var gateScreens=[textPanel(['刷币进站','↓'],'#102c29','#65edaf',512,256),textPanel(['投币出站','↓'],'#102c29','#65edaf',512,256)];var gin=[],gout=[];for(i=0;i<3;i++){gin.push(gate(hall,m,point(-48,14,17+i*5.5),false,hb,gateScreens[0]));gout.push(gate(hall,m,point(27,14,i===2?33.5:17+i*5.5),true,hb,gateScreens[1]));}
 for(i=-8;i<42;i+=4){if(i>13&&i<37)continue;hb.box(m.steel,.18,1.9,3.6,-48,14.95,i);hb.box(m.glass,.08,1.5,3.6,-48,14.9,i);hb.box(m.steel,.18,1.9,3.6,27,14.95,i);hb.box(m.glass,.08,1.5,3.6,27,14.9,i);}
 hb.box(m.steel,11,2.4,3.4,-10,15.2,36);hb.box(m.glass,11,1.7,.1,-10,17.4,34.32);hb.box(m.blue,11,.6,3.5,-10,17.7,36);label(hb,customer.material,10,2.5,-10,20,35,Math.PI);
 label(hb,guide.material,16,4,5,21,16,Math.PI);label(hb,downSign.material,12,3,-38,21,2,Math.PI);label(hb,wc.material,15,2.7,65,21,8,Math.PI);
 label(hb,route.material,18,6,2,18.7,41.62,Math.PI);
 var firstAid=textPanel(['AED  急救设备','灭火器  ·  紧急求助'],'#237e5f','#ffffff',512,256);hb.box(m.white,2.4,2.8,.65,10,15.4,41.35);label(hb,firstAid.material,2.25,1.1,10,16,40.98,Math.PI);hb.cyl(m.red,.28,1.15,10,14.83,40.93);hb.box(m.dark,.34,.2,.15,10,15.5,40.92);
 var notice=textPanel(['文明乘车','请勿奔跑  请站稳扶好'],'#f1f1e8','#1b343d');label(pb,notice.material,8,2,-59,6,1,0);
 // Access stairs and the island platform escalators, all actually animated.

 // Soft, baked lamp reflections on polished tiles; no reflective render pass.
 var reflection=W.canvasMaterial(128,128),rc=reflection.ctx,rg=rc.createLinearGradient(0,0,0,128);rg.addColorStop(0,'rgba(230,247,247,0)');rg.addColorStop(.5,'rgba(230,247,247,.22)');rg.addColorStop(1,'rgba(230,247,247,0)');rc.fillStyle=rg;rc.fillRect(0,0,128,128);reflection.texture.needsUpdate=true;reflection.material.transparent=true;reflection.material.depthWrite=false;
 [-5.8,5.8].forEach(function(z){pb.add(new T.PlaneGeometry(258,1.8).rotateX(-Math.PI/2),reflection.material,0,2.034,z);});
 [18,34].forEach(function(z){hb.add(new T.PlaneGeometry(173,2.4).rotateX(-Math.PI/2),reflection.material,-4,14.027,z);});
 [[5,21,16,8],[-38,21,2,6],[65,21,8,7.5],[-10,20,35,5],[-77,21,22,3]].forEach(function(p){var top=p[1]+(p[0]===5?2:1.5);[-1,1].forEach(function(s){hb.box(m.steel,.07,24.03-top,.07,p[0]+s*p[3]*.65,(24.03+top)/2,p[2]);});});
 [-93,0,92].forEach(function(x){[-1,1].forEach(function(s){pb.box(m.steel,.08,1.16,.08,x+s*4,11.12,-3);});});
 // Dark baffle ceilings, steel skirtings, enameled-panel joints and tactile guidance.
 for(i=-135;i<=135;i+=3){boxHoles(prb,m.dark,12.13,i-.08,i+.08,-32,32,[[-39.5,-16,-4.1,4.1],[15.5,39,24.9,29.1],[15.5,39,-29.1,-24.9]],.12);}
 for(i=-96;i<=87;i+=3){boxHoles(hrb,m.dark,24.05,i-.06,i+.06,-42,42,[[-85.5,-61.5,24.9,29.1],[49.5,73.5,24.9,29.1]],.12);}
 [-1,1].forEach(function(side){
  pb.box(m.dark,272,.62,.24,0,2.38,side*31.37);pb.box(m.steel,272,.07,.12,0,9.68,side*31.42);
  for(var j=-135;j<=135;j+=6){pb.box(m.grout,.038,9.5,.045,j,6.8,side*31.46);}
  for(var y=4;y<12;y+=2.8)pb.box(m.grout,272,.026,.045,0,y,side*31.46);
  pb.box(m.yellow,265,.035,.65,0,2.029,side*7.88);
 });
 hb.box(m.dark,185,.65,.16,-5,14.34,41.56);
 for(i=-96;i<=86;i+=6)hb.box(m.grout,.04,10,.045,i,19.2,41.65);
 for(i=17;i<24;i+=3.2)hb.box(m.grout,185,.032,.045,-5,i,41.65);
 hb.kind='floor';hb.owner='站厅盲道地面';
 hb.box(m.yellow,37,.045,.5,-68.5,14.031,33);hb.box(m.yellow,.5,.045,16,-52,14.031,25);
 hb.box(m.yellow,55,.045,.5,-20.5,14.031,11);hb.box(m.yellow,.5,.045,10,-43,14.031,6);hb.kind=null;hb.owner=null;
 var tact=[];for(i=-87;i<=-51;i+=.5)tact.push([i,14.07,33]);for(i=17;i<33;i+=.5)tact.push([-52,14.07,i]);
 W.instance(hall,new T.BoxGeometry(.09,.035,.4),m.yellow,tact);
 // Local luminous poster artwork, without external image requests or extra animation work.
 var ad=W.canvasMaterial(768,384),ac=ad.ctx;ac.fillStyle='#043c4d';ac.fillRect(0,0,768,384);
 ac.fillStyle='#f2d253';ac.beginPath();ac.arc(580,110,72,0,Math.PI*2);ac.fill();ac.fillStyle='#55ad91';
 for(var ax=320;ax<768;ax+=56){ac.fillRect(ax,190-(ax%3)*20,42,200);ac.fillStyle=ax%2?'#368c85':'#55ad91';}
 ac.fillStyle='#f5f4da';ac.font='bold 70px sans-serif';ac.fillText('下一站，广州',36,115);ac.font='32px sans-serif';ac.fillText('乘地铁 · 看见城市的故事',38,177);ac.font='bold 28px sans-serif';ac.fillText('GUANGZHOU  METRO',38,325);ad.texture.needsUpdate=true;
 [-1,1].forEach(function(side){[-71,-17,37,91].forEach(function(x){pb.box(m.black,15.8,5.5,.18,x,6.2,side*31.1);pb.box(m.lamp,15.5,5.2,.1,x,6.2,side*30.98);label(pb,ad.material,15.1,4.8,x,6.2,side*30.89,side===1?Math.PI:0);});});
 [-34,38,70].forEach(function(x){hb.box(m.black,15.6,6.2,.15,x,18.2,41.35);hb.box(m.lamp,15.4,6,.1,x,18.2,41.24);label(hb,ad.material,15,5.6,x,18.2,41.13,Math.PI);});
 var exitLeft=textPanel(['←  出口  EXIT','站厅 / 票务服务 / 换乘'],'#10364b','#ffffff'),exitRight=textPanel(['出口  EXIT  →','站厅 / 票务服务 / 换乘'],'#10364b','#ffffff');
 [-93,0,92].forEach(function(x){pb.box(m.black,11.4,2.7,.28,x,9.5,-3);label(pb,(x<-38?exitLeft:exitRight).material,11.1,2.4,x,9.5,-3.16,Math.PI);label(pb,(x<-38?exitRight:exitLeft).material,11.1,2.4,x,9.5,-2.84,0);});
 // Public-address horns, CCTV, fire points, vents and contact shadows.
 [-100,-48,38,105].forEach(function(x){pb.box(m.steel,1.05,.7,.45,x,11.22,1.8);pb.box(m.black,.84,.42,.06,x,11.08,2.05);pb.cyl(m.white,.32,.6,x+2,10.8,-1.8);pb.box(m.black,.24,.16,.45,x+2,10.46,-1.65);});
 [-83,-56,-29,-2,25,52,79].forEach(function(x){hb.box(m.shadow,2.6,.014,2.8,x+.35,14.024,8.4);hb.box(m.steel,1.7,.32,1.7,x,14.18,8);});
 [-112,19,101].forEach(function(x){pb.box(m.shadow,2.6,.012,2.6,x+.3,2.026,.3);});

 var esc=[];
 esc.push(escalator(connections,m,'entrance',point(-84,28,27),point(-54,14,27),3,4.2));
 esc.push(escalator(connections,m,'platformDown',point(-38,14,2),point(-8,2,2),2.6));
 esc.push(escalator(connections,m,'platformUp',point(-38,14,-2),point(-8,2,-2),2.6));
 // A shared narrow two-escalator stairwell: opaque side walls and continuous sloping ceiling.
 cb.slope=-.4;cb.collisionOnly=true;for(var sk=0;sk<60;sk++){var sx=-38+(sk+.5)*.5,sy=14-(sk+.5)*.2;[-1,1].forEach(function(side){cb.owner='岛式扶梯梯井侧墙';cb.box(m.shaftTile,.52,12.7,.3,sx,sy+1.35,side*3.95);cb.box(m.band,.52,.5,.32,sx,sy+1.95,side*3.95);});cb.kind='ceiling';cb.owner='岛式扶梯封闭斜顶';cb.box(m.ceiling,.52,.32,8.2,sx,sy+7.6,0);cb.kind=null;if(sk%8===0){cb.collisionOnly=false;cb.box(m.lamp,.8,.06,7.1,sx,sy+7.36,0);cb.collisionOnly=true;}}cb.collisionOnly=false;[-1,1].forEach(function(s){slopeSolid(cb,m.shaftTile,point(-38,14,0),point(-8,2,0),s*3.95,.3,12.7,1.35);slopeSolid(cb,m.band,point(-38,14,0),point(-8,2,0),s*3.95,.32,.5,1.95);});slopeSolid(cb,m.ceiling,point(-38,14,0),point(-8,2,0),0,8.2,.32,7.6);
 esc.push(escalator(connections,m,'exit',point(72,28,27),point(42,14,27),3,4.2));
 // Street cut-outs prevent floor plates blocking the entrance/exit slopes.
 boxHoles(ssb,m.floor,28,-124,124,-1,90,[[-85.5,-69.5,24.9,29.1],[57.5,73.5,24.9,29.1]]);
 sb.kind='floor';sb.owner='街面道路与车道标线';sb.box(m.road,240,.08,10,1,28.02,70);for(i=-90;i<105;i+=14)sb.box(m.white,7,.018,.24,i,28.07,70);sb.kind=null;sb.owner=null;
 [-84,72].forEach(function(x){[-1,1].forEach(function(ps){sb.box(m.steel,.35,7,.35,x+ps*4,31.5,23.7);sb.box(m.steel,.35,7,.35,x+ps*4,31.5,30.3);});sb.box(m.blue,8.2,.3,7,x,35,27);sb.box(m.glass,7.8,.08,6.4,x,35.19,27);sb.box(m.lamp,6.7,.08,.45,x,34.78,28.3);sb.box(m.blue,7.2,1.6,.4,x,34,30.02);label(sb,entrySign.material,7,1.55,x,34,30.26,0);
  sb.box(m.glass,14.5,1.6,.12,x+(x<0?6.5:-6.5),28.75,24.9);sb.box(m.glass,14.5,1.6,.12,x+(x<0?6.5:-6.5),28.75,29.1);
 });
 // A covered, dogleg vestibule blocks every direct shaft-to-sky sightline.
 // Street and shaft apertures share a wall; the solid return forces a turn.
 [-84,72].forEach(function(mouth){
  var sign=mouth<0?-1:1,outer=mouth+sign*11,mid=(mouth+outer)/2,baffleWidth=sign<0?5.3:3.8;
  // Opaque retaining apron underneath the upper landing closes the below-floor mouth.
  sb.kind='floor';sb.supportId=sign<0?'entrance':'exit';sb.owner='上端落地平台挡土结构';sb.box(m.dark,1.7,14,4.2,mouth+sign*.85,21,27);sb.kind=null;sb.supportId=null;
  sb.owner='地面转折门厅围护';sb.box(m.shaftTile,.3,7.6,20.9,outer,31.8,33.05);
  [22.6,43.5].forEach(function(z){sb.box(m.shaftTile,11.3,7.6,.3,mid,31.8,z);});
  [[22.6,24.9],[29.1,37.7],[42.3,43.5]].forEach(function(q){sb.box(m.shaftTile,.3,7.6,q[1]-q[0],mouth,31.8,(q[0]+q[1])/2);});
  sb.box(m.shaftTile,baffleWidth,7.6,.3,mouth+sign*baffleWidth/2,31.8,33.5);
  sb.box(m.band,baffleWidth+.03,.55,.32,mouth+sign*baffleWidth/2,30.1,33.5);
  sb.kind='ceiling';sb.owner='转折门厅实体顶';sb.box(m.ceiling,11.3,.3,21.2,mid,35.5,33.05);sb.kind=null;
  sb.box(m.lamp,8,.075,.5,mid,35.28,40);sb.box(m.lamp,5,.075,.5,mouth+sign*7,35.28,27);
  sb.box(m.blue,.4,1.6,4.6,mouth-sign*.2,34,40);label(sb,entrySign.material,4.4,1.5,mouth-sign*.42,34,40,-sign*Math.PI/2);
  var turn=textPanel([sign<0?'←  地铁入口':'出口  →','请紧握扶手  站稳扶好'],'#10364b','#ffffff',512,128);
  label(sb,turn.material,baffleWidth-.4,1.2,mouth+sign*baffleWidth/2,32.6,33.32,Math.PI);
 });sb.owner=null;
 var cityWindows=[];for(i=-90;i<=100;i+=20){sb.box(m.white,15,12,9,i,34,81);sb.box(m.brick,15,.5,9.4,i,40.2,81);sb.box(m.steel,15,.3,9.2,i,32,81);for(var wy=0;wy<3;wy++)for(var wx=-5;wx<=5;wx+=2.5)cityWindows.push([i+wx,30+wy*3,76.43]);}W.instance(street,new T.BoxGeometry(1.4,1.8,.16),m.blue,cityWindows);
 // Entrance-facing facades make the first-person approach feel like a city block.
 [-104,-78,-43,1,58,101].forEach(function(x){sb.box(m.brick,17,15,9,x,35.5,4);sb.box(m.white,17,.5,9.3,x,38,4);sb.box(m.dark,18,.45,10,x,43.3,4);for(var y=31;y<42;y+=3.2)for(var wx=-5;wx<=5;wx+=3.4){sb.box(m.white,2.1,2.4,.22,x+wx,y,8.6);sb.box(m.blue,1.7,2,.24,x+wx,y,8.74);}for(var sx=-6;sx<=6;sx+=6)sb.box(m.white,.6,5,.6,x+sx,30.5,9);});
 [-96,-40,47,92].forEach(function(x){sb.box(m.brick,4.6,.65,4.6,x,28.33,20);sb.box(m.grass,4.2,.12,4.2,x,28.72,20);sb.cyl(m.brick,.34,4,x,30.65,20);sb.box(m.grass,4.6,3.1,4.6,x,33,20);sb.box(m.grass,3.5,1.8,3.5,x,35.05,20);});
 // Approximate twin-ram emblem, built into the local canvas, no external image requests.
 var logo=W.canvasMaterial(256,320),lc=logo.ctx;lc.fillStyle='#D01F2D';lc.fillRect(0,0,256,320);lc.strokeStyle='#fff';lc.lineWidth=26;lc.beginPath();lc.moveTo(54,65);lc.bezierCurveTo(54,160,105,155,105,245);lc.moveTo(202,65);lc.bezierCurveTo(202,160,151,155,151,245);lc.stroke();logo.texture.needsUpdate=true;
 [-94,83].forEach(function(x){sb.box(m.red,.4,5.7,.4,x,31.85,34);label(sb,logo.material,1.5,1.85,x,34.4,34,0);});
 [-84,72].forEach(function(mouth){var sign=mouth<0?-1:1;sb.box(m.red,.12,1.8,1.4,mouth-sign*.22,32.4,35.5);label(sb,logo.material,1.35,1.65,mouth-sign*.29,32.4,35.5,-sign*Math.PI/2);});
 // Streetscape studs and low trees establish the toy vocabulary without blocking pathways.
 var treepos=[];[-96,-38,12,44,96].forEach(function(x){sb.box(m.shadow,4.3,.02,4.3,x+.6,28.15,58+.6);sb.cyl(m.brick,.35,3,x,29.5,58);sb.box(m.grass,4,3,4,x,32,58);sb.box(m.grass,3,1.5,3,x,34,58);for(i=-1;i<=1;i++)treepos.push([x+i,34.85,58]);});W.instance(street,new T.CylinderGeometry(.28,.28,.18,8),m.grass,treepos);

 // A compact Guangzhou street: zebra crossings, curbs, lamps, bus stop and traffic.
 sb.box(m.steel,240,.25,.35,1,28.17,64.9);sb.box(m.steel,240,.25,.35,1,28.17,75.1);
 sb.kind='floor';sb.owner='街面斑马线地面';for(i=65.5;i<75;i+=1.35){sb.box(m.white,7,.018,.65,-50,28.08,i);sb.box(m.white,7,.018,.65,67,28.08,i);}sb.kind=null;sb.owner=null;
 [-76,-28,31,83].forEach(function(x){sb.cyl(m.steel,.12,9,x,32.5,62);sb.box(m.steel,3.2,.16,.2,x+1.4,36.96,62);sb.box(m.lamp,1.5,.08,.6,x+2.2,36.84,62);sb.box(m.dark,1.4,1.4,.45,x,35,62);sb.box(m.green,.4,.4,.12,x,35.3,61.71);});
 sb.box(m.blue,15,.25,4,-10,32.4,60);sb.box(m.steel,.18,4.4,.18,-16,30.2,61.2);sb.box(m.steel,.18,4.4,.18,-4,30.2,61.2);sb.box(m.glass,13,3.2,.08,-10,30.3,61.2);sb.box(m.steel,10,.25,1,-10,29,60);
 var busSign=textPanel(['广州公交  BUS','中山路  ·  地铁接驳'],'#155271','#ffffff');label(sb,busSign.material,7,1.5,-10,33.5,60,Math.PI);
 var shop=textPanel(['骑楼街区  ·  老广州','GUANGZHOU'],'#28544e','#f8efd2');for(i=-90;i<100;i+=40){sb.box(m.dark,15,3,.12,i,29.6,76.35);sb.box(m.blue,15,.25,2.2,i,32.6,75.5);label(sb,shop.material,13,1.1,i,32.02,76.23,Math.PI);}
 sb.kind='floor';sb.owner='街面人行道铺装';for(var paving=-118;paving<118;paving+=6){sb.box(m.white,.04,.012,17,paving,28.009,45.5);sb.box(m.steel,5.8,.035,1.2,paving+3,28.023,55);}sb.kind=null;sb.owner=null;
 [-112,-57,2,110].forEach(function(x){sb.box(m.brick,6,.65,2.6,x,28.33,47);sb.box(m.grass,5.6,.14,2.2,x,28.73,47);sb.box(m.steel,4.5,.25,1.1,x+7,29,48);sb.box(m.dark,.18,1.1,.8,x+5.6,28.55,48);sb.box(m.dark,.18,1.1,.8,x+8.4,28.55,48);sb.cyl(m.steel,.12,7.5,x+11,31.75,49);sb.box(m.lamp,1.5,.1,.7,x+11,35.46,49);});
 var traffic=[];
 function vehicle(x,z,color,bus,sign){var g=new T.Group();g.position.set(x,28.2,z);g.rotation.y=sign===-1?Math.PI:0;street.add(g);var vb=new W.Builder(g),vm=W.material(color),len=bus?12:5.6;vm.fog=false;
  vb.box(m.vehicleShade,len+1,.01,3.8,0,-.08,.25);vb.box(vm,len,1.8,3,0,1.28,0);vb.box(vm,len-1.1,bus?2.1:1.4,2.8,-.15,bus?2.92:2.7,0);
  vb.box(m.black,len-1.6,bus?1.5:.9,2.82,-.1,bus?3.03:2.72,0);vb.box(vm,.18,bus?2:1.3,3.04,-len*.25,2.75,0);vb.box(vm,.18,bus?2:1.3,3.04,len*.25,2.75,0);
  vb.box(m.lamp,.12,.4,2.3,len/2+.07,1.32,0);vb.box(m.red,.12,.4,2.3,-len/2-.07,1.32,0);
  for(var vx=-1;vx<=1;vx+=2)for(var vz=-1;vz<=1;vz+=2){vb.add(new T.CylinderGeometry(.65,.65,.3,10).rotateX(Math.PI/2),m.black,vx*(len*.33),.6,vz*1.52);vb.add(new T.CylinderGeometry(.31,.31,.32,10).rotateX(Math.PI/2),m.steel,vx*(len*.33),.6,vz*1.54);}
  if(bus){var bp=textPanel(['广州公交  1'],'#073329','#72ffc0',256,64);label(vb,bp.material,2.5,.48,len/2+.14,3.78,0,Math.PI/2);for(var bx=-4;bx<=4;bx+=2)vb.box(vm,.12,1.6,3.02,bx,3.02,0);}
  vb.finish();traffic.push({group:g,x:x,sign:sign,speed:bus?7:11});}
 vehicle(-90,67.4,'#f2bd43',false,1);vehicle(0,67.4,'#24a68c',true,1);vehicle(75,72.7,'#c83c3b',false,-1);vehicle(-22,72.7,'#668cc3',false,-1);
 // Four geographically grounded brick landmark assemblies. Only the selected one is visible.
 var landmarks={};
 function landmark(kind){var g=new T.Group();g.position.set(52,28,47);g.name=kind;street.add(g);landmarks[kind]=g;var b=new W.Builder(g);
  b.box(m.grass,30,.2,14,0,.03,3);b.box(m.floor,8,.22,14,0,.1,2);
  if(kind==='park') {b.box(m.white,3,5,3,-7,2.5,0);b.box(m.white,3,5,3,7,2.5,0);b.box(m.white,18,1.3,3,0,5.3,0);b.box(m.steel,14,1.4,.25,0,5.4,-1.57);for(i=-12;i<15;i+=5){b.cyl(m.brick,.25,3,i,1.5,8);b.box(m.grass,4,3,4,i,4,8);}b.box(m.blue,6,.06,4,0,.2,9);for(i=-5;i<=5;i++)b.box(m.dark,.12,2.8,.15,i,1.4,0);b.box(m.dark,11,.12,.18,0,2.6,0);b.box(m.white,7.8,1.4,1.1,0,6.3,0);}
  if(kind==='njs') {
   b.box(m.red,10,6,2,-8,3,0);b.box(m.red,10,6,2,8,3,0);b.box(m.red,6,2.7,2,0,6.6,0);b.box(m.red,1,5,2,-3.1,2.5,0);b.box(m.red,1,5,2,3.1,2.5,0);b.box(m.dark,5.2,4.4,.15,0,2.2,.65);
   var arch=new T.Shape();arch.moveTo(-2.6,0);arch.lineTo(-2.6,3.4);arch.absarc(0,3.4,2.6,Math.PI,0,true);arch.lineTo(2.6,0);arch.closePath();var ag=new T.ShapeGeometry(arch);b.add(ag,m.dark,0,0,-1.06,Math.PI);
   b.box(m.roofTile,27,.4,3.5,0,6.15,0);b.box(m.roofTile,9,.35,4.5,0,8.17,0);b.add(new T.BoxGeometry(8.8,.14,2.6).rotateX(.24),m.roofTile,0,8.44,.7);b.add(new T.BoxGeometry(8.8,.14,2.6).rotateX(-.24),m.roofTile,0,8.44,-.7);
   for(i=-13;i<=13;i+=.55)b.add(new T.CylinderGeometry(.17,.17,3.7,8).rotateX(Math.PI/2),m.roofTile,i,6.45,0);
   b.box(m.white,6.8,1.1,.15,0,7.1,-2);[-1,1].forEach(function(s){b.box(m.red,.2,.2,1.05,s*2.6,7.1,-1.475);});b.box(m.red,1.7,.4,1.7,-3.1,5.1,0);b.box(m.red,1.7,.4,1.7,3.1,5.1,0);
  }
  if(kind==='martyrs') {b.box(m.white,27,7,2,0,3.5,0);b.box(m.dark,5,4.8,2.2,0,2.4,0);b.box(m.dark,5,4.8,2.2,-8,2.4,0);b.box(m.dark,5,4.8,2.2,8,2.4,0);b.box(m.white,28,.7,3,0,7.1,0);b.box(m.white,5,16,4,0,8,10);b.box(m.white,8,.7,6,0,.45,10);b.box(m.white,4,2,3,0,17,10);b.box(m.white,6,.5,5,0,18.15,10);b.box(m.red,2.8,10,.13,0,10.6,7.92);b.box(m.white,12,.4,7,0,.08,10);}
  if(kind==='dongshan') {for(var hn=0;hn<3;hn++){var x=(hn-1)*10;b.box(m.brick,8,8,7,x,4,3);b.box(m.white,8,.45,7.1,x,4.2,3);b.box(m.dark,8.6,.5,8,x,8.3,3);for(i=-1;i<=1;i++){b.box(m.white,1.4,2,.2,x+i*2.2,6,-.58);b.box(m.blue,1,1.65,.23,x+i*2.2,6,-.71);b.box(m.white,.22,3,.25,x+i*2.2,1.5,-1.1);}b.box(m.white,7,.3,2,x,3.2,-.5);b.box(m.dark,1.8,2.7,.2,x,1.35,-.7);}b.box(m.white,12,1.5,.18,0,4.8,-1.21);[-1,1].forEach(function(s){b.cyl(m.steel,.12,4.8,s*5.2,2.4,-1.2);});}
  label(b,landSign.material,kind==='njs'?6.5:kind==='dongshan'?11.8:kind==='martyrs'?12:20,kind==='njs'?1:kind==='dongshan'?1.4:1.6,0,kind==='dongshan'?4.8:kind==='martyrs'?6:kind==='njs'?7.1:5.4,kind==='park'?-1.76:kind==='njs'?-2.1:-1.35,Math.PI);b.finish();
 }
 ['park','njs','martyrs','dongshan'].forEach(landmark);
 // Brick stud caps are instances shared across the complete station.
 var caps=[];for(i=-94;i<103;i+=2)for(s=12;s<=18;s+=2)caps.push([i,28.035,s]);W.instance(street,new T.CylinderGeometry(.27,.27,.12,6),m.floor,caps);
 batchEscalatorShells(esc,cb);pb.finish();hb.finish();sb.finish();cb.finish();prb.finish();hrb.finish();ssb.finish();
 // Navigation paths are collision-conscious polylines, all floor heights explicit.
 var nav={points:{},paths:{},platformDoorSpotsByTrack:[[],[]],gateIn:[],gateInExit:[],gateOut:[],gateOutExit:[]};
 function pt(name,x,y,z,zone,extra){var p=point(x,y,z,zone,extra);nav[name]=nav.points[name]=p;return p;}
 pt('streetSpawn',-76,28,52,'street');pt('entranceTop',-84,28,27,'street',{kind:'escalator',escalator:'entrance',speed:3.2});pt('entranceBottom',-54,14,27,'concourse',{kind:'escalator',escalator:'entrance',speed:3.2});
 pt('security',-82,14,20.4,'concourse');pt('securityExit',-66,14,20.4,'concourse');pt('tvm',-82,14,35.6,'concourse');pt('ticketPickup',-82,14,35.6,'concourse');
 pt('platformEscalatorTop',-38,14,2,'concourse',{kind:'escalator',escalator:'platformDown',speed:3.2});pt('platformEscalatorBottom',-8,2,2,'platform',{kind:'escalator',escalator:'platformDown',speed:3.2});
 pt('platformCenter',4,2,3.3,'platform');pt('platformExitEscalatorBottom',-8,2,-2,'platform',{kind:'escalator',escalator:'platformUp',speed:3.2});pt('platformExitEscalatorTop',-38,14,-2,'concourse',{kind:'escalator',escalator:'platformUp',speed:3.2});
 pt('exitBottom',42,14,27,'concourse',{kind:'escalator',escalator:'exit',speed:3.2});pt('exitTop',72,28,27,'street',{kind:'escalator',escalator:'exit',speed:3.2});pt('landmark',52,28,39,'street');
 for(i=0;i<3;i++){nav.gateIn.push(pt('gateIn'+i,-52,14,17+i*5.5,'concourse'));nav.gateInExit.push(pt('gateInExit'+i,-43,14,17+i*5.5,'concourse'));nav.gateOut.push(pt('gateOut'+i,23,14,i===2?33.5:17+i*5.5,'concourse'));nav.gateOutExit.push(pt('gateOutExit'+i,32,14,i===2?33.5:17+i*5.5,'concourse'));}
 for(i=0;i<xs.length;i++){nav.platformDoorSpotsByTrack[0].push(point(xs[i],2,7.1,'platform'));nav.platformDoorSpotsByTrack[1].push(point(xs[i],2,-7.1,'platform'));}
 nav.platformDoorSpots=nav.platformDoorSpotsByTrack[dir===1?0:1];
 nav.paths.enter=[nav.streetSpawn,point(-80,28,40,'street'),point(-91,28,40,'street'),point(-91,28,27,'street'),nav.entranceTop,nav.entranceBottom,point(-52,14,27,'concourse'),point(-52,14,16,'concourse'),point(-84,14,16,'concourse'),point(-84,14,20.4,'concourse'),nav.security];
 nav.paths.buyTicket=[nav.security,nav.securityExit,point(-52,14,20.4,'concourse'),point(-52,14,33,'concourse'),point(-82,14,33,'concourse'),nav.tvm];
 nav.paths.toGate=[nav.tvm,point(-82,14,33,'concourse'),point(-52,14,33,'concourse'),point(-52,14,17,'concourse'),nav.gateIn[0]];
 nav.paths.toPlatform=[nav.gateInExit[0],point(-43,14,11,'concourse'),point(-43,14,2,'concourse'),nav.platformEscalatorTop,nav.platformEscalatorBottom,point(-3,2,2,'platform'),nav.platformCenter];
 nav.paths.exitPlatform=[nav.platformCenter,point(-3,2,-2,'platform'),nav.platformExitEscalatorBottom,nav.platformExitEscalatorTop,point(-43,14,-2,'concourse'),point(-43,14,-7,'concourse'),point(20,14,-7,'concourse'),point(20,14,17,'concourse'),nav.gateOut[0]];
 nav.paths.leave=[nav.gateOutExit[0],point(36,14,17,'concourse'),point(39,14,27,'concourse'),nav.exitBottom,nav.exitTop,point(78,28,27,'street'),point(78,28,39,'street'),nav.landmark];
 nav.landmarkView=nav.landmark;
 nav.pathToDoor=function(index,trackIdx){trackIdx=trackIdx==null?result.activeTrackIdx:trackIdx;var dest=nav.platformDoorSpotsByTrack[trackIdx][index]||nav.platformDoorSpotsByTrack[trackIdx][0];return [nav.platformCenter,point(4,2,trackIdx===0?6.8:-6.8,'platform'),point(dest.x,2,trackIdx===0?6.8:-6.8,'platform'),dest];};
 nav.alightSpotsByTrack=[xs.map(function(x){return point(x,2,22.7,'platform');}),xs.map(function(x){return point(x,2,-22.7,'platform');})];
 nav.pathFromAlight=function(index,tr){tr=tr===1?1:0;if(station.id!=='gyq')return nav.pathToDoor(index,tr).slice().reverse().concat(nav.paths.exitPlatform);var p=nav.alightSpotsByTrack[tr][index],os=tr===0?1:-1;return[p,point(p.x,2,os*22.7,'platform'),point(52,2,os*22.7,'platform'),point(52,2,os*27,'platform'),point(47,2,os*27,'platform',{kind:'escalator',escalator:'outerExit'+tr,speed:3.2}),point(17,14,os*27,'concourse',{kind:'escalator',escalator:'outerExit'+tr,speed:3.2}),point(13,14,os*27,'concourse'),point(13,14,12,'concourse'),point(20,14,12,'concourse'),point(20,14,17,'concourse'),nav.gateOut[0]];};
 var tracks=[{z:14.95,stopX:0,side:-1,dir:1,platformZ:9.4},{z:-14.95,stopX:0,side:1,dir:-1,platformZ:-9.4}];
 function pidsKey(data){return data.destination+'|'+typeof data.minutes+'|'+data.minutes;}
 var pidsCache=new W.PanelCache(pidsPanels[0],function(c,data){c.fillStyle='#0b242b';c.fillRect(0,0,1024,256);c.textAlign='left';c.fillStyle='#e0c94a';c.font='bold 44px sans-serif';c.fillText('1号线    开往 '+data.destination,30,65);c.fillStyle='#7ef6af';c.font='bold 69px sans-serif';c.fillText('下一班   '+data.minutes+(typeof data.minutes==='number'?' 分钟':''),30,150,964);c.fillStyle='#d8e7ea';c.font='31px sans-serif';c.fillText('先下后上   请在黄色安全线后候车',30,219);},'station-pids');
 [GZ.config.LINE.terminals.up,GZ.config.LINE.terminals.down].forEach(function(destination){[2,3,'即将进站','本站停靠'].forEach(function(minutes){var data={destination:destination,minutes:minutes};pidsCache.add(pidsKey(data),data);});});
 pidsPanels[1].texture.dispose();pidsPanels[1].canvas.width=pidsPanels[1].canvas.height=1;pidsPanels[1]={material:pidsPanels[1].material};panelCaches.push(pidsCache);
 function drawPids(tr,data){var old=pidsValues[tr];if(old.destination===data.destination&&old.minutes===data.minutes)return;pidsValues[tr]={destination:data.destination,minutes:data.minutes};pidsCache.select(pidsPanels[tr].material,pidsKey(data),data);}
 var dynamicColliders=colliders.filter(function(c){return c.kind==='door';}),psdOpen=[0,0],alightOpen=[0,0];
 var psdColliderSets=psdLeaves.map(function(leaves){return dynamicColliders.filter(function(c){return leaves.some(function(l){return c._group===l.group;});});}),alightColliderSets=outerLeaves.map(function(leaves){return dynamicColliders.filter(function(c){return leaves.some(function(l){return c._group===l.group;});});}),gateColliders=dynamicColliders.filter(function(c){return c.owner==='闸机动态扇门';});var result={colliders:colliders,escalators:esc.concat(outerEsc),group:group,trackY:0,platformY:2,concourseY:14,streetY:28,tracks:tracks,activeTrackIdx:dir===1?0:1,nav:nav,
  interact:{tvm:tvms[0],tvms:tvms,gatesIn:gin,gatesOut:gout,security:{position:nav.security,group:securityGroup}},
  psd:{duration:1.25,setAlightOpen:function(tr,a){a=Math.max(0,Math.min(1,Number(a)||0));if(!outerLeaves[tr]||alightOpen[tr]===a)return;alightOpen[tr]=a;for(var n=0;n<2;n++)outerLeaves[tr][n].group.position.x=outerLeaves[tr][n].sign*1.63*a;W.refreshColliders(group,alightColliderSets[tr]);},setOpen:function(tr,a){a=Math.max(0,Math.min(1,Number(a)||0));if(!psdLeaves[tr]||psdOpen[tr]===a)return;psdOpen[tr]=a;for(var n=0;n<2;n++)psdLeaves[tr][n].group.position.x=psdLeaves[tr][n].sign*1.63*a;W.refreshColliders(group,psdColliderSets[tr]);}},
  pids:{set:function(p){var tr=p.trackIdx===1?1:0;drawPids(tr,{destination:p.destination||GZ.config.LINE.terminals[tr===0?'up':'down'],minutes:p.minutes==null?2:p.minutes});}},
  setStation:function(st){st=st||station;var key=stationKey(st);if(key===lastStationKey){result.station=station=st;return;}lastStationKey=key;result.raycastSolid=null;station=st;result.station=station;spanish.visible=spanishConnections.visible=station.id==='gyq';outerFloorClosures.visible=outerRoofClosures.visible=station.id!=='gyq';result.spanishLayout=station.id==='gyq';for(var ti=0;ti<2;ti++){tracks[ti].alightSide=station.id==='gyq'?-tracks[ti].side:tracks[ti].side;tracks[ti].alightZ=station.id==='gyq'?(ti===0?20.5:-20.5):tracks[ti].platformZ;}m.band.color.set(station.color).convertSRGBToLinear();m.band.emissive.copy(m.band.color);m.wall.color.set(station.id==='gyq'?'#E6E7DF':station.color).convertSRGBToLinear();m.wall.emissive.copy(m.wall.color);m.column.color.set(station.id==='dsk'?'#995A50':station.id==='njs'?'#9C1010':'#eeeae0').convertSRGBToLinear();m.column.emissive.copy(m.column.color);
   stationCache.select(stationSign.material,key,station);entryCache.select(entrySign.material,key,station);landCache.select(landSign.material,key,station);routeCache.select(route.material,key,station);
   Object.keys(landmarks).forEach(function(k){landmarks[k].visible=k===station.landmark;});
   if(result.escalators)result.escalators.forEach(function(e){e.enabled=!/^outer/.test(e.id)||station.id==='gyq';});if(result.walkableRegions)result.walkableRegions.forEach(function(r){r.enabled=!/^outer/.test(r.id)||station.id==='gyq';if(r.id==='concourse')r.holes=[[-39.5,-20,-4.1,4.1]].concat(station.id==='gyq'?[[15.5,36,24.9,29.1],[15.5,36,-29.1,-24.9]]:[]);});applyStationFlags();result.setDirection(dir);
  },
  getPanelTextures:function(){return W.panelTextures(panelCaches);},getPanelStats:function(){return W.panelStats(panelCaches);},prewarmTextures:function(renderer){return W.prewarmPanels(panelCaches,renderer);},
  setDirection:function(d){dir=d===-1?-1:1;result.activeTrackIdx=dir===1?0:1;nav.platformDoorSpots=nav.platformDoorSpotsByTrack[result.activeTrackIdx];guideCache.select(guide.material,stationKey(station)+'|'+dir,{station:station,dir:dir});},
  setCutaway:function(on){cutaway=!!on;platformRoof.visible=hallRoof.visible=streetSurface.visible=!on;W.refreshColliderFlags(colliders);},
  setZone:function(zone){result.zone=zone;street.visible=hall.visible=platform.visible=connections.visible=true;},
  update:function(dt){if(!group.visible)return;dt=Math.min(.1,Math.max(0,dt||0));for(var n=0;n<esc.length;n++)if(connections.visible)esc[n].update(dt);if(spanishConnections.visible&&connections.visible)for(n=0;n<outerEsc.length;n++)outerEsc[n].update(dt);var gatesChanged=false;for(n=0;n<gin.length;n++){gatesChanged=gin[n].update(dt)||gatesChanged;gatesChanged=gout[n].update(dt)||gatesChanged;}if(gatesChanged){W.refreshColliders(group,gateColliders);if(group.userData.worldRefreshGates)group.userData.worldRefreshGates();}if(group.userData.worldRefreshTokens)group.userData.worldRefreshTokens();if(street.visible)for(n=0;n<traffic.length;n++){var v=traffic[n],oldX=v.x;v.x+=dt*v.speed*v.sign;if(v.x>118)v.x=-118;if(v.x<-118)v.x=118;v.group.position.x=v.x;if(v.colliders)for(var vc=0;vc<v.colliders.length;vc++){v.colliders[vc].min.x+=v.x-oldX;v.colliders[vc].max.x+=v.x-oldX;}}},
  dispose:function(){W.dispose(group,result.getPanelTextures());}
 };
 // Station tunnel mouths remain beyond the platform, leaving stopping doors unobstructed.
 var tunnelBlack=new T.MeshBasicMaterial({color:'#020507',fog:false}),mouths=new W.Builder(platform);
 [-1,1].forEach(function(end){[-1,1].forEach(function(side){var tz=side*14.95;
  mouths.owner='隧道固定围护';
  mouths.box(m.ceiling,2,12,.5,end*137.5,5.8,tz-7.8);mouths.box(m.ceiling,2,12,.5,end*137.5,5.8,tz+7.8);mouths.box(m.ceiling,2,.8,17,end*136.5,12.6,tz);
  mouths.box(tunnelBlack,586,13,.5,end*427,5.9,tz-7.6);mouths.box(tunnelBlack,586,13,.5,end*427,5.9,tz+7.6);mouths.box(tunnelBlack,586,.5,15.5,end*427,12.4,tz);mouths.box(tunnelBlack,.5,13,15.5,end*721,5.9,tz);
  mouths.owner='轮轨支撑';mouths.box(tunnelBlack,586,.3,15.5,end*427,-.4,tz);
  for(var r=-1;r<=1;r+=2)mouths.box(m.steel,265,.16,.23,end*267,-.02,tz+r*2.65);
  mouths.owner='隧道固定围护';
  for(var tx=144;tx<365;tx+=22){mouths.box(m.dark,.28,11,.24,end*tx,5.5,tz-7.32);mouths.box(m.lamp,1.4,.14,.08,end*tx,7.2,tz-7.3);}
 });});mouths.finish();
 // The ordinary stations have no exterior alighting escalators. Close both
 // unused slab/roof apertures with real geometry; only Gongyuanqian opens them.
 // Append these colliders after all existing entities so diagnostic IDs persist.
 var outerFloorClosures=new T.Group(),outerRoofClosures=new T.Group();outerFloorClosures.name='普通站外梯孔实体楼板';outerRoofClosures.name='普通站外梯孔实体顶板';hall.add(outerFloorClosures);platformRoof.add(outerRoofClosures);
 var floorClosureBuilder=new W.Builder(outerFloorClosures),roofClosureBuilder=new W.Builder(outerRoofClosures);floorClosureBuilder.kind='floor';floorClosureBuilder.owner='普通站外梯孔实体楼板';roofClosureBuilder.kind='ceiling';roofClosureBuilder.owner='普通站外梯孔实体顶板';
 [-1,1].forEach(function(side){floorClosureBuilder.box(m.floor,20.5,.48,4.2,25.75,13.76,side*27);roofClosureBuilder.box(m.ceiling,23.5,.48,4.2,27.25,12.36,side*27);});floorClosureBuilder.finish();roofClosureBuilder.finish();
 W.refreshColliders(group,colliders);colliders.forEach(function(c){if(/站台边缘/.test(c.owner))c.type='platform';else if(/屏蔽门/.test(c.owner))c.type='psd';else if(/隧道固定围护/.test(c.owner))c.type='tunnel';else if(c.kind==='ceiling')c.type='ceiling';});result.clearanceColliders=colliders.filter(function(c){return c.type==='platform'||c.type==='psd'||c.type==='ceiling'||c.type==='tunnel';});
 traffic.forEach(function(v){v.colliders=colliders.filter(function(c){return c._group===v.group;});var motion={type:'traffic',axis:'x',speed:v.speed*v.sign,wrapMin:-118,wrapMax:118};v.colliders.forEach(function(c){c.dynamic=true;c.motion=motion;});});
 result.walkableRegions=[{id:'street',y:28,minX:-124,maxX:124,minZ:-1,maxZ:90,holes:[[-85.5,-69.5,24.9,29.1],[57.5,73.5,24.9,29.1]]},{id:'concourse',y:14,minX:-98,maxX:88,minZ:-42,maxZ:42,holes:[[-39.5,-20,-4.1,4.1],[15.5,36,24.9,29.1],[15.5,36,-29.1,-24.9]]},{id:'island',y:2,minX:-135,maxX:135,minZ:-9.4,maxZ:9.4},{id:'outer-0',y:2,minX:-135,maxX:135,minZ:20.5,maxZ:30.5},{id:'outer-1',y:2,minX:-135,maxX:135,minZ:-30.5,maxZ:-20.5}];
 var floorColliders=colliders.filter(function(c){return c.kind==='floor';});result.sampleGround=function(x,z,expectedY){expectedY=expectedY==null?2:expectedY;var q,best=null,err=Infinity;
  for(var ei=0;ei<result.escalators.length;ei++){var e=result.escalators[ei];if(!e.group.parent.visible)continue;q=e.sample(x,z,expectedY);if(q&&Math.abs(q.y-expectedY)<err){best=q;err=Math.abs(q.y-expectedY);}}
  // Within an actual tread lane, its current steel face is the support. The
  // conservative sloped-body AABB must not replace it with a higher flat floor.
  if(best&&best.kind==='escalator')return best;
  for(var ci=0;ci<floorColliders.length;ci++){var c=floorColliders[ci];if(!c.enabled||c.kind!=='floor'||x<c.min.x||x>c.max.x||z<c.min.z||z>c.max.z)continue;var ce=Math.abs(c.max.y-expectedY);if(ce<.85&&(!best||c.max.y>best.y)){err=ce;best={y:c.max.y,normal:{x:0,y:1,z:0},id:c.id,kind:'floor'};}}
  return best;
 };
 result.psd.openingsByTrack=xs.map? [xs.map(function(x){return{x:x,y:2,z:9.4,width:3.04};}),xs.map(function(x){return{x:x,y:2,z:-9.4,width:3.04};})]:[];
 result.psd.alightOpeningsByTrack=[xs.map(function(x){return{x:x,y:2,z:20.5,width:3.04};}),xs.map(function(x){return{x:x,y:2,z:-20.5,width:3.04};})];
 [street,platformRoof,hallRoof,streetSurface,spanish,spanishConnections,outerFloorClosures,outerRoofClosures].forEach(function(g){g.userData.worldBatchBoundary=true;});
 Object.keys(landmarks).forEach(function(k){landmarks[k].userData.worldBatchBoundary=true;});traffic.forEach(function(v){v.group.userData.worldBatchBoundary=true;});
 var gatePaneSources=[];gin.concat(gout).forEach(function(gate){gate.group.traverse(function(mesh){if(mesh.isMesh&&mesh.material===m.gateGlass)gatePaneSources.push({mesh:mesh,parent:mesh.parent,angle:NaN});});});
 var gatePaneInstances=new T.InstancedMesh(gatePaneSources[0].mesh.geometry,m.gateGlass,gatePaneSources.length);gatePaneInstances.name='十二扇实际旋转闸机玻璃合批';gatePaneInstances.instanceMatrix.setUsage(T.DynamicDrawUsage);gatePaneInstances.frustumCulled=false;
 gatePaneSources.forEach(function(p){p.mesh.updateMatrix();p.local=p.mesh.matrix.clone();p.parent.remove(p.mesh);});group.add(gatePaneInstances);
 var gateInv=new T.Matrix4(),gateMatrix=new T.Matrix4();group.userData.worldRefreshGates=function(){
  var changed=false;gateInv.copy(group.matrixWorld).invert();for(var gi=0;gi<gatePaneSources.length;gi++){var p=gatePaneSources[gi];if(p.angle===p.parent.rotation.y)continue;p.angle=p.parent.rotation.y;gateMatrix.multiplyMatrices(gateInv,p.parent.matrixWorld).multiply(p.local);gatePaneInstances.setMatrixAt(gi,gateMatrix);changed=true;}if(changed)gatePaneInstances.instanceMatrix.needsUpdate=true;
 };group.userData.worldRefreshGates();
 var tokenSources=[];gin.concat(gout).map(function(g){return g.group;}).concat(tvms.map(function(t){return t.group;})).forEach(function(g){g.traverse(function(mesh){if(mesh.isMesh&&mesh.material===m.token)tokenSources.push({mesh:mesh,parent:mesh.parent});});});
 var tokenInstances=new T.InstancedMesh(new T.CylinderGeometry(1,1,1,12),m.token,tokenSources.length);tokenInstances.name='十个实际单程币合批';tokenInstances.frustumCulled=false;tokenInstances.instanceMatrix.setUsage(T.DynamicDrawUsage);group.add(tokenInstances);
 var tokenInv=new T.Matrix4().copy(group.matrixWorld).invert(),tokenMatrix=new T.Matrix4(),tokenHidden=new T.Matrix4().makeScale(0,0,0);
 tokenSources.forEach(function(p){p.base=new T.Matrix4().multiplyMatrices(tokenInv,p.parent.matrixWorld);var params=p.mesh.geometry.parameters;p.shape=new T.Matrix4().makeScale(params.radiusTop,params.height,params.radiusTop);p.parent.remove(p.mesh);});
 group.userData.worldRefreshTokens=function(){var any=tokenSources.some(function(p){return p.mesh.visible;});tokenInstances.visible=any;if(!any)return;
  tokenSources.forEach(function(p,i){if(p.mesh.visible){p.mesh.updateMatrix();tokenMatrix.copy(p.base).multiply(p.mesh.matrix).multiply(p.shape);tokenInstances.setMatrixAt(i,tokenMatrix);}else tokenInstances.setMatrixAt(i,tokenHidden);});tokenInstances.instanceMatrix.needsUpdate=true;
 };group.userData.worldRefreshTokens();
 result.renderBatch=W.batchStatic(group);
 // Preclassify only visibility domains that setStation actually changes.
 // Dynamic door bounds and cutaway/zone flags keep their existing contracts.
 var stationDomains=[spanish,spanishConnections,outerFloorClosures,outerRoofClosures];Object.keys(landmarks).forEach(function(k){stationDomains.push(landmarks[k]);});
 stationFlagColliders=colliders.filter(function(c){for(var p=c._group;p&&p!==c._root;p=p.parent)if(stationDomains.indexOf(p)>=0)return true;return false;});
 var originalStation=station;GZ.config.STATIONS.forEach(function(st){result.setStation(st);var flags=new Uint8Array(stationFlagColliders.length);for(var fi=0;fi<flags.length;fi++)flags[fi]=Number(stationFlagColliders[fi].enabled);stationFlags[flagKey()]=flags;});
 result.setStation(originalStation);result.pids.set({trackIdx:0,destination:'广州东站',minutes:2});result.pids.set({trackIdx:1,destination:'西塱',minutes:3});return result;
},buildTunnel:function(){
 var group=new T.Group(),colliders=[];group.userData.colliderSink=colliders;group.name='积木隧道 · 连续掠过';
 var dark=W.tile(W.material('#172b37'),10,true),rib=W.material('#334650'),rail=W.metal('#718b99'),cable=W.material('#080d12'),light=new T.MeshBasicMaterial({color:'#d8f4e7',toneMapped:false}),blue=new T.MeshBasicMaterial({color:'#277c8f'}),b=new W.Builder(group),length=720;
 b.owner='行驶隧道固定围护';b.box(dark,length,13.4,.6,0,5.9,-7.6);b.box(dark,length,13.4,.6,0,5.9,7.6);b.kind='ceiling';b.box(dark,length,.5,15.8,0,12.3,0);b.kind=null;b.owner='轮轨支撑';b.box(dark,length,.6,15.8,0,-.5,0);
 [-1,1].forEach(function(s){b.box(rail,length,.16,.24,0,-.03,s*2.65);b.box(rib,length,.12,.24,0,3.5,s*7.24);b.box(cable,length,.17,.3,0,10.3,s*2);});b.finish();
 var move=new T.Group();group.add(move);var mb=new W.Builder(move),ribs=[],lamps=[],sleep=[],marks=[],wash=[];
 var sign=W.canvasMaterial(512,128),current='';
 for(var i=0;i<36;i++){var x=-360+i*20;ribs.push([x,5.5,-7.24],[x,5.5,7.24]);marks.push([x+10,4,-7.13],[x+10,4,7.13]);
  [-1,1].forEach(function(s){mb.box(rib,.45,.22,.6,x,4.9,s*7.12);mb.box(rib,.45,.22,.6,x,5.65,s*7.12);
   for(var j=0;j<5;j++){var sag=Math.sin((j+.5)*Math.PI/5)*.18;mb.box(cable,4,.08,.09,x+j*4+2,4.9-sag,s*7.04);mb.box(cable,4,.09,.1,x+j*4+2,5.65-sag,s*7.04);}
   mb.box(blue,3.6,.11,.08,x+4,7.61,s*7.1);
   if(i%4===0)W.panel(mb,sign.material,6.5,1.65,x+10,5.9,s*7.02,s===1?Math.PI:0);
  });
 }
 for(i=-360;i<=360;i+=8)lamps.push([i,5.8,-7.18],[i,5.8,7.18]);
 for(i=-360;i<=360;i+=2.2)sleep.push([i,-.2,0]);
 mb.finish();W.instance(move,new T.BoxGeometry(.34,11,.18),rib,ribs);W.instance(move,new T.BoxGeometry(4.6,.32,.14),light,lamps);W.instance(move,new T.BoxGeometry(.7,.18,7.3),rib,sleep);W.instance(move,new T.BoxGeometry(.3,.5,.12),rail,marks);
 // Every element has an 80-unit repetition period, including the station plaques.
 var tunnelCache=new W.PanelCache(sign,function(c,st){c.fillStyle='#142731';c.fillRect(0,0,512,128);c.fillStyle='#e5cd50';c.fillRect(0,0,9,128);c.fillStyle='#f1f5dd';c.textAlign='center';c.font='bold 60px sans-serif';c.fillText(st.name,256,76);c.font='20px sans-serif';c.fillText(st.en,256,111,485);},'tunnel-station');
 GZ.config.STATIONS.forEach(function(st){tunnelCache.add(st.id+'|'+st.name+'|'+st.en,st);});var tunnelPanels=[tunnelCache];
 var phase=0,dir=1,motionBounds=[],result={group:group,setDirection:function(d){dir=d===-1?-1:1;},getPanelTextures:function(){return W.panelTextures(tunnelPanels);},getPanelStats:function(){return W.panelStats(tunnelPanels);},prewarmTextures:function(renderer){return W.prewarmPanels(tunnelPanels,renderer);},setStation:function(st){if(!st)return;var key=st.id+'|'+st.name+'|'+st.en;if(current===key)return;current=key;tunnelCache.select(sign.material,key,st);},update:function(dt,speed){phase=(phase+Math.max(0,dt||0)*Math.max(0,Math.min(1,speed||0))*65)%80;move.position.x=-dir*phase;for(var mi=0;mi<motionBounds.length;mi++){var q=motionBounds[mi];q.c.min.x=q.min+move.position.x;q.c.max.x=q.max+move.position.x;}},dispose:function(){W.dispose(group,W.panelTextures(tunnelPanels));}};
 W.refreshColliders(group,colliders);colliders.forEach(function(c){if(c._group===move)motionBounds.push({c:c,min:c.min.x,max:c.max.x});});result.colliders=colliders;result.clearanceColliders=colliders.filter(function(c){return c.owner==='行驶隧道固定围护';});result.setStation(GZ.config.STATIONS[0]);return result;
}};
// Actual rendered triangles in a BVH: no proxy box can conceal a hole in the enclosure.
function solidBVH(root){
 root.updateMatrixWorld(true);var inv=new T.Matrix4().copy(root.matrixWorld).invert(),matrix=new T.Matrix4(),inst=new T.Matrix4(),v=new T.Vector3(),tri=[];
 root.traverse(function(mesh){if(!mesh.isMesh||mesh.material.transparent||mesh.name==='traffic')return;for(var p=mesh;p&&p!==root;p=p.parent)if(!p.visible)return;
  var attr=mesh.geometry.attributes.position,index=mesh.geometry.index,ns=mesh.isInstancedMesh?mesh.count:1;
  for(var ni=0;ni<ns;ni++){matrix.multiplyMatrices(inv,mesh.matrixWorld);if(mesh.isInstancedMesh){mesh.getMatrixAt(ni,inst);matrix.multiply(inst);}var count=index?index.count:attr.count;
   for(var j=0;j<count;j+=3){var a=[];for(var k=0;k<3;k++){v.fromBufferAttribute(attr,index?index.getX(j+k):j+k).applyMatrix4(matrix);a.push(v.x,v.y,v.z);}tri.push({v:a,min:[Math.min(a[0],a[3],a[6]),Math.min(a[1],a[4],a[7]),Math.min(a[2],a[5],a[8])],max:[Math.max(a[0],a[3],a[6]),Math.max(a[1],a[4],a[7]),Math.max(a[2],a[5],a[8])]});}
  }
 });
 function node(ids){var min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];ids.forEach(function(i){for(var k=0;k<3;k++){min[k]=Math.min(min[k],tri[i].min[k]);max[k]=Math.max(max[k],tri[i].max[k]);}});var out={min:min,max:max};if(ids.length<=16){out.ids=ids;return out;}var axis=0;for(var k=1;k<3;k++)if(max[k]-min[k]>max[axis]-min[axis])axis=k;ids.sort(function(a,b){return tri[a].min[axis]+tri[a].max[axis]-tri[b].min[axis]-tri[b].max[axis];});var mid=ids.length>>1;out.left=node(ids.slice(0,mid));out.right=node(ids.slice(mid));return out;}
 var tree=node(tri.map(function(t,i){return i;}));
 function hitBox(n,o,d,limit){var lo=0,hi=limit;for(var k=0;k<3;k++){if(Math.abs(d[k])<1e-9){if(o[k]<n.min[k]||o[k]>n.max[k])return false;continue;}var a=(n.min[k]-o[k])/d[k],b=(n.max[k]-o[k])/d[k];if(a>b){var tmp=a;a=b;b=tmp;}lo=Math.max(lo,a);hi=Math.min(hi,b);if(hi<lo)return false;}return true;}
 function triangle(a,o,d){var ex=a[3]-a[0],ey=a[4]-a[1],ez=a[5]-a[2],fx=a[6]-a[0],fy=a[7]-a[1],fz=a[8]-a[2];var px=d[1]*fz-d[2]*fy,py=d[2]*fx-d[0]*fz,pz=d[0]*fy-d[1]*fx,det=ex*px+ey*py+ez*pz;if(Math.abs(det)<1e-9)return Infinity;var ix=1/det,tx=o[0]-a[0],ty=o[1]-a[1],tz=o[2]-a[2],u=(tx*px+ty*py+tz*pz)*ix;if(u<0||u>1)return Infinity;var qx=ty*ez-tz*ey,qy=tz*ex-tx*ez,qz=tx*ey-ty*ex,v=(d[0]*qx+d[1]*qy+d[2]*qz)*ix;if(v<0||u+v>1)return Infinity;var t=(fx*qx+fy*qy+fz*qz)*ix;return t>.00001?t:Infinity;}
 return function(origin,direction,maxDistance){var o=[origin.x,origin.y,origin.z],d=[direction.x,direction.y,direction.z],best=maxDistance||1000,found=false,stack=[tree];while(stack.length){var n=stack.pop();if(!hitBox(n,o,d,best))continue;if(n.ids){for(var i=0;i<n.ids.length;i++){var t=triangle(tri[n.ids[i]].v,o,d);if(t<best){best=t;found=true;}}}else{stack.push(n.left,n.right);}}return found?best:Infinity;};
}
// Replay the six actual exit-camera poses that escaped the 26-axis check in R8.
// These temporary cameras never modify the renderer's camera or player state.
GZ.Station.validateReportedViews=function(st){
 var poses=[[20,17.45360397318147,7.748700560290111],[20,17.444590438746076,8.14830056029032],[20,17.42849450806886,8.549100560290249],[20,17.407947463285147,8.94870056029011],[20,17.386148163536674,9.348300560290319],[20,17.366531450905608,9.74790056029018]],corners=[[-1,-1],[-1,1],[1,-1],[1,1],[0,0]],camera=new T.PerspectiveCamera(65,4/3,.1,850),v=new T.Vector3(),ray=st.raycastSolid||(st.raycastSolid=solidBVH(st.group)),probes=[],failures=[];
 camera.rotation.order='YXZ';camera.rotation.set(.32766691589355457,2.686785551867215,0,'YXZ');
 poses.forEach(function(p,pi){camera.position.set(p[0],p[1],p[2]);camera.updateMatrixWorld(true);corners.forEach(function(q){v.set(q[0],q[1],.5).unproject(camera).sub(camera.position).normalize();var origin={x:p[0],y:p[1],z:p[2]},direction={x:v.x,y:v.y,z:v.z},distance=ray(origin,direction,850),probe={pose:pi,corner:q,position:origin,direction:direction,distance:isFinite(distance)?distance:null};probes.push(probe);if(!isFinite(distance))failures.push(probe);});});
 return{ok:failures.length===0,origins:poses.length,rays:probes.length,probes:probes,failures:failures};
};
GZ.Station.validateTrainClearance=function(st,train){
 var tb=train.bodyBounds||new T.Box3(new T.Vector3(-122.8,-.2,-5.035),new T.Vector3(122.8,11.85,5.035)),p={x:train.group.position.x-st.group.position.x,y:train.group.position.y-st.group.position.y,z:train.group.position.z-st.group.position.z},minimum=Infinity,objects=[];
 var list=st.clearanceColliders||st.colliders;
 for(var i=0;i<list.length;i++){var c=list[i];if(!c.enabled)continue;var dx=Math.max(c.min.x-(tb.max.x+p.x),(tb.min.x+p.x)-c.max.x,0),dy=Math.max(c.min.y-(tb.max.y+p.y),(tb.min.y+p.y)-c.max.y,0),dz=Math.max(c.min.z-(tb.max.z+p.z),(tb.min.z+p.z)-c.max.z,0),gap=Math.hypot(dx,dy,dz);minimum=Math.min(minimum,gap);if(gap<.25-1e-5)objects.push(c.id);}
 return{ok:objects.length===0,gap:minimum,objects:objects,penetration:Math.max(0,.25-minimum)};
};
GZ.Station.validate=function(st,train){
 var ci,c;var counts={pathObstruction:0,pathClearance:0,unsupported:0,enclosure:0,doorAlignment:0,trainClearance:0},violations=[],metrics={pathSamples:0,closureOrigins:0,rays:0,minWidth:Infinity,minHeight:Infinity,maxDoorError:0,minTrainClearance:Infinity,trainSweep:[-415-train.length/2,415+train.length/2]},seen={},paths=[],all=st.nav.paths;
 function fail(kind,data){counts[kind]++;if(counts[kind]<=25)violations.push(Object.assign({kind:kind},data));}
 Object.keys(all).forEach(function(k){paths.push({id:k,points:all[k]});});
 for(var tr=0;tr<2;tr++){for(var n=0;n<st.nav.platformDoorSpotsByTrack[tr].length;n++){paths.push({id:'door-'+tr+'-'+n,points:st.nav.pathToDoor(n,tr)});if(st.spanishLayout)paths.push({id:'alight-'+tr+'-'+n,points:st.nav.pathFromAlight(n,tr)});}
  for(n=0;n<3;n++){paths.push({id:'gateIn-'+n,points:[st.nav.gateIn[n],st.nav.gateInExit[n]]});paths.push({id:'gateOut-'+n,points:[st.nav.gateOut[n],st.nav.gateOutExit[n]]});}
 }
 var spatial={};st.colliders.forEach(function(c){if(c.kind==='door')return;for(var bx=Math.floor((c.min.x-1.1)/8);bx<=Math.floor((c.max.x+1.1)/8);bx++)for(var bz=Math.floor((c.min.z-1.1)/8);bz<=Math.floor((c.max.z+1.1)/8);bz++){var key=bx+'/'+bz;(spatial[key]||(spatial[key]=[])).push(c);}});
 var ray=st.raycastSolid||(st.raycastSolid=solidBVH(st.group)),directions=[],stairDirections=[];for(var dx=-1;dx<=1;dx++)for(var dy=-1;dy<=1;dy++)for(var dz=-1;dz<=1;dz++)if(dx||dy||dz){var dl=Math.hypot(dx,dy,dz);directions.push({x:dx/dl,y:dy/dl,z:dz/dl});}
 for(var sd=0;sd<512;sd++){var sy=1-2*(sd+.5)/512,sr=Math.sqrt(1-sy*sy),sa=sd*Math.PI*(3-Math.sqrt(5));stairDirections.push({x:Math.cos(sa)*sr,y:sy,z:Math.sin(sa)*sr});}stairDirections=directions.concat(stairDirections);metrics.closureDirections=26;metrics.extraStairDirections=512;metrics.stairLateralOrigins=0;
 function checkEnclosure(origin,dirs,id){metrics.closureOrigins++;for(var di=0;di<dirs.length;di++){metrics.rays++;if(!isFinite(ray(origin,dirs[di],1000)))fail('enclosure',{path:id,position:origin,direction:dirs[di]});}}
 paths.forEach(function(path){for(var pi=0;pi<path.points.length;pi++){var a=path.points[pi],b=path.points[Math.min(pi+1,path.points.length-1)],len=Math.hypot(b.x-a.x,b.y-a.y,b.z-a.z),samples=Math.max(1,Math.ceil(len/.5));for(var k=0;k<=samples;k++){
  var t=k/samples,p={x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,z:a.z+(b.z-a.z)*t},key=[p.x.toFixed(3),p.y.toFixed(3),p.z.toFixed(3)].join('/');if(seen[key])continue;seen[key]=true;metrics.pathSamples++;
  var ground=st.sampleGround(p.x,p.z,p.y);if(!ground||Math.abs(ground.y-p.y)>.6)fail('unsupported',{path:path.id,position:p,ground:ground});
  var floor=ground?ground.y:p.y,height=Infinity,width=Infinity;
  var nearby=spatial[Math.floor(p.x/8)+'/'+Math.floor(p.z/8)]||[];for(var ci=0;ci<nearby.length;ci++){var c=nearby[ci];if(!c.enabled||c.kind==='door')continue; // traversals are conditional on fully open gates/doors; tested separately below
   var nearX=Math.max(c.min.x-p.x,0,p.x-c.max.x),nearZ=Math.max(c.min.z-p.z,0,p.z-c.max.z),hd=Math.hypot(nearX,nearZ);
   if(c.min.y>=floor+1&&hd<1.1)height=Math.min(height,c.min.y-floor);
   if(c.kind==='floor'||c.max.y<=floor+.1||c.min.y>=floor+5)continue;
   width=Math.min(width,hd*2);
   if(hd<1.1-1e-4)fail('pathObstruction',{path:path.id,position:p,object:c.id,owner:c.owner,clearance:hd});
  }
  metrics.minWidth=Math.min(metrics.minWidth,width);metrics.minHeight=Math.min(metrics.minHeight,height);
  if(height<5-1e-4)fail('pathClearance',{path:path.id,position:p,height:height});
  if(floor<27.9)checkEnclosure({x:p.x,y:floor+GZ.config.EYE_H,z:p.z},ground&&ground.kind==='escalator'?stairDirections:directions,path.id);
 }}});
 // Check shaft sides too; a center-line ray set alone can miss a narrow lower seam.
 st.escalators.forEach(function(e){if(!e.enabled)return;var steps=Math.ceil(Math.hypot(e.top.x-e.bottom.x,e.top.y-e.bottom.y)/.5);for(var sk=0;sk<=steps;sk++)for(var lane=-1;lane<=1;lane+=2){var f=sk/steps,x=e.bottom.x+(e.top.x-e.bottom.x)*f,y=e.bottom.y+(e.top.y-e.bottom.y)*f,z=e.top.z+lane*.6,g=st.sampleGround(x,z,y);if(g&&g.y<27.9){metrics.stairLateralOrigins++;checkEnclosure({x:x,y:g.y+GZ.config.EYE_H,z:z},stairDirections,'shaft-side-'+e.id);}}});
 var reportedViews=GZ.Station.validateReportedViews(st);metrics.reportedViewOrigins=reportedViews.origins;metrics.reportedViewRays=reportedViews.rays;metrics.closureOrigins+=reportedViews.origins;metrics.rays+=reportedViews.rays;reportedViews.failures.forEach(function(p){fail('enclosure',{path:'reported-exit-view-'+p.pose,position:p.position,direction:p.direction,corner:p.corner});});
 // Gate aperture: static housings + actual fully-open swinging leaf AABBs.
 var testGates=st.interact.gatesIn.concat(st.interact.gatesOut),savedGates=testGates.map(function(g){return g.getState();});testGates.forEach(function(g){g.setOpen(1);});st.update(0);
 for(var gi=0;gi<st.colliders.length;gi++){var gc=st.colliders[gi];if(gc.kind!=='door'||gc.owner!=='闸机动态扇门')continue;var center=gc._group.parent.position,dist=Math.max(gc.min.z-center.z,center.z-gc.max.z,0);if(dist<1.1)fail('pathObstruction',{path:'open-gate',object:gc.id,width:dist*2});}
 testGates.forEach(function(g,i){g.setOpen(savedGates[i].open);g[savedGates[i].target?'open':'close']();});st.update(0);
 for(tr=0;tr<2;tr++){
  var track=st.tracks[tr],doors=train.doors.filter(function(d){return d.side===track.side;});
  for(n=0;n<doors.length;n++){var apertures=[st.psd.openingsByTrack[tr][n]];if(st.spanishLayout)apertures.push(st.psd.alightOpeningsByTrack[tr][n]);for(var ai=0;ai<apertures.length;ai++){var err=Math.abs(doors[n].x+track.stopX-apertures[ai].x);metrics.maxDoorError=Math.max(metrics.maxDoorError,err);if(err>.15)fail('doorAlignment',{track:tr,door:n,side:ai?'alight':'board',error:err});}}
  // Analytic longitudinal sweep: all X positions, including between frame samples.
  var lo=-train.length-170,hi=train.length+170;
  for(var ti=0;ti<train.colliders.length;ti++){var tc=train.colliders[ti];if(!tc.enabled||tc.owner==='车灯')continue;
   for(ci=0;ci<st.clearanceColliders.length;ci++){c=st.clearanceColliders[ci];if(!c.enabled)continue;
    if(tc.max.x+hi<c.min.x||tc.min.x+lo>c.max.x)continue;
    var zg=Math.max(c.min.z-(tc.max.z+track.z),(tc.min.z+track.z)-c.max.z,0),yg=Math.max(c.min.y-(tc.max.y+st.trackY),(tc.min.y+st.trackY)-c.max.y,0),gap=Math.hypot(zg,yg);metrics.minTrainClearance=Math.min(metrics.minTrainClearance,gap);if(gap<.25-1e-5)fail('trainClearance',{track:tr,train:tc.id,object:c.id,owner:c.owner,gap:gap});
   }
  }
 }
 return{ok:Object.keys(counts).every(function(k){return counts[k]===0;}),counts:counts,violations:violations,metrics:metrics};
};

})();
