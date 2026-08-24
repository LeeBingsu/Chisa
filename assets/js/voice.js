/* ═══════════════════════════════════════════
   CHISA · 千咲  —  voice player
   4개 국어 실제 게임 음성 (Wuthering Waves Wiki 호스팅)
   ═══════════════════════════════════════════ */

(function voice() {
  const LANGS = { ko: '한국어 · 이주은', ja: '日本語 · 金元寿子', en: 'English · Leader Looi', zh: '中文 · 赵灵泽' };
  const audio = $('#audio');
  const listEl = $('#voiceList');

  let lines = [];
  let lang = 'ko';
  let current = -1;     // 재생 중 인덱스
  let queue = false;    // 전체 순차 재생 여부

  document.addEventListener('chisa:ready', () => {
    fetch('data/voicelines.json').then(r => r.json()).then(d => { lines = d; render(); });
  });

  /* 대사 본문: 선택 언어 → 없으면 한국어 → 영어 */
  const textOf = (l, lg) => l['tx_' + lg] || l.tx_ko || l.tx_en || '';

  function render() {
    listEl.innerHTML = lines.map((l, i) => {
      const body = textOf(l, lang);
      const fallback = !l['tx_' + lang] && lang === 'zh' ? '<small>대사 원문 없음 · 한국어 표기</small>' : '';
      return `
      <article class="vline${i === current ? ' is-playing' : ''}" data-i="${i}">
        <button class="vline__btn" aria-label="${esc(l.title_ko || l.title_en)} 재생"></button>
        <div class="vline__c">
          <p class="vline__t">${esc(l.title_ko || l.title_en)}<small>${esc(l.title_en)}</small>${fallback}</p>
          <p class="vline__x vline__x--fold">${esc(body)}</p>
        </div>
      </article>`;
    }).join('');

    // 파형 막대
    const wave = $('#nowWave');
    if (wave && !wave.children.length) {
      wave.innerHTML = Array.from({ length: 7 },
        (_, i) => `<i style="animation-delay:${i * .09}s"></i>`).join('');
    }
  }

  function play(i) {
    const l = lines[i];
    if (!l) return;
    const src = l.audio[lang] || l.audio.ko || l.audio.en;
    if (!src) return;

    current = i;
    audio.src = src;
    audio.play().catch(() => { /* 자동재생 차단 등 */ });

    $$('.vline', listEl).forEach(n => n.classList.toggle('is-playing', +n.dataset.i === i));
    $$('.vline', listEl).forEach(n => { if (+n.dataset.i === i) n.classList.add('is-open'); });

    const bar = $('#nowPlay');
    bar.hidden = false;
    $('#nowTitle').textContent = l.title_ko || l.title_en;
    $('#nowLang').textContent = LANGS[lang];
  }

  function stop() {
    audio.pause();
    audio.removeAttribute('src');
    current = -1; queue = false;
    $('#nowPlay').hidden = true;
    $$('.vline', listEl).forEach(n => n.classList.remove('is-playing'));
  }

  /* 목록 상호작용 */
  listEl.addEventListener('click', e => {
    const row = e.target.closest('.vline'); if (!row) return;
    const i = +row.dataset.i;
    if (e.target.closest('.vline__btn')) {
      queue = false;
      (current === i && !audio.paused) ? stop() : play(i);
    } else {
      row.classList.toggle('is-open');
    }
  });

  audio.addEventListener('ended', () => {
    if (queue && current < lines.length - 1) {
      play(current + 1);
      $$('.vline', listEl)[current]?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    } else {
      stop();
    }
  });

  /* 언어 탭 */
  $('#voiceLangs').addEventListener('click', e => {
    const tab = e.target.closest('.tab'); if (!tab) return;
    $$('.tab', $('#voiceLangs')).forEach(t => t.classList.toggle('is-on', t === tab));
    lang = tab.dataset.lang;
    const wasPlaying = current;
    render();
    if (wasPlaying >= 0) play(wasPlaying);          // 같은 대사를 새 언어로 이어서
  });

  /* 컨트롤 */
  $('#voicePlayAll').addEventListener('click', () => { queue = true; play(0); });
  $('#voiceShuffle').addEventListener('click', () => {
    queue = false;
    const i = Math.floor(Math.random() * lines.length);
    play(i);
    $$('.vline', listEl)[i]?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  });
  $('#nowStop').addEventListener('click', stop);
})();
