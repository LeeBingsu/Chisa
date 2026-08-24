/* ═══════════════════════════════════════════
   CHISA · 千咲  —  3D models
   Sketchfab 라이브 뷰어 + 배포본 정리
   ═══════════════════════════════════════════ */

(function models() {
  document.addEventListener('chisa:ready', () => {
    fetch('data/models.json').then(r => r.json()).then(render).catch(console.error);
  });

  function render(m) {
    $('#m3dViewer').innerHTML = m.viewer.map((v, i) => `
      <article class="mcard" data-reveal style="--d:${i * .07}s">
        <div class="mcard__frame" data-uid="${esc(v.uid)}" role="button" tabindex="0"
             aria-label="${esc(v.title)} 3D 뷰어 실행">
          <img src="${esc(v.thumb)}" alt="${esc(v.title)} 미리보기" loading="lazy">
          <span class="mcard__spin">⟳</span>
        </div>
        <div class="mcard__b">
          <h3 class="mcard__t">${esc(v.title)}</h3>
          <p class="mcard__m">${esc(v.author)} · ${esc(v.license)} · ${v.faces.toLocaleString()} 면</p>
          <p class="mcard__d">${esc(v.note)}</p>
          <a class="ocard__more" href="${esc(v.url)}" target="_blank" rel="noopener">Sketchfab에서 다운로드 →</a>
        </div>
      </article>`).join('');

    const load = frame => {
      frame.innerHTML = `<iframe src="https://sketchfab.com/models/${frame.dataset.uid}/embed?autospin=0.4&ui_theme=dark&dnt=1"
        title="Chisa 3D 모델" allow="autoplay; fullscreen; xr-spatial-tracking" allowfullscreen></iframe>`;
    };
    $('#m3dViewer').addEventListener('click', e => {
      const f = e.target.closest('.mcard__frame'); if (f?.dataset.uid) load(f);
    });
    $('#m3dViewer').addEventListener('keydown', e => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const f = e.target.closest('.mcard__frame'); if (f?.dataset.uid) { e.preventDefault(); load(f); }
    });

    $('#m3dList').innerHTML = m.downloads.map(d => `
      <article class="mitem${d.best ? ' mitem--best' : ''}">
        <div class="mitem__h">
          <span class="mitem__n">${esc(d.name)}</span>
          <span class="mitem__site">${esc(d.site)}</span>
          ${d.best ? '<span class="mitem__best">물리 최상급</span>' : ''}
        </div>
        <dl class="mitem__grid">
          <dt>형식</dt><dd>${esc(d.format)}</dd>
          <dt>물리</dt><dd>${esc(d.physics)}</dd>
          <dt>의상 교체</dt><dd>${esc(d.outfit)}</dd>
          <dt>이용 범위</dt><dd>${esc(d.license)}</dd>
        </dl>
        <p class="mitem__cav">${esc(d.caveat)}</p>
        <div class="mitem__links">
          <a class="btn" href="${esc(d.url)}" target="_blank" rel="noopener">배포처 열기 ↗</a>
          ${d.ref ? `<a class="btn btn--ghost" href="${esc(d.ref.url)}" target="_blank" rel="noopener">${esc(d.ref.label)} ↗</a>` : ''}
        </div>
      </article>`).join('');

    $('#m3dNote').textContent = m.note;
    observeReveals($('#models'));
  }
})();
