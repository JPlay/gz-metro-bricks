/* Local Guangzhou Metro audio. No credentials or network synthesis at runtime. */
(function () {
  'use strict';
  var GZ = (window.GZ = window.GZ || {}), script = document.currentScript;
  var root = new URL('../../assets/audio/', script ? script.src : new URL('js/metro/audio.js', document.baseURI)).href;
  var ctx, master, analyser, buses, trainFilter, paInput, manifest, loading, paNodes = [];
  var loaded = false, everUnlocked = false, needsGesture = true, muted = false, volume = .85, zone = 'none';
  var background = document.hidden, lastContextState, decodedBytes = 0, decodeActive = 0, decodePeak = 0;
  var mix = { ambience: .65, train: .8, sfx: .8, voice: 1 };
  var buffers = Object.create(null), assets = Object.create(null), ambient = Object.create(null), loops = Object.create(null);
  var emitters = Object.create(null), retired = [], active = [], queue = [], pumping = false, current = null, epoch = 0;
  var speed = 0, inside = true, braking = false, curve = 0, wasMoving = false, ducked = false;
  var lastSpeed = -1, lastInside, lastBraking, lastCurve, lastStart = -100, lastStop = -100;
  var errors = [], progress = 0, stepIndex = 0, listeners = [];
  var ear = { x: 0, y: 0, z: 0 }, facing = { x: 0, y: 0, z: -1 };
  var station = { concourseSpeakers: [], platformSpeakers: [], trainSpeakers: [], escalators: [] };
  var safetyEnabled = true, safetyMin = 45, safetyMax = 80, safetyInitial = 20, safetyTimer, safetyDue = 0;
  var safetyRun = null, safetyEpoch = 0, lastSafety = null;
  var compressedVoice = Object.create(null), decoding = Object.create(null), decoders = Object.create(null);
  var voiceUsed = Object.create(null), voiceBytes = 0, voiceLimit = 8 * 1048576;
  var compressedBytes = 0, parameterTargets = new WeakMap(), listenerAt = -1, trainAt = -1, emitterAt = -1, listenerDirty = true;
  var decodeWaiters = [];

  function clamp(n, min, max) { return Math.max(min, Math.min(max, isFinite(n) ? n : min)); }
  function point(p) {
    if (!p) return null;
    var x = p.x == null ? p[0] : p.x, y = p.y == null ? p[1] : p.y, z = p.z == null ? p[2] : p.z;
    return Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z) ? { x: x, y: y, z: z } : null;
  }
  function smooth(param, target, seconds) {
    if (!ctx) return;
    if (parameterTargets.get(param) === target) return;
    parameterTargets.set(param, target);
    if (param.cancelAndHoldAtTime) param.cancelAndHoldAtTime(ctx.currentTime);
    else { param.cancelScheduledValues(ctx.currentTime); param.setValueAtTime(param.value, ctx.currentTime); }
    param.setTargetAtTime(target, ctx.currentTime, seconds || .08);
  }
  function gain(parent, value) { var n = ctx.createGain(); n.gain.value = value; n.connect(parent); return n; }
  function canPlay() { return loaded && everUnlocked && ctx.state === 'running' && !background; }
  function audioSession(value) { try { if (navigator.audioSession) navigator.audioSession.type = value; } catch (_) {} }
  function notifyState() {
    window.dispatchEvent(new CustomEvent('gz-audio-state', { detail: { context: ctx ? ctx.state : 'uninitialized', needsGesture: needsGesture, background: background } }));
  }
  function context() {
    if (ctx) return ctx;
    var Constructor = window.AudioContext || window.webkitAudioContext;
    if (!Constructor) throw new Error('此浏览器不支持 Web Audio');
    // Halves decoded PCM memory relative to 48 kHz. Safari may use the hardware rate.
    try { ctx = new Constructor({ sampleRate: 24000 }); } catch (_) { ctx = new Constructor(); }
    lastContextState = ctx.state;
    master = ctx.createGain(); master.gain.value = muted ? 0 : volume;
    var compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -8; compressor.knee.value = 6; compressor.ratio.value = 4;
    compressor.attack.value = .003; compressor.release.value = .18;
    analyser = ctx.createAnalyser(); analyser.fftSize = 512;
    master.connect(compressor); compressor.connect(analyser); analyser.connect(ctx.destination);
    buses = { ambience: gain(master, mix.ambience), sfx: gain(master, mix.sfx), voice: gain(master, mix.voice), train: gain(master, mix.train) };
    trainFilter = ctx.createBiquadFilter(); trainFilter.type = 'lowpass'; trainFilter.frequency.value = 2900; trainFilter.connect(buses.train);
    resetPA();
    ctx.onstatechange = function () {
      var state = ctx.state;
      if (state === 'running') { needsGesture = false; if (everUnlocked && !background) { updateZone(); updateTrain(true); armSafety(); } }
      else {
        needsGesture = !background;
        if (lastContextState === 'running') { cancelTransients(); stopBeds(); }
      }
      lastContextState = state; notifyState();
    };
    applyListener(); return ctx;
  }
  function resetPA() {
    // Clear delay tails on cancellation, especially before suspending iOS audio.
    paNodes.forEach(function (n) { try { n.disconnect(); } catch (_) {} }); paNodes.length = 0;
    var high = ctx.createBiquadFilter(), low = ctx.createBiquadFilter();
    high.type = 'highpass'; high.frequency.value = 280; low.type = 'lowpass'; low.frequency.value = 4400;
    high.connect(low); low.connect(buses.voice); paInput = high; paNodes.push(high, low);
    [.053, .137].forEach(function (d, i) {
      var delay = ctx.createDelay(.5), wet = gain(buses.voice, [.13, .07][i]), filter = ctx.createBiquadFilter();
      delay.delayTime.value = d; filter.type = 'lowpass'; filter.frequency.value = 2200;
      low.connect(delay); delay.connect(filter); filter.connect(wet); paNodes.push(delay, filter, wet);
    });
  }
  function applyMix() {
    if (!ctx) return;
    if (master.gain.cancelAndHoldAtTime) master.gain.cancelAndHoldAtTime(ctx.currentTime);
    else { master.gain.cancelScheduledValues(ctx.currentTime); master.gain.setValueAtTime(master.gain.value, ctx.currentTime); }
    master.gain.linearRampToValueAtTime(muted ? 0 : volume, ctx.currentTime + .025);
    smooth(buses.ambience.gain, mix.ambience * (ducked ? .23 : 1), ducked ? .035 : .18);
    smooth(buses.train.gain, mix.train * (ducked ? .4 : 1), ducked ? .035 : .18);
    smooth(buses.sfx.gain, mix.sfx, .025); smooth(buses.voice.gain, mix.voice, .025);
  }
  function duck(v) { if (ducked !== v) { ducked = v; applyMix(); } }
  function applyListener() {
    if (!ctx) return;
    var l = ctx.listener;
    if (l.positionX) {
      smooth(l.positionX, ear.x, .025); smooth(l.positionY, ear.y, .025); smooth(l.positionZ, ear.z, .025);
      smooth(l.forwardX, facing.x, .025); smooth(l.forwardY, facing.y, .025); smooth(l.forwardZ, facing.z, .025);
      smooth(l.upX, 0, .025); smooth(l.upY, 1, .025); smooth(l.upZ, 0, .025);
    } else { l.setPosition(ear.x, ear.y, ear.z); l.setOrientation(facing.x, facing.y, facing.z, 0, 1, 0); }
  }
  function setListener(pos, forward) {
    // No temporary vectors/objects in the per-frame path.
    if (!pos || !forward || !Number.isFinite(pos.x) || !Number.isFinite(pos.y) || !Number.isFinite(pos.z)) return;
    var length = Math.sqrt(forward.x * forward.x + forward.y * forward.y + forward.z * forward.z);
    if (!Number.isFinite(length) || length < .001) return;
    var x = forward.x / length, y = forward.y / length, z = forward.z / length;
    if (ear.x !== pos.x || ear.y !== pos.y || ear.z !== pos.z || facing.x !== x || facing.y !== y || facing.z !== z) {
      ear.x = pos.x; ear.y = pos.y; ear.z = pos.z; facing.x = x; facing.y = y; facing.z = z; listenerDirty = true;
    }
    if (listenerDirty && ctx && ctx.state === 'running' && ctx.currentTime - listenerAt >= 1 / 30) {
      listenerAt = ctx.currentTime; applyListener(); listenerDirty = false;
      if (ctx.currentTime - emitterAt >= .5) { emitterAt = ctx.currentTime; updateEmitters(); }
    }
  }
  function positionNode(n, p, immediate) {
    if (n.positionX) {
      if (immediate) { n.positionX.value = p.x; n.positionY.value = p.y; n.positionZ.value = p.z; }
      else { smooth(n.positionX, p.x, .025); smooth(n.positionY, p.y, .025); smooth(n.positionZ, p.z, .025); }
    } else n.setPosition(p.x, p.y, p.z);
  }
  function spatial(p, opts) {
    var n = ctx.createPanner(); n.panningModel = opts.pa || opts.kind === 'train' ? 'HRTF' : 'equalpower'; n.distanceModel = 'inverse';
    n.refDistance = clamp(opts.refDistance == null ? 5 : opts.refDistance, .1, 1000);
    n.maxDistance = 2000; n.rolloffFactor = clamp(opts.rolloff == null ? 1.25 : opts.rolloff, 0, 4);
    if (opts.pa) {
      n.coneInnerAngle = 180; n.coneOuterAngle = 300; n.coneOuterGain = .45;
      if (n.orientationY) { n.orientationX.value = 0; n.orientationY.value = -1; n.orientationZ.value = 0; }
      else n.setOrientation(0, -1, 0);
    }
    positionNode(n, p, true); return n;
  }
  function removeSource(item) {
    var i = active.indexOf(item); if (i !== -1) active.splice(i, 1);
    try { item.source.disconnect(); item.gain.disconnect(); if (item.pan) item.pan.disconnect(); } catch (_) {}
  }
  function stopItem(item) { try { item.source.stop(); } catch (_) {} item.finish(); }
  function play(id, bus, opts, done) {
    opts = opts || {};
    var buffer = buffers[id]; if (!buffer || !canPlay()) { if (done) done(); return 0; }
    var kind = opts.kind || 'sfx', spatialActive = active.filter(function (a) { return a.kind === 'npc'; });
    if (kind === 'npc' && spatialActive.length >= 3) stopItem(spatialActive[0]);
    if (active.length >= 10) {
      var oldest = active.find(function (a) { return a.kind === 'sfx' || a.kind === 'npc'; });
      if (oldest) stopItem(oldest); else { if (done) done(); return 0; }
    }
    var source = ctx.createBufferSource(), node = ctx.createGain(), pan, p = point(opts.position || opts.from);
    source.buffer = buffer;
    source.playbackRate.value = opts.duration ? clamp(buffer.duration / opts.duration, .25, 4) : clamp(opts.rate == null ? 1 : opts.rate, .25, 4);
    node.gain.value = clamp(opts.volume == null ? 1 : opts.volume, 0, 2); source.connect(node);
    if (p) { pan = spatial(p, opts); node.connect(pan); pan.connect(opts.pa ? paInput : bus); }
    else if (ctx.createStereoPanner) { pan = ctx.createStereoPanner(); pan.pan.value = clamp(opts.pan || 0, -1, 1); node.connect(pan); pan.connect(opts.pa ? paInput : bus); }
    else node.connect(opts.pa ? paInput : bus);
    var start = ctx.currentTime + clamp(opts.delay || 0, 0, 10), duration = buffer.duration / source.playbackRate.value;
    var item = { source: source, gain: node, pan: pan, sourceId: opts.sourceId, kind: kind, id: id, position: p };
    active.push(item); var ended = false;
    item.finish = function () { if (ended) return; ended = true; removeSource(item); if (done) done(); };
    source.onended = item.finish;
    var to = point(opts.to);
    if (p && to && pan.positionX) {
      ['x', 'y', 'z'].forEach(function (axis) {
        var param = pan['position' + axis.toUpperCase()]; param.setValueAtTime(p[axis], start);
        for (var j = 1; j <= 30; j++) {
          var t = j / 30, ease = t * t * (3 - 2 * t);
          param.linearRampToValueAtTime(p[axis] + (to[axis] - p[axis]) * ease, start + duration * t);
        }
      });
      item.to = to;
    }
    source.start(start); return duration;
  }
  function setSourcePosition(id, pos) {
    if (!ctx || !pos || !Number.isFinite(pos.x) || !Number.isFinite(pos.y) || !Number.isFinite(pos.z)) return;
    var e = emitters[id]; if (e) { e.position.x = pos.x; e.position.y = pos.y; e.position.z = pos.z; if (e.node) positionNode(e.node.pan, pos); }
    for (var i = 0; i < active.length; i++) {
      var a = active[i]; if (a.sourceId === id && a.position && a.pan) { if (a.lastPositionAt != null && ctx.currentTime - a.lastPositionAt < 1 / 30) continue; a.lastPositionAt = ctx.currentTime; if (a.to && a.pan.positionX) { ['X','Y','Z'].forEach(function (axis) { var param = a.pan['position' + axis]; if (param.cancelAndHoldAtTime) param.cancelAndHoldAtTime(ctx.currentTime); else { param.cancelScheduledValues(ctx.currentTime); param.setValueAtTime(param.value, ctx.currentTime); } }); a.to = null; } a.position.x = pos.x; a.position.y = pos.y; a.position.z = pos.z; positionNode(a.pan, pos); }
    }
  }
  function loop(id, parent, pos, opts) {
    if (!buffers[id]) return null;
    var source = ctx.createBufferSource(), node = ctx.createGain(), pan;
    node.gain.value = 0; source.buffer = buffers[id]; source.loop = true; source.connect(node);
    if (pos) { pan = spatial(pos, opts || {}); node.connect(pan); pan.connect(parent); } else node.connect(parent);
    source.start(); var item = { source: source, gain: node, pan: pan };
    source.onended = function () { var i = retired.indexOf(item); if (i !== -1) retired.splice(i, 1); try { source.disconnect(); node.disconnect(); if (pan) pan.disconnect(); } catch (_) {} };
    return item;
  }
  function retire(collection, name, now) {
    var item = collection[name]; if (!item) return; delete collection[name];
    if (!now) { retired.push(item); smooth(item.gain.gain, 0, .08); }
    try { item.source.stop(ctx.currentTime + (now ? 0 : .65)); } catch (_) {}
  }
  function stopBeds() {
    Object.keys(ambient).forEach(function (n) { retire(ambient, n, true); });
    Object.keys(loops).forEach(function (n) { retire(loops, n, true); });
    Object.keys(emitters).forEach(function (n) { var e = emitters[n]; if (e.node) { try { e.node.source.stop(); } catch (_) {} e.node = null; } });
    retired.splice(0).forEach(function (item) { try { item.source.stop(); } catch (_) {} });
  }
  function updateZone() {
    if (!canPlay()) return;
    Object.keys(ambient).forEach(function (n) { if (n !== zone) retire(ambient, n); });
    if (zone !== 'none') {
      if (!ambient[zone]) ambient[zone] = loop('ambience.' + zone, buses.ambience);
      if (ambient[zone]) smooth(ambient[zone].gain.gain, 1, .28);
    }
    updateEmitters();
  }
  function updateEmitters() {
    if (!canPlay()) return;
    var nearestIds = Object.keys(emitters).filter(function (id) { return emitters[id].zone === zone; }).sort(function (a, b) {
      var p = emitters[a].position, q = emitters[b].position;
      return (p.x-ear.x)*(p.x-ear.x)+(p.z-ear.z)*(p.z-ear.z)-(q.x-ear.x)*(q.x-ear.x)-(q.z-ear.z)*(q.z-ear.z);
    }).slice(0, 2);
    Object.keys(emitters).forEach(function (id) {
      var e = emitters[id], on = nearestIds.indexOf(id) !== -1;
      if (on && !e.node) e.node = loop('sfx.escalator', buses.ambience, e.position, { refDistance: 7, rolloff: 1.5 });
      if (e.node) {
        smooth(e.node.gain.gain, on ? e.volume : 0, .12);
        if (!on) { retired.push(e.node); try { e.node.source.stop(ctx.currentTime + .7); } catch (_) {} e.node = null; }
      }
    });
  }
  function layer(name, target, rate) {
    if (!canPlay()) return;
    if (target <= 0) { retire(loops, name); return; }
    if (!loops[name]) loops[name] = loop('train.' + name, trainFilter);
    if (loops[name]) { smooth(loops[name].source.playbackRate, rate, .12); smooth(loops[name].gain.gain, target, .12); }
  }
  function updateTrain(force) {
    if (!canPlay() || (!force && speed === lastSpeed && inside === lastInside && braking === lastBraking && curve === lastCurve)) return;
    if (!force && inside === lastInside && braking === lastBraking && ctx.currentTime - trainAt < .05) return;
    trainAt = ctx.currentTime;
    lastSpeed = speed; lastInside = inside; lastBraking = braking; lastCurve = curve;
    smooth(trainFilter.frequency, inside ? 2900 : 10500, .12);
    var moving = speed > .006, body = inside ? .72 : 1;
    layer('motor', moving ? body * (.13 + .49 * Math.sqrt(speed)) * (braking ? .34 : 1) : 0, .42 + speed * 1.65);
    layer('roll', moving ? body * (.08 + .8 * speed) : 0, .6 + speed * .78);
    layer('joints', moving ? body * (.12 + .3 * speed) : 0, .28 + speed * 1.85);
    layer('brake', braking && moving ? body * (.2 + .38 * (1 - speed)) : 0, .78 + speed * .5);
    layer('curve', moving ? body * curve * (.16 + .3 * speed) : 0, .82 + speed * .25);
  }
  function trainSound(opts) {
    opts = opts || {}; var oldBraking = braking, oldInside = inside;
    speed = clamp(opts.speed || 0, 0, 1); inside = opts.inside !== false; braking = !!opts.braking; curve = clamp(opts.curve || 0, 0, 1);
    var moving = speed > .006;
    if ((!moving && wasMoving) || (braking && !oldBraking) || (!inside && oldInside)) { active.slice().forEach(function (a) { if (a.id === 'train.tractionStart') stopItem(a); }); }
    if (canPlay() && inside) {
      if (moving && !wasMoving && !braking && ctx.currentTime - lastStart > 4) { play('train.tractionStart', trainFilter, { volume: .55, kind: 'train' }); lastStart = ctx.currentTime; }
      if (!moving && wasMoving && (braking || oldBraking) && ctx.currentTime - lastStop > 2) { play('train.airRelease', trainFilter, { volume: .65, kind: 'train' }); lastStop = ctx.currentTime; }
    }
    wasMoving = canPlay() ? moving : false; updateTrain(false);
  }
  function trimVoice(exclude) {
    var ids = Object.keys(voiceUsed).sort(function (a, b) { return voiceUsed[a] - voiceUsed[b]; });
    for (var i = 0; voiceBytes > voiceLimit && i < ids.length; i++) {
      var id = ids[i];
      if (id === exclude || active.some(function (a) { return a.id === id; })) continue;
      var buffer = buffers[id]; if (!buffer) continue;
      var bytes = buffer.length * buffer.numberOfChannels * 4;
      delete buffers[id]; delete voiceUsed[id]; voiceBytes -= bytes; decodedBytes -= bytes;
    }
  }
  async function decodeBuffer(a, raw) {
    if (decodeActive >= 2) await new Promise(function (resolve) { decodeWaiters.push(resolve); });
    decodeActive++; decodePeak = Math.max(decodePeak, decodeActive);
    try {
      var rate = a.loop ? 16000 : 24000, decoder = decoders[rate];
      if (!decoder) {
        var Offline = window.OfflineAudioContext || window.webkitOfflineAudioContext;
        try { decoder = Offline ? new Offline(2, 1, rate) : ctx; } catch (_) { decoder = ctx; }
        decoders[rate] = decoder;
      }
      var buffer = await new Promise(function (resolve, reject) { decoder.decodeAudioData(raw, resolve, reject); });
      buffers[a.id] = buffer;
      var bytes = buffer.length * buffer.numberOfChannels * 4; decodedBytes += bytes;
      if (a.group === 'voice') { voiceBytes += bytes; voiceUsed[a.id] = performance.now(); trimVoice(a.id); }
      return buffer;
    } finally { decodeActive--; var next = decodeWaiters.shift(); if (next) next(); }
  }
  function ensureBuffer(id) {
    if (buffers[id]) { if (assets[id].group === 'voice') voiceUsed[id] = performance.now(); return Promise.resolve(buffers[id]); }
    if (decoding[id]) return decoding[id];
    if (!compressedVoice[id]) return Promise.reject(new Error('广播素材缺失：' + id));
    // decodeAudioData detaches its input. Keep only the small MP3 and one decode copy.
    decoding[id] = decodeBuffer(assets[id], compressedVoice[id].slice(0)).finally(function () { delete decoding[id]; });
    return decoding[id];
  }
  function preload(onProgress) {
    if (loaded) { if (onProgress) onProgress(1); return Promise.resolve(manifest); }
    if (onProgress) listeners.push(onProgress);
    if (loading) { if (onProgress) onProgress(progress); return loading; }
    try { context(); } catch (e) { return Promise.reject(e); }
    loading = fetch(root + 'manifest.json').then(function (r) {
      if (!r.ok) throw new Error('音频清单加载失败（' + r.status + '）'); return r.json();
    }).then(async function (data) {
      manifest = data;
      if (!data.assets || !data.assets.length) throw new Error('音频清单为空');
      var index = 0, finished = 0, failed = false, firstFailure;
      data.assets.forEach(function (a) { assets[a.id] = a; });
      async function worker() {
        while (index < data.assets.length && !failed) {
          var a = data.assets[index++];
          if (!buffers[a.id] && !compressedVoice[a.id]) {
            var r = await fetch(root + a.file); if (!r.ok) throw new Error('音频加载失败：' + a.file);
            var raw = await r.arrayBuffer();
            if (a.group === 'voice') { compressedVoice[a.id] = raw; compressedBytes += raw.byteLength; }
            else await decodeBuffer(a, raw);
            raw = null;
          }
          finished++; progress = finished / data.assets.length;
          listeners.forEach(function (fn) { try { fn(progress); } catch (_) {} });
        }
      }
      // iOS: two workers, no simultaneous decode storm, no retained compressed copy.
      function failedWorker(e) { failed = true; firstFailure = firstFailure || e; }
      // Wait for both workers before allowing retry, including the failure path.
      await Promise.all([worker().catch(failedWorker), worker().catch(failedWorker)]);
      if (firstFailure) throw firstFailure;
      loaded = true;
      updateZone(); updateTrain(true); armSafety(); listeners.length = 0; return manifest;
    }).catch(function (e) { errors.push(e.message); loading = null; listeners.length = 0; throw e; });
    return loading;
  }
  function unlock() {
    try {
      context(); audioSession('playback');
      // Both operations occur synchronously inside the trusted gesture.
      var silent = ctx.createBufferSource(); silent.buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
      silent.connect(ctx.destination); silent.onended = function () { silent.disconnect(); }; silent.start(0);
      var resume = ctx.resume();
      return resume.then(function () {
        everUnlocked = ctx.state === 'running' || everUnlocked; needsGesture = ctx.state !== 'running';
        if (!needsGesture && !background) { updateZone(); updateTrain(true); armSafety(); }
        notifyState(); return !needsGesture;
      });
    } catch (e) { needsGesture = true; errors.push(e.message); return Promise.reject(e); }
  }
  function stationId(value) {
    var stations = GZ.config ? GZ.config.STATIONS : [];
    if (typeof value === 'number') return stations[value] ? stations[value].id : null;
    if (value && typeof value === 'object') value = value.id || value.name;
    if (value == null) return stations[0] ? stations[0].id : 'gyq';
    for (var i = 0; i < stations.length; i++) if (value === stations[i].id || value === stations[i].name || value === stations[i].en) return stations[i].id;
    return null;
  }
  function direction(p) {
    var d = p.dir == null ? (p.direction == null ? p.destination : p.direction) : p.dir;
    return d === -1 || d === 'down' || d === '西塱' || d === 'Xilang' ? 'down' : 'up';
  }
  function sequence(prefix) { return ['voice.' + prefix + '.zh', 'voice.' + prefix + '.yue', 'voice.' + prefix + '.en']; }
  function announcement(key, p) {
    var aliases = { arrival: 'arrive', arrived: 'arrive', nextStation: 'next', approach: 'platform', doorClose: 'doorsClosing', closeDoors: 'doorsClosing' };
    key = aliases[key] || key;
    var sid = stationId(p.station == null ? (p.nextStation == null ? p.stationId : p.nextStation) : p.station), d = direction(p);
    if (manifest.announcements[key]) return manifest.announcements[key];
    if (key === 'platform') return sequence('platform.' + d + '.' + (p.platform === 1 || p.platform === 2 ? p.platform : (d === 'up' ? 1 : 2)));
    if (key === 'destination' || key === 'terminal') return sequence(key + '.' + d);
    if (key === 'transfer') return sid === 'gyq' || sid === 'dsk' ? sequence('transfer.' + sid) : [];
    var route = manifest.routes[sid + '_' + d];
    if (route && route.announcements[key]) return route.announcements[key];
    throw new Error('未知广播或车站：' + key + '/' + sid);
  }
  function nearest(points) {
    var best = null, distance = Infinity;
    for (var i = 0; i < points.length; i++) { var p = points[i], d = Math.pow(p.x - ear.x, 2) + Math.pow(p.y - ear.y, 2) + Math.pow(p.z - ear.z, 2); if (d < distance) { best = p; distance = d; } }
    return best;
  }
  function speaker(key) { return nearest(station[key === 'platform' || key === 'welcome' || zone === 'platform' ? 'platformSpeakers' : zone === 'train' ? 'trainSpeakers' : 'concourseSpeakers']); }
  function caption(id, channel) {
    window.dispatchEvent(new CustomEvent('gz-audio-caption', { detail: id && assets[id] ? { id: id, text: assets[id].text, lang: assets[id].lang, channel: channel } : null }));
  }
  async function pump() {
    if (pumping) return;
    pumping = true; duck(true);
    try {
      while (queue.length) {
        var item = queue.shift(); current = item;
        if (item.epoch !== epoch || !canPlay()) { item.resolve({ cancelled: true }); continue; }
        try {
          for (var i = 0; i < item.ids.length && item.epoch === epoch && canPlay(); i++) {
            var id = item.ids[i]; await ensureBuffer(id);
            if (item.epoch !== epoch || !canPlay()) break;
            caption(id, 'important');
            var pos = point(item.params.position) || speaker(item.key);
            await new Promise(function (resolve) { play(id, buses.voice, { position: pos, pa: !!pos, refDistance: 14, rolloff: .7, volume: pos ? .85 : 1, delay: i ? .22 : .07, kind: 'voice', sourceId: item.params.sourceId }, resolve); });
          }
          item.resolve({ cancelled: item.epoch !== epoch || !canPlay() });
        } catch (e) { errors.push(e.message); item.reject(e); }
      }
    } finally { current = null; pumping = false; duck(false); caption(null); armSafety(); }
  }
  function announce(key, params) {
    var requestEpoch = epoch;
    cancelSafety(); clearSafetyTimer();
    return preload().then(function () {
      if (requestEpoch !== epoch || !canPlay()) return { cancelled: true };
      var ids = announcement(key, params || {});
      return new Promise(function (resolve, reject) { queue.push({ ids: ids, resolve: resolve, reject: reject, epoch: epoch, key: key, params: params || {} }); pump(); });
    });
  }
  function clearSafetyTimer() { if (safetyTimer) clearTimeout(safetyTimer); safetyTimer = null; safetyDue = 0; }
  function cancelSafety() {
    safetyEpoch++; clearSafetyTimer();
    var old = safetyRun; safetyRun = null;
    active.slice().forEach(function (a) { if (a.kind === 'safety') stopItem(a); });
    if (old) { if (!pumping && ctx) resetPA(); caption(null); }
  }
  function safetyAllowed() { return safetyEnabled && canPlay() && !muted && (zone === 'concourse' || zone === 'platform') && !pumping && !queue.length && !safetyRun; }
  function armSafety(initial) {
    if (safetyTimer || !safetyAllowed()) return;
    var delay = initial ? safetyInitial : safetyMin + Math.random() * (safetyMax - safetyMin);
    safetyDue = Date.now() + delay * 1000;
    safetyTimer = setTimeout(function () { safetyTimer = null; safetyDue = 0; stationAnnouncement(); }, delay * 1000);
  }
  async function stationAnnouncement(key) {
    if (!safetyAllowed()) return { skipped: true, cancelled: false };
    clearSafetyTimer();
    var choices = Object.keys(manifest.stationSafety || {}).filter(function (k) { return manifest.stationSafety[k].zones.indexOf(zone) !== -1 && k !== lastSafety; });
    if (!key) key = choices[Math.floor(Math.random() * choices.length)];
    var entry = manifest.stationSafety && manifest.stationSafety[key];
    if (!entry) throw new Error('未知站内安全广播：' + key);
    if (entry.zones.indexOf(zone) === -1) return { skipped: true, cancelled: false };
    lastSafety = key; var token = ++safetyEpoch, startZone = zone;
    safetyRun = { key: key, token: token };
    try {
      for (var i = 0; i < entry.ids.length && token === safetyEpoch && zone === startZone && canPlay(); i++) {
        var id = entry.ids[i]; await ensureBuffer(id);
        if (token !== safetyEpoch || zone !== startZone || !canPlay()) break;
        caption(id, 'station');
        var p = nearest(station[startZone === 'platform' ? 'platformSpeakers' : 'concourseSpeakers']);
        await new Promise(function (resolve) { play(id, buses.voice, { position: p, pa: true, refDistance: 10, rolloff: .85, volume: .38, kind: 'safety', delay: i ? .35 : 0, sourceId: 'station-pa' }, resolve); });
      }
      return { cancelled: token !== safetyEpoch || zone !== startZone || !canPlay(), key: key };
    } finally { if (safetyRun && safetyRun.token === token) { safetyRun = null; caption(null); armSafety(); } }
  }
  function setStationAudio(opts) {
    opts = opts || {}; cancelSafety();
    Object.keys(emitters).forEach(function (id) { var e = emitters[id]; if (e.node) { try { e.node.source.stop(); } catch (_) {} } });
    emitters = Object.create(null);
    ['concourseSpeakers', 'platformSpeakers', 'trainSpeakers'].forEach(function (k) { station[k] = (opts[k] || []).map(point).filter(Boolean).slice(0, 16); });
    station.escalators = (opts.escalators || []).slice(0, 8);
    station.escalators.forEach(function (e, i) {
      var p = point(e.position); if (p) emitters[e.id || 'escalator-' + i] = { position: p, zone: e.zone || 'concourse', volume: clamp(e.volume == null ? .5 : e.volume, 0, 1), node: null };
    });
    updateZone(); armSafety(true);
  }
  function setZone(value) {
    if (['street', 'concourse', 'platform', 'train', 'none'].indexOf(value) === -1) { errors.push('未知环境：' + value); return; }
    if (value !== zone) { cancelSafety(); zone = value; updateZone(); armSafety(true); }
    else { updateZone(); armSafety(); }
  }
  function sfx(name, opts) {
    opts = opts || {}; var id = assets[name] ? name : 'sfx.' + name;
    if (name === 'footstep' && loaded) { stepIndex = (stepIndex + 1) % 4; id = 'sfx.footstep' + (stepIndex ? stepIndex + 1 : ''); }
    if (opts.npc || opts.sourceId && opts.sourceId.indexOf('npc-') === 0) opts = Object.assign({}, opts, { kind: 'npc' });
    if (loaded) { if (!buffers[id]) { errors.push('未知音效：' + name); return 0; } return play(id, buses.sfx, opts); }
    var requestEpoch = epoch;
    preload().then(function () { if (requestEpoch === epoch && buffers[id]) play(id, buses.sfx, opts); }).catch(function () {}); return 0;
  }
  function trainOneShot(name, opts) {
    opts = Object.assign({ kind: 'train', refDistance: 18, rolloff: 1.15 }, opts || {});
    if (loaded) return play('train.' + name, buses.train, opts);
    var requestEpoch = epoch;
    preload().then(function () { if (requestEpoch === epoch) play('train.' + name, buses.train, opts); }).catch(function () {});
    return opts.duration || (name === 'approach' ? 15 : 13);
  }
  function cancelTransients() {
    epoch++; cancelSafety();
    queue.splice(0).forEach(function (q) { q.resolve({ cancelled: true }); });
    active.slice().forEach(stopItem); if (ctx) resetPA(); duck(false);
  }
  function stopAll() {
    cancelTransients(); zone = 'none'; speed = 0; curve = 0; braking = false; wasMoving = false;
    lastSpeed = -1; lastStart = lastStop = -100; stopBeds();
  }
  function suspend() {
    cancelTransients(); stopBeds(); needsGesture = true; audioSession('auto'); notifyState();
    return ctx && ctx.state === 'running' ? ctx.suspend().catch(function () {}) : Promise.resolve();
  }
  function preview(id, opts) {
    if (!canPlay()) return 0;
    var a = assets[id], bus = a && a.group === 'voice' ? buses.voice : buses.sfx;
    if (buffers[id]) return play(id, bus, opts);
    if (!a || a.group !== 'voice') return 0;
    var token = epoch;
    ensureBuffer(id).then(function () { if (token === epoch && canPlay()) play(id, bus, opts); }).catch(function (e) { errors.push(e.message); });
    return a.duration / clamp(opts && opts.rate || 1, .25, 4);
  }
  function visible(value) {
    background = !value;
    if (!value) suspend();
    else if (ctx && everUnlocked) {
      audioSession('playback'); needsGesture = true;
      ctx.resume().then(function () { needsGesture = ctx.state !== 'running'; if (!needsGesture) { updateZone(); updateTrain(true); armSafety(true); } notifyState(); }).catch(function () { needsGesture = true; notifyState(); });
      notifyState();
    }
  }
  document.addEventListener('visibilitychange', function () { visible(!document.hidden); });
  window.addEventListener('pagehide', function () { visible(false); });
  window.addEventListener('pageshow', function (e) { if (e.persisted) visible(!document.hidden); });
  ['pointerdown', 'touchend', 'keydown'].forEach(function (event) { document.addEventListener(event, function () { if (ctx && everUnlocked && needsGesture && !document.hidden) unlock().catch(function () {}); }, { capture: true, passive: true }); });
  var meter = new Float32Array(512);
  GZ.Audio = {
    preload: preload, unlock: unlock, announce: announce, sfx: sfx, setListener: setListener, setSourcePosition: setSourcePosition, setStationAudio: setStationAudio,
    stationAnnouncement: stationAnnouncement,
    setStationAnnouncements: function (opts) {
      opts = opts || {}; if (opts.enabled != null) safetyEnabled = !!opts.enabled;
      if (opts.minInterval != null) safetyMin = clamp(opts.minInterval, 5, 600);
      if (opts.maxInterval != null) safetyMax = clamp(opts.maxInterval, safetyMin, 900);
      safetyMax = Math.max(safetyMax, safetyMin);
      if (opts.initialDelay != null) safetyInitial = clamp(opts.initialDelay, .25, 300);
      cancelSafety(); armSafety(true);
    },
    setMuted: function (v) { muted = !!v; if (muted) cancelSafety(); applyMix(); if (!muted) armSafety(true); },
    setVolume: function (v) { volume = clamp(v, 0, 1); applyMix(); },
    setMix: function (values) { Object.keys(mix).forEach(function (k) { if (values[k] != null) mix[k] = clamp(values[k], 0, 1.5); }); applyMix(); },
    setZone: setZone, trainSound: trainSound,
    trainApproach: function (opts) { return trainOneShot('approach', opts); }, trainDepart: function (opts) { return trainOneShot('depart', opts); },
    stopAll: stopAll, suspend: suspend,
    preview: preview,
    getManifest: function () { return manifest; },
    getState: function () {
      return { loaded: loaded, progress: progress, unlocked: everUnlocked && ctx && ctx.state === 'running' && !background, needsGesture: needsGesture,
        context: ctx ? ctx.state : 'uninitialized', background: background, muted: muted, volume: volume, zone: zone, speed: speed, inside: inside, braking: braking, curve: curve,
        ducked: ducked, announcing: current ? current.key : null, stationAnnouncing: safetyRun ? safetyRun.key : null,
        stationAnnouncements: safetyEnabled, nextStationAnnouncementMs: safetyDue ? Math.max(0, safetyDue - Date.now()) : null,
        queued: queue.length, active: active.length, retiringBeds: retired.length, beds: Object.keys(ambient).length + Object.keys(loops).length + Object.keys(emitters).filter(function (id) { return !!emitters[id].node; }).length,
        spatialSources: active.filter(function (a) { return !!a.position; }).map(function (a) { return { id: a.id, sourceId: a.sourceId, position: a.pan.positionX ? { x: a.pan.positionX.value, y: a.pan.positionY.value, z: a.pan.positionZ.value } : a.position }; }),
        listener: { position: { x: ear.x, y: ear.y, z: ear.z }, forward: { x: facing.x, y: facing.y, z: facing.z } },
        assetCount: manifest ? manifest.assets.length : 0, decodedAssetCount: Object.keys(buffers).length,
        decodedBytes: decodedBytes, compressedVoiceBytes: compressedBytes, voiceCacheBytes: voiceBytes, voiceCacheLimit: voiceLimit,
        sampleRate: ctx ? ctx.sampleRate : null, loopDecodeRate: decoders[16000] ? decoders[16000].sampleRate : null,
        voiceDecodeRate: decoders[24000] ? decoders[24000].sampleRate : null, decodeConcurrencyPeak: decodePeak,
        pendingVoiceDecodes: Object.keys(decoding).length,
        spatialPannerCount: active.filter(function (a) { return !!a.position; }).length + Object.keys(emitters).filter(function (id) { return !!emitters[id].node; }).length + retired.filter(function (a) { return !!a.pan; }).length,
        hrtfPannerCount: active.filter(function (a) { return a.pan && a.pan.panningModel === 'HRTF'; }).length,
        audioPerformanceVersion: 'audio-perf-1', transientLimit: 10, npcSoundLimit: 3, escalatorLimit: 2,
        audioSessionSupported: !!navigator.audioSession, mix: { ambience: mix.ambience, train: mix.train, sfx: mix.sfx, voice: mix.voice }, errors: errors.slice() };
    },
    getLevel: function () {
      if (!analyser) return 0;
      analyser.getFloatTimeDomainData(meter); var sum = 0;
      for (var i = 0; i < meter.length; i++) { var v = meter[i]; sum += v * v; } return Math.sqrt(sum / meter.length);
    }
  };
})();
