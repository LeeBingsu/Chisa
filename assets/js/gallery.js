/* ═══════════════════════════════════════════
   CHISA · 千咲  —  gallery
   팬아트는 Safebooru / Danbooru 공개 API에서 브라우저가 직접 불러온다.
   (이미지는 저장·재배포하지 않고 원본 서버에서 그대로 표시)
   ═══════════════════════════════════════════ */

(function gallery() {
  const TAG   = 'chisa_(wuthering_waves)';
  const PER   = 50;
  const grid  = $('#galGrid');
  const status= $('#gStatus');

  const S = {
    tab: 'fan',
    sort: 'score',
    rating: 'safe',
    source: 'both',
    page: { danbooru: 1, safebooru: 0 },
    done: { danbooru: false, safebooru: false },
    seen: new Set(),
    items: [],
    loading: false
  };

  /* ── 소스별 fetch ── */
  const RATING_KO = { g: '전체', s: '준수위', q: '수위', e: '높은 수위' };

  async function fromDanbooru() {
    if (S.done.danbooru) return [];
    const order = S.sort === 'new' ? '' : S.sort === 'random' ? ' order:random' : ' order:score';
    const url = `https://danbooru.donmai.us/posts.json?tags=${encodeURIComponent(TAG + order)}`
              + `&limit=${PER}&page=${S.page.danbooru}`;
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error('danbooru ' + res.status);
    const posts = await res.json();
    if (!Array.isArray(posts) || posts.length < PER) S.done.danbooru = true;
    S.page.danbooru++;
    return posts.filter(p => p.file_url || p.large_file_url).map(p => ({
      key: p.md5 || 'd' + p.id,
      thumb: p.large_file_url || p.preview_file_url || p.file_url,
      full: p.file_url || p.large_file_url,
      w: p.image_width, h: p.image_height,
      rating: p.rating || 'g',
      artist: (p.tag_string_artist || '').split(' ')[0].replace(/_/g, ' '),
      score: p.score,
      src: 'Danbooru',
      link: `https://danbooru.donmai.us/posts/${p.id}`
    }));
  }

  async function fromSafebooru() {
    if (S.done.safebooru) return [];
    const order = S.sort === 'new' ? '' : S.sort === 'random' ? ' sort:random' : ' sort:score:desc';
    const url = `https://safebooru.org/index.php?page=dapi&s=post&q=index&json=1`
              + `&limit=${PER}&pid=${S.page.safebooru}&tags=${encodeURIComponent(TAG + order)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('safebooru ' + res.status);
    const txt = await res.text();
    const posts = txt.trim() ? JSON.parse(txt) : [];
    if (!Array.isArray(posts) || posts.length < PER) S.done.safebooru = true;
    S.page.safebooru++;
    return posts.map(p => ({
      key: p.hash || 's' + p.id,
      thumb: p.sample_url || p.preview_url || p.file_url,
      full: p.file_url,
      w: p.width, h: p.height,
      rating: (p.rating || 'general')[0],
      artist: (String(p.tags || '').match(/\b\w+_\(artist\)/) || [''])[0].replace(/_\(artist\)/, '').replace(/_/g, ' '),
      score: p.score,
      src: 'Safebooru',
      link: `https://safebooru.org/index.php?page=post&s=view&id=${p.id}`
    }));
  }

  /* ── 페이지 적재 ── */
  async function loadMore() {
    if (S.loading || S.tab !== 'fan') return;
    const use = S.source === 'both' ? ['safebooru', 'danbooru'] : [S.source];
    if (use.every(s => S.done[s])) { setStatus(); $('#gMore').hidden = true; return; }

    S.loading = true;
    setStatus('불러오는 중…');

    const jobs = use.map(s => (s === 'danbooru' ? fromDanbooru() : fromSafebooru())
      .catch(err => { console.warn(s, err); S.done[s] = true; return { __err: s }; }));
    const results = await Promise.all(jobs);

    const failed = results.filter(r => r && r.__err).map(r => r.__err);
    let batch = results.filter(Array.isArray).flat();

    // 등급 필터 (기본: 전체 이용가)
    if (S.rating === 'safe') batch = batch.filter(p => p.rating === 'g' || p.rating === 's');

    // 중복 제거
    batch = batch.filter(p => p.full && !S.seen.has(p.key) && S.seen.add(p.key));

    if (S.sort === 'score') batch.sort((a, b) => (b.score || 0) - (a.score || 0));

    S.items.push(...batch);
    append(batch);
    S.loading = false;
    setStatus(null, failed);

    const allDone = use.every(s => S.done[s]);
    $('#gMore').hidden = allDone;
    // 화면이 아직 짧으면 한 번 더
    if (!allDone && batch.length === 0) loadMore();
  }

  function setStatus(msg, failed) {
    if (msg) { status.textContent = msg; return; }
    if (S.tab === 'official') {
      status.innerHTML = `공식 일러스트·모션 <b>${window.CHISA.art.length}</b>점 · 출처 Wuthering Waves Wiki`;
      return;
    }
    let t = `팬아트 <b>${S.items.length}</b>장 표시 중`;
    const use = S.source === 'both' ? ['safebooru', 'danbooru'] : [S.source];
    if (use.every(s => S.done[s])) t += ' · 모두 불러왔습니다';
    if (failed && failed.length) t += ` · <b>${failed.join(', ')}</b> 응답 없음 (브라우저 차단이나 봇 검사일 수 있습니다)`;
    status.innerHTML = t;
  }

  /* ── 그리기 ── */
  const gIO = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('is-in'); gIO.unobserve(e.target); }
  }), { rootMargin: '200px' });

  function append(batch) {
    const frag = document.createDocumentFragment();
    batch.forEach(p => {
      const base = S.items.indexOf(p);
      const a = el('a', 'gitem');
      a.href = p.full; a.target = '_blank'; a.rel = 'noopener';
      a.dataset.i = base;
      const ratio = p.w && p.h ? ` style="aspect-ratio:${p.w}/${p.h}"` : '';
      a.innerHTML = `<img src="${p.thumb}" alt="치사 팬아트" loading="lazy" decoding="async"${ratio}
                       onerror="this.closest('.gitem').remove()">
        <span class="gitem__meta"><b>${esc(p.artist || '작가 미상')}</b>
        <span class="gitem__src">${esc(p.src)}${p.rating && p.rating !== 'g' ? ' · ' + esc(RATING_KO[p.rating] || '') : ''}</span></span>`;
      gIO.observe(a);
      frag.appendChild(a);
    });
    grid.appendChild(frag);
  }

  function renderOfficial() {
    grid.innerHTML = '';
    S.items = window.CHISA.art.map(a => ({
      thumb: a.url, full: a.url, artist: a.title, src: a.desc, link: a.url, rating: 'g'
    }));
    const frag = document.createDocumentFragment();
    S.items.forEach((p, i) => {
      const a = el('a', 'gitem is-in');
      a.href = p.full; a.target = '_blank'; a.rel = 'noopener'; a.dataset.i = i;
      a.innerHTML = `<img src="${p.thumb}" alt="${esc(p.artist)}" loading="lazy" decoding="async">
        <span class="gitem__meta"><b>${esc(p.artist)}</b><span class="gitem__src">OFFICIAL</span></span>`;
      frag.appendChild(a);
    });
    grid.appendChild(frag);
    setStatus();
  }

  /* ── 리셋 ── */
  function reset() {
    S.page = { danbooru: 1, safebooru: 0 };
    S.done = { danbooru: false, safebooru: false };
    S.seen = new Set(); S.items = []; S.loading = false;
    grid.innerHTML = '';
    loadMore();
  }

  /* ── 컨트롤 ── */
  $('#galTabs').addEventListener('click', e => {
    const tab = e.target.closest('.tab'); if (!tab) return;
    $$('.tab', $('#galTabs')).forEach(t => t.classList.toggle('is-on', t === tab));
    S.tab = tab.dataset.gal;
    $('#fanFilters').style.display = S.tab === 'fan' ? '' : 'none';
    $('#gMore').hidden = true;
    if (S.tab === 'official') renderOfficial(); else reset();
  });
  ['fSort', 'fRating', 'fSource'].forEach(id => $('#' + id).addEventListener('change', e => {
    S[{ fSort: 'sort', fRating: 'rating', fSource: 'source' }[id]] = e.target.value;
    reset();
  }));
  $('#fReload').addEventListener('click', reset);
  $('#gMore').addEventListener('click', loadMore);

  /* 무한 스크롤 */
  new IntersectionObserver(es => {
    if (es[0].isIntersecting && S.tab === 'fan' && S.items.length) loadMore();
  }, { rootMargin: '600px' }).observe($('#gSentinel'));

  /* ── 라이트박스 ── */
  const lb = $('#lbox'), lbImg = $('#lboxImg'), lbCap = $('#lboxCap');
  let lbI = -1, lbList = [];

  function openLb(list, i) {
    lbList = list;
    const p = lbList[i]; if (!p) return;
    lbI = i; lb.hidden = false; document.body.style.overflow = 'hidden';
    lbImg.src = p.full; lbImg.alt = p.artist || '치사 일러스트';
    lbCap.innerHTML = `<span>${esc(p.artist || '작가 미상')}</span>`
      + `<span>${esc(p.src)}</span>`
      + `<a href="${p.link}" target="_blank" rel="noopener">원본 페이지</a>`
      + `<a href="${p.full}" target="_blank" rel="noopener">원본 이미지</a>`
      + `<span>${i + 1} / ${lbList.length}</span>`;
  }
  const closeLb = () => { lb.hidden = true; lbImg.src = ''; document.body.style.overflow = ''; };
  const step = d => openLb(lbList, (lbI + d + lbList.length) % lbList.length);

  grid.addEventListener('click', e => {
    const item = e.target.closest('.gitem'); if (!item) return;
    e.preventDefault(); openLb(S.items, +item.dataset.i);
  });
  $('#lboxX').addEventListener('click', closeLb);
  $('#lboxPrev').addEventListener('click', () => step(-1));
  $('#lboxNext').addEventListener('click', () => step(1));
  lb.addEventListener('click', e => { if (e.target === lb) closeLb(); });
  addEventListener('keydown', e => {
    if (lb.hidden) return;
    if (e.key === 'Escape') closeLb();
    if (e.key === 'ArrowLeft') step(-1);
    if (e.key === 'ArrowRight') step(1);
  });

  /* 히어로 미니 갤러리 → 공식 아트 라이트박스 */
  document.addEventListener('chisa:ready', () => {
    $('#cardMiniGal')?.addEventListener('click', e => {
      const img = e.target.closest('img[data-official]'); if (!img) return;
      const arts = window.CHISA.art.filter(a => a.kind === 'art')
        .map(a => ({ thumb: a.url, full: a.url, artist: a.title, src: a.desc, link: a.url }));
      openLb(arts, +img.dataset.official);
    });
    loadMore();
  });
})();
