/* Play owns this module. Shared, instanced brick people: 60 minifig passengers / shared instanced parts. */
(function () {
  'use strict';
  var GZ = window.GZ = window.GZ || {}, T = window.THREE;
  var shirts = [0xee684b, 0x3e9fb4, 0xe9bc42, 0x8c78b1, 0x53a580, 0xf1ece1, 0xd57798, 0x3271a0];
  var skin = [0xf6c792, 0xe9aa76, 0xf8d9ac, 0xc58a60];
  var hair = [0x352b25, 0x574136, 0x222e35, 0x9b643e];
  function Crowd(opts) {
    opts = opts || {};
    this.count = opts.count || 60;
    this.group = new T.Group(); this.group.name = '会走路的积木乘客';
    if (opts.parent || opts.scene) (opts.parent || opts.scene).add(this.group);
    this.actors = []; this.parts = []; this.time = 0;this.reservations=[];
    this._m = new T.Matrix4(); this._p = new T.Vector3(); this._s = new T.Vector3();
    this.player = new T.Vector3(10000,10000,10000);this.playerRadius=3.5;this.colliders=[];this.escalators=[];this.front=new T.Vector3(10000,10000,10000);this.frontRadius=0;this.physicsStats={resolutions:0,unresolved:0,hiddenBySolver:0,restoredLastSafe:0,precomputedUnresolved:0};this._q = new T.Quaternion(); this._e = new T.Euler(0, 0, 0, 'YXZ');
    var specs = [
      ['body',1.15,1.25,.67,0,2.03,0,'shirt'],
      ['head',1.02,.92,1.02,0,3.1,0,'skin'],
      ['stud',.38,.25,.38,0,3.72,0,'skin'],
      ['hair',1.07,.25,1.07,0,3.52,-.03,'hair'],
      ['hairBack',1.02,.63,.25,0,3.18,-.42,'hair'],
      ['legL',.43,1.22,.48,-.29,.65,0,'pants'],
      ['legR',.43,1.22,.48,.29,.65,0,'pants'],
      ['shoeL',.47,.26,.66,-.29,.16,.09,'pants'],
      ['shoeR',.47,.26,.66,.29,.16,.09,'pants'],
      ['armL',.33,1.14,.37,-.79,2.0,0,'shirt'],
      ['armR',.33,1.14,.37,.79,2.0,0,'shirt'],
      ['handL',.42,.42,.42,-.79,1.36,0,'skin'],
      ['handR',.42,.42,.42,.79,1.36,0,'skin'],
      ['pack',.86,.86,.36,0,2.06,-.46,'pack'],
      ['eyeL',.105,.105,.08,-.19,3.22,.475,'eyes'],
      ['eyeR',.105,.105,.08,.19,3.22,.475,'eyes'],
      ['smile',.25,.20,.12,0,3.03,.50,'eyes'],
      ['phone',.35,.56,.07,.79,2.14,.98,'phone'],
      ['screen',.28,.43,.075,.79,2.15,1.02,'screen']
    ];
    var cube=new T.BoxGeometry(1,1,1), cylinder=new T.CylinderGeometry(.5,.5,1,16),
      eye=new T.SphereGeometry(.5,8,6), claw=new T.TorusGeometry(.5,.19,6,14,Math.PI*1.5),
      smile=new T.TorusGeometry(1,.14,4,12,Math.PI), torso=new T.BoxGeometry(1,1,1);
    claw.rotateZ(-Math.PI*.25);smile.rotateZ(Math.PI);
    var vertices=torso.attributes.position;for(var vi=0;vi<vertices.count;vi++)if(vertices.getY(vi)>0)vertices.setX(vi,vertices.getX(vi)*.83);torso.computeVertexNormals();
    this.geometries=[cube,cylinder,eye,claw,smile,torso];
    var mat=new T.MeshLambertMaterial({color:0xffffff});
    for(var p=0;p<specs.length;p++){
      var name=specs[p][0],geo=name==='body'?torso:name==='head'||name==='stud'||name==='hair'?cylinder:name.indexOf('eye')===0?eye:name.indexOf('hand')===0?claw:name==='smile'?smile:cube;
      var mesh=new T.InstancedMesh(geo,mat,this.count);
      mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);mesh.frustumCulled=false;mesh.name=name;
      this.group.add(mesh);this.parts.push({mesh:mesh,spec:specs[p]});
    }
    var c = new T.Color();
    for (var i = 0; i < this.count; i++) {
      var a = {id:i, position:new T.Vector3(), path:[], pathIndex:0, loop:true,
        speed:2.7 + (i % 7) * .14, yaw:0, scale:i % 6 === 0 ? .77 : 1,
        visible:false, renderVisible:true, state:'idle', phase:i * 1.8, walking:false, backpack:i%3===0, pause:0, pose:i%7===2?'phone':'normal', followParent:-1, escalator:false,soundPosition:new T.Vector3(),soundId:'npc-'+i,nextFootstep:0,soundOpts:{position:null,sourceId:'npc-'+i,volume:.3}};
      a.soundOpts.position=a.soundPosition;this.actors.push(a);
      for (p = 0; p < this.parts.length; p++) {
        var type = this.parts[p].spec[7], color = type==='shirt' ? shirts[i%shirts.length] : type==='skin' ? skin[i%skin.length] : type==='hair' ? hair[i%hair.length] : type==='pants' ? (i%2 ? 0x344856 : 0x626978) : type==='pack' ? 0x995e43 : type==='screen'?0x6cd4ef : 0x23333a;
        this.parts[p].mesh.setColorAt(i, c.setHex(color).convertSRGBToLinear());
      }
    }
    this.update(0,true);
  }
  Crowd.prototype.setPath = function (id, path, opts) {
    this.dirty=true;var a = this.actors[id]; if (!a) return;
    opts = opts || {}; a.backpack=id%3===0;a.path.length = 0;a.backpack=opts.seated?false:id%3===0;a.followParent=-1;a.pose=opts.pose||(id%7===2?'phone':'normal');
    for (var i=0;i<path.length;i++) {
      var v=path[i]; a.path.push(new T.Vector3(v.x === undefined ? v[0] : v.x, v.y === undefined ? v[1] : v.y, v.z === undefined ? v[2] : v.z));a.path[a.path.length-1].escalator=v.kind==='escalator';
    }
    a.renderVisible=true;a.bodyHitSignature=null;a.footFitSignature=null;a.supportId=null;a.shoeOffsetL=a.shoeOffsetR=0;a.escalator=false;a.walking=false;a.pathIndex=opts.startIndex||0; a.loop=opts.loop!==false; a.visible=!this.mask||!!this.mask[id];
    a.state=opts.state||'walking';a.transit=a.state==='transit'; if (opts.speed) a.speed=opts.speed;
    if (opts.place!==false && a.path.length) a.position.copy(a.path[a.pathIndex]);
    a.pathIndex=a.path.length>1 ? (a.pathIndex+1)%a.path.length : 0; a.pause=opts.delay||0;
  };
  Crowd.prototype.place = function (id, point, opts) {
    this.dirty=true;var a=this.actors[id]; if(!a)return; opts=opts||{};
    a.backpack=opts.seated?false:id%3===0;a.followParent=-1;a.pose=opts.pose||(id%7===2?'phone':'normal');a.bodyHitSignature=null;a.footFitSignature=null;a.supportId=null;a.shoeOffsetL=a.shoeOffsetR=0;a.escalator=false;a.walking=false;a.pause=0;a.renderVisible=true;a.position.set(point.x,point.y,point.z);a.yaw=opts.yaw||0;a.transit=false;a.state=opts.seated?'seated':'idle';a.visible=!this.mask||!!this.mask[id];a.path.length=0;
  };
  Crowd.prototype.follow = function(id,parent){this.actors[id].followParent=parent;this.actors[id].scale=.77;};
  Crowd.prototype.hideAll = function () { for(var i=0;i<this.count;i++)this.actors[i].visible=false; };
  Crowd.prototype.attach = function (parent) { if(this.group.parent!==parent)parent.add(this.group); };
  Crowd.prototype.avoidPlayer = function (x,y,z,radius,front) {this.player.set(x,y,z);this.playerRadius=Math.max(3.5,radius||3.5);if(front){this.front.copy(front);this.frontRadius=4.3;}else this.frontRadius=0;};
  Crowd.prototype.setColliders = function(list,ground){this.colliders=list||[];this.ground=ground;this.physicsRevision=(this.physicsRevision||0)+1;};
  Crowd.prototype.legal = function(a,p,ignore){
    if(this.groundExact&&!this.plantFoot(a,p))return false;
    if(this.staticHit(a,p))return false;
    if(Math.abs(p.y-this.player.y)<3.85&&Math.hypot(p.x-this.player.x,p.z-this.player.z)<this.playerRadius+.03)return false;
    if(this.frontRadius&&Math.abs(p.y-this.front.y)<3.85&&Math.hypot(p.x-this.front.x,p.z-this.front.z)<this.frontRadius)return false;
    for(var ri=0;ri<this.reservations.length;ri++){var reserved=this.reservations[ri];if(Math.abs(p.y-reserved.p.y)<3.85&&Math.hypot(p.x-reserved.p.x,p.z-reserved.p.z)<reserved.r)return false;}
    for(var i=0;i<this.count;i++){var b=this.actors[i];if(b===a||i===ignore||!b.visible||Math.abs(b.position.y-p.y)>3.85*Math.max(a.scale,b.scale))continue;if(Math.hypot(b.position.x-p.x,b.position.z-p.z)<(GZ.PlayPhysics?GZ.PlayPhysics.npcRadius(a)+GZ.PlayPhysics.npcRadius(b):1.4*(a.scale+b.scale))+.03)return false;}
    return true;
  };
  Crowd.prototype.snapSupport = function(a,p){
    if(!this.ground||a.state==='seated')return;
    // Predict the surface before sampling, including the FIRST step after a landing.
    // sampleGround deliberately rejects a stale upper-floor expectedY on a lower step.
    for(var si=0;si<this.escalators.length;si++){var stair=this.escalators[si];if(stair.enabled===false)continue;var lo=Math.min(stair.top.x,stair.bottom.x),hi=Math.max(stair.top.x,stair.bottom.x),fraction=Math.max(0,Math.min(1,(p.x-stair.bottom.x)/(stair.top.x-stair.bottom.x))),nominal=stair.bottom.y+(stair.top.y-stair.bottom.y)*fraction;if(a.supportId===stair.id||(p.x>=lo-.85&&p.x<=hi+.85&&Math.abs(p.z-stair.top.z)<=stair.width*.5&&Math.abs(p.y-nominal)<3)){p.z=stair.top.z;p.y=nominal;a.supportId=stair.id;break;}}
    var g=this.ground(p);a.stairSurface=!!g&&(g.kind==='escalator'||/-landing$/.test(g.id||''));if(!g||Math.abs(g.y-p.y)>3)return;
    if(g.kind==='escalator'){
      var id=g.id.replace(/-step$/,'');for(var k=0;k<this.escalators.length;k++){var e=this.escalators[k];if(e.id===id){p.z=e.top.z;g=this.ground(p);break;}}
      a.supportId=id;a.escalator=true;a.walking=false;
      var target=a.path[a.pathIndex];a.yaw=target&&target.x<p.x?-Math.PI/2:Math.PI/2;
    }else {a.supportId=null;a.escalator=false;}
    if(g)p.y=g.y;
  };
  Crowd.prototype.resolve = function(){
    var i,j,a,b,dx,dz,d,need,p,old,changed;
    for(i=0;i<this.count;i++)if(this.actors[i].visible)this.snapSupport(this.actors[i],this.actors[i].position);
    // Joint constraint solve. Never push through a wall to resolve another constraint.
    for(var pass=0;pass<24;pass++){changed=false;
      for(i=0;i<this.count;i++){a=this.actors[i];if(!a.visible)continue;p=a.position;
        var anchors=[{p:this.player,r:this.playerRadius+.08}].concat(this.reservations);if(this.frontRadius)anchors.push({p:this.front,r:this.frontRadius+.08});
        for(j=0;j<anchors.length;j++){var q=anchors[j];if(Math.abs(p.y-q.p.y)>=3.85)continue;dx=p.x-q.p.x;dz=p.z-q.p.z;d=Math.hypot(dx,dz);if(d<q.r){if(d<.0001){dx=Math.cos(i*2.4);dz=Math.sin(i*2.4);d=1;}need=q.r-d;if(a.escalator){p.x+=(dx<0?-1:1)*(q.r-Math.abs(dx));this.snapSupport(a,p);}else {p.x+=dx/d*need;p.z+=dz/d*need;}changed=true;}}
        for(j=i+1;j<this.count;j++){b=this.actors[j];if(!b.visible||Math.abs(b.position.y-p.y)>3.85*Math.max(a.scale,b.scale))continue;dx=b.position.x-p.x;dz=b.position.z-p.z;d=Math.hypot(dx,dz);need=(GZ.PlayPhysics?GZ.PlayPhysics.npcRadius(a)+GZ.PlayPhysics.npcRadius(b):1.4*(a.scale+b.scale))+.08;if(d<need){if((a.state==='seated'||a.pose==='strap')&&(b.state==='seated'||b.pose==='strap'))continue;if(d<.0001){dx=1;dz=0;d=1;}var correction=need-d,af=a.state==='seated'||a.pose==='strap',bf=b.state==='seated'||b.pose==='strap',am=af?0:bf?1:.5,bm=bf?0:af?1:.5;if(a.escalator||b.escalator){var shift=(dx<0?-1:1)*(need-Math.abs(dx));p.x-=shift*am;b.position.x+=shift*bm;this.snapSupport(a,p);this.snapSupport(b,b.position);}else {p.x-=dx/d*correction*am;p.z-=dz/d*correction*am;b.position.x+=dx/d*correction*bm;b.position.z+=dz/d*correction*bm;}changed=true;}}
        var collision=this.staticHit(a,p);if(collision){var box=GZ.PlayPhysics.box(collision.collider),bb=collision.bounds,choices=[{d:bb.max.x-box.min.x+.008,a:'x',sign:-1},{d:box.max.x-bb.min.x+.008,a:'x',sign:1},{d:bb.max.z-box.min.z+.008,a:'z',sign:-1},{d:box.max.z-bb.min.z+.008,a:'z',sign:1}];if(a.escalator)choices=choices.filter(function(c){return c.a==='x';});choices.sort(function(a,b){return a.d-b.d;});p[choices[0].a]+=choices[0].sign*choices[0].d;this.snapSupport(a,p);changed=true;}

      }
      if(!changed)break;
    }
    // A narrow doorway can have no space for a pair. Find a legal nearby waiting place.
    // This is used at scene population and only when the joint solve cannot satisfy constraints.
    for(i=0;i<this.count;i++){a=this.actors[i];if(!a.visible||this.legal(a,a.position))continue;old=a.position.clone();var savedSupport=a.supportId,savedYaw=a.yaw,savedEscalator=a.escalator,found=false;
      for(var radius=.5;radius<35&&!found;radius+=.5)for(j=0;j<(savedEscalator?2:24);j++){a.supportId=savedSupport;a.yaw=savedYaw;a.escalator=savedEscalator;var angle=savedEscalator?j*Math.PI:j*Math.PI/12;p=old.clone();p.x+=Math.cos(angle)*radius;p.z+=Math.sin(angle)*radius;if(this.ground&&a.state!=='seated'){if(savedEscalator)this.snapSupport(a,p);var g=this.ground(p);if(!g||Math.abs(g.y-p.y)>.8)continue;p.y=g.y;this.snapSupport(a,p);}if(!this.legal(a,p))continue;a.position.copy(p);found=true;this.physicsStats.resolutions++;break;}
      if(!found){a.supportId=savedSupport;a.yaw=savedYaw;a.escalator=savedEscalator;}
      if(!found)this.physicsStats.unresolved++;
    }
  };
  Crowd.prototype.update = function (dt,renderOnly) {
    this.time+=dt;
    var list=this.actors,i,j,a,b,d,dx,dy,dz,dist,move,p;
    if(!renderOnly)for(i=0;i<this.count;i++) {
      a=list[i];a.walking=false;if(!a.visible)continue;
      if(a.pause>0){a.pause-=dt;continue;}
      if(a.path.length>1 && a.state!=='seated') {
        d=a.path[a.pathIndex];a.escalator=!!d.escalator&&Math.abs(d.y-a.position.y)>.08;dx=d.x-a.position.x;dy=d.y-a.position.y;dz=d.z-a.position.z;dist=Math.hypot(dx,dy,dz);
        if(dist<.15){a.pathIndex++;if(a.pathIndex>=a.path.length){if(a.loop)a.pathIndex=0;else{a.path.length=0;a.state='idle';}}continue;}
        a.yaw=Math.atan2(dx,dz);move=Math.min((a.escalator?3.2:a.speed)*dt,dist);p=a.position.clone();p.x+=dx/dist*move;p.y+=dy/dist*move;p.z+=dz/dist*move;
        this.snapSupport(a,p);a.walking=!a.escalator;if(this.legal(a,p)){a.position.copy(p);}else if(!a.escalator){
          // Two small diagonal sidesteps; retain the destination, resume once the lane is clear.
          for(j=0;j<2;j++){var sign=(i%2?1:-1)*(j?-1:1);p.copy(a.position);p.x+=(dx/dist*.25+dz/dist*sign)*move;p.z+=(dz/dist*.25-dx/dist*sign)*move;this.snapSupport(a,p);a.walking=!a.escalator;if(this.legal(a,p)){a.position.copy(p);break;}if(j===1)a.walking=false;}
        }
        if(this.ground&&a.state!=='seated'){var g=this.ground(a.position);if(g&&Math.abs(g.y-a.position.y)<.8){a.position.y=g.y;a.supportId=g.kind==='escalator'?g.id.replace(/-step$/,''):null;}}
      }
      if(a.followParent>=0){b=list[a.followParent];if(b.visible&&Math.hypot(a.position.x-b.position.x,a.position.z-b.position.z)>4){a.path=[a.position.clone(),new T.Vector3(b.position.x+3.4*Math.cos(b.yaw),b.position.y,b.position.z-3.4*Math.sin(b.yaw))];a.pathIndex=1;a.loop=false;a.state='family';}}
    }
    if(!renderOnly){
      for(i=0;i<this.count;i++){a=list[i];a.gaitOverride=null;a.footReach=null;if(!a.visible||!a.walking||!this.groundExact)continue;if(!this.footContact(a).supported){a.gaitOverride=Math.sin(this.time*8.5+a.phase)>=0?1:-1;var reaches=[-.6,.6];for(j=0;j<reaches.length;j++){a.footReach=reaches[j];if(this.footContact(a).supported)break;}}}
      this.resolve();this.fitFeet();this.dirty=false;
    }
    var m=this._m, pos=this._p, scale=this._s, q=this._q, e=this._e;
    for(var p=0;p<this.parts.length;p++) {
      var part=this.parts[p], s=part.spec, name=s[0];
      for(i=0;i<(this.limit===undefined?this.count:this.limit);i++) {
        a=list[this.order?this.order[i]:i];
        if(!a.visible || a.renderVisible===false ||  (name==='pack' && !a.backpack) || ((name==='phone'||name==='screen')&&a.pose!=='phone') || (name==='hairBack'&&a.id%4!==1)) {scale.set(0,0,0);pos.set(0,-1000,0);q.set(0,0,0,1);m.compose(pos,q,scale);part.mesh.setMatrixAt(i,m);continue;}
        part.mesh.setMatrixAt(i,this.partMatrix(a,s,a.position));
      }
      part.mesh.instanceMatrix.needsUpdate=true;
    }
  };
  Crowd.prototype.partMatrix=function(a,s,origin){var name=s[0],m=this._m,pos=this._p,scale=this._s,q=this._q,e=this._e,i=a.id;
    if(a.trigTime!==this.time||a.trigYaw!==a.yaw||a.trigPhase!==a.phase||a.trigGait!==a.gaitOverride){a.trigTime=this.time;a.trigYaw=a.yaw;a.trigPhase=a.phase;a.trigGait=a.gaitOverride;a.waveValue=a.gaitOverride==null?Math.sin(this.time*8.5+a.phase):a.gaitOverride;a.slowValue=Math.sin(this.time*1.3+a.phase);a.yawSin=Math.sin(a.yaw);a.yawCos=Math.cos(a.yaw);}var wave=a.waveValue,swing=a.walking?wave*.62:(this.secondaryAnimations===false?0:a.slowValue*.015),stance=!a.walking||(name.indexOf('L')>=0?wave<=0:wave>=0),bob=a.walking?Math.abs(wave)*.055:0;
    var rx=0,lx=s[4],ly=s[5],lz=s[6];
    if(name==='legL'||name==='legR'||name==='shoeL'||name==='shoeR'){
      rx=a.state==='seated'?-Math.PI/2:(name.indexOf('L')>=0?swing:-swing);if(a.walking&&stance){rx*=.72;if(a.footReach!=null)rx=-Math.asin(a.footReach/1.1);}
      ly=1.25-Math.cos(rx)*.60;lz=-Math.sin(rx)*.60;if(a.state!=='seated')ly=Math.max(ly,Math.abs(Math.cos(rx))*.61+Math.abs(Math.sin(rx))*.24+.12);
      if(name.indexOf('shoe')===0){ly=1.25-Math.cos(rx)*1.1;lz=-Math.sin(rx)*1.1+.09;if(a.state!=='seated'&&stance){ly=.13;rx=0;bob=0;}else if(a.walking)ly+=Math.abs(wave)*.08;}if(a.state==='seated')ly-=.3;else {var footOffset=(name.indexOf('L')>=0?a.shoeOffsetL:a.shoeOffsetR)||0;ly+=footOffset/a.scale;}
    }
    if(name==='armL'||name==='armR'||name==='handL'||name==='handR'||name==='phone'||name==='screen') {
      rx=name.indexOf('L')>=0?-swing:swing;
      var right=name.indexOf('R')>=0||name==='phone'||name==='screen';if(a.state==='seated')rx=-.4;if(right&&a.pose==='phone')rx=-1.25;if(!right&&a.pose==='strap')rx=-2.8;if(a.escalator&&!right)rx=-.45;var len=name.indexOf('hand')===0?1.18:name==='phone'||name==='screen'?1.05:.55;ly=2.55-Math.cos(rx)*len;lz=-Math.sin(rx)*len;if(name==='phone'||name==='screen')lz+=.07;
    }
    if(a.state==='seated' && name.indexOf('leg')!==0&&name.indexOf('shoe')!==0)ly-=.32;
    var sy=a.yawSin,cy=a.yawCos,k=a.scale;
    pos.set(origin.x+(lx*cy+lz*sy)*k,origin.y+ly*k+bob,origin.z+(lz*cy-lx*sy)*k);
    scale.set(s[1]*k,s[2]*k,s[3]*k);if(name==='hair' && i%4===0)scale.y*=1.8;
    var cr=Math.cos(rx),sr=Math.sin(rx),el=m.elements;el[0]=cy*scale.x;el[1]=0;el[2]=-sy*scale.x;el[3]=0;el[4]=sy*sr*scale.y;el[5]=cr*scale.y;el[6]=cy*sr*scale.y;el[7]=0;el[8]=sy*cr*scale.z;el[9]=-sr*scale.z;el[10]=cy*cr*scale.z;el[11]=0;el[12]=pos.x;el[13]=pos.y;el[14]=pos.z;el[15]=1;return m;
  };
  Crowd.prototype.fitActor=function(a,origin){
    if(!this.groundExact||!a.visible||a.state==='seated')return;
    var signature=[origin.x,origin.y,origin.z,a.yaw,a.walking,this.time,a.gaitOverride,a.footReach].join(',');if(a.footFitSignature===signature)return;a.footFitSignature=signature;a.shoeOffsetL=a.shoeOffsetR=0;
    var wave=a.gaitOverride==null?Math.sin(this.time*8.5+a.phase):a.gaitOverride;
    for(var si=0;si<2;si++){var left=si===0,swinging=a.walking&&(left?wave>0:wave<0),name=left?'shoeL':'shoeR',part=this.parts[left?7:8];if(!part.mesh.geometry.boundingBox)part.mesh.geometry.computeBoundingBox();var b=part.mesh.geometry.boundingBox,m=this.partMatrix(a,part.spec,origin).clone(),samples=[[0,0],[b.min.x,b.min.z],[b.min.x,b.max.z],[b.max.x,b.min.z],[b.max.x,b.max.z]],required=-Infinity;
      for(var j=0;j<samples.length;j++){var p=new T.Vector3(samples[j][0],b.min.y,samples[j][1]).applyMatrix4(m),g=this.groundExact(p);if(g&&Math.abs(g.y-p.y)<=.5)required=Math.max(required,g.y-p.y);}
      if(isFinite(required)){var offset=swinging?Math.max(0,required+.006):required;if(left)a.shoeOffsetL=offset;else a.shoeOffsetR=offset;}
    }
  };
  Crowd.prototype.fitFeet=function(){for(var i=0;i<this.count;i++)this.fitActor(this.actors[i],this.actors[i].position);};
  Crowd.prototype.plantFoot=function(a,p){
    this.fitActor(a,p);if(this.footContact(a,p).supported)return true;if(!a.walking)return false;
    var gait=a.gaitOverride,reach=a.footReach,wave=Math.sin(this.time*8.5+a.phase)>=0?1:-1;
    for(var side=0;side<2;side++)for(var step=0;step<2;step++){a.gaitOverride=side?-wave:wave;a.footReach=step?.6:-.6;this.fitActor(a,p);if(this.footContact(a,p).supported)return true;}
    a.gaitOverride=gait;a.footReach=reach;this.fitActor(a,p);return false;
  };
  Crowd.prototype.footContact=function(a,origin){
    if(!this.groundExact||a.state==='seated')return {supported:true,gap:0};
    var wave=a.gaitOverride==null?Math.sin(this.time*8.5+a.phase):a.gaitOverride,first=a.walking&&wave>0?'shoeR':'shoeL',names=[first,first==='shoeL'?'shoeR':'shoeL'],best=Infinity,details=[];
    for(var n=0;n<2;n++){var part=this.parts.filter(function(p){return p.spec[0]===names[n];})[0];if(!part.mesh.geometry.boundingBox)part.mesh.geometry.computeBoundingBox();var b=part.mesh.geometry.boundingBox,m=this.partMatrix(a,part.spec,origin||a.position).clone(),samples=[[0,0],[b.min.x,b.min.z],[b.min.x,b.max.z],[b.max.x,b.min.z],[b.max.x,b.max.z]];
      for(var j=0;j<samples.length;j++){var p=new T.Vector3(samples[j][0],b.min.y,samples[j][1]).applyMatrix4(m),g=this.groundExact(p);if(!g)continue;var gap=Math.abs(p.y-g.y);best=Math.min(best,gap);if(gap<=.055)return {supported:true,gap:gap,shoe:names[n],position:p};}details.push({shoe:names[n],gap:best});
    }return {supported:false,gap:best,details:details};
  };
  Crowd.prototype.staticHit=function(a,p){
    if(!GZ.PlayPhysics)return null;if(!this.fast)this.fitActor(a,p);var signature=[this.physicsRevision,this.time,p.x,p.y,p.z,a.yaw,a.walking,a.pose,a.scale,a.backpack,a.gaitOverride,a.footReach,a.shoeOffsetL,a.shoeOffsetR].join(',');if(a.bodyHitSignature===signature)return a.bodyHitResult;a.bodyHitSignature=signature;a.bodyHitResult=null;
    var radius=GZ.PlayPhysics.npcRadius(a),list=this.colliders.query?this.colliders.query(p,radius):this.colliders,bounds=this._bodyBounds||(this._bodyBounds=new T.Box3());
    for(var k=0;k<this.parts.length;k++){var part=this.parts[k],name=part.spec[0];if((name==='pack'&&!a.backpack)||((name==='phone'||name==='screen')&&a.pose!=='phone')||(name==='hairBack'&&a.id%4!==1))continue;
      if(!part.mesh.geometry.boundingBox)part.mesh.geometry.computeBoundingBox();bounds.copy(part.mesh.geometry.boundingBox).applyMatrix4(this.partMatrix(a,part.spec,p));
      for(var j=0;j<list.length;j++){var c=list[j],b=GZ.PlayPhysics.box(c);if(!GZ.PlayPhysics.enabled(c)||b.max.y<=p.y+.016)continue;
        // WORLD_API: floor patches/steps support soles; they are not lateral walls.
        // Shoe contact is checked against actual triangles, separately from these proxies.
        if(c.kind==='floor'&&b.max.y<p.y+.65)continue;
        // The gripping claw may touch its own strap; the head and all other parts still collide.
        if(a.pose==='strap'&&(name==='handL'||name==='armL')&&a.strapAnchor&&Math.abs((b.min.x+b.max.x)/2-a.strapAnchor.x)<.1&&Math.abs((b.min.z+b.max.z)/2-a.strapAnchor.z)<.1&&b.max.y>=a.strapAnchor.y&&b.min.y<=a.strapAnchor.y+.3)continue;
        if(bounds.min.x<b.max.x-.004&&bounds.max.x>b.min.x+.004&&bounds.min.y<b.max.y-.004&&bounds.max.y>b.min.y+.004&&bounds.min.z<b.max.z-.004&&bounds.max.z>b.min.z+.004)return a.bodyHitResult={collider:c,part:name,bounds:bounds.clone()};
      }
    }return null;
  };

  Crowd.prototype.enableFast=function(runtime){
    this.fast=true;this.runtime=runtime;this.limit=this.count;this.order=[];this.mask=new Uint8Array(this.count);this.mask.fill(1);for(var oi=0;oi<24;oi++){this.order.push(oi,oi+24);if(oi<12)this.order.push(oi+48);}this.baseColors=this.parts.map(function(p){return p.mesh.instanceColor.array.slice();});this.grid=new Map();this.next=new Int16Array(this.count);this.keys=new Int32Array(this.count);this._candidate=new T.Vector3();this._sample=new T.Vector3();this._origin=new T.Vector3();this.envelopes={};
    var dummy={id:0,scale:1,yaw:0,walking:true,state:'walking',pose:'normal',backpack:true,phase:0},b=new T.Box3(),m=new T.Matrix4();
    for(var pose of ['normal','phone','strap','seated']){var bins=[];dummy.pose=pose==='seated'?'normal':pose;dummy.state=pose==='seated'?'seated':'walking';dummy.walking=pose==='normal'||pose==='phone';
      for(var yi=0;yi<64;yi++){dummy.yaw=yi*Math.PI*2/64;var parts=[],whole=new T.Box3();for(var pi=0;pi<this.parts.length;pi++){var part=this.parts[pi],name=part.spec[0];if((name==='phone'||name==='screen')&&pose!=='phone')continue;var bounds=new T.Box3();if(!part.mesh.geometry.boundingBox)part.mesh.geometry.computeBoundingBox();for(var wave of [-1,0,1]){dummy.gaitOverride=wave;m.copy(this.partMatrix(dummy,part.spec,this._origin));b.copy(part.mesh.geometry.boundingBox).applyMatrix4(m);bounds.union(b);}bounds.min.x-=.08;bounds.max.x+=.08;bounds.min.z-=.08;bounds.max.z+=.08;bounds.min.y-=.008;bounds.max.y+=.008;parts.push({name:name,box:bounds});whole.union(bounds);}bins.push({parts:parts,box:whole});}this.envelopes[pose]=bins;
    }this.setLimit(this.count);
  };
  Crowd.prototype.bucket=function(p){return (Math.floor(p.x/8)+512)*1048576+(Math.floor(p.y/4)+128)*1024+Math.floor(p.z/8)+512;};
  Crowd.prototype.buildGrid=function(){this.grid.clear();this.maxRadius=0;this.maxScale=0;for(var i=0;i<this.count;i++){var a=this.actors[i];if(!a.visible){this.keys[i]=-1;continue;}this.maxRadius=Math.max(this.maxRadius,(a.pose==='phone'?1.7:1.4)*a.scale);this.maxScale=Math.max(this.maxScale,a.scale);var key=this.bucket(a.position);this.keys[i]=key;this.next[i]=this.grid.has(key)?this.grid.get(key):-1;this.grid.set(key,i);}};
  Crowd.prototype.moveGrid=function(a){var id=a.id,old=this.keys[id],key=a.visible?this.bucket(a.position):-1;if(old===key)return;if(old!==-1){var head=this.grid.get(old);if(head===id){if(this.next[id]<0)this.grid.delete(old);else this.grid.set(old,this.next[id]);}else{var previous=head;while(previous!==undefined&&previous>=0&&this.next[previous]!==id)previous=this.next[previous];if(previous!==undefined&&previous>=0)this.next[previous]=this.next[id];}}this.keys[id]=key;if(key!==-1){this.next[id]=this.grid.has(key)?this.grid.get(key):-1;this.grid.set(key,id);}};
  Crowd.prototype.fastStatic=function(a,p){
    var rt=this.runtime,attached=rt.attached,fixed=attached&&!a.transit&&(a.state==='seated'||a.pose==='strap'||a.path.length===0);if(fixed&&a.fixedX===p.x&&a.fixedY===p.y&&a.fixedZ===p.z&&a.fixedYaw===a.yaw&&a.fixedPose===a.pose&&a.fixedState===a.state&&a.fixedScale===a.scale)return a.fixedHit;
    var yaw=((Math.round(a.yaw*64/(Math.PI*2))%64)+64)%64,env=this.envelopes[a.state==='seated'?'seated':a.pose==='strap'?'strap':a.pose==='phone'?'phone':'normal'][yaw],k=a.scale,whole=env.box,hit=false;
    for(var source=0;source<2&&!hit;source++){var field,px,py,pz;if(source===0){field=attached?rt.trainField:rt.stationField;var offset=attached?rt.zero:rt.station.group.position;px=p.x-offset.x;py=p.y-offset.y;pz=p.z-offset.z;}else{if(!a.transit)continue;if(attached){if(!rt.station.group.visible)continue;field=rt.stationField;px=p.x+rt.train.group.position.x-rt.station.group.position.x;py=p.y+rt.train.group.position.y-rt.station.group.position.y;pz=p.z+rt.train.group.position.z-rt.station.group.position.z;}else{if(!rt.train.group.visible)continue;field=rt.trainField;px=p.x-rt.train.group.position.x;py=p.y-rt.train.group.position.y;pz=p.z-rt.train.group.position.z;}}
      var list=a.scale<=1?field.bodyAt(px,py,pz):field.at(px,py,pz);for(var set=0;set<4&&!hit;set++){if(set===1)list=a.scale<=1?field.bodyLarge:field.large;if(set===2)list=field.dynamicAt(py,pz);if(set===3)list=field.doorAt(px,py,pz);for(var i=0;i<list.length&&!hit;i++){var c=list[i];if(!GZ.PlayPhysics.enabled(c))continue;var b=GZ.PlayPhysics.box(c);if(c.kind==='floor'&&b.max.y<=py+.65)continue;if(b.min.x>=px+whole.max.x*k||b.max.x<=px+whole.min.x*k||b.min.y>=py+whole.max.y*k||b.max.y<=py+whole.min.y*k||b.min.z>=pz+whole.max.z*k||b.max.z<=pz+whole.min.z*k)continue;
       for(var j=0;j<env.parts.length;j++){var part=env.parts[j],v=part.box;if(part.name==='pack'&&!a.backpack)continue;if(a.pose==='strap'&&(part.name==='armL'||part.name==='handL')&&a.strapAnchor&&Math.abs((b.min.x+b.max.x)/2-a.strapAnchor.x)<.1&&Math.abs((b.min.z+b.max.z)/2-a.strapAnchor.z)<.1&&b.max.y>=a.strapAnchor.y&&b.min.y<=a.strapAnchor.y+.3)continue;if(px+v.min.x*k<b.max.x-.004&&px+v.max.x*k>b.min.x+.004&&py+v.min.y*k<b.max.y-.004&&py+v.max.y*k>b.min.y+.004&&pz+v.min.z*k<b.max.z-.004&&pz+v.max.z*k>b.min.z+.004){hit=true;break;}}
      }}
    }if(fixed){a.fixedX=p.x;a.fixedY=p.y;a.fixedZ=p.z;a.fixedYaw=a.yaw;a.fixedPose=a.pose;a.fixedState=a.state;a.fixedScale=a.scale;a.fixedHit=hit;}return hit;
  };
  Crowd.prototype.fastLegal=function(a,p,ignoreNeighbors){
    if(!this.runtime.attached&&!a.transit&&!a.escalator&&!a.stairSurface&&!this.runtime.walkable(p,.8*a.scale))return false;if(this.fastStatic(a,p))return false;var dx=p.x-this.player.x,dz=p.z-this.player.z;if(Math.abs(p.y-this.player.y)<3.85&&dx*dx+dz*dz<(this.playerRadius+.35)*(this.playerRadius+.35))return false;
    dx=p.x-this.front.x;dz=p.z-this.front.z;if(this.frontRadius&&Math.abs(p.y-this.front.y)<3.85&&dx*dx+dz*dz<(this.frontRadius+.1)*(this.frontRadius+.1))return false;
    for(var ri=0;ri<this.reservations.length;ri++){var q=this.reservations[ri];dx=p.x-q.p.x;dz=p.z-q.p.z;if(Math.abs(p.y-q.p.y)<3.85&&dx*dx+dz*dz<(q.r+.1)*(q.r+.1))return false;}
    if(!ignoreNeighbors){var ar=GZ.PlayPhysics.npcRadius(a),range=ar+this.maxRadius+.16,x0=Math.floor((p.x-range)/8),x1=Math.floor((p.x+range)/8),y0=Math.floor((p.y-3.85*Math.max(a.scale,this.maxScale))/4),y1=Math.floor((p.y+3.85*Math.max(a.scale,this.maxScale))/4),z0=Math.floor((p.z-range)/8),z1=Math.floor((p.z+range)/8);for(var x=x0;x<=x1;x++)for(var y=y0;y<=y1;y++)for(var z=z0;z<=z1;z++){var id=this.grid.get((x+512)*1048576+(y+128)*1024+z+512);while(id!==undefined&&id>=0){var b=this.actors[id];if(b!==a&&b.visible&&Math.abs(p.y-b.position.y)<3.85*Math.max(a.scale,b.scale)){dx=p.x-b.position.x;dz=p.z-b.position.z;var r=ar+GZ.PlayPhysics.npcRadius(b)+.16;if(dx*dx+dz*dz<r*r)return false;}id=this.next[id];}}}return true;
  };
  Crowd.prototype.relocateFast=function(a){
    var p=this._candidate,old=a.position,support=a.supportId,esc=a.escalator,yaw=a.yaw;
    if(a.state==='seated'){var seats=this.runtime.train.seats;for(var si=0;si<seats.length;si++){var seat=seats[(si+a.id*7)%seats.length];if(seat.car===this.reservedCar&&Math.abs(seat.x-this.reservedDoorX)<10.5)continue;p.set(seat.x,seat.y+.185-.71*a.scale+.008,seat.z);a.yaw=seat.yaw||0;if(this.fastLegal(a,p)){old.copy(p);return true;}}a.yaw=yaw;this.physicsStats.unresolved++;return false;}
    p.copy(old);var projected=false,anchors=[{p:this.player,r:this.playerRadius+.4}];if(this.frontRadius)anchors.push({p:this.front,r:this.frontRadius+.15});for(var ri=0;ri<this.reservations.length;ri++)anchors.push({p:this.reservations[ri].p,r:this.reservations[ri].r+.15});
    for(var ai=0;ai<anchors.length;ai++){var q=anchors[ai],dx=p.x-q.p.x,dz=p.z-q.p.z,d=Math.hypot(dx,dz);if(Math.abs(p.y-q.p.y)>=3.85||d>=q.r)continue;if(d<.001){dx=Math.cos(a.id*2.4);dz=Math.sin(a.id*2.4);d=1;}p.x+=dx/d*(q.r-d+.02);p.z+=dz/d*(q.r-d+.02);projected=true;}
    if(this.runtime.attached&&Math.abs(p.z)>2){p.z=0;projected=true;}
    if(projected&&!esc){var ar=GZ.PlayPhysics.npcRadius(a);var range=ar+this.maxRadius+.2,x0=Math.floor((p.x-range)/8),x1=Math.floor((p.x+range)/8),y0=Math.floor((p.y-3.85*this.maxScale)/4),y1=Math.floor((p.y+3.85*this.maxScale)/4),z0=Math.floor((p.z-range)/8),z1=Math.floor((p.z+range)/8);for(var gx=x0;gx<=x1;gx++)for(var gy=y0;gy<=y1;gy++)for(var gz=z0;gz<=z1;gz++){var neighbor=this.grid.get((gx+512)*1048576+(gy+128)*1024+gz+512);while(neighbor!==undefined&&neighbor>=0){var other=this.actors[neighbor];neighbor=this.next[neighbor];if(other===a||!other.visible||Math.abs(p.y-other.position.y)>=3.85*Math.max(a.scale,other.scale))continue;var dx=p.x-other.position.x,dz=p.z-other.position.z,d=Math.hypot(dx,dz),r=ar+GZ.PlayPhysics.npcRadius(other)+.2;if(d>=r)continue;if(d<.001){dx=Math.cos(a.id*2.4);dz=Math.sin(a.id*2.4);d=1;}p.x+=dx/d*(r-d+.02);p.z+=dz/d*(r-d+.02);}}this.currentActor=a;this.snapSupport(a,p);var g=this.ground(p);if(g&&Math.abs(g.y-old.y)<.85){p.y=g.y;if(this.fastLegal(a,p)){old.copy(p);this.physicsStats.resolutions++;return true;}}a.supportId=support;a.escalator=esc;a.yaw=yaw;}
    for(var r=.5;r<35;r+=.5)for(var j=0;j<(esc?2:16);j++){var angle=esc?j*Math.PI:j*Math.PI/8;p.set(old.x+Math.cos(angle)*r,old.y,old.z+Math.sin(angle)*r);a.supportId=support;a.escalator=esc;a.yaw=yaw;this.currentActor=a;this.snapSupport(a,p);var g=a.state==='seated'?{y:old.y}:this.ground(p);if(!g||Math.abs(g.y-old.y)>(esc?3:.85))continue;p.y=g.y;if(this.fastLegal(a,p)){old.copy(p);this.physicsStats.resolutions++;return true;}}
    a.supportId=support;a.escalator=esc;a.yaw=yaw;this.physicsStats.unresolved++;return false;
  };
  Crowd.prototype.fitFast=function(a){
    if(!a.visible||a.state==='seated')return;if(!a.escalator&&!a.transit&&(a.position.y<24||this.runtime.stationField.flatAround(a.position.x-this.runtime.station.group.position.x,a.position.y-this.runtime.station.group.position.y,a.position.z-this.runtime.station.group.position.z,1.3*a.scale))){a.shoeOffsetL=a.shoeOffsetR=0;return;}a.shoeOffsetL=a.shoeOffsetR=0;var wave=Math.sin(this.time*8.5+a.phase),p=this._sample;
    for(var side=0;side<2;side++){var part=this.parts[side?8:7],m=this.partMatrix(a,part.spec,a.position),el=m.elements,required=-Infinity;for(var j=0;j<5;j++){var x=j===0?0:(j<3?-.5:.5),z=j===0?0:(j%2?-.5:.5);p.set(el[12]+x*el[0]-.5*el[4]+z*el[8],el[13]+x*el[1]-.5*el[5]+z*el[9],el[14]+x*el[2]-.5*el[6]+z*el[10]);var g=this.ground(p);if(g&&Math.abs(g.y-p.y)<.5)required=Math.max(required,g.y-p.y);}if(isFinite(required)){var swinging=a.walking&&(side?wave<0:wave>0),offset=swinging?Math.max(0,required+.006):required;if(side)a.shoeOffsetR=offset;else a.shoeOffsetL=offset;}}
  };
  Crowd.prototype.candidateSupported=function(a,p){if(this.ground(p))return true;if(!a.transit)return false;var q=this._sample,cy=Math.cos(a.yaw),sy=Math.sin(a.yaw);for(var side=-1;side<=1;side+=2)for(var f=-1;f<=1;f+=2){var x=side*.29*a.scale,z=f*.65*a.scale;q.set(p.x+x*cy+z*sy,p.y,p.z+z*cy-x*sy);if(this.ground(q))return true;}return false;};
  Crowd.prototype.advanceFast=function(dt){
    this.time+=dt;this.buildGrid();var p=this._candidate;
    for(var i=0;i<this.count;i++){var a=this.actors[i];if(!a.visible)continue;this.currentActor=a;var currentLegal=false;if(a.followParent>=0){var parent=this.actors[a.followParent];if(parent.visible&&Math.hypot(a.position.x-parent.position.x,a.position.z-parent.position.z)>4.5){if(!a.followTargets)a.followTargets=[new T.Vector3(),new T.Vector3()];a.followTargets[0].copy(a.position);a.followTargets[1].set(parent.position.x+3.4*Math.cos(parent.yaw),parent.position.y,parent.position.z-3.4*Math.sin(parent.yaw));a.path.length=0;a.path.push(a.followTargets[0],a.followTargets[1]);a.pathIndex=1;a.loop=false;a.state='family';}}a.walking=false;a.gaitOverride=null;a.footReach=null;this.snapSupport(a,a.position);if(a.pause>0)a.pause-=dt;
      if(a.pause<=0&&a.path.length>1&&a.state!=='seated'){var target=a.path[a.pathIndex],dx=target.x-a.position.x,dy=target.y-a.position.y,dz=target.z-a.position.z,d=Math.hypot(dx,dy,dz);if(d<.15){a.pathIndex++;if(a.pathIndex>=a.path.length){if(a.loop)a.pathIndex=0;else{a.path.length=0;a.state='idle';}}}else{a.escalator=!!target.escalator&&Math.abs(dy)>.08;a.yaw=Math.atan2(dx,dz);var move=Math.min((a.escalator?3.2:a.speed)*dt,d);p.copy(a.position);p.x+=dx/d*move;p.y+=dy/d*move;p.z+=dz/d*move;this.snapSupport(a,p);if(this.candidateSupported(a,p)&&this.fastLegal(a,p)){a.position.copy(p);currentLegal=true;a.walking=!a.escalator;}else if(!a.escalator){for(var j=0;j<2;j++){var sign=(i%2?1:-1)*(j?-1:1);p.copy(a.position);p.x+=(dx/d*.25+dz/d*sign)*move;p.z+=(dz/d*.25-dx/d*sign)*move;this.snapSupport(a,p);if(this.candidateSupported(a,p)&&this.fastLegal(a,p)){a.position.copy(p);currentLegal=true;a.walking=true;break;}}}}}
      if(!currentLegal)currentLegal=this.fastLegal(a,a.position);if(!currentLegal){currentLegal=this.relocateFast(a);if(!currentLegal){a.walking=false;if(a.lastSafe){var failedYaw=a.yaw;a.yaw=a.lastSafeYaw;if(this.fastLegal(a,a.lastSafe)){a.position.copy(a.lastSafe);currentLegal=true;this.physicsStats.restoredLastSafe++;}else a.yaw=failedYaw;}}this.moveGrid(a);}else if(this.bucket(a.position)!==this.keys[i])this.moveGrid(a);this.fitFast(a);if(currentLegal){if(!a.lastSafe)a.lastSafe=new T.Vector3();a.lastSafe.copy(a.position);a.lastSafeYaw=a.yaw;}
    }this.dirty=false;
  };
  Crowd.prototype.enforcePlayerSpace=function(){var changed=false;for(var i=0;i<this.count;i++){var a=this.actors[i];if(!a.visible)continue;var p=a.position,dx=p.x-this.player.x,dz=p.z-this.player.z,blocked=Math.abs(p.y-this.player.y)<3.85&&dx*dx+dz*dz<(this.playerRadius+.15)*(this.playerRadius+.15);if(!blocked)for(var ri=0;ri<this.reservations.length;ri++){var q=this.reservations[ri];dx=p.x-q.p.x;dz=p.z-q.p.z;if(Math.abs(p.y-q.p.y)<3.85&&dx*dx+dz*dz<(q.r+.1)*(q.r+.1)){blocked=true;break;}}if(!blocked)continue;this.currentActor=a;if(this.relocateFast(a)){this.fitFast(a);this.moveGrid(a);changed=true;}}return changed;};
  Crowd.prototype.setLimit=function(n){this.dirty=true;this.limit=n;this.mask.fill(0);for(var i=0;i<n;i++)this.mask[this.order[i]]=1;for(i=0;i<this.count;i++)if(!this.mask[i])this.actors[i].visible=false;for(var p=0;p<this.parts.length;p++){var mesh=this.parts[p].mesh;mesh.count=n;for(i=0;i<n;i++){var from=this.order[i]*3,to=i*3;mesh.instanceColor.array[to]=this.baseColors[p][from];mesh.instanceColor.array[to+1]=this.baseColors[p][from+1];mesh.instanceColor.array[to+2]=this.baseColors[p][from+2];}mesh.instanceColor.needsUpdate=true;}};

  Crowd.prototype.stats = function () {var visible=0,walking=0,seated=0;for(var i=0;i<this.count;i++){var a=this.actors[i];if(a.visible&&a.renderVisible!==false&&(!this.mask||this.mask[i]))visible++;if(a.visible&&a.walking&&a.renderVisible!==false)walking++;if(a.visible&&a.state==='seated')seated++;}return {count:this.count,visible:visible,walking:walking,seated:seated,drawCalls:this.parts.length,physics:Object.assign({},this.physicsStats)};};
  Crowd.prototype.blocksInteraction=function(origin,target){
    var delta=new T.Vector3(target.x-origin.x,target.y-origin.y,target.z-origin.z),length=delta.length(),ray=new T.Ray(origin,delta.normalize()),bounds=new T.Box3(),hit=new T.Vector3();
    for(var i=0;i<this.count;i++){var a=this.actors[i];if(!a.visible||a.renderVisible===false)continue;for(var k=0;k<this.parts.length;k++){var part=this.parts[k],name=part.spec[0];if((name==='pack'&&!a.backpack)||((name==='phone'||name==='screen')&&a.pose!=='phone')||(name==='hairBack'&&a.id%4!==1))continue;if(!part.mesh.geometry.boundingBox)part.mesh.geometry.computeBoundingBox();bounds.copy(part.mesh.geometry.boundingBox).applyMatrix4(this.partMatrix(a,part.spec,a.position));if(ray.intersectBox(bounds,hit)&&hit.distanceTo(origin)<length-.1)return {id:a.id,part:name,position:a.position};}}
    return null;
  };
  Crowd.prototype.dispose = function () {if(this.group.parent)this.group.parent.remove(this.group);for(var i=0;i<this.geometries.length;i++)this.geometries[i].dispose();this.parts[0].mesh.material.dispose();};
  // A passenger accessory fallback while World adds short/long strap anchors.
  // World geometry is untouched; a fresh Train with strapSpots uses its own handles.
  function fitTrainStraps(train){
    var group=new T.Group();group.name='乘客可够到的加长吊带';train.group.add(group);
    var points=[],cars=train.cars||[],mat=new T.MeshLambertMaterial({color:0xf6f2e5});
    for(var i=0;i<cars.length;i++)for(var j=0;j<4;j++)for(var side=-1;side<=1;side+=2)points.push({car:i,x:cars[i].x+[-14,-6,4,12][j],y:5.65,z:side*2.3,yaw:side===1?0:Math.PI});
    var strings=new T.InstancedMesh(new T.BoxGeometry(.07,2.3,.055),mat,points.length),rings=new T.InstancedMesh(new T.TorusGeometry(.23,.052,5,12),mat,points.length),obj=new T.Object3D();
    for(i=0;i<points.length;i++){var p=points[i];obj.position.set(p.x,7.05,p.z);obj.rotation.set(0,0,0);obj.updateMatrix();strings.setMatrixAt(i,obj.matrix);obj.position.set(p.x,p.y,p.z);obj.rotation.y=Math.PI/2;obj.updateMatrix();rings.setMatrixAt(i,obj.matrix);}
    group.add(strings,rings);return points;
  }
  GZ.NPC={create:function(opts){return new Crowd(opts);},fitTrainStraps:fitTrainStraps};
})();
