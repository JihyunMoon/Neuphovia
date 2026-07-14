/* AURA · 공유 백엔드 헬퍼
   프론트 어디서든:  const data = await AuraAPI.analyze(blobOrFile);
   백엔드가 없으면 예외 → 각 페이지에서 로컬 폴백. */
window.AuraAPI = {
  base: (localStorage.getItem('aura_api') || 'http://localhost:8000'),
  setBase(u){ this.base = u; localStorage.setItem('aura_api', u); },
  async ping(){
    try{ const r = await fetch(this.base + '/', {method:'GET'}); return r.ok; }
    catch(e){ return false; }
  },
  async analyze(blob){
    const fd = new FormData();
    fd.append('image', blob, 'photo.png');
    const res = await fetch(this.base + '/api/analyze', { method:'POST', body: fd });
    if(!res.ok) throw new Error('backend ' + res.status);
    return res.json(); // {composition, aesthetic, aura, palette, music_seed, guidelines}
  }
};
