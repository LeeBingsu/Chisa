/* ═══════════════════════════════════════════
   CHISA · 千咲  —  core
   ═══════════════════════════════════════════ */

const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const el = (tag, cls, html) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html != null) n.innerHTML = html;
  return n;
};
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]));

/* 여러 섹션에서 공유하는 상태 */
window.CHISA = { data: null, art: [] };

/* ── 인트로 베일 ── */
window.addEventListener('load', () => {
  setTimeout(() => $('#veil')?.classList.add('is-gone'), 1500);
});

/* ── 등장 애니메이션 ── */
const revealIO = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('is-in'); revealIO.unobserve(e.target); }
  });
}, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
const observeReveals = (root = document) => $$('[data-reveal]', root).forEach(n => revealIO.observe(n));

/* ── 내비게이션 ── */
(function nav() {
  const bar = $('#nav'), links = $('#navLinks') || $('.nav__links'), toggle = $('#navToggle');
  addEventListener('scroll', () => bar.classList.toggle('is-stuck', scrollY > 30), { passive: true });

  toggle?.addEventListener('click', () => {
    const open = links.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', String(open));
  });
  links?.addEventListener('click', e => {
    if (e.target.tagName === 'A') { links.classList.remove('is-open'); toggle?.setAttribute('aria-expanded', 'false'); }
  });

  const sections = $$('[data-section]');
  const spy = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      $$('.nav__links a').forEach(a => a.classList.toggle('is-active', a.dataset.nav === e.target.id));
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  sections.forEach(s => spy.observe(s));
})();

/* ── 카드 틸트 ── */
(function tilt() {
  if (matchMedia('(pointer:coarse)').matches || matchMedia('(prefers-reduced-motion:reduce)').matches) return;
  document.addEventListener('mousemove', e => {
    $$('[data-tilt]').forEach(card => {
      const r = card.getBoundingClientRect();
      if (r.bottom < 0 || r.top > innerHeight) return;
      const dx = (e.clientX - (r.left + r.width / 2)) / r.width;
      const dy = (e.clientY - (r.top + r.height / 2)) / r.height;
      const near = Math.abs(dx) < 1.4 && Math.abs(dy) < 1.4;
      card.style.transform = near
        ? `perspective(900px) rotateY(${dx * 4}deg) rotateX(${-dy * 4}deg) translateZ(6px)`
        : '';
    });
  }, { passive: true });
})();

/* ── 초상 패럴랙스 ── */
(function portraitParallax() {
  const img = $('#portraitImg');
  if (!img || matchMedia('(pointer:coarse)').matches) return;
  addEventListener('mousemove', e => {
    const x = (e.clientX / innerWidth - .5), y = (e.clientY / innerHeight - .5);
    img.style.transform = `translate3d(${x * 14}px, ${y * 10}px, 0)`;
  }, { passive: true });
})();

/* ═══ 데이터 렌더링 ═══ */
async function boot() {
  const [data, art] = await Promise.all([
    fetch('data/chisa.json').then(r => r.json()),
    fetch('data/official-art.json').then(r => r.json())
  ]);
  window.CHISA.data = data;
  window.CHISA.art = art;

  renderHero(data, art);
  renderProfile(data);
  renderPersona(data);
  renderStories(data);
  renderVideos(data);
  observeReveals();
  document.dispatchEvent(new CustomEvent('chisa:ready', { detail: { data, art } }));
}

function renderHero(d, art) {
  $('#heroTagline').textContent = d.tagline;
  $('#heroQuote').textContent = d.quote.ko;

  const pick = ['등급', '속성', '무기', '역할', '소속'];
  $('#cardBasics').innerHTML = d.profile
    .filter(p => pick.includes(p.k))
    .map(p => `<dt>${esc(p.k)}</dt><dd>${esc(p.v)}</dd>`).join('');

  $('#cardPower').textContent = d.power.lines[0] + ' ' + d.power.lines[2];
  $('#cardLook').textContent = d.appearance.summary;
  $('#cardPersona').textContent = d.personality.summary;
  $('#cardCombat').textContent = d.combat.concept;

  $('#heroChips').innerHTML =
    `<span class="chip chip--red">${esc(d.title.ko)}</span>` +
    `<span class="chip">${esc(d.title.en)}</span>` +
    ['속성', '무기', '공명자 타입'].map(k => {
      const p = d.profile.find(x => x.k === k);
      return p ? `<span class="chip">${esc(p.v)}</span>` : '';
    }).join('');

  // 중앙 이미지 전환
  const picks = [
    ['Chisa_Full_Sprite.png', '전신'],
    ['Chisa_Convene_Draw.png', '클로즈업'],
    ['Chisa_Splash_Art.png', '스플래시'],
    ['Chisa_Resonator_Showcase_Art.png', '쇼케이스']
  ].map(([id, label]) => ({ label, url: (art.find(a => a.id === id) || {}).url })).filter(p => p.url);

  const pickWrap = $('#portraitPick');
  pickWrap.innerHTML = picks.map((p, i) =>
    `<button class="pick${i === 0 ? ' is-on' : ''}" data-url="${p.url}">${esc(p.label)}</button>`).join('');
  pickWrap.addEventListener('click', e => {
    const btn = e.target.closest('.pick'); if (!btn) return;
    $$('.pick', pickWrap).forEach(b => b.classList.toggle('is-on', b === btn));
    const img = $('#portraitImg');
    img.style.opacity = '0';
    const next = new Image();
    next.onload = () => { img.src = btn.dataset.url; img.style.opacity = ''; };
    next.src = btn.dataset.url;
  });

  // 미니 갤러리 (공식 아트 6장)
  const mini = art.filter(a => a.kind === 'art').slice(0, 6);
  $('#cardMiniGal').innerHTML = mini
    .map((a, i) => `<img src="${a.url}" alt="${esc(a.title)}" loading="lazy" data-official="${i}">`).join('');
}

