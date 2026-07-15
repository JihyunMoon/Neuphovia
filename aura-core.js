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

  /* ---------- 소니피케이션 (해피엔딩) ---------- */
  const Audio = { ctx: null, master: null, dest: null, playing: false };
  function m2f(m) { return 440 * Math.pow(2, (m - 69) / 12); }
  Audio.ensure = function () {
    if (!this.ctx) {
      this.ctx = new (global.AudioContext || global.webkitAudioContext)();
      this.master = this.ctx.createGain(); this.master.gain.value = .22;
      const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 2200;
      const dl = this.ctx.createDelay(); dl.delayTime.value = .3; const fb = this.ctx.createGain(); fb.gain.value = .28;
      this.master.connect(f); f.connect(this.ctx.destination); this.master.connect(dl); dl.connect(fb); fb.connect(dl); dl.connect(this.ctx.destination);
      this.dest = this.ctx.createMediaStreamDestination(); this.master.connect(this.dest);
    } else this.ctx.resume();
  };
  Audio.tone = function (fr, t, dur, vol, type) { const o = this.ctx.createOscillator(), g = this.ctx.createGain(); o.type = type || 'sine'; o.frequency.value = fr; o.connect(g); g.connect(this.master); g.gain.setValueAtTime(1e-4, t); g.gain.linearRampToValueAtTime(vol, t + .03); g.gain.exponentialRampToValueAtTime(1e-4, t + dur); o.start(t); o.stop(t + dur + .05); };
  // 다성부 보이스 (ADSR + 스테레오 팬 + 디튠)
  Audio.note = function (freq, t, dur, opt) {
    opt = opt || {}; const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = opt.type || 'sine'; o.frequency.value = freq; if (opt.detune) o.detune.value = opt.detune;
    o.connect(g); let last = g;
    if (opt.pan !== undefined && this.ctx.createStereoPanner) { const p = this.ctx.createStereoPanner(); p.pan.value = opt.pan; g.connect(p); last = p; }
    last.connect(this.master);
    const atk = opt.attack || .02, vol = opt.vol || .1;
    g.gain.setValueAtTime(1e-4, t); g.gain.linearRampToValueAtTime(vol, t + atk);
    g.gain.exponentialRampToValueAtTime(1e-4, t + dur);
    o.start(t); o.stop(t + dur + .05);
  };
  // 코드 진행 + 베이스 + 이미지 유래 멜로디 + 셰머 + 웅장한 해피엔딩
  Audio.play = function (a, onEnd) {
    this.ensure(); const t0 = this.ctx.currentTime + .06;
    const dark = a.aura < -.1;
    const root = (dark ? 45 : 48) + Math.floor(((a.domHue) % 360) / 360 * 12);
    const scale = dark ? [0, 2, 3, 5, 7, 8, 10] : [0, 2, 4, 5, 7, 9, 11];
    const beat = Math.max(.32, .48 - a.sat * .12);
    // 진행: 어두우면 i-VI-III-VII, 밝으면 I-V-vi-IV
    const prog = dark ? [[0, 3, 7], [8, 12, 15], [3, 7, 10], [10, 14, 17]]
                      : [[0, 4, 7], [7, 11, 14], [9, 12, 16], [5, 9, 12]];
    const mel = a.wave; let t = t0;
    for (let b = 0; b < prog.length; b++) {
      const ch = prog[b], barLen = beat * 4;
      this.note(m2f(root - 12 + ch[0]), t, barLen * .95, { type: 'triangle', vol: .13, attack: .04 }); // 베이스
      ch.forEach((s, i) => { // 패드(디튠 2겹)
        this.note(m2f(root + s), t, barLen, { type: 'sine', vol: .055, attack: .3, pan: (i - 1) * .35 });
        this.note(m2f(root + s), t, barLen, { type: 'triangle', vol: .028, detune: 7, attack: .3 });
      });
      for (let n = 0; n < 8; n++) { // 멜로디(이미지 파형 → 음계)
        const w = mel[(b * 8 + n) % mel.length]; if (w < .12) continue; // 어두운 열은 쉼표
        const deg = Math.min(scale.length - 1, Math.floor(w * scale.length)), oct = w > .66 ? 12 : 0;
        const dur = (n % 2 === 0 ? beat * .9 : beat * .5);
        this.note(m2f(root + 12 + scale[deg] + oct), t + n * beat * .5, dur, { type: 'triangle', vol: .085, attack: .01, pan: (w - .5) * .5 });
        if (n % 4 === 0) this.note(m2f(root + 24 + scale[deg]), t + n * beat * .5, beat * 1.6, { type: 'sine', vol: .03, attack: .02, pan: .4 }); // 셰머
      }
      t += barLen;
    }
    // 웅장한 해피엔딩 — 무조건 장조 I로 귀결
    const gr = root + 12, maj = [0, 4, 7, 12, 16, 19];
    this.note(m2f(gr - 24), t, 4, { type: 'triangle', vol: .14, attack: .05 });
    maj.forEach((s, i) => this.note(m2f(gr + s), t + .02 * i, 3.6, { type: 'sine', vol: .1, attack: .05, pan: (i % 2 ? .3 : -.3) }));
    [0, 4, 7, 12, 16, 19, 24].forEach((s, i) => this.note(m2f(gr + s), t + i * .13, 1.4, { type: 'triangle', vol: .09, attack: .01 })); // 상행 플루리시
    t += 4;
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
