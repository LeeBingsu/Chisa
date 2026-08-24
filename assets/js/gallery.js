/* ═══════════════════════════════════════════
   CHISA · 千咲  —  gallery
   팬아트는 Safebooru / Danbooru 공개 API에서 브라우저가 직접 불러온다.
   (이미지는 저장·재배포하지 않고 원본 서버에서 그대로 표시)
   ═══════════════════════════════════════════ */

(function gallery() {
  const BASE  = 'chisa_(wuthering_waves)';
  const PER   = 50;
  const grid  = $('#galGrid');
  const status= $('#gStatus');

  /* 빠른 선택 태그 */
  const PRESETS = [
    ['교복', 'school_uniform'], ['세일러복', 'serafuku'], ['대체 의상', 'alternate_costume'],
    ['공식 스킨', 'official_alternate_costume'], ['드레스', 'dress'], ['수영복', 'swimsuit'],
    ['비키니', 'bikini'], ['기모노', 'kimono'], ['메이드', 'maid'], ['동물 귀', 'animal_ears'],
    ['안경', 'glasses'], ['팬티스타킹', 'pantyhose'], ['치비', 'chibi'], ['무기 들기', 'holding_weapon'],
    ['음식', 'food'], ['웃는 얼굴', 'smile'], ['공식 아트', 'official_art'],
    ['로버와', 'rover_(wuthering_waves)'], ['리네와', 'lynae_(wuthering_waves)'],
    ['나미폰과', 'namipon_(wuthering_waves)']
  ];
  const RATING_KO = { g: '전체 이용가', s: '노출 약간', q: '수위 있음', e: '높은 수위' };

  const S = {
    tab: 'fan',
    sort: 'score',
    quality: 'sample',
    source: 'both',
    tags: [],
    rates: new Set(['g', 's']),
    page: { danbooru: 1, safebooru: 0 },
    done: { danbooru: false, safebooru: false },
    notes: {},
    seen: new Set(),
    items: [],
    loading: false
  };

  /* ══ 소스별 fetch ══ */

  async function fromDanbooru() {
    if (S.done.danbooru) return [];
    // 비로그인 Danbooru는 태그 2개까지 — 추가 태그가 있으면 정렬 메타태그를 뺀다
    const order = S.tags.length ? '' :
      (S.sort === 'new' ? '' : S.sort === 'random' ? ' order:random' : ' order:score');
    const q = [BASE, ...S.tags].join(' ') + order;
    const url = `https://danbooru.donmai.us/posts.json?tags=${encodeURIComponent(q)}`
              + `&limit=${PER}&page=${S.page.danbooru}`;
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) {
      if (res.status === 422 && S.tags.length > 1) S.notes.danbooru = 'Danbooru는 비로그인 시 추가 태그를 1개까지만 받습니다';
      throw new Error('danbooru ' + res.status);
    }
    const posts = await res.json();
    if (!Array.isArray(posts) || posts.length < PER) S.done.danbooru = true;
    S.page.danbooru++;
    return posts.filter(p => p.file_url || p.large_file_url).map(p => ({
      id: p.id,
      key: p.md5 || 'd' + p.id,
      md5: p.md5 || '',
      sample: p.large_file_url || p.preview_file_url || p.file_url,
      full: p.file_url || p.large_file_url,
      w: p.image_width, h: p.image_height, bytes: p.file_size,
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
    const q = [BASE, ...S.tags].join(' ') + order;
    const url = `https://safebooru.org/index.php?page=dapi&s=post&q=index&json=1`
              + `&limit=${PER}&pid=${S.page.safebooru}&tags=${encodeURIComponent(q)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('safebooru ' + res.status);
    const txt = await res.text();
    const posts = txt.trim() ? JSON.parse(txt) : [];
    if (!Array.isArray(posts) || posts.length < PER) S.done.safebooru = true;
    S.page.safebooru++;
    return posts.map(p => ({
      id: p.id,
      key: p.hash || 's' + p.id,
      md5: p.hash || '',
      sample: p.sample_url || p.preview_url || p.file_url,
      full: p.file_url,
      w: p.width, h: p.height, bytes: null,
      rating: (p.rating || 'general')[0],
      artist: (String(p.tags || '').match(/\b\w+_\(artist\)/) || [''])[0]
        .replace(/_\(artist\)/, '').replace(/_/g, ' '),
      score: p.score,
      src: 'Safebooru',
      link: `https://safebooru.org/index.php?page=post&s=view&id=${p.id}`
    }));
  }

  /* ══ 페이지 적재 ══ */
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

    batch = batch.filter(p => S.rates.has(p.rating));                       // 수위 필터
    batch = batch.filter(p => p.full && !S.seen.has(p.key) && S.seen.add(p.key)); // 중복 제거
    if (S.sort === 'score') batch.sort((a, b) => (b.score || 0) - (a.score || 0));

    S.items.push(...batch);
    append(batch);
    S.loading = false;
    setStatus(null, failed);

    const allDone = use.every(s => S.done[s]);
    $('#gMore').hidden = allDone;
    if (!allDone && batch.length === 0) loadMore();
  }

  function setStatus(msg, failed) {
    if (msg) { status.textContent = msg; return; }
    if (S.tab === 'official') {
      status.innerHTML = `공식 일러스트·모션 <b>${window.CHISA.art.length}</b>점 · 출처 Wuthering Waves Wiki`;
      return;
    }
    const q = [BASE, ...S.tags].join(' + ');
    let t = `<b>${esc(q)}</b> · ${S.items.length}장`;
    if (S.quality === 'original') t += ' · 원본 초고화질';
    const use = S.source === 'both' ? ['safebooru', 'danbooru'] : [S.source];
    if (use.every(s => S.done[s])) t += ' · 모두 불러왔습니다';
    (failed || []).forEach(f => {
      t += ` · <b>${f}</b> ${S.notes[f] || '응답 없음 (봇 검사일 수 있습니다)'}`;
    });
    if (!S.items.length && !S.loading && use.every(s => S.done[s]))
      t += ' — 조건에 맞는 그림이 없습니다. 태그나 수위를 조정해 보세요.';
    status.innerHTML = t;
  }

  /* ══ 그리기 ══ */
  const gIO = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('is-in'); gIO.unobserve(e.target); }
  }), { rootMargin: '200px' });

  const srcOf = p => (S.quality === 'original' ? p.full : (p.sample || p.full));

  function append(batch) {
    const frag = document.createDocumentFragment();
    batch.forEach(p => {
      const i = S.items.indexOf(p);
      const a = el('a', 'gitem');
      a.href = p.full; a.target = '_blank'; a.rel = 'noopener'; a.dataset.i = i;
      const ratio = p.w && p.h ? ` style="aspect-ratio:${p.w}/${p.h}"` : '';
      a.innerHTML =
        `<img src="${srcOf(p)}" alt="치사 팬아트" loading="lazy" decoding="async"${ratio}
              onerror="this.closest('.gitem').remove()">
         ${p.w ? `<span class="gitem__res">${p.w}×${p.h}</span>` : ''}
         <span class="gitem__act">
           <button type="button" data-dl="${i}" title="원본 다운로드" aria-label="원본 다운로드"><i class="ico-dl"></i></button>
         </span>
         <span class="gitem__meta"><b>${esc(p.artist || '작가 미상')}</b>
         <span class="gitem__src">${esc(p.src)}${p.rating !== 'g' ? ' · ' + esc(RATING_KO[p.rating] || '') : ''}</span></span>`;
      gIO.observe(a);
      frag.appendChild(a);
    });
    grid.appendChild(frag);
  }

  function renderOfficial() {
    grid.innerHTML = '';
    S.items = window.CHISA.art.map(a => ({
      sample: a.url, full: a.url, artist: a.title, src: a.desc, link: a.url, rating: 'g', id: a.id
    }));
    const frag = document.createDocumentFragment();
    S.items.forEach((p, i) => {
      const a = el('a', 'gitem is-in');
      a.href = p.full; a.target = '_blank'; a.rel = 'noopener'; a.dataset.i = i;
      a.innerHTML = `<img src="${p.full}" alt="${esc(p.artist)}" loading="lazy" decoding="async">
        <span class="gitem__act">
          <button type="button" data-dl="${i}" title="원본 다운로드" aria-label="원본 다운로드"><i class="ico-dl"></i></button>
        </span>
        <span class="gitem__meta"><b>${esc(p.artist)}</b><span class="gitem__src">OFFICIAL</span></span>`;
      frag.appendChild(a);
    });
    grid.appendChild(frag);
    setStatus();
  }

  function reset() {
    S.page = { danbooru: 1, safebooru: 0 };
    S.done = { danbooru: false, safebooru: false };
    S.notes = {}; S.seen = new Set(); S.items = []; S.loading = false;
    grid.innerHTML = '';
    loadMore();
  }

  /* ══ 다운로드 ══ */
  function extOf(url) { return (url.split('?')[0].match(/\.(\w{3,4})$/) || [, 'jpg'])[1]; }

  // Safebooru는 Danbooru 미러라 hash가 곧 Danbooru의 md5다.
  // Safebooru 원본 서버는 CORS를 막아 두었지만 Danbooru CDN은 열려 있어, 같은 파일을 그쪽에서 받는다.
  const mirrorOf = p => (p.md5 && p.src === 'Safebooru')
    ? `https://cdn.donmai.us/original/${p.md5.slice(0, 2)}/${p.md5.slice(2, 4)}/${p.md5}.${extOf(p.full)}`
    : null;

  async function grab(url) {
    const res = await fetch(url, { mode: 'cors' });
    if (!res.ok) throw new Error(res.status);
    return res.blob();
  }

  async function download(p, spin) {
    const name = `chisa_${String(p.src).toLowerCase().replace(/\W+/g, '')}_${p.id}.${extOf(p.full)}`;
    spin && (spin.hidden = false);
    const chain = [p.full, mirrorOf(p)].filter(Boolean);
    try {
      let blob = null, last;
      for (const url of chain) {
        try { blob = await grab(url); break; } catch (e) { last = e; }
      }
      if (!blob) throw last || new Error('failed');
      const url = URL.createObjectURL(blob);
      const a = el('a'); a.href = url; a.download = name; document.body.appendChild(a);
      a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      toast(`저장했습니다 — ${name} (${(blob.size / 1048576).toFixed(1)}MB)`);
    } catch {
      window.open(p.full, '_blank', 'noopener');
      toast('이 서버가 교차 출처 저장을 막아 새 탭에 원본을 열었습니다. 우클릭 → “이미지를 다른 이름으로 저장”으로 받으세요.');
    } finally {
      spin && (spin.hidden = true);
    }
  }

  let toastT;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg; t.hidden = false;
    requestAnimationFrame(() => t.classList.add('is-on'));
    clearTimeout(toastT);
    toastT = setTimeout(() => {
      t.classList.remove('is-on');
      setTimeout(() => { t.hidden = true; }, 400);
    }, 5200);
  }

  /* ══ 태그 UI ══ */
  function renderTags() {
    $('#tagChips').innerHTML = S.tags.map(t =>
      `<span class="tagchip">${esc(t)}<button type="button" data-rm="${esc(t)}" aria-label="${esc(t)} 제거">✕</button></span>`
    ).join('');
    $$('.preset').forEach(b => b.classList.toggle('is-on', S.tags.includes(b.dataset.tag)));
  }
  function addTag(tag) {
    tag = String(tag).trim().toLowerCase().replace(/\s+/g, '_');
    if (!tag || tag === BASE || S.tags.includes(tag)) return;
    S.tags.push(tag);
    renderTags(); reset();
  }
  function removeTag(tag) {
    S.tags = S.tags.filter(t => t !== tag);
    renderTags(); reset();
  }

  $('#tagPresets').innerHTML = PRESETS.map(([ko, tag]) =>
    `<button class="preset" type="button" data-tag="${esc(tag)}" title="${esc(tag)}">${esc(ko)}<em>${esc(tag.replace(/_\(wuthering_waves\)/, ''))}</em></button>`).join('');

  $('#tagPresets').addEventListener('click', e => {
    const b = e.target.closest('.preset'); if (!b) return;
    S.tags.includes(b.dataset.tag) ? removeTag(b.dataset.tag) : addTag(b.dataset.tag);
  });
  $('#tagChips').addEventListener('click', e => {
    const b = e.target.closest('[data-rm]'); if (b) removeTag(b.dataset.rm);
  });

  /* 자동완성 — Safebooru 태그 API (XML) */
  const acBox = $('#tagAc'), acInput = $('#tagInput');
  let acItems = [], acCur = -1, acT;

  async function suggest(q) {
    const url = `https://safebooru.org/index.php?page=dapi&s=tag&q=index&limit=100`
              + `&name_pattern=${encodeURIComponent(q)}%25`;
    const res = await fetch(url);
    const xml = new DOMParser().parseFromString(await res.text(), 'text/xml');
    return [...xml.querySelectorAll('tag')]
      .map(t => ({ name: t.getAttribute('name'), count: +t.getAttribute('count') || 0 }))
      .filter(t => t.name && !S.tags.includes(t.name))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  function drawAc() {
    if (!acItems.length) { acBox.hidden = true; return; }
    acBox.hidden = false;
    acBox.innerHTML = acItems.map((t, i) =>
      `<button type="button" class="${i === acCur ? 'is-cur' : ''}" data-t="${esc(t.name)}">
         ${esc(t.name)}<span>${t.count.toLocaleString()}</span></button>`).join('');
  }

  acInput.addEventListener('input', () => {
    const q = acInput.value.trim().toLowerCase();
    clearTimeout(acT);
    if (q.length < 2) { acItems = []; acCur = -1; drawAc(); return; }
    acT = setTimeout(async () => {
      try { acItems = await suggest(q); } catch { acItems = []; }
      acCur = -1; drawAc();
    }, 260);
  });
  acInput.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!acItems.length) return;
      e.preventDefault();
      acCur = (acCur + (e.key === 'ArrowDown' ? 1 : -1) + acItems.length) % acItems.length;
      drawAc();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      addTag(acCur >= 0 ? acItems[acCur].name : acInput.value);
      acInput.value = ''; acItems = []; acCur = -1; drawAc();
    } else if (e.key === 'Escape') {
      acItems = []; acCur = -1; drawAc();
    }
  });
  acBox.addEventListener('click', e => {
    const b = e.target.closest('[data-t]'); if (!b) return;
    addTag(b.dataset.t);
    acInput.value = ''; acItems = []; acCur = -1; drawAc();
  });
  document.addEventListener('click', e => {
    if (!e.target.closest('.tagbar__input')) { acItems = []; drawAc(); }
  });

  /* ══ 수위 토글 ══ */
  $('#rateBtns').addEventListener('click', e => {
    const b = e.target.closest('.rate'); if (!b) return;
    const r = b.dataset.r;
    S.rates.has(r) ? S.rates.delete(r) : S.rates.add(r);
    if (!S.rates.size) { S.rates.add('g'); }
    $$('.rate').forEach(x => x.classList.toggle('is-on', S.rates.has(x.dataset.r)));
    reset();
  });

  /* ══ 컨트롤 ══ */
  $('#galTabs').addEventListener('click', e => {
    const tab = e.target.closest('.tab'); if (!tab) return;
    $$('.tab', $('#galTabs')).forEach(t => t.classList.toggle('is-on', t === tab));
    S.tab = tab.dataset.gal;
    const fan = S.tab === 'fan';
    $('#fanFilters').style.display = fan ? '' : 'none';
    $('#tagBar').style.display = fan ? '' : 'none';
    $('#gMore').hidden = true;
    fan ? reset() : renderOfficial();
  });
  ['fSort', 'fQuality', 'fSource'].forEach(id => $('#' + id).addEventListener('change', e => {
    const key = { fSort: 'sort', fQuality: 'quality', fSource: 'source' }[id];
    S[key] = e.target.value;
    if (key === 'quality') {                       // 화질만 바뀌면 다시 받지 않고 교체
      $$('.gitem', grid).forEach(node => {
        const p = S.items[+node.dataset.i], img = $('img', node);
        if (p && img) img.src = srcOf(p);
      });
      setStatus();
    } else reset();
  }));
  $('#fReload').addEventListener('click', reset);
  $('#gMore').addEventListener('click', loadMore);
  $('#fCopy').addEventListener('click', async () => {
    if (!S.items.length) return toast('복사할 이미지가 없습니다.');
    const text = S.items.map(p => p.full).join('\n');
    try { await navigator.clipboard.writeText(text); toast(`원본 URL ${S.items.length}개를 클립보드에 복사했습니다.`); }
    catch { toast('클립보드 접근이 막혔습니다. 라이트박스의 “원본 이미지” 링크를 이용해 주세요.'); }
  });

  /* 무한 스크롤 */
  new IntersectionObserver(es => {
    if (es[0].isIntersecting && S.tab === 'fan' && S.items.length) loadMore();
  }, { rootMargin: '600px' }).observe($('#gSentinel'));

  /* ══ 라이트박스 ══ */
  const lb = $('#lbox'), lbImg = $('#lboxImg'), lbCap = $('#lboxCap');
  let lbI = -1, lbList = [];

  function openLb(list, i) {
    lbList = list;
    const p = lbList[i]; if (!p) return;
    lbI = i; lb.hidden = false; document.body.style.overflow = 'hidden';
    lbImg.src = p.full; lbImg.alt = p.artist || '치사 일러스트';        // 라이트박스는 항상 원본
    lbCap.innerHTML = `<span>${esc(p.artist || '작가 미상')}</span>`
      + `<span>${esc(p.src)}</span>`
      + (p.w ? `<span>${p.w}×${p.h}${p.bytes ? ' · ' + (p.bytes / 1048576).toFixed(1) + 'MB' : ''}</span>` : '')
      + `<a href="${p.link}" target="_blank" rel="noopener">원본 페이지</a>`
      + `<a href="${p.full}" target="_blank" rel="noopener">원본 이미지</a>`
      + `<span>${i + 1} / ${lbList.length}</span>`;
  }
  const closeLb = () => { lb.hidden = true; lbImg.src = ''; document.body.style.overflow = ''; };
  const step = d => openLb(lbList, (lbI + d + lbList.length) % lbList.length);

  grid.addEventListener('click', e => {
    const dl = e.target.closest('[data-dl]');
    if (dl) { e.preventDefault(); e.stopPropagation(); download(S.items[+dl.dataset.dl]); return; }
    const item = e.target.closest('.gitem'); if (!item) return;
    e.preventDefault(); openLb(S.items, +item.dataset.i);
  });
  $('#lboxDl').addEventListener('click', () => download(lbList[lbI], $('#lboxSpin')));
  $('#lboxX').addEventListener('click', closeLb);
  $('#lboxPrev').addEventListener('click', () => step(-1));
  $('#lboxNext').addEventListener('click', () => step(1));
  lb.addEventListener('click', e => { if (e.target === lb) closeLb(); });
  addEventListener('keydown', e => {
    if (lb.hidden) return;
    if (e.key === 'Escape') closeLb();
    if (e.key === 'ArrowLeft') step(-1);
    if (e.key === 'ArrowRight') step(1);
    if (e.key === 's' || e.key === 'S') download(lbList[lbI], $('#lboxSpin'));
  });

  /* 히어로 미니 갤러리 → 공식 아트 라이트박스 */
  document.addEventListener('chisa:ready', () => {
    $('#cardMiniGal')?.addEventListener('click', e => {
      const img = e.target.closest('img[data-official]'); if (!img) return;
      const arts = window.CHISA.art.filter(a => a.kind === 'art')
        .map(a => ({ sample: a.url, full: a.url, artist: a.title, src: a.desc, link: a.url, id: a.id }));
      openLb(arts, +img.dataset.official);
    });
    renderTags();
    loadMore();
  });
})();