function renderProfile(d) {
  $('#profileTable').innerHTML = d.profile
    .map(p => `<tr><th>${esc(p.k)}</th><td>${esc(p.v)}</td></tr>`).join('');
  $('#vaList').innerHTML = d.va
    .map(v => `<li><b>${esc(v.lang)}</b><span>${esc(v.name)}</span></li>`).join('');

  $('#reportMeta').textContent = d.power.report;
  $('#reportLines').innerHTML = d.power.lines.map(l => `<li>${esc(l)}</li>`).join('');

  $('#combatConcept').textContent = d.combat.concept;
  $('#skillList').innerHTML = d.combat.skills.map(s => `
    <div class="skill">
      <div class="skill__h"><span class="skill__n">${esc(s.n)}</span><span class="skill__t">${esc(s.t)}</span></div>
      <p class="skill__d">${esc(s.d)}</p>
    </div>`).join('');
}

function renderPersona(d) {
  $('#personaSummary').textContent = d.personality.summary;
  $('#traitList').innerHTML = d.personality.traits.map((t, i) => `
    <article class="trait" data-i="0${i + 1}" data-reveal style="--d:${(i % 3) * .08}s">
      <h4>${esc(t.t)}</h4><p>${esc(t.d)}</p>
    </article>`).join('');

  $('#lookSummary').textContent = d.appearance.summary;
  $('#lookPoints').innerHTML = d.appearance.points.map(p => `<li>${esc(p)}</li>`).join('');
  $('#itemList').innerHTML = d.items.map(i => `
    <div class="item"><h4>${esc(i.n)}</h4><p>${esc(i.d)}</p></div>`).join('');
  $('#relList').innerHTML = d.relations.map(r => `
    <div class="rel"><b>${esc(r.n)}</b><span>${esc(r.d)}</span></div>`).join('');
  $('#triviaList').innerHTML = d.trivia.map(t => `<li>${esc(t)}</li>`).join('');
}

function renderStories(d) {
  const wrap = $('#storyList');
  wrap.innerHTML = d.stories.map((s, i) => `
    <article class="story" data-reveal style="--d:${i * .05}s">
      <button class="story__btn" aria-expanded="false">
        <span class="story__i">0${i + 1}</span>
        <span class="story__t">${esc(s.t)}</span>
        <span class="story__s">${esc(s.s)}</span>
        <span class="story__x"></span>
      </button>
      <div class="story__body">
        <div class="story__inner">
          <div class="story__rule"></div>
          ${s.b.split('\n').map(p => `<p>${esc(p)}</p>`).join('')}
        </div>
      </div>
    </article>`).join('');

  wrap.addEventListener('click', e => {
    const btn = e.target.closest('.story__btn');
    if (!btn) return;
    const story = btn.closest('.story'), body = $('.story__body', story);
    const open = story.classList.toggle('is-open');
    btn.setAttribute('aria-expanded', String(open));
    body.style.maxHeight = open ? body.scrollHeight + 'px' : '0px';
  });
  addEventListener('resize', () => $$('.story.is-open .story__body', wrap)
    .forEach(b => { b.style.maxHeight = b.scrollHeight + 'px'; }));
}

function renderVideos(d) {
  $('#videoList').innerHTML = d.videos.map((v, i) => `
    <article class="vid" data-reveal style="--d:${(i % 3) * .07}s">
      <div class="vid__frame" data-yt="${esc(v.id)}" role="button" tabindex="0" aria-label="${esc(v.t)} 재생">
        <img src="https://i.ytimg.com/vi/${esc(v.id)}/hqdefault.jpg" alt="${esc(v.t)} 썸네일" loading="lazy">
        <span class="vid__tag">${esc(v.tag)}</span>
        <span class="vid__play"></span>
      </div>
      <div class="vid__b">
        <h3 class="vid__t">${esc(v.t)}</h3>
        <p class="vid__d">${esc(v.d)}</p>
      </div>
    </article>`).join('');

  const play = frame => {
    const id = frame.dataset.yt;
    frame.innerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0"
      title="YouTube 영상" allow="accelerometer;autoplay;clipboard-write;encrypted-media;gyroscope;picture-in-picture"
      allowfullscreen></iframe>`;
  };
  $('#videoList').addEventListener('click', e => {
    const f = e.target.closest('.vid__frame'); if (f && f.dataset.yt) play(f);
  });
  $('#videoList').addEventListener('keydown', e => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const f = e.target.closest('.vid__frame'); if (f && f.dataset.yt) { e.preventDefault(); play(f); }
  });
}

boot().catch(err => {
  console.error(err);
  const s = $('#gStatus');
  if (s) s.innerHTML = '데이터를 불러오지 못했습니다. <b>로컬 서버(예: python3 -m http.server)</b>로 열어 주세요.';
});
