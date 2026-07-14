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
  Audio.play = function (a, onEnd) {
    this.ensure(); const t = this.ctx.currentTime;
    const root = 48 + Math.floor(((a.domHue) % 360) / 360 * 10), tempo = .5 - a.sat * .18, dark = a.aura < -.1;
    const minor = [0, 2, 3, 7, 10, 12], major = [0, 2, 4, 7, 9, 12, 16]; let time = t; const p1 = dark ? minor : major;
    for (let i = 0; i < 6; i++) { this.tone(m2f(root + p1[i % p1.length]), time, tempo * 2.4, .12, dark ? 'triangle' : 'sine'); time += tempo; }
    this.tone(m2f(root - 12), t, tempo * 8, .1, 'sine'); this.tone(m2f(root - 5), t, tempo * 8, .08, 'sine');
    for (let i = 0; i < 6; i++) { this.tone(m2f(root + (dark ? minor : major)[i % 6] + 7), time, tempo * 1.8, .11, 'sine'); time += tempo * .8; }
    const gr = root + 12, rt = time + .1; [0, 4, 7, 12, 16].forEach(s => { this.tone(m2f(gr + s), rt, 2.8, .13, 'sine'); this.tone(m2f(gr + s + 12), rt, 2.6, .06, 'triangle'); });
    [0, 4, 7, 12, 16, 19].forEach((s, i) => this.tone(m2f(gr + s), rt + i * .12, 1.6, .12, 'sine')); this.tone(m2f(gr - 24), rt, 3, .12, 'sine');
    this.playing = true; const total = (time - t) + 3.3; setTimeout(() => { this.playing = false; if (onEnd) onEnd(); }, total * 1000);
    return total;
  };
  AuraCore.audio = Audio;

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
