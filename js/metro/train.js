/* Guangzhou Metro brick world — THREE r128, plain scripts, no runtime dependencies. */
(function () {
  'use strict';
  var GZ = window.GZ = window.GZ || {}, T = window.THREE;
  function merge(parts) {
    var count = 0, i, k, p;
    for (i = 0; i < parts.length; i++) count += parts[i].attributes.position.count;
    var g = new T.BufferGeometry(), specs = {position:3, normal:3, uv:2, color:3, worldMetal:1, worldGlow:1, worldUnlit:1};
    for (k in specs) {
      var a = new Float32Array(count * specs[k]), offset = 0;
      for (i = 0; i < parts.length; i++) {
        p = parts[i].attributes[k];
        if (p) a.set(p.array, offset);
        offset += parts[i].attributes.position.count * specs[k];
      }
      g.setAttribute(k, new T.BufferAttribute(a, specs[k]));
    }
    for (i = 0; i < parts.length; i++) parts[i].dispose();
    g.computeBoundingSphere(); return g;
  }
  // Static untextured colours share one shader submission. Dynamic colours,
  // texture labels and transparent surfaces retain their original materials.
  var paletteMaterials=Object.create(null);
  function paletteMaterial(mat,geo){
    if(mat.transparent||mat.map||mat.userData.worldDynamic||mat.userData.worldPalette||!mat.color||
       !(mat.isMeshLambertMaterial||mat.isMeshPhongMaterial||mat.isMeshBasicMaterial))return mat;
    var lit=true;
    // The world's untextured Phong surfaces are all the same steel finish.
    // Keep a per-vertex metal flag so matte brick colours share its draw without
    // inheriting steel highlights. Theme/lamp colours stay live and separate.
    if(mat.isMeshPhongMaterial&&mat.shininess!==85)return mat;
    var key=['surface',mat.side,mat.fog,mat.depthWrite,mat.depthTest,mat.blending,
      mat.toneMapped,mat.polygonOffset,mat.polygonOffsetFactor,mat.polygonOffsetUnits].join('|');
    var shared=paletteMaterials[key];if(!shared){
      shared=lit?new T.MeshPhongMaterial({color:0xffffff,emissive:0x000000,
        specular:new T.Color('#b9ced4').convertSRGBToLinear(),shininess:85,
        side:mat.side,fog:mat.fog,depthWrite:mat.depthWrite,depthTest:mat.depthTest,
        blending:mat.blending,toneMapped:mat.toneMapped,polygonOffset:mat.polygonOffset,
        polygonOffsetFactor:mat.polygonOffsetFactor,polygonOffsetUnits:mat.polygonOffsetUnits}):mat.clone();
      shared.color.setRGB(1,1,1);shared.vertexColors=true;shared.userData.worldPalette=true;
      if(lit){shared.customProgramCacheKey=function(){return 'world-palette-phong-v2';};shared.onBeforeCompile=function(shader){
        shader.vertexShader=shader.vertexShader.replace('#include <common>',
          '#include <common>\nattribute float worldMetal; attribute float worldGlow; attribute float worldUnlit; varying float vWorldMetal; varying float vWorldGlow; varying float vWorldUnlit;')
          .replace('#include <color_vertex>','#include <color_vertex>\nvWorldMetal=worldMetal; vWorldGlow=worldGlow; vWorldUnlit=worldUnlit;');
        shader.fragmentShader=shader.fragmentShader.replace('#include <common>',
          '#include <common>\nvarying float vWorldMetal; varying float vWorldGlow; varying float vWorldUnlit;')
          .replace('#include <lights_phong_fragment>','#include <lights_phong_fragment>\nmaterial.specularColor *= vWorldMetal; material.specularShininess=mix(1.0,85.0,vWorldMetal);')
          .replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\ntotalEmissiveRadiance=vColor*vWorldGlow;')
          .replace('gl_FragColor = vec4( outgoingLight, diffuseColor.a );','outgoingLight=mix(outgoingLight,diffuseColor.rgb,vWorldUnlit);\ngl_FragColor = vec4( outgoingLight, diffuseColor.a );');
      };}paletteMaterials[key]=shared;
    }
    var count=geo.attributes.position.count,colors=new Float32Array(count*3),metal=new Float32Array(count),glow=new Float32Array(count),unlit=new Float32Array(count),c=mat.color;
    var emission=mat.emissive&&mat.emissive.getHex()!==0?(mat.emissiveIntensity||0):0;
    for(var i=0;i<count;i++){colors[i*3]=c.r;colors[i*3+1]=c.g;colors[i*3+2]=c.b;metal[i]=mat.isMeshPhongMaterial?1:0;glow[i]=emission;unlit[i]=mat.isMeshBasicMaterial?1:0;}
    geo.setAttribute('color',new T.BufferAttribute(colors,3));geo.setAttribute('worldMetal',new T.BufferAttribute(metal,1));geo.setAttribute('worldGlow',new T.BufferAttribute(glow,1));geo.setAttribute('worldUnlit',new T.BufferAttribute(unlit,1));return shared;
  }
  function thinSurface(geo){
    // Sub-pixel painted strips retain both actual horizontal faces; their
    // hidden thin edges never provide enclosure or a walkable support plane.
    geo.computeBoundingBox();if(geo.boundingBox.max.y-geo.boundingBox.min.y>.075)return geo;
    var n=geo.attributes.normal;if(!n)return geo;var keep=[];
    for(var i=0;i<n.count;i+=3)if(Math.abs(n.getY(i))>.999)keep.push(i,i+1,i+2);
    if(!keep.length||keep.length===n.count)return geo;
    var out=new T.BufferGeometry();Object.keys(geo.attributes).forEach(function(k){
      var a=geo.attributes[k],v=new Float32Array(keep.length*a.itemSize);
      for(var j=0;j<keep.length;j++)for(var z=0;z<a.itemSize;z++)v[j*a.itemSize+z]=a.array[keep[j]*a.itemSize+z];
      out.setAttribute(k,new T.BufferAttribute(v,a.itemSize));
    });geo.dispose();return out;
  }
  function batchStatic(root){
    // Boundaries are semantic visibility/motion groups. Colliders keep their
    // original source groups and IDs; only static render submissions move.
    root.updateMatrixWorld(true);var buckets=[],removed=0;
    root.traverse(function(mesh){
      if(!mesh.isMesh||mesh.isInstancedMesh||mesh.userData.worldDynamic)return;
      var domain=root;for(var p=mesh.parent;p&&p!==root;p=p.parent)if(p.userData.worldBatchBoundary){domain=p;break;}
      var bucket=null;for(var i=0;i<buckets.length;i++)if(buckets[i].root===domain&&buckets[i].mat===mesh.material)bucket=buckets[i];
      if(!bucket){bucket={root:domain,mat:mesh.material,meshes:[]};buckets.push(bucket);}bucket.meshes.push(mesh);
    });
    buckets.forEach(function(b){if(b.meshes.length<2)return;var inv=new T.Matrix4().copy(b.root.matrixWorld).invert(),m=new T.Matrix4(),parts=[];
      b.meshes.forEach(function(mesh){m.multiplyMatrices(inv,mesh.matrixWorld);parts.push(mesh.geometry.clone().applyMatrix4(m));mesh.parent.remove(mesh);mesh.geometry.dispose();removed++;});
      var mesh=new T.Mesh(merge(parts),b.mat);mesh.name='同材质静态合批';b.root.add(mesh);
    });return{sourceMeshes:removed,mergedMeshes:buckets.filter(function(b){return b.meshes.length>1;}).length};
  }
  function material(color, options) {
    var col=new T.Color(color).convertSRGBToLinear();
    return new T.MeshLambertMaterial(Object.assign({color:col, emissive:col.clone(), emissiveIntensity:0.025}, options || {}));
  }
  function Builder(group) {this.group=group; this.buckets=[];this.kind=null;this.owner=null;}
  function colliderSink(group){for(var p=group;p;p=p.parent)if(p.userData.colliderSink)return{root:p,list:p.userData.colliderSink};return null;}
  function recordCollider(builder,geo,type){
    var sink=colliderSink(builder.group);if(!sink||!/Box|Cylinder|Torus/.test(type))return;
    geo.computeBoundingBox();var box=geo.boundingBox.clone();if(builder.collisionOnly&&builder.slope){var slopePad=(box.max.x-box.min.x)*Math.abs(builder.slope)/2;box.min.y-=slopePad;box.max.y+=slopePad;}var size=new T.Vector3();box.getSize(size);var cy=(box.min.y+box.max.y)/2;
    if(size.y<.1&&size.x<1&&size.z<1)return; // stud caps and painted surface markings
    var kind=builder.kind||'obstacle';if(!builder.kind&&size.x>1&&size.z>1){
      if([2,14,28].some(function(y){return Math.abs(box.max.y-y)<.35;}))kind='floor';
      else if(cy>8&&size.y<.8)kind='ceiling';
    }
    var c={id:'solid-'+sink.list.length,kind:kind,supportId:builder.supportId||null,owner:builder.owner||builder.group.name||'积木实体',min:{x:0,y:0,z:0},max:{x:0,y:0,z:0},_box:box,_group:builder.group,_root:sink.root};
    c.enabled=true;['_box','_group','_root'].forEach(function(key){Object.defineProperty(c,key,{enumerable:false,value:c[key]});});
    sink.list.push(c);
  }
  function refreshColliderFlags(list){for(var i=0;i<list.length;i++){var c=list[i],enabled=true;for(var p=c._group;p&&p!==c._root;p=p.parent)if(!p.visible){enabled=false;break;}c.enabled=enabled;}}
  function refreshColliders(root,list){refreshColliderFlags(list);root.updateWorldMatrix(true,false);
    var inv=new T.Matrix4().copy(root.matrixWorld).invert(),box=new T.Box3(),groups=[],transforms=[];
    for(var i=0;i<list.length;i++){var c=list[i],gi=groups.indexOf(c._group),matrix;
      if(gi<0){c._group.updateWorldMatrix(true,false);gi=groups.length;groups.push(c._group);transforms.push(new T.Matrix4().multiplyMatrices(inv,c._group.matrixWorld));}
      matrix=transforms[gi];var e=matrix.elements;
      if(Math.abs(e[0]-1)+Math.abs(e[5]-1)+Math.abs(e[10]-1)+Math.abs(e[1])+Math.abs(e[2])+Math.abs(e[4])+Math.abs(e[6])+Math.abs(e[8])+Math.abs(e[9])<1e-10){
        c.min.x=c._box.min.x+e[12];c.min.y=c._box.min.y+e[13];c.min.z=c._box.min.z+e[14];
        c.max.x=c._box.max.x+e[12];c.max.y=c._box.max.y+e[13];c.max.z=c._box.max.z+e[14];
      }else{box.copy(c._box).applyMatrix4(matrix);Object.assign(c.min,box.min);Object.assign(c.max,box.max);}
    }
  }
  Builder.prototype.add = function (geo, mat, x,y,z, ry, rz) {
    var shapeType=geo.type;geo = geo.index ? geo.toNonIndexed() : geo;
    if (ry) geo.rotateY(ry); if (rz) geo.rotateZ(rz);
    geo.translate(x||0,y||0,z||0);recordCollider(this,geo,shapeType);if(this.collisionOnly){geo.dispose();return;}
    if(shapeType==='BoxGeometry')geo=thinSurface(geo);
    if(mat.userData.worldTile){var a=geo.attributes.position,n=geo.attributes.normal,uv=geo.attributes.uv,scale=mat.userData.worldTile;for(var u=0;u<a.count;u++){if(Math.abs(n.getY(u))>.5)uv.setXY(u,a.getX(u)/scale,a.getZ(u)/scale);else if(Math.abs(n.getZ(u))>.5)uv.setXY(u,a.getX(u)/scale,a.getY(u)/scale);else uv.setXY(u,a.getZ(u)/scale,a.getY(u)/scale);}}
    mat=paletteMaterial(mat,geo);
    var b, i; for(i=0;i<this.buckets.length;i++) if(this.buckets[i].mat===mat) b=this.buckets[i];
    if(!b) {b={mat:mat,parts:[]};this.buckets.push(b);} b.parts.push(geo);
  };
  Builder.prototype.box = function(mat,w,h,d,x,y,z,ry,rz) {this.add(new T.BoxGeometry(w,h,d),mat,x,y,z,ry,rz);};
  Builder.prototype.cyl = function(mat,r,h,x,y,z,rz) {this.add(new T.CylinderGeometry(r,r,h,6),mat,x,y,z,0,rz);};
  Builder.prototype.finish = function() {
    for(var i=0;i<this.buckets.length;i++) {var b=this.buckets[i];this.group.add(new T.Mesh(merge(b.parts),b.mat));}
    this.buckets.length=0;
  };
  function tile(mat,scale,rubber){
    var c=document.createElement('canvas');c.width=c.height=256;var ctx=c.getContext('2d');ctx.fillStyle=rubber?'#bbc2c2':'#e4e2d9';ctx.fillRect(0,0,256,256);
    for(var i=0;i<700;i++){var x=(i*73)%256,y=(i*97)%256;ctx.fillStyle=i%2?'#b7b9b4':'#f0eee5';ctx.fillRect(x,y,1,1);}
    if(!rubber){ctx.strokeStyle='#a7b0ad';ctx.lineWidth=2;ctx.strokeRect(0,0,256,256);ctx.strokeStyle='#f1f0e9';ctx.lineWidth=2;ctx.strokeRect(3,3,250,250);}
    var tex=new T.CanvasTexture(c);tex.encoding=T.sRGBEncoding;tex.wrapS=tex.wrapT=T.RepeatWrapping;tex.anisotropy=2;mat.map=tex;mat.userData.worldTile=scale;return mat;
  }
  function canvasMaterial(w,h) {
    var canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
    var tex=new T.CanvasTexture(canvas);tex.encoding=T.sRGBEncoding;tex.anisotropy=2;
    return {canvas:canvas, ctx:canvas.getContext('2d'), texture:tex,
      material:new T.MeshBasicMaterial({map:tex,side:T.FrontSide})};
  }
  // Immutable default panels are painted once during build. A material keeps
  // its identity and merely selects a preuploaded texture at a state change.
  function PanelCache(seed,paint,name) {
    var entries=Object.create(null),fallbacks=Object.create(null),first=true,w=seed.canvas.width,h=seed.canvas.height;
    var cache={name:name,paints:0,fallbackPaints:0,selections:0};
    function fresh(){var p=canvasMaterial(w,h);p.material.dispose();return p;}
    cache.add=function(key,data){key=String(key);if(entries[key])return entries[key];var p=first?seed:fresh();first=false;paint(p.ctx,data);p.texture.needsUpdate=true;(p.texture.userData||(p.texture.userData={})).worldPanelKey=name+':'+key;entries[key]=p;cache.paints++;return p;};
    cache.select=function(material,key,data){key=String(key);var p=entries[key];if(!p){var f=fallbacks[material.id];if(!f){f=fallbacks[material.id]={panel:fresh(),key:null};}p=f.panel;if(f.key!==key){paint(p.ctx,data);p.texture.needsUpdate=true;(p.texture.userData||(p.texture.userData={})).worldPanelKey=name+':custom:'+key;f.key=key;cache.fallbackPaints++;}}if(material.map!==p.texture){material.map=p.texture;cache.selections++;}return p.texture;};
    cache.textures=function(){var a=[];Object.keys(entries).forEach(function(k){a.push(entries[k].texture);});Object.keys(fallbacks).forEach(function(k){a.push(fallbacks[k].panel.texture);});return a;};
    cache.stats=function(){return{name:name,width:w,height:h,defaultCount:Object.keys(entries).length,fallbackCount:Object.keys(fallbacks).length,paints:cache.paints,fallbackPaints:cache.fallbackPaints,selections:cache.selections};};
    return cache;
  }
  function panelTextures(caches){var a=[];caches.forEach(function(c){c.textures().forEach(function(t){if(a.indexOf(t)<0)a.push(t);});});return a;}
  function panelStats(caches){var tex=panelTextures(caches),bytes=0,mips=0;tex.forEach(function(t){var w=t.image.width,h=t.image.height;bytes+=w*h*4;var mw=w,mh=h;do{mips+=mw*mh*4;mw=Math.max(1,mw>>1);mh=Math.max(1,mh>>1);}while(mw>1||mh>1);if(w>1||h>1)mips+=4;});return{textureCount:tex.length,canvasCount:tex.length,rgbaBytes:bytes,mipmapRGBABytes:mips,canvasRGBAEstimateBytes:bytes,caches:caches.map(function(c){return c.stats();})};}
  function prewarmPanels(caches,renderer){var before=performance.now(),textures=panelTextures(caches);textures.forEach(function(t){renderer.initTexture(t);});return{textureCount:textures.length,milliseconds:performance.now()-before};}
  function panel(builder,mat,w,h,x,y,z,ry) {
    // Two front faces with independent orientations: text stays upright on either side.
    ry=ry||0;var nx=Math.sin(ry)*.012,nz=Math.cos(ry)*.012;
    builder.add(new T.PlaneGeometry(w,h),mat,x+nx,y,z+nz,ry);
    builder.add(new T.PlaneGeometry(w,h),mat,x-nx,y,z-nz,ry+Math.PI);
  }
  function metal(color){return new T.MeshPhongMaterial({color:new T.Color(color).convertSRGBToLinear(),specular:new T.Color('#b9ced4').convertSRGBToLinear(),shininess:85});}
  function instance(group,geo,mat,positions) {
    var mesh=new T.InstancedMesh(geo,mat,positions.length), o=new T.Object3D();
    for(var i=0;i<positions.length;i++) {var p=positions[i];o.position.set(p[0],p[1],p[2]);o.rotation.set(p[3]||0,p[4]||0,p[5]||0);o.updateMatrix();mesh.setMatrixAt(i,o.matrix);}
    group.add(mesh);var sink=colliderSink(group);if(sink){for(var ci=0;ci<positions.length;ci++){var cp=positions[ci],cg=geo.clone();if(cp[3])cg.rotateX(cp[3]);if(cp[4])cg.rotateY(cp[4]);if(cp[5])cg.rotateZ(cp[5]);cg.translate(cp[0],cp[1],cp[2]);recordCollider({group:group},cg,geo.type);cg.dispose();}}return mesh;
  }
  function dispose(group, extraTextures) {
    var gs=[], ms=[], ts=[];
    group.traverse(function(o){if(!o.isMesh)return;if(gs.indexOf(o.geometry)<0)gs.push(o.geometry);
      var mats=Array.isArray(o.material)?o.material:[o.material];mats.forEach(function(m){if(ms.indexOf(m)<0)ms.push(m);if(m.map&&ts.indexOf(m.map)<0)ts.push(m.map);});});
    (extraTextures||[]).forEach(function(t){if(ts.indexOf(t)<0)ts.push(t);});
    gs.forEach(function(g){g.dispose();});ms.forEach(function(m){m.dispose();});ts.forEach(function(t){t.dispose();});
  }
  GZ.WorldInternals={Builder:Builder,material:material,canvasMaterial:canvasMaterial,panel:panel,instance:instance,dispose:dispose,merge:merge,tile:tile,metal:metal,refreshColliders:refreshColliders,recordCollider:recordCollider,refreshColliderFlags:refreshColliderFlags,batchStatic:batchStatic,PanelCache:PanelCache,panelTextures:panelTextures,panelStats:panelStats,prewarmPanels:prewarmPanels};

  GZ.Train={VERSION:'world-round3-14',DOOR_DURATION:1.25,create:function(opts) {
    opts=opts||{};
    var config=GZ.config, group=new T.Group(), body=new T.Group();group.name='广州地铁1号线 · 六节积木列车';group.add(body);
    var glow=canvasMaterial(128,128),gc=glow.ctx,gr=gc.createRadialGradient(64,64,3,64,64,64);gr.addColorStop(0,'rgba(255,249,214,.9)');gr.addColorStop(.2,'rgba(255,235,176,.45)');gr.addColorStop(1,'rgba(255,221,128,0)');gc.fillStyle=gr;gc.fillRect(0,0,128,128);glow.texture.needsUpdate=true;glow.material.transparent=true;glow.material.depthWrite=false;glow.material.blending=T.AdditiveBlending;glow.material.toneMapped=false;glow.material.fog=false;
    var m={yellow:material(config.TRAIN.bodyColor),red:material(config.TRAIN.stripeColor),
      steel:metal('#82959e'),floor:tile(material('#8a9998'),4,true),white:material('#dfdfd4'),dark:material('#333b43'),black:material('#1c252d'),
      glass:material('#9ab5bf',{transparent:true,opacity:.09,depthWrite:false,side:T.DoubleSide}),
      lamp:new T.MeshBasicMaterial({color:'#fff5da'}),green:new T.MeshBasicMaterial({color:'#54d089'})};
    m.lamp.userData.worldDynamic=true;
    var colliders=[];group.userData.colliderSink=colliders;body.name='列车固定车体';var b=new Builder(body), doors=[],cars=[],seats=[],stands=[],bounds=[],wheelPositions=[],studs=[],rings=[],strapSpots=[],headlights=[],lightsOn=true,activeHeadDir=1;
    var decal=canvasMaterial(512,256),dc=decal.ctx;dc.fillStyle='#faf3cf';dc.fillRect(0,0,512,256);dc.strokeStyle='#be2831';dc.lineWidth=12;dc.strokeRect(6,6,500,244);dc.fillStyle='#b31f2c';dc.font='bold 48px sans-serif';dc.textAlign='center';dc.fillText('⚠ 小心夹手',256,78);dc.fillText('请勿倚靠',256,143);dc.font='25px sans-serif';dc.fillStyle='#25343c';dc.fillText('CAUTION • KEEP CLEAR',256,216);decal.texture.needsUpdate=true;
    var notice=canvasMaterial(512,256),nc=notice.ctx;nc.fillStyle='#f3f0df';nc.fillRect(0,0,512,256);nc.fillStyle='#156573';nc.textAlign='center';nc.font='bold 48px sans-serif';nc.fillText('爱心专座  ♥',256,75);nc.font='30px sans-serif';nc.fillText('请为有需要的乘客让座',256,133);nc.fillText('文明乘车 · 广州地铁',256,208);notice.texture.needsUpdate=true;
    var leaves=[], i,j,s,cx, offsets=[-14.4,-7.2,0,7.2,14.4], route=canvasMaterial(1024,256),cab=canvasMaterial(512,128);
    var logo=canvasMaterial(256,320),L=logo.ctx;logo.material.transparent=true;L.strokeStyle=config.TRAIN.stripeColor;L.lineWidth=30;L.beginPath();L.moveTo(52,40);L.bezierCurveTo(52,155,105,150,105,280);L.moveTo(204,40);L.bezierCurveTo(204,155,151,150,151,280);L.stroke();logo.texture.needsUpdate=true;
    var C=cab.ctx;C.fillStyle='#151d23';C.fillRect(0,0,512,128);C.fillStyle='#ffce45';C.font='bold 68px sans-serif';C.textAlign='center';C.fillText('广州东站',256,88);cab.texture.needsUpdate=true;
    for(s=-1;s<=1;s+=2) for(j=-1;j<=1;j+=2) {var lg=new T.Group();lg.name='列车滑门';lg.userData.worldBatchBoundary=true;body.add(lg);leaves.push({side:s,sign:j,group:lg,b:new Builder(lg)});leaves[leaves.length-1].b.kind="door";}
    for(i=0;i<6;i++) {
      cx=(i-2.5)*41;cars.push({index:i,x:cx,minX:cx-20,maxX:cx+20});
      bounds.push({minX:cx-19.5+(i===0?3.5:0),maxX:cx+19.5-(i===5?3.5:0),minZ:-2.7,maxZ:2.7,floorY:2});
      b.box(m.dark,40,.65,10,cx,1.62,0); b.box(m.floor,39.6,.14,9,cx,1.93,0);
      b.box(m.yellow,40,.6,10,cx,9.6,0);b.box(m.white,39.2,.15,8.9,cx,9.275,0);
      [-11.6,11.6].forEach(function(dx){b.box(m.dark,5.8,.6,6.8,cx+dx,.85,0);});
      for(j=0;j<4;j++) {var wx=cx+(j<2?-11.6:11.6)+(j%2?1.7:-1.7);wheelPositions.push([wx,.75,-3.8,Math.PI/2,0,0],[wx,.75,3.8,Math.PI/2,0,0]);}
      b.box(m.dark,13,.65,6.8,cx,.8,0);
      for(j=-18;j<=18;j+=3) for(var zz=-4;zz<=4;zz+=4)studs.push([cx+j,9.96,zz]);
      [-13,13].forEach(function(dx){b.box(m.yellow,5.6,.7,6,cx+dx,10.1,0);b.box(m.dark,4.3,.12,4,cx+dx,10.51,0);});
      if(i===1||i===4) {
        b.box(m.dark,3.5,.2,3,cx+4,10,0);
        b.box(m.red,3.2,.14,.22,cx+4,10.35,-1,0,.55);b.box(m.red,3.2,.14,.22,cx+4,10.35,1,0,.55);
        b.box(m.red,3.2,.14,.22,cx+4,10.8,-1,0,-.55);b.box(m.red,3.2,.14,.22,cx+4,10.8,1,0,-.55);
        b.box(m.dark,.3,.18,3.6,cx+2.65,11.4,0);
      }
      for(s=-1;s<=1;s+=2) {
        var prev=-20;
        for(j=0;j<=offsets.length;j++) {
          var right=j<offsets.length?offsets[j]-1.6:20, width=right-prev, mid=(right+prev)/2;
          if(width>0) {
            b.box(m.yellow,width,1.8,.55,cx+mid,2.95,s*4.72);
            b.box(m.red,width,.38,.59,cx+mid,3.35,s*4.74);
            b.box(m.white,width,1.8,.12,cx+mid,2.94,s*4.46);
            b.box(m.yellow,.35,4.8,.55,cx+prev+.18,6.12,s*4.72);b.box(m.yellow,.35,4.8,.55,cx+right-.18,6.12,s*4.72);
            if(width>.8)b.box(m.glass,width-.7,4.25,.08,cx+mid,5.975,s*4.73);b.box(m.yellow,width,1.1,.55,cx+mid,8.65,s*4.72);b.box(m.white,width,1.1,.12,cx+mid,8.65,s*4.46);
            if(j>0&&j<offsets.length) {
              b.box(m.steel,width-.5,.18,1.25,cx+mid,2.96,s*3.68);
              b.box(m.steel,width-.5,1.2,.12,cx+mid,3.54,s*4.17);
              b.box(m.white,width-.7,.12,1.05,cx+mid,3.075,s*3.68);
              b.box(m.steel,width-.5,.06,.08,cx+mid,4.16,s*4.09);
              if(j===1)panel(b,notice.material,2.6,1.15,cx+mid,8.56,s*4.37,s===1?Math.PI:0);
              b.box(m.steel,width-.75,.7,.15,cx+mid,2.55,s*3.9);
              for(var sx=prev+.7;sx<right-.4;sx+=1.25) {
                var seat={car:i,x:cx+sx,y:2.95,z:s*3.63,yaw:s===1?Math.PI:0};seat.position={x:seat.x,y:seat.y,z:seat.z};seats.push(seat);
                b.box(m.dark,.025,.02,1.13,seat.x,3.06,s*3.65);
              }
            }
          }
          if(j<offsets.length) {
            var dx=cx+offsets[j];doors.push({car:i,side:s,x:dx,y:2,z:s*5,width:3.2});
            b.box(m.yellow,3.2,.78,.55,dx,8.81,s*4.72);
            b.box(m.dark,3.25,.16,.6,dx,2.04,s*4.72);
            b.box(m.steel,.09,6.65,.62,dx-1.62,5.4,s*4.72);b.box(m.steel,.09,6.65,.62,dx+1.62,5.4,s*4.72);
            b.box(m.black,3.24,.84,.16,dx,8.63,s*4.41);
            panel(b,route.material,3.12,.78,dx,8.63,s*4.305,s===1?Math.PI:0);
            b.box(m.green,.17,.07,.06,dx+1.44,9.06,s*4.29);
            for(var li=0;li<leaves.length;li++)if(leaves[li].side===s){var leaf=leaves[li],lx=dx+leaf.sign*.79,lb=leaf.b;
              lb.box(m.yellow,1.57,1.55,.17,lx,2.84,s*4.86);lb.box(m.red,1.57,.38,.19,lx,3.35,s*4.87);
              lb.box(m.white,1.57,1.55,.08,lx,2.84,s*4.74);lb.box(m.glass,1.4,4.8,.1,lx,5.9,s*4.86);
              lb.box(m.steel,.1,6.55,.18,lx+leaf.sign*.73,5.32,s*4.86);lb.box(m.yellow,1.57,.4,.18,lx,8.38,s*4.86);
              lb.box(m.dark,.2,.18,.2,lx-leaf.sign*.4,4.2,s*4.66);
              panel(lb,decal.material,.62,.31,lx,5.13,s*4.69,s===1?Math.PI:0);
              lb.box(m.steel,1.55,.07,.08,lx,8.15,s*4.71);
            }
            prev=offsets[j]+1.6;
          }
        }
        b.cyl(m.steel,.09,37,cx,8.3,s*2.3,Math.PI/2);
        for(j=-16;j<=16;j+=2) {
          var longStrap=j===-14||j===-6||j===4||j===12,ringY=longStrap?2+2.55-Math.cos(-2.8)*1.18:7.55;
          if(longStrap){var strapTop=ringY+.23,strapLen=8.28-strapTop;b.box(m.white,.075,strapLen,.055,cx+j,(8.28+strapTop)/2,s*2.3);var angle=s===1?0:Math.PI,hx=-.79,hz=-Math.sin(-2.8)*1.18;
            strapSpots.push({car:i,x:cx+j,y:ringY,z:s*2.3,yaw:angle,stand:{x:cx+j-hx*Math.cos(angle)-hz*Math.sin(angle),y:2,z:s*2.3-hz*Math.cos(angle)+hx*Math.sin(angle)}});
          }else b.cyl(m.steel,.035,.58,cx+j,7.96,s*2.3);
          rings.push([cx+j,ringY,s*2.3,0,Math.PI/2,0]);
        }
        b.box(m.dark,37,.09,.72,cx,9.18,s*2.3);b.box(m.lamp,36,.055,.55,cx,9.115,s*2.3);
        for(j=-18;j<=18;j+=1.1)b.box(m.dark,.32,.035,.68,cx+j,9.178,s*3.55);
        b.box(m.steel,38,.06,.07,cx,9.15,s*4.05);
      }
      for(j=0;j<offsets.length;j++){b.cyl(m.steel,.085,6.15,cx+offsets[j]+2.12,5.1,0);
        var sp={car:i,x:cx+offsets[j],y:2,z:0,yaw:Math.PI/2};sp.position={x:sp.x,y:sp.y,z:sp.z};stands.push(sp);}
      if(i<5){
        for(var fold=0;fold<5;fold++){var fx=cx+20.12+fold*.19;b.box(m.steel,.055,.04,7.5,fx,2.055,0);for(var fs=-1;fs<=1;fs+=2){b.box(m.black,.095,6.9,.32,fx,5.55,fs*4.17);b.box(m.steel,.045,6.85,.04,fx,5.55,fs*3.98);}b.box(m.dark,.095,.18,8.15,fx,9.13,0);}
        b.box(m.white,1.25,.2,7.6,cx+20.5,1.93,0);b.box(m.dark,1.05,7.25,.45,cx+20.5,5.55,-4.3);b.box(m.dark,1.05,7.25,.45,cx+20.5,5.55,4.3);b.box(m.dark,1.05,.28,8.7,cx+20.5,9.05,0);}
      if(i===0||i===5) {
        var end=i===0?-1:1, ex=cx+end*19.7;
        b.box(m.yellow,.55,2,10,ex,2.98,0);b.box(m.red,.58,.4,9.8,ex,3.4,0);
        b.box(m.yellow,.55,1.1,10,ex,8.94,0);b.box(m.yellow,.55,4.8,1.8,ex,6,0);
        b.box(m.glass,.14,4.8,3.6,ex+end*.25,6,-2.9);b.box(m.glass,.14,4.8,3.6,ex+end*.25,6,2.9);
        b.box(m.white,.18,7.1,8.8,cx+end*16.6,5.5,0);
        b.box(m.steel,.24,6.1,2.1,cx+end*16.4,5.07,0);b.box(m.dark,.26,2.8,1.5,cx+end*16.25,6,0);
        b.cyl(m.red,.27,1.1,cx+end*16.22,2.58,-3.2);b.box(m.steel,.16,.15,.36,cx+end*16.22,3.2,-3.2);
        b.box(m.dark,.6,1.2,6,ex-end*.8,3.75,0);
        var headLampMaterial=new T.MeshBasicMaterial({color:'#fff1cf',toneMapped:false});headLampMaterial.userData.worldDynamic=true;b.box(headLampMaterial,.1,.56,1.35,ex+end*.33,3.85,-3.55);b.box(headLampMaterial,.1,.56,1.35,ex+end*.33,3.85,3.55);
        var hg=new T.Group();hg.name='车头灯 '+end;hg.userData.worldBatchBoundary=true;body.add(hg);var spot=new T.SpotLight('#ffe9bb',3.5,115,.24,.65,1);spot.position.set(ex+end*.7,3.85,0);spot.target.position.set(ex+end*75,-.1,0);hg.add(spot,spot.target);var hgb=new Builder(hg);panel(hgb,glow.material,4.1,2.6,ex+end*.8,3.85,-3.55,end*Math.PI/2);panel(hgb,glow.material,4.1,2.6,ex+end*.8,3.85,3.55,end*Math.PI/2);hgb.finish();
        var bg=new T.BufferGeometry();bg.setAttribute('position',new T.Float32BufferAttribute([ex+end*.7,.09,-3.8,ex+end*.7,.09,3.8,ex+end*83,.09,-7,ex+end*.7,.09,3.8,ex+end*83,.09,7,ex+end*83,.09,-7],3));
        bg.setAttribute('color',new T.Float32BufferAttribute([.38,.3,.15,.38,.3,.15,0,0,0,.38,.3,.15,0,0,0,0,0,0],3));
        var bm=new T.MeshBasicMaterial({vertexColors:true,transparent:true,opacity:.5,depthWrite:false,side:T.DoubleSide,blending:T.AdditiveBlending});hg.add(new T.Mesh(bg,bm));headlights.push({dir:end,group:hg,light:spot,lampMaterial:headLampMaterial});
        panel(b,cab.material,5,.92,ex+end*.34,8.9,0,end*Math.PI/2);panel(b,logo.material,1.25,1.58,ex+end*.34,6,0,end*Math.PI/2);
      }
    }
    b.finish();leaves.forEach(function(l){l.b.finish();delete l.b;});
    var wheels=instance(body,new T.CylinderGeometry(.73,.73,.42,12).rotateX(Math.PI/2),m.black,wheelPositions.map(function(p){return[p[0],p[1],p[2]];}));
    var wheelRims=instance(body,new T.BoxGeometry(1.12,.16,.45),m.steel,wheelPositions.map(function(p){return[p[0],p[1],p[2]];}));
    instance(body,new T.CylinderGeometry(.28,.28,.16,6),m.yellow,studs);
    instance(body,new T.TorusGeometry(.23,.052,3,6),m.white,rings);
    wheelRims.instanceMatrix.setUsage(T.DynamicDrawUsage);
    var renderBatch=batchStatic(group);
    var doorColliders=colliders.filter(function(c){return c.kind==='door';}),doorOpen=[0,0];
    var wm=new T.Object3D(), time=0, wheelAngle=0, lastRoute='';
    var headPositions=[{x:-122.85,y:3.85,z:0},{x:122.85,y:3.85,z:0}];
    function routeKey(stations,idx,next,dir){return stations.map(function(s){return s.name;}).join('|')+'|'+idx+','+next+','+dir;}
    var routeCache=new PanelCache(route,function(ctx,r){var stations=r.stations,idx=r.idx,next=r.next,dir=r.dir;
        ctx.fillStyle='#17242c';ctx.fillRect(0,0,1024,256);ctx.textAlign='center';ctx.textBaseline='middle';
        ctx.fillStyle='#f3d03e';ctx.font='bold 31px sans-serif';ctx.fillText('1号线   '+(dir===1?'广州东站方向 →':'← 西塱方向'),512,30);
        ctx.strokeStyle='#e5c747';ctx.lineWidth=12;ctx.beginPath();ctx.moveTo(92,108);ctx.lineTo(932,108);ctx.stroke();
        for(var n=0;n<stations.length;n++) {var x=120+n*784/Math.max(1,stations.length-1);ctx.fillStyle=n===idx?'#ff594a':n===next?'#65f0a2':'#f0d04b';ctx.beginPath();ctx.arc(x,108,n===idx?19:13,0,Math.PI*2);ctx.fill();ctx.font='bold 38px sans-serif';ctx.fillStyle='#f8fbfc';ctx.fillText(stations[n].name,x,166,234);}
        ctx.fillStyle='#6cf0a6';ctx.font='bold 35px sans-serif';ctx.fillText((idx===next?'本站：':'下一站：')+(stations[next]?stations[next].name:''),512,227);
    },'train-route'),cabCache=new PanelCache(cab,function(cc,d){cc.fillStyle='#151d23';cc.fillRect(0,0,512,128);cc.fillStyle='#ffce45';cc.font='bold 68px sans-serif';cc.textAlign='center';cc.fillText(d===1?'广州东站':'西塱',256,88);},'train-cab');
    for(var ri=0;ri<config.STATIONS.length;ri++)[-1,1].forEach(function(d){var ni=Math.max(0,Math.min(config.STATIONS.length-1,ri+d)),data={stations:config.STATIONS,idx:ri,next:ni,dir:d};routeCache.add(routeKey(data.stations,ri,ni,d),data);});
    cabCache.add('1',1);cabCache.add('-1',-1);var panelCaches=[routeCache,cabCache];
    var result={renderBatch:renderBatch,bodyBounds:new T.Box3(new T.Vector3(-122.8,-.2,-5.035),new T.Vector3(122.8,11.85,5.035)),colliders:colliders,group:group,length:245,floorY:2,doorDuration:1.25,headlights:headlights,getHeadPosition:function(d){return headPositions[d===-1?0:1];},cars:cars,doors:doors,seats:seats,standSpots:stands,strapSpots:strapSpots,
      walkBounds:{minX:-119,maxX:119,minZ:-2.7,maxZ:2.7,floorY:2,cars:bounds},
      setDoors:function(side,a){a=Math.max(0,Math.min(1,Number(a)||0));var changed=false;for(var k=0;k<leaves.length;k++){var l=leaves[k],di=l.side===-1?0:1;if((side===0||side===l.side)&&doorOpen[di]!==a){l.group.position.x=l.sign*1.63*a;changed=true;}}if(!changed)return;if(side===0||side===-1)doorOpen[0]=a;if(side===0||side===1)doorOpen[1]=a;refreshColliders(group,doorColliders);},
      getPanelTextures:function(){return panelTextures(panelCaches);},getPanelStats:function(){return panelStats(panelCaches);},prewarmTextures:function(renderer){return prewarmPanels(panelCaches,renderer);},
      setRoute:function(r){
        r=r||{};var stations=r.stations||config.STATIONS,idx=r.currentIdx||0,next=r.nextIdx==null?idx:r.nextIdx,dir=r.dir===-1?-1:1;idx=Math.max(0,Math.min(stations.length-1,idx));next=Math.max(0,Math.min(stations.length-1,next));
        result.setHeadlights(dir,lightsOn);var key=routeKey(stations,idx,next,dir);if(key===lastRoute)return;lastRoute=key;
        routeCache.select(route.material,key,{stations:stations,idx:idx,next:next,dir:dir});cabCache.select(cab.material,String(dir),dir);
      },
      setHeadlights:function(dir,on){activeHeadDir=dir===-1?-1:1;for(var h=0;h<headlights.length;h++){var head=headlights[h];head.group.visible=on!==false&&head.dir===activeHeadDir;head.lampMaterial.color.set(on===false?'#39414b':head.dir===activeHeadDir?'#fff1cf':'#cb2331');}},
      setLights:function(on){lightsOn=!!on;result.setHeadlights(activeHeadDir,lightsOn);m.lamp.color.set(on?'#fff5da':'#46535b');for(var h=0;h<headlights.length;h++)headlights[h].light.intensity=on?3.5:0;},
      update:function(dt,speed){dt=Math.min(.1,Math.max(0,dt||0));speed=Math.max(0,Math.min(1,speed||0));time+=dt;wheelAngle-=dt*speed*55;
        body.position.y=0;body.rotation.x=0;
        if(speed>0) {for(var n=0;n<wheelPositions.length;n++){var p=wheelPositions[n];wm.position.set(p[0],p[1],p[2]);wm.rotation.set(0,0,wheelAngle);wm.updateMatrix();wheelRims.setMatrixAt(n,wm.matrix);}wheelRims.instanceMatrix.needsUpdate=true;}
      },dispose:function(){dispose(group,panelTextures(panelCaches));}};
    refreshColliders(group,colliders);var envelope=new T.Box3();colliders.forEach(function(c){envelope.expandByPoint(new T.Vector3(c.min.x,c.min.y,c.min.z));envelope.expandByPoint(new T.Vector3(c.max.x,c.max.y,c.max.z));});result.bodyBounds.copy(envelope);var trainFloors=colliders.filter(function(c){return c.kind==='floor'&&c.max.y<2.3;});result.sampleGround=function(x,z,expectedY){expectedY=expectedY==null?2:expectedY;var best=null;for(var i=0;i<trainFloors.length;i++){var c=trainFloors[i];if(c.enabled&&x>=c.min.x&&x<=c.max.x&&z>=c.min.z&&z<=c.max.z&&Math.abs(c.max.y-expectedY)<.85&&(!best||c.max.y>best.y))best={y:c.max.y,normal:{x:0,y:1,z:0},id:c.id,kind:'floor'};}return best;};
    result.setRoute({stations:config.STATIONS,currentIdx:0,nextIdx:1,dir:1});return result;
  }};
})();
