/* ===========================================================================
   AURA CORE · 공유 모듈
   - 샘플 생성 · 이미지 분석 · 재가공 그레이딩 · 소니피케이션(해피엔딩)
   - 미적 정체성 집계
   - AuraDB: IndexedDB 사진 라이브러리(영속성)
   모든 도구가 이 한 파일을 공유 → 사진 하나가 전 기능을 관통한다.
   =========================================================================== */
(function (global) {
  const AuraCore = {};

  /* ---------- 유틸 ---------- */
  function rgb2hsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    let h, s, l = (mx + mn) / 2;
    if (mx === mn) { h = s = 0; }
    else {
      const d = mx - mn;
      s = l > .5 ? d / (2 - mx - mn) : d / (mx + mn);
      switch (mx) { case r: h = (g - b) / d + (g < b ? 6 : 0); break; case g: h = (b - r) / d + 2; break; default: h = (r - g) / d + 4; }
      h /= 6;
    }
    return [h * 360, s, l];
  }
  function hex(r, g, b) { return '#' + [r, g, b].map(x => Math.round(Math.max(0, Math.min(255, x))).toString(16).padStart(2, '0')).join(''); }
  AuraCore.hex = hex;
  AuraCore.HUE_NAMES = ['빨강', '주황', '노랑', '연두', '초록', '청록', '파랑', '보라', '자주'];

  /* ---------- 샘플 이미지 ---------- */
  AuraCore.genSample = function (kind) {
    const c = document.createElement('canvas'); c.width = 480; c.height = 340; const g = c.getContext('2d');
    if (kind === 'sunset') {
      const gr = g.createLinearGradient(0, 0, 0, 340); gr.addColorStop(0, '#2a1a4a'); gr.addColorStop(.5, '#e85c3a'); gr.addColorStop(.75, '#ffb347'); gr.addColorStop(1, '#3a2416');
      g.fillStyle = gr; g.fillRect(0, 0, 480, 340); g.fillStyle = 'rgba(255,240,180,.9)'; g.beginPath(); g.arc(330, 190, 32, 0, 7); g.fill(); g.fillStyle = '#1a0f14'; g.fillRect(0, 290, 480, 50);
    } else if (kind === 'night') {
      g.fillStyle = '#070a16'; g.fillRect(0, 0, 480, 340);
      for (let i = 0; i < 90; i++) { g.fillStyle = `rgba(${120 + Math.random() * 130},${140 + Math.random() * 100},${200 + Math.random() * 55},${.4 + Math.random() * .6})`; g.fillRect(Math.random() * 480, 160 + Math.random() * 180, 2 + Math.random() * 3, 2 + Math.random() * 3); }
      g.fillStyle = 'rgba(90,130,255,.2)'; g.fillRect(0, 130, 480, 40); g.fillStyle = '#0a0e1e'; g.fillRect(0, 0, 480, 130);
    } else if (kind === 'forest') {
      const gr = g.createLinearGradient(0, 0, 0, 340); gr.addColorStop(0, '#123a24'); gr.addColorStop(1, '#0a1f14'); g.fillStyle = gr; g.fillRect(0, 0, 480, 340);
      for (let i = 0; i < 44; i++) { g.strokeStyle = `rgba(${40 + Math.random() * 60},${90 + Math.random() * 80},${50 + Math.random() * 40},.6)`; g.lineWidth = 3 + Math.random() * 8; g.beginPath(); const x = Math.random() * 480; g.moveTo(x, 340); g.lineTo(x + (Math.random() - .5) * 40, Math.random() * 150); g.stroke(); }
    } else { // flat
      const gr = g.createLinearGradient(0, 0, 480, 340); gr.addColorStop(0, '#9a9690'); gr.addColorStop(1, '#787c82'); g.fillStyle = gr; g.fillRect(0, 0, 480, 340); g.fillStyle = 'rgba(140,130,120,.5)'; g.fillRect(140, 110, 180, 120);
    }
    return c;
  };

  /* ---------- 썸네일 dataURL ---------- */
  AuraCore.toThumb = function (src, w = 320) {
    const iw = src.width || src.naturalWidth, ih = src.height || src.naturalHeight;
    const h = Math.round(w * (ih / iw));
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    c.getContext('2d').drawImage(src, 0, 0, w, h);
    return c.toDataURL('image/jpeg', 0.82);
  };

  /* ---------- 분석 ---------- */
  AuraCore.analyze = function (src) {
    const iw = src.width || src.naturalWidth, ih = src.height || src.naturalHeight;
    const sw = 96, sh = Math.max(1, Math.round(96 * (ih / iw)));
    const oc = document.createElement('canvas'); oc.width = sw; oc.height = sh;
    const o = oc.getContext('2d'); o.drawImage(src, 0, 0, sw, sh);
    let data; try { data = o.getImageData(0, 0, sw, sh).data; } catch (e) { return null; }
    const bins = {}; let sB = 0, sS = 0, sW = 0, n = 0, cx = 0, cy = 0, wsum = 0;
    for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) {
      const i = (y * sw + x) * 4, r = data[i], g = data[i + 1], b = data[i + 2];
      const k = (r >> 5) + '_' + (g >> 5) + '_' + (b >> 5);
      if (!bins[k]) bins[k] = { r: 0, g: 0, b: 0, c: 0 };
      bins[k].r += r; bins[k].g += g; bins[k].b += b; bins[k].c++;
      const [, s, l] = rgb2hsl(r, g, b); sB += l; sS += s; sW += (r - b) / 255; n++;
      const lum = 0.299 * r + 0.587 * g + 0.114 * b; cx += x * lum; cy += y * lum; wsum += lum;
    }
    const palette = Object.values(bins).sort((a, b) => b.c - a.c).slice(0, 5)
      .map(o => ({ r: Math.round(o.r / o.c), g: Math.round(o.g / o.c), b: Math.round(o.b / o.c) }));
    const bright = sB / n, sat = sS / n, warm = sW / n;
    const [dh] = rgb2hsl(palette[0].r, palette[0].g, palette[0].b);
    const aura = Math.max(-1, Math.min(1, (bright - 0.45) * 1.6 + warm * 0.9 + (sat - 0.3) * 0.6));
    // 파형(열 밝기)
    const wave = []; for (let x = 0; x < 72; x++) { let s = 0; const xx = Math.floor(x / 72 * sw); for (let y = 0; y < sh; y++) { const i = (y * sw + xx) * 4; s += (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) / 255; } wave.push(s / sh); }
    const centroid = { x: cx / wsum / sw, y: cy / wsum / sh };
    const hueName = AuraCore.HUE_NAMES[Math.floor(((dh + 20) % 360) / 40)];
    return { bright, sat, warm, aura: +aura.toFixed(3), palette, domHue: dh, hueName, wave, centroid,
      paletteHex: palette.map(p => hex(p.r, p.g, p.b)) };
  };

  /* ---------- 가이드라인 ---------- */
  AuraCore.guidelines = function (a) {
    const t = [], c = a.centroid;
    if (Math.abs(c.x - .5) < .08 && Math.abs(c.y - .5) < .08) t.push('주 피사체가 <b>정중앙</b>에 있어요. 1/3 또는 황금(0.382) 교차점으로 옮겨 삼각을 완성하세요.');
    else t.push('무게중심이 <b>비대칭</b>에 있어 좋습니다. 황금 교차점에 더 맞춰보세요.');
    if (a.bright < .32) t.push('전체가 어둡습니다 — <b>노출 +1스톱</b> 또는 순광 재촬영을 권합니다.');
    if (a.sat < .2) t.push('채도가 낮아 밋밋할 수 있어요 — <b>보색 소품</b>으로 시선을 잡으세요.');
    if (a.warm > .15) t.push('따뜻한 톤 — <b>골든아워</b> 역광 실루엣을 시도해보세요.');
    t.push('여백을 프레임의 <b>1/3 이상</b> 남겨 피사체가 숨 쉬게 하세요.');
    return t.slice(0, 4);
  };
  AuraCore.musicArc = function (a) {
    return a.aura < -0.1
      ? `<b>단조(minor)</b>로 시작해 어둠을 존중하다, 후반 <b>장조로 전환</b>되며 <b>웅장한 해피엔딩</b>으로 맺습니다.`
      : `밝은 아우라 — <b>장조</b> 아르페지오가 처음부터 반짝이고, 주조색 <b>${a.hueName}</b>이 음색을 정합니다.`;
  };

  /* ---------- 재가공 그레이딩 ---------- */
  AuraCore.grade = function (src) {
    const maxD = 900; let iw = src.width || src.naturalWidth, ih = src.height || src.naturalHeight;
    const scl = Math.min(1, maxD / Math.max(iw, ih)); iw = Math.round(iw * scl); ih = Math.round(ih * scl);
    const before = document.createElement('canvas'); before.width = iw; before.height = ih;
    const ob = before.getContext('2d'); ob.drawImage(src, 0, 0, iw, ih);
    const d = ob.getImageData(0, 0, iw, ih).data;
    let sB = 0, aR = 0, aG = 0, aB = 0, sat = 0, n = 0, warm = 0;
    for (let i = 0; i < d.length; i += 4) { const r = d[i], g = d[i + 1], b = d[i + 2]; aR += r; aG += g; aB += b; const mx = Math.max(r, g, b) / 255, mn = Math.min(r, g, b) / 255; sB += (mx + mn) / 2; sat += mx === mn ? 0 : (mx - mn); warm += (r - b) / 255; n++; }
    const bright = sB / n; aR /= n; aG /= n; aB /= n; sat /= n; warm /= n; const gray = (aR + aG + aB) / 3;
    const expo = Math.max(.85, Math.min(1.7, .52 / Math.max(bright, .05))), contrast = 1.13;
    const satMult = Math.max(1, Math.min(1.5, 1 + (.34 - sat) * .9));
    const wbAmt = Math.min(.4, Math.abs(warm) > .05 ? .38 : .15), shadow = bright < .4 ? .14 : .05, split = .06, vig = .28;
    const after = document.createElement('canvas'); after.width = iw; after.height = ih; const oa = after.getContext('2d');
    const out = oa.createImageData(iw, ih); const o = out.data;
    const wbR = 1 + (gray / aR - 1) * wbAmt, wbG = 1 + (gray / aG - 1) * wbAmt, wbB = 1 + (gray / aB - 1) * wbAmt;
    const cx = iw / 2, cy = ih / 2, mr = Math.hypot(cx, cy);
    for (let y = 0; y < ih; y++) for (let x = 0; x < iw; x++) {
      const i = (y * iw + x) * 4; let r = d[i] / 255 * wbR * expo, g = d[i + 1] / 255 * wbG * expo, b = d[i + 2] / 255 * wbB * expo;
      r = (r - .5) * contrast + .5; g = (g - .5) * contrast + .5; b = (b - .5) * contrast + .5;
      const lum = .299 * r + .587 * g + .114 * b; r = lum + (r - lum) * satMult; g = lum + (g - lum) * satMult; b = lum + (b - lum) * satMult;
      const lift = shadow * (1 - lum) * (1 - lum); r += lift; g += lift; b += lift;
      const hl = Math.max(0, lum - .5) * 2, sh2 = Math.max(0, .5 - lum) * 2; r += split * hl - split * .3 * sh2; b += split * sh2 - split * .4 * hl; g += split * .1 * hl;
      const vf = 1 - vig * Math.pow(Math.hypot(x - cx, y - cy) / mr, 2.2); r *= vf; g *= vf; b *= vf;
      o[i] = Math.max(0, Math.min(255, r * 255)); o[i + 1] = Math.max(0, Math.min(255, g * 255)); o[i + 2] = Math.max(0, Math.min(255, b * 255)); o[i + 3] = 255;
    }
    oa.putImageData(out, 0, 0);
    const edits = [
      ['노출', '+' + Math.round((expo - 1) * 100) + '%'], ['대비', '+13%'],
      ['채도', '+' + Math.round((satMult - 1) * 100) + '%'],
      ['화이트밸런스', warm > .05 ? '따뜻→중립' : warm < -.05 ? '차갑게→중립' : '미세'],
      ['섀도우 리프트', '+' + Math.round(shadow * 100)], ['스플릿톤', 'ON'], ['비네트', 'ON']
    ];
    return { before, after, edits };
  };

  /* ---------- AURA Sound Engine v2 — 프로 작곡 · 신시시스 ----------
     파형 레벨 프로덕션(컨볼루션 리버브·핑퐁 딜레이·버스 컴프레서) 위에
     뮤지션 작법을 융합: 기능화성(7th·9th·백도어 케이던스), 보이스리딩,
     모티프 전개(이조·전위·종지 호흡), 스윙·휴머나이즈, 섹션 폼 A→A'→Climax. */
  const Audio = { ctx: null, playing: false };
  function m2f(m) { return 440 * Math.pow(2, (m - 69) / 12); }

  Audio.ensure = function () {
    if (this.ctx) { this.ctx.resume(); return; }
    const ctx = this.ctx = new (global.AudioContext || global.webkitAudioContext)();
    // 마스터 버스: 필터(섹션별 오픈) → 글루 컴프레서 → 아웃(+녹화 dest)
    this.busFilter = ctx.createBiquadFilter(); this.busFilter.type = 'lowpass'; this.busFilter.frequency.value = 2400; this.busFilter.Q.value = .4;
    this.comp = ctx.createDynamicsCompressor();
    this.comp.threshold.value = -16; this.comp.knee.value = 18; this.comp.ratio.value = 3.2; this.comp.attack.value = .008; this.comp.release.value = .22;
    this.master = ctx.createGain(); this.master.gain.value = .9;
    this.busFilter.connect(this.comp); this.comp.connect(this.master); this.master.connect(ctx.destination);
    this.dest = ctx.createMediaStreamDestination(); this.master.connect(this.dest);
    // 컨볼루션 리버브 — 지수감쇠 스테레오 IR 2.4s
    this.verb = ctx.createConvolver();
    const sr = ctx.sampleRate, len = Math.floor(sr * 2.4), ir = ctx.createBuffer(2, len, sr);
    for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6) * (ch ? .92 : 1); }
    this.verb.buffer = ir;
    const vg = ctx.createGain(); vg.gain.value = .34; this.verb.connect(vg); vg.connect(this.busFilter);
    // 핑퐁 딜레이 (BPM 동기, play()에서 시간 설정)
    this.dL = ctx.createDelay(); this.dR = ctx.createDelay();
    const fb = ctx.createGain(); fb.gain.value = .32;
    const mkPan = v => { if (ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = v; return p; } return ctx.createGain(); };
    const pL = mkPan(-.6), pR = mkPan(.6);
    this.dIn = ctx.createGain();
    this.dIn.connect(this.dL); this.dL.connect(pL); pL.connect(this.busFilter);
    this.dL.connect(this.dR); this.dR.connect(pR); pR.connect(this.busFilter);
    this.dR.connect(fb); fb.connect(this.dL);
    // 노이즈 버퍼 (햇·라이저)
    const nb = ctx.createBuffer(1, sr * 2, sr), nd = nb.getChannelData(0);
    for (let i = 0; i < sr * 2; i++) nd[i] = Math.random() * 2 - 1;
    this.noiseBuf = nb;
  };
  // 보이스 아웃: 드라이 + 리버브/딜레이 센드
  Audio._out = function (node, opt) {
    opt = opt || {}; const ctx = this.ctx; let last = node;
    if (ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = opt.pan || 0; last.connect(p); last = p; }
    last.connect(this.busFilter);
    if (opt.verb) { const s = ctx.createGain(); s.gain.value = opt.verb; last.connect(s); s.connect(this.verb); }
    if (opt.delay) { const s = ctx.createGain(); s.gain.value = opt.delay; last.connect(s); s.connect(this.dIn); }
  };

  /* --- 악기 --- */
  // 감산합성 패드: 디튠 saw 2겹 + 필터 엔벌로프 (아날로그 스트링 무브먼트)
  Audio.pad = function (freq, t, dur, vel, pan) {
    const ctx = this.ctx, g = ctx.createGain(), f = ctx.createBiquadFilter();
    f.type = 'lowpass'; f.Q.value = .7;
    f.frequency.setValueAtTime(freq * 1.6, t);
    f.frequency.linearRampToValueAtTime(freq * 5, t + dur * .5);
    f.frequency.linearRampToValueAtTime(freq * 1.8, t + dur);
    [-7, 7].forEach(dt => { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = freq; o.detune.value = dt; o.connect(f); o.start(t); o.stop(t + dur + .1); });
    f.connect(g);
    g.gain.setValueAtTime(1e-4, t); g.gain.linearRampToValueAtTime(vel, t + dur * .35);
    g.gain.setValueAtTime(vel, t + dur * .7); g.gain.exponentialRampToValueAtTime(1e-4, t + dur);
    this._out(g, { pan, verb: .5 });
  };
  // FM 일렉피아노: 2:1 모듈레이터 + 인덱스 감쇠 (DX 계열 EP)
  Audio.ep = function (freq, t, dur, vel, pan, delaySend) {
    const ctx = this.ctx;
    const car = ctx.createOscillator(); car.frequency.value = freq;
    const mod = ctx.createOscillator(); mod.frequency.value = freq * 2;
    const mg = ctx.createGain();
    mg.gain.setValueAtTime(freq * 1.5, t); mg.gain.exponentialRampToValueAtTime(freq * .02, t + Math.min(.5, dur));
    mod.connect(mg); mg.connect(car.frequency);
    const g = ctx.createGain();
    g.gain.setValueAtTime(1e-4, t); g.gain.linearRampToValueAtTime(vel, t + .006);
    g.gain.exponentialRampToValueAtTime(Math.max(1e-4, vel * .35), t + dur * .4);
    g.gain.exponentialRampToValueAtTime(1e-4, t + dur);
    car.connect(g); this._out(g, { pan, verb: .3, delay: delaySend || 0 });
    car.start(t); car.stop(t + dur + .1); mod.start(t); mod.stop(t + dur + .1);
  };
  // 베이스: triangle + 서브 sine, 필터 스냅
  Audio.bassN = function (freq, t, dur, vel) {
    const ctx = this.ctx, g = ctx.createGain(), f = ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.setValueAtTime(freq * 6, t); f.frequency.exponentialRampToValueAtTime(freq * 2, t + dur);
    const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = freq;
    const s = ctx.createOscillator(); s.type = 'sine'; s.frequency.value = freq / 2;
    const sg = ctx.createGain(); sg.gain.value = .5;
    o.connect(f); s.connect(sg); sg.connect(f); f.connect(g);
    g.gain.setValueAtTime(1e-4, t); g.gain.linearRampToValueAtTime(vel, t + .015); g.gain.exponentialRampToValueAtTime(1e-4, t + dur);
    this._out(g, { verb: .06 });
    o.start(t); o.stop(t + dur + .05); s.start(t); s.stop(t + dur + .05);
  };
  // 드럼: 킥(피치 드롭) · 햇(하이패스 노이즈) · 라이저
  Audio.kick = function (t, vel) { const ctx = this.ctx, o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(44, t + .12);
    g.gain.setValueAtTime(vel, t); g.gain.exponentialRampToValueAtTime(1e-4, t + .24);
    o.connect(g); this._out(g, { verb: .04 }); o.start(t); o.stop(t + .3); };
  Audio.hat = function (t, vel, open) { const ctx = this.ctx, src = ctx.createBufferSource(); src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7800;
    const g = ctx.createGain(); const d = open ? .24 : .05;
    g.gain.setValueAtTime(vel, t); g.gain.exponentialRampToValueAtTime(1e-4, t + d);
    src.connect(f); f.connect(g); this._out(g, { pan: .25, verb: .05 }); src.start(t); src.stop(t + d + .05); };
  Audio.riser = function (t, dur) { const ctx = this.ctx, src = ctx.createBufferSource(); src.buffer = this.noiseBuf; src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.2;
    f.frequency.setValueAtTime(300, t); f.frequency.exponentialRampToValueAtTime(6000, t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(1e-4, t); g.gain.linearRampToValueAtTime(.09, t + dur); g.gain.linearRampToValueAtTime(1e-4, t + dur + .15);
    src.connect(f); f.connect(g); this._out(g, { verb: .4 }); src.start(t); src.stop(t + dur + .3); };

  // 보이스리딩: 이전 보이싱에서 최소 이동으로 옥타브 배치
  function voiceLead(tones, prev, root) {
    const v = tones.map(s => root + s);
    if (!prev) return v.sort((a, b) => a - b);
    return v.map(n => { let best = n, bd = 1e9;
      [-12, 0, 12].forEach(o => { const c = n + o; const d = Math.min.apply(null, prev.map(p => Math.abs(p - c))); if (d < bd) { bd = d; best = c; } });
      return best; }).sort((a, b) => a - b);
  }

  /* --- 장르 인식: 이미지 분석 → 어울리는 음악 장르 --- */
  AuraCore.GENRES = {
    lofi:      { name: 'Lo-fi', bpm: 74,  swing: .14, drums: 'boom', wob: true,  vinyl: true,  bass: 'round',  pad: 'warm',  desc: '나른한 재즈 코드·스윙 비트' },
    cinematic: { name: 'Cinematic', bpm: 82, swing: .02, drums: 'epic', wob: false, vinyl: false, bass: 'sub',   pad: 'strings', desc: '웅장한 스트링·팀파니' },
    ambient:   { name: 'Ambient', bpm: 60, swing: 0,   drums: 'none', wob: false, vinyl: false, bass: 'drone', pad: 'glass', desc: '떠도는 패드·무박자' },
    synthwave: { name: 'Synthwave', bpm: 104, swing: 0, drums: 'four', wob: false, vinyl: false, bass: 'pluck', pad: 'saw',   desc: '아르페지오·네온 신스' },
    dreampop:  { name: 'Dream-pop', bpm: 92, swing: .06, drums: 'soft', wob: false, vinyl: false, bass: 'round', pad: 'wide',  desc: '리버비한 기타·부드러운 비트' },
  };
  AuraCore.detectGenre = function (a) {
    const b = a.bright, s = a.sat, w = a.warm, au = a.aura;
    if (b < .34 && s < .3) return 'ambient';                 // 어둡고 무채 → 앰비언트
    if (au < -.05 && s < .45) return 'cinematic';            // 어둡고 극적 → 시네마틱
    if (s > .5 && (Math.abs(w) < .1 || w < 0)) return 'synthwave'; // 채도 높고 차가움 → 신스웨이브
    if (b > .55 && s > .35) return 'dreampop';               // 밝고 부드러움 → 드림팝
    return 'lofi';                                           // 기본 → 로파이
  };

  /* --- 작곡: 장르 인식 → 장르별 편곡 (3섹션 A→A'→Climax + 픽카르디) --- */
  Audio.play = function (a, onEnd, genreKey) {
    this.ensure(); const ctx = this.ctx;
    const gk = genreKey || AuraCore.detectGenre(a), G = AuraCore.GENRES[gk] || AuraCore.GENRES.lofi;
    this.lastGenre = gk;
    const dark = a.aura < -.1;
    const bpm = Math.round(G.bpm + a.sat * 12 - (dark ? 4 : 0));
    const beat = 60 / bpm, bar = beat * 4;
    this.dL.delayTime.value = beat * .75; this.dR.delayTime.value = beat * .75;
    const key = 48 + Math.floor(((a.domHue) % 360) / 360 * 12);
    // 장르별 화성: 로파이=재즈ii-V, 신스웨이브=마이너 팝, 시네마틱=장엄, 앰비언트=서스펜디드
    const minorJazz = [[0,3,7,10,14],[5,8,12,15],[10,14,17,21],[3,7,10,14]];   // i9 iv9 bVII9 bIII
    const brightPop = [[0,4,7,11,14],[9,12,16,19],[5,9,12,16],[7,11,14,17]];   // IΔ vi IVΔ V
    const epic      = [[0,4,7,12],[8,12,15,19],[5,9,12,17],[7,11,14,19]];      // I bVI IV V (장엄)
    const sus       = [[0,5,7,12],[2,7,9,14],[-3,2,4,9],[0,5,7,12]];           // sus 부유
    const progMap = { lofi:minorJazz, dreampop:brightPop, synthwave:(dark?minorJazz:brightPop), cinematic:epic, ambient:sus };
    const progA = progMap[gk] || brightPop;
    const progC = gk==='cinematic'? [[0,4,7,12],[5,9,12,17],[7,11,14,19],[0,4,7,12]] : brightPop;
    const hum = () => (Math.random() - .5) * (.012 + G.swing * .06);
    const swingOff = i => (i % 2 ? beat * G.swing : 0);
    const w = a.wave;
    const motif = [0,1,2,3].map(i => Math.floor(w[Math.floor(i*w.length/4)] * 5) % 5);
    const inv = motif.map(d => 4 - d);
    const t0 = ctx.currentTime + .08; let t = t0, prevV = null;
    const nSec = gk==='ambient' ? 3 : 3;
    const sections = [
      { prog: progA, level: 0, mel: motif,                dens: .55, cutoff: gk==='ambient'?1100:1500 },
      { prog: progA, level: 1, mel: motif.map(d=>(d+1)%5), dens: .8,  cutoff: gk==='ambient'?1600:2600 },
      { prog: progC, level: 2, mel: inv,                   dens: 1,   cutoff: gk==='ambient'?2200:5200 },
    ];
    const drumFor = (lvl, b4) => {
      if (G.drums==='none' || lvl===0) return;
      if (G.drums==='boom'){ if(b4===0) this.kick(t+b4*beat+hum(),.5); if(b4===2) this.kick(t+b4*beat+beat*.5+hum(),.42);
        this.hat(t+b4*beat+beat*.5+hum(), b4===1?.09:.05, false); return; }
      if (G.drums==='four'){ this.kick(t+b4*beat,.5); this.hat(t+b4*beat+beat*.5, .06, false); return; }
      if (G.drums==='soft'){ if(b4===0||b4===2) this.kick(t+b4*beat+hum(),.32); this.hat(t+b4*beat+hum(),.04); return; }
      if (G.drums==='epic'){ if(b4===0||b4===2) this.kick(t+b4*beat,.6); if(lvl===2&&b4===3){this.kick(t+b4*beat+beat*.5,.4);} }
    };
    sections.forEach((S, si) => {
      this.busFilter.frequency.linearRampToValueAtTime(S.cutoff, t + bar * .8);
      if (si === 2 && G.drums!=='none') this.riser(t - bar * .85, bar * .8);
      const penta = dark ? [0,3,5,7,10] : [0,2,4,7,9];
      S.prog.forEach((tones, bi) => {
        const v = voiceLead(tones, prevV, key); prevV = v;
        const padDur = gk==='ambient' ? bar*1.4 : bar*1.02;
        v.forEach((n, i) => this.pad(m2f(n), t, padDur, .04 + (i===v.length-1?.014:0), (i/(v.length-1)-.5)*.7));
        // 베이스
        const rt = key - 24 + tones[0];
        if (G.bass==='drone'){ this.bassN(m2f(rt), t, bar, .12); }
        else if (G.bass==='pluck'){ for(let n=0;n<8;n++) this.bassN(m2f(rt+(n%2?7:0)), t+n*beat*.5, beat*.4, .12); }
        else { this.bassN(m2f(rt), t+hum(), beat*1.6, .15); this.bassN(m2f(rt+7), t+beat*2+hum(), beat*1.1, .12);
          if (S.dens>.7) this.bassN(m2f(rt+12), t+beat*3.5+hum(), beat*.45, .1); }
        // 멜로디
        if (gk!=='ambient') S.mel.forEach((deg, ni) => {
          if (bi===3 && ni===3) return;
          const tt = t + ni*beat + swingOff(ni) + hum();
          const oct = (bi%2===1 && ni===2) ? 12 : 0;
          const vel = .12 * (ni===0?1.2:.9) * (.85 + S.dens*.3);
          this.ep(m2f(key+12+penta[deg]+oct), tt, beat*.95, vel, (deg/4-.5)*.6, .22);
        }); else if (si>0) { const d=motif[bi%4]; this.ep(m2f(key+24+penta[d]), t, bar*.9, .05, (bi%2?.4:-.4), .5); } // 앰비언트=긴 벨
        // 아르페지오 (신스웨이브/드림팝 레벨1+)
        if ((gk==='synthwave'||gk==='dreampop') && S.level>0) for (let n=0;n<8;n++)
          this.ep(m2f(v[n%v.length]+12), t+n*beat*.5+hum(), beat*.42, .045, n%2?.55:-.55, .3);
        for (let b4=0;b4<4;b4++) drumFor(S.level, b4);
        t += bar;
      });
    });
    // 픽카르디 피날레
    this.busFilter.frequency.linearRampToValueAtTime(gk==='ambient'?2600:6500, t + .6);
    this.bassN(m2f(key-24), t, 4, .16);
    [0,4,7,9,14,16].forEach((s,i)=>this.pad(m2f(key+s), t+.02*i, 4.2, .055, (i%2?.45:-.45)));
    if (gk!=='ambient') [0,2,4,7,9,12,14,16].forEach((s,i)=>this.ep(m2f(key+12+s), t+i*beat*.22, 1.5, .09, (i/8-.5), .3));
    t += gk==='ambient'?4.5:4;
    const total = t - t0; this.playing = true;
    setTimeout(() => { this.playing = false; if (onEnd) onEnd(); }, total * 1000);
    return total;
  };
  AuraCore.audio = Audio;

  /* ---------- 황금비 구도 재구성 (content-aware recrop → AI 재가공) ---------- */
  AuraCore.recompose = function (img, a) {
    const iw = img.width || img.naturalWidth, ih = img.height || img.naturalHeight;
    const phi = 1.618, landscape = iw >= ih, cropAR = landscape ? phi : 1 / phi;
    let cw, ch;
    if (iw / ih > cropAR) { ch = ih; cw = ch * cropAR; } else { cw = iw; ch = cw / cropAR; }
    const fx = a.centroid.x * iw, fy = a.centroid.y * ih;
    const tx = a.centroid.x < .5 ? .382 : .618, ty = a.centroid.y < .5 ? .382 : .618; // 가까운 황금 교차점
    let x0 = Math.max(0, Math.min(iw - cw, fx - tx * cw));
    let y0 = Math.max(0, Math.min(ih - ch, fy - ty * ch));
    const crop = document.createElement('canvas'); crop.width = Math.round(cw); crop.height = Math.round(ch);
    crop.getContext('2d').drawImage(img, x0, y0, cw, ch, 0, 0, Math.round(cw), Math.round(ch));
    const graded = AuraCore.grade(crop).after; // 색·톤 AI 재가공
    return {
      result: graded, cropRect: { x: x0 / iw, y: y0 / ih, w: cw / iw, h: ch / ih },
      target: { x: tx, y: ty }, focal: a.centroid,
      note: `피사체를 황금 교차점(φ ${tx})으로 재배치하고 색·톤을 재가공했습니다.`
    };
  };

  /* ---------- Living Photo · 무빙 이미지 엔진 ----------
     Ken Burns(황금점 향해 느린 줌·팬) + 라이트 릭 스윕 + 부유 입자 + 비네트.
     energy(0..1)를 넣으면 노래와 동기화된다. */
  AuraCore.livingFrame = function (c, w, h, img, a, t, energy) {
    energy = energy === undefined ? 0.45 : energy;
    const dark = a.aura < -0.1;
    // Ken Burns: 12초 주기로 1.0→1.12 줌하며 초점(황금점 방향)으로 팬
    const cyc = (t % 12) / 12, ease = 0.5 - 0.5 * Math.cos(cyc * Math.PI * 2);
    const zoom = 1.04 + 0.09 * ease + energy * 0.02;
    const fx = a.centroid.x, fy = a.centroid.y;
    const ar = img.width / img.height, cr = w / h;
    let dw, dh; if (ar > cr) { dh = h * zoom; dw = dh * ar; } else { dw = w * zoom; dh = dw / ar; }
    const panX = (fx - 0.5) * (dw - w) * ease, panY = (fy - 0.5) * (dh - h) * ease;
    const dx = (w - dw) / 2 - panX, dy = (h - dh) / 2 - panY;
    c.fillStyle = '#000'; c.fillRect(0, 0, w, h);
    c.drawImage(img, dx, dy, dw, dh);
    // 라이트 릭: 주조색 광선이 천천히 가로지름
    const p = a.palette[0];
    const lx = ((t * 0.05) % 1.6 - 0.3) * w;
    const lg = c.createLinearGradient(lx, 0, lx + w * 0.45, h);
    lg.addColorStop(0, 'rgba(0,0,0,0)');
    lg.addColorStop(0.5, `rgba(${Math.min(255, p.r + 90)},${Math.min(255, p.g + 70)},${Math.min(255, p.b + 50)},${(dark ? 0.10 : 0.16) * (0.6 + energy * 0.7)})`);
    lg.addColorStop(1, 'rgba(0,0,0,0)');
    c.globalCompositeOperation = 'screen'; c.fillStyle = lg; c.fillRect(0, 0, w, h);
    // 부유 입자(먼지/반딧불) — 결정적 시드로 프레임 간 연속
    c.globalCompositeOperation = 'lighter';
    const N = Math.round(16 + energy * 22);
    for (let i = 0; i < N; i++) {
      const sd = i * 12.9898, r1 = (Math.sin(sd) * 43758.5453) % 1, r2 = (Math.sin(sd * 1.7) * 24634.63) % 1;
      const px = ((Math.abs(r1) + t * (0.008 + Math.abs(r2) * 0.02)) % 1) * w;
      const py = ((Math.abs(r2) + t * 0.012 * (i % 2 ? 1 : -1) + 10) % 1) * h;
      const tw = 0.35 + 0.65 * Math.abs(Math.sin(t * (0.8 + Math.abs(r1)) + i));
      const sz = 0.8 + Math.abs(r2) * 2.2 + energy * 1.2;
      c.fillStyle = dark ? `rgba(200,220,255,${0.28 * tw})` : `rgba(255,240,200,${0.3 * tw})`;
      c.beginPath(); c.arc(px, py, sz, 0, 7); c.fill();
    }
    c.globalCompositeOperation = 'source-over';
    // 비네트 + 미세 그레인 대비
    const vg = c.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.32)');
    c.fillStyle = vg; c.fillRect(0, 0, w, h);
  };

  /* ---------- 2.5D 패럴랙스 ----------
     행 스트립 변위: 아래(가까움)일수록 크게, 위(멀수록) 작게 흔들려 입체감.
     px/py(-1..1)는 시차 방향 — 마우스나 자동 스웨이. */
  AuraCore.parallaxFrame = function (c, w, h, img, a, t, px, py, energy) {
    energy = energy === undefined ? 0.45 : energy;
    px = px === undefined ? Math.sin(t * 0.4) * 0.6 : px;
    py = py === undefined ? Math.cos(t * 0.31) * 0.35 : py;
    const zoom = 1.12; // 가장자리 여유
    const ar = img.width / img.height, cr = w / h;
    let dw, dh; if (ar > cr) { dh = h * zoom; dw = dh * ar; } else { dw = w * zoom; dh = dw / ar; }
    const bx = (w - dw) / 2, by = (h - dh) / 2;
    c.fillStyle = '#000'; c.fillRect(0, 0, w, h);
    const STRIPS = 42, maxShift = w * 0.028 * (0.7 + energy * 0.6);
    const sy = img.height / STRIPS;
    for (let i = 0; i < STRIPS; i++) {
      const dNear = i / (STRIPS - 1);            // 0=위(멀다) → 1=아래(가깝다)
      const depth = 0.25 + dNear * 0.75;
      const shX = px * maxShift * depth, shY = py * maxShift * 0.5 * depth;
      const dyS = by + (i / STRIPS) * dh;
      c.drawImage(img, 0, i * sy, img.width, sy + 1, bx + shX, dyS + shY, dw, dh / STRIPS + 1.2);
    }
    // 깊이 안개(위쪽 원경을 살짝 흐리게 보이도록 밝은 베일)
    const fog = c.createLinearGradient(0, 0, 0, h * 0.6);
    fog.addColorStop(0, a.aura < -0.1 ? 'rgba(140,170,220,0.10)' : 'rgba(255,240,210,0.10)');
    fog.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = fog; c.fillRect(0, 0, w, h * 0.6);
    // 비네트
    const vg = c.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.34)');
    c.fillStyle = vg; c.fillRect(0, 0, w, h);
  };

  /* ---------- 3D 깊이 포인트 클라우드 ----------
     이미지를 깊이 그리드로 변환(위=원경·어두움=원경 휴리스틱) →
     회전(yaw/pitch) 가능한 3D 릴리프. 드래그로 돌려 깊이를 살펴본다. */
  AuraCore.buildDepthGrid = function (img, cols, nLayers) {
    cols = cols || 88; nLayers = nLayers || 4;
    const iw = img.width || img.naturalWidth, ih = img.height || img.naturalHeight;
    const rows = Math.max(8, Math.round(cols * ih / iw));
    const oc = document.createElement('canvas'); oc.width = cols; oc.height = rows;
    const o = oc.getContext('2d'); o.drawImage(img, 0, 0, cols, rows);
    let data; try { data = o.getImageData(0, 0, cols, rows).data; } catch (e) { return null; }
    const pts = [];
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      const i = (y * cols + x) * 4;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      // 연속 깊이 추정: 상단=원경 + 어두움=원경 (0..1, 1=가까움)
      const depth = 1 - ((y / (rows - 1)) * 0.6 + (1 - lum) * 0.4);
      pts.push({ x: x / (cols - 1) - 0.5, y: y / (rows - 1) - 0.5, depth, r, g, b, lum });
    }
    // 1D k-means로 깊이를 nLayers 레이어로 분리 (전경/중경/원경)
    let cent = Array.from({ length: nLayers }, (_, k) => (k + .5) / nLayers);
    for (let it = 0; it < 8; it++) {
      const sum = new Float64Array(nLayers), cnt = new Int32Array(nLayers);
      for (const p of pts) { let bk = 0, bd = 9; for (let k = 0; k < nLayers; k++) { const d = Math.abs(p.depth - cent[k]); if (d < bd) { bd = d; bk = k; } } p.layer = bk; sum[bk] += p.depth; cnt[bk]++; }
      for (let k = 0; k < nLayers; k++) if (cnt[k]) cent[k] = sum[k] / cnt[k];
    }
    // 레이어를 가까운 순으로 정렬 → layerZ: 원경(-)..근경(+), 레이어 간 '간격' 부여
    const order = cent.map((c0, k) => ({ k, c0 })).sort((a, b) => a.c0 - b.c0); // 먼→가까운
    const remap = {}; order.forEach((o2, rank) => remap[o2.k] = rank);
    for (const p of pts) { const rank = remap[p.layer]; p.layer = rank; p.layerZ = (rank / (nLayers - 1) - 0.5); }
    return { pts, cols, rows, ar: iw / ih, nLayers };
  };
  // 원본 이미지를 고해상 텍스처로 캐시(메시 위에 실사 화질로 얹기)
  AuraCore._texCache = { key: null, cv: null };
  AuraCore._getTex = function (img) {
    const iw = img.width || img.naturalWidth;
    if (AuraCore._texCache.key === img.src && AuraCore._texCache.cv) return AuraCore._texCache.cv;
    const cv = document.createElement('canvas'); const s = Math.min(1024, iw);
    cv.width = s; cv.height = Math.round(s * (img.height || img.naturalHeight) / iw);
    cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
    AuraCore._texCache = { key: img.src, cv }; return cv;
  };
  AuraCore.depth3DFrame = function (c, w, h, grid, yaw, pitch, t, energy, img) {
    energy = energy === undefined ? .45 : energy;
    c.fillStyle = '#070709'; c.fillRect(0, 0, w, h);
    const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
    const unit = Math.min(w / grid.ar, h) * (grid.ar > 1 ? grid.ar : 1) * 0.9;
    const sxu = unit * (grid.ar >= 1 ? 1 : grid.ar), syc = unit / (grid.ar >= 1 ? grid.ar : 1);
    const gap = 0.5 + energy * 0.14, relief = 0.05, focal = 2.6;
    const cols = grid.cols, rows = grid.rows, P = grid.pts;
    // 정점 투영
    const V = new Array(P.length);
    for (let i = 0; i < P.length; i++) {
      const p = P[i];
      const z0 = p.layerZ * gap + (p.depth - 0.5) * relief;
      const x1 = p.x * cy + z0 * sy, z1 = -p.x * sy + z0 * cy;
      const y1 = p.y * cp - z1 * sp, z2 = p.y * sp + z1 * cp;
      const d = focal / (focal + z2);
      V[i] = { sx: w / 2 + x1 * sxu * d, sy: h / 2 + y1 * syc * d, z: z2, layer: p.layer };
    }
    // 텍스처가 있으면 삼각형 어파인 매핑으로 실사 렌더
    const tex = img ? AuraCore._getTex(img) : null;
    const near = l => 0.62 + (l / Math.max(1, grid.nLayers - 1)) * 0.5;   // 대기원근
    // 셀(2삼각형) 목록 — 같은 레이어끼리만 잇고, 평균 z로 정렬(painter's)
    const cells = [];
    for (let y = 0; y < rows - 1; y++) for (let x = 0; x < cols - 1; x++) {
      const a = y * cols + x, b = a + 1, cc = a + cols, dd = cc + 1;
      const la = P[a].layer;
      if (P[b].layer !== la || P[cc].layer !== la || P[dd].layer !== la) continue; // 레이어 경계는 끊음
      cells.push({ a, b, cc, dd, z: (V[a].z + V[b].z + V[cc].z + V[dd].z) / 4, layer: la });
    }
    cells.sort((p, q) => q.z - p.z);
    const tw = tex ? tex.width : cols, th = tex ? tex.height : rows;
    const uAt = i => (P[i].x + .5), vAt = i => (P[i].y + .5);
    if (tex) {
      // 배경판: 전체 사진을 가장 먼 깊이에 평평하게 깔아 레이어 분리 구멍을 메움(살짝 어둡게)
      const backZ = -0.5 * gap - relief * .5;
      const corner = (cx0, cy0) => { const x1 = cx0 * cy + backZ * sy, z1 = -cx0 * sy + backZ * cy, y1 = cy0 * cp - z1 * sp, z2 = cy0 * sp + z1 * cp, d = focal / (focal + z2); return { sx: w / 2 + x1 * sxu * d, sy: h / 2 + y1 * syc * d }; };
      const c00 = corner(-.5, -.5), c10 = corner(.5, -.5), c01 = corner(-.5, .5), c11 = corner(.5, .5);
      c.save(); c.globalAlpha = .82;
      drawTexTri(c, tex, c00, c10, c01, 0, 0, tw, 0, 0, th);
      drawTexTri(c, tex, c10, c11, c01, tw, 0, tw, th, 0, th);
      c.restore();
      c.save(); c.globalAlpha = .35; c.fillStyle = '#000';
      c.beginPath(); c.moveTo(c00.sx, c00.sy); c.lineTo(c10.sx, c10.sy); c.lineTo(c11.sx, c11.sy); c.lineTo(c01.sx, c01.sy); c.closePath(); c.fill(); c.restore();
      for (const cell of cells) {
        drawTexTri(c, tex, V[cell.a], V[cell.b], V[cell.cc], uAt(cell.a) * tw, vAt(cell.a) * th, uAt(cell.b) * tw, vAt(cell.b) * th, uAt(cell.cc) * tw, vAt(cell.cc) * th);
        drawTexTri(c, tex, V[cell.b], V[cell.dd], V[cell.cc], uAt(cell.b) * tw, vAt(cell.b) * th, uAt(cell.dd) * tw, vAt(cell.dd) * th, uAt(cell.cc) * tw, vAt(cell.cc) * th);
      }
    } else {
      for (const cell of cells) { const br = near(cell.layer), p = P[cell.a];
        c.fillStyle = `rgb(${p.r * br | 0},${p.g * br | 0},${p.b * br | 0})`;
        c.beginPath(); c.moveTo(V[cell.a].sx, V[cell.a].sy); c.lineTo(V[cell.b].sx, V[cell.b].sy); c.lineTo(V[cell.dd].sx, V[cell.dd].sy); c.lineTo(V[cell.cc].sx, V[cell.cc].sy); c.closePath(); c.fill(); }
    }
    const vg = c.createRadialGradient(w / 2, h / 2, Math.min(w, h) * .36, w / 2, h / 2, Math.max(w, h) * .74);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.42)');
    c.fillStyle = vg; c.fillRect(0, 0, w, h);
  };
  // 삼각형 어파인 텍스처 매핑 (uv → 화면 좌표)
  function drawTexTri(ctx, tex, v0, v1, v2, u0, w0, u1, w1, u2, w2) {
    ctx.save();
    ctx.beginPath(); ctx.moveTo(v0.sx, v0.sy); ctx.lineTo(v1.sx, v1.sy); ctx.lineTo(v2.sx, v2.sy); ctx.closePath(); ctx.clip();
    const dx1 = v1.sx - v0.sx, dy1 = v1.sy - v0.sy, dx2 = v2.sx - v0.sx, dy2 = v2.sy - v0.sy;
    const ux1 = u1 - u0, uy1 = w1 - w0, ux2 = u2 - u0, uy2 = w2 - w0;
    const det = ux1 * uy2 - ux2 * uy1; if (Math.abs(det) < 1e-6) { ctx.restore(); return; }
    const ia = (uy2 * dx1 - uy1 * dx2) / det, ib = (uy2 * dy1 - uy1 * dy2) / det;
    const ic = (ux1 * dx2 - ux2 * dx1) / det, id = (ux1 * dy2 - ux2 * dy1) / det;
    ctx.transform(ia, ib, ic, id, v0.sx - ia * u0 - ic * w0, v0.sy - ib * u0 - id * w0);
    ctx.drawImage(tex, 0, 0);
    ctx.restore();
  }

  /* ---------- 필름 룩 프리셋 (마스터 그레이딩) ---------- */
  AuraCore.FILM_PRESETS = {
    none:     { name: 'AURA 기본', desc: '자동 보정' },
    portra:   { name: 'Portra 400', desc: '따뜻한 살결·부드러운 섀도우',
      expo: 1.06, contrast: 1.05, sat: 1.08, warmShift: 0.045, liftR: .03, liftG: .02, liftB: .01, hlDesat: .15, grain: .05 },
    cinestill:{ name: 'CineStill 800T', desc: '틸 섀도우·붉은 헐레이션',
      expo: 1.02, contrast: 1.12, sat: 1.02, warmShift: -0.03, liftR: 0, liftG: .015, liftB: .04, halation: .5, grain: .08 },
    fuji:     { name: 'Fuji Superia', desc: '초록 결·시원한 미드톤',
      expo: 1.04, contrast: 1.08, sat: 1.12, warmShift: -0.01, liftR: 0, liftG: .03, liftB: .015, grain: .06 },
    noir:     { name: 'Noir B&W', desc: '고대비 흑백·짙은 그레인',
      expo: 1.0, contrast: 1.3, sat: 0, warmShift: 0, liftR: .01, liftG: .01, liftB: .01, grain: .12 },
  };
  AuraCore.filmGrade = function (src, key) {
    const P = AuraCore.FILM_PRESETS[key];
    if (!P || key === 'none') return AuraCore.grade(src);
    const maxD = 900; let iw = src.width || src.naturalWidth, ih = src.height || src.naturalHeight;
    const scl = Math.min(1, maxD / Math.max(iw, ih)); iw = Math.round(iw * scl); ih = Math.round(ih * scl);
    const before = document.createElement('canvas'); before.width = iw; before.height = ih;
    const ob = before.getContext('2d'); ob.drawImage(src, 0, 0, iw, ih);
    const d = ob.getImageData(0, 0, iw, ih).data;
    const after = document.createElement('canvas'); after.width = iw; after.height = ih;
    const oa = after.getContext('2d'); const out = oa.createImageData(iw, ih); const o = out.data;
    const cx = iw / 2, cy = ih / 2, mr = Math.hypot(cx, cy);
    for (let y = 0; y < ih; y++) for (let x = 0; x < iw; x++) {
      const i = (y * iw + x) * 4;
      let r = d[i] / 255 * P.expo, g = d[i + 1] / 255 * P.expo, b = d[i + 2] / 255 * P.expo;
      r = (r - .5) * P.contrast + .5; g = (g - .5) * P.contrast + .5; b = (b - .5) * P.contrast + .5;
      let lum = .299 * r + .587 * g + .114 * b;
      r = lum + (r - lum) * P.sat; g = lum + (g - lum) * P.sat; b = lum + (b - lum) * P.sat;
      r += P.warmShift; b -= P.warmShift;                                   // 색온도
      const shadow = Math.max(0, .5 - lum) * 2;                             // 섀도우 리프트(필름 페이드)
      r += P.liftR * shadow; g += P.liftG * shadow; b += P.liftB * shadow;
      if (P.hlDesat) { const hl = Math.max(0, lum - .6) * 2.5; const l2 = .299 * r + .587 * g + .114 * b;
        r = r + (l2 - r) * P.hlDesat * hl; g = g + (l2 - g) * P.hlDesat * hl; b = b + (l2 - b) * P.hlDesat * hl; }
      if (P.halation) { const hl = Math.max(0, lum - .78) * 4; r += P.halation * .12 * hl; g += P.halation * .03 * hl; } // 붉은 번짐
      if (P.grain) { const n = (Math.sin((x * 12.9898 + y * 78.233)) * 43758.5453 % 1) * P.grain * .5; r += n; g += n; b += n; }
      const vf = 1 - .22 * Math.pow(Math.hypot(x - cx, y - cy) / mr, 2.2); r *= vf; g *= vf; b *= vf;
      o[i] = Math.max(0, Math.min(255, r * 255)); o[i + 1] = Math.max(0, Math.min(255, g * 255)); o[i + 2] = Math.max(0, Math.min(255, b * 255)); o[i + 3] = 255;
    }
    oa.putImageData(out, 0, 0);
    return { before, after, edits: [['필름', P.name], ['특성', P.desc]] };
  };

  /* ---------- 미적 정체성 집계 ---------- */
  AuraCore.identity = function (analyses) {
    if (!analyses.length) return null;
    const avg = k => analyses.reduce((s, a) => s + a[k], 0) / analyses.length;
    const aB = avg('bright'), aW = avg('warm'), aS = avg('sat'), aA = avg('aura');
    const varr = analyses.reduce((s, a) => s + (a.warm - aW) ** 2 + (a.bright - aB) ** 2, 0) / analyses.length;
    const coherence = Math.max(0, Math.min(1, 1 - Math.sqrt(varr) * 2.2));
    const all = analyses.flatMap(a => a.palette.slice(0, 3));
    const step = Math.max(1, Math.floor(all.length / 6)); const sig = [];
    for (let i = 0; i < 6 && i * step < all.length; i++) { const g = all.slice(i * step, (i + 1) * step); const m = { r: 0, g: 0, b: 0 }; g.forEach(c => { m.r += c.r; m.g += c.g; m.b += c.b; }); sig.push(hex(m.r / g.length, m.g / g.length, m.b / g.length)); }
    const temp = aW > .08 ? '따뜻한' : aW < -.08 ? '차가운' : '중성적인', tone = aB > .5 ? '밝은' : '그윽한', con = coherence > .6 ? '뚜렷하게 일관된' : '폭넓게 열린';
    return { avgBright: aB, avgWarm: aW, avgSat: aS, avgAura: aA, coherence, signature: sig,
      summary: `당신은 <b>${temp} ${tone}</b> 톤에 끌리며, 취향이 <b>${con}</b> 편입니다.` };
  };

  /* ---------- IndexedDB 사진 라이브러리 ---------- */
  const AuraDB = {
    _db: null,
    open() {
      return new Promise((res, rej) => {
        if (this._db) return res(this._db);
        const r = indexedDB.open('aura_db', 1);
        r.onupgradeneeded = e => { const db = e.target.result; if (!db.objectStoreNames.contains('photos')) db.createObjectStore('photos', { keyPath: 'id', autoIncrement: true }); };
        r.onsuccess = e => { this._db = e.target.result; res(this._db); };
        r.onerror = e => rej(e.target.error);
      });
    },
    async add(rec) { const db = await this.open(); return new Promise((res, rej) => { const tx = db.transaction('photos', 'readwrite'); const rq = tx.objectStore('photos').add(rec); rq.onsuccess = e => res(e.target.result); rq.onerror = e => rej(e.target.error); }); },
    async all() { const db = await this.open(); return new Promise(res => { const out = []; db.transaction('photos').objectStore('photos').openCursor().onsuccess = e => { const c = e.target.result; if (c) { out.push(c.value); c.continue(); } else res(out); }; }); },
    async del(id) { const db = await this.open(); return new Promise(res => { db.transaction('photos', 'readwrite').objectStore('photos').delete(id).onsuccess = () => res(); }); },
    async clear() { const db = await this.open(); return new Promise(res => { db.transaction('photos', 'readwrite').objectStore('photos').clear().onsuccess = () => res(); }); },
  };
  AuraCore.db = AuraDB;

  global.AuraCore = AuraCore;
})(window);
