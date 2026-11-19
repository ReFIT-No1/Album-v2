(function () {
  'use strict';

  const DATA = window.QIANXUN_CATALOG;
  if (!DATA || !Array.isArray(DATA.series) || !DATA.series.length) return;

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const series = DATA.series;
  const DEFAULT_CERTS = ['CCC', 'CQC', 'TÜV', 'CE', 'CB', 'UL', 'ISO'];
  const dial = $('#seriesDial');
  const dialNodes = $('#seriesDialNodes');
  const stage = $('#seriesStage');
  const pagesRoot = $('#seriesPages');
  let active = 0;
  let selectedModel = null;

  const toast = $('#catalogToast');
  let toastTimer = 0;

  function showToast(message, duration = 1800) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('is-show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('is-show'), duration);
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function pad2(number) {
    return String(number).padStart(2, '0');
  }

  function pageRange(item) {
    return item.start === item.end ? pad2(item.start) : `${pad2(item.start)}–${pad2(item.end)}`;
  }

  function modelSearchText(model) {
    return [model.name, model.crop].filter(Boolean).join(' ');
  }

  function filterModels(models) {
    const list = (models || []).filter((model) => model && model.name);
    const normalized = (value) => String(value).toUpperCase().replace(/[^A-Z0-9]/g, '');
    return list.filter((model) => {
      const key = normalized(model.name);
      return !list.some((other) => {
        if (!other || other === model) return false;
        const otherKey = normalized(other.name);
        return otherKey.length > key.length + 1 && otherKey.startsWith(key);
      });
    });
  }

  function buildDial() {
    dialNodes.replaceChildren();
    series.forEach((item, index) => {
      const dot = document.createElement('button');
      dot.type = 'button';
      dot.className = 'series-dot';
      dot.dataset.index = String(index);
      dot.setAttribute('aria-label', `${pad2(item.number)} ${item.name}，印刷页 ${pageRange(item)}`);
      dot.title = `${pad2(item.number)} ${item.name}`;
      const label = document.createElement('span');
      label.className = 'series-dot__label';
      label.textContent = item.name;
      dot.appendChild(label);
      const number = document.createElement('span');
      number.className = 'series-dot__num';
      number.textContent = pad2(item.number);
      dot.appendChild(number);
      dot.addEventListener('click', () => selectSeries(index));
      dot.addEventListener('mouseenter', () => showDialPreview(index));
      dot.addEventListener('mouseleave', () => showDialPreview(active));
      dialNodes.appendChild(dot);
    });
    positionDialNodes();
  }

  function dialGeometry() {
    if (!dial) return { radius: 104, cx: 0, cy: 0 };
    const rect = dial.getBoundingClientRect();
    return {
      radius: Math.max(76, Math.min(rect.width, rect.height) / 2 - 26),
      cx: rect.width / 2,
      cy: rect.height / 2
    };
  }

  function positionDialNodes() {
    const { radius, cx, cy } = dialGeometry();
    const count = series.length;
    $$('.series-dot', dialNodes).forEach((dot, index) => {
      const angle = (index / count) * Math.PI * 2 - Math.PI / 2;
      dot.style.left = `${cx + Math.cos(angle) * radius}px`;
      dot.style.top = `${cy + Math.sin(angle) * radius}px`;
    });
  }

  function showDialPreview(index) {
    const item = series[index];
    if (!item) return;
    const name = $('#dialName');
    const count = $('#dialCount');
    const range = $('#dialRange');
    if (name) name.textContent = item.name;
    if (count) count.textContent = `${pad2(item.number)} / ${series.length}`;
    if (range) range.textContent = `印刷页 ${pageRange(item)}`;
  }

  function updateDial() {
    $$('.series-dot', dialNodes).forEach((dot, index) => {
      dot.classList.toggle('is-active', index === active);
      dot.setAttribute('aria-current', index === active ? 'true' : 'false');
    });
    showDialPreview(active);
    if (dial) {
      dial.style.setProperty('--dial-rotation', `${-active * (360 / series.length)}deg`);
    }
    $('#seriesTotal').textContent = `${series.length} 个系列`;
    $('#seriesPageTotal').textContent = `${series.reduce((sum, item) => sum + item.pages.length, 0)} 个产品页`;
  }

  function specMarkup(specs, shared) {
    if (!specs || !specs.length) return '';
    return `
      <section class="spec-panel" aria-label="技术参数">
        <div class="spec-panel__head">
          <strong>技术参数</strong>
          <span>${shared ? '系列通用参数' : '本页参数'} · TECHNICAL SPECIFICATIONS</span>
        </div>
        <div class="spec-grid">
          ${specs.map((spec) => `
            <div class="spec-item">
              <span class="spec-item__label">${escapeHtml(spec.label)}</span>
              <strong class="spec-item__value">${escapeHtml(spec.value)}</strong>
            </div>
          `).join('')}
        </div>
      </section>
    `;
  }

  function certsMarkup(certs) {
    const all = Array.from(new Set([...DEFAULT_CERTS, ...(certs || [])]));
    return `<div class="cert-row">${all.map((cert) => `<span class="cert-chip">${escapeHtml(cert)}</span>`).join('')}</div>`;
  }

  function productMarkup(model, item, page) {
    const specs = page.specs || [];
    const keySpecs = specs.slice(0, 3);
    const image = `${model.crop || page.image}?v=20261119d`;
    const fallback = model.fallback ? ' / 本页总览' : '';
    return `
      <article class="product-card">
        <div class="product-visual">
          <img src="${escapeHtml(image)}" alt="${escapeHtml(model.name)}" decoding="async">
          <span class="product-visual__page">P${pad2(page.page)}</span>
        </div>
        <div class="product-body">
          <strong class="product-model" title="${escapeHtml(model.name)}">${escapeHtml(model.name)}</strong>
          <span class="product-series">${escapeHtml(item.name)}${fallback}</span>
          <div class="product-key-specs">
            ${keySpecs.map((spec) => `<span title="${escapeHtml(spec.label)}：${escapeHtml(spec.value)}">${escapeHtml(spec.label)} ${escapeHtml(spec.value)}</span>`).join('')}
          </div>
          <div class="product-actions">
            <button class="product-original" type="button" data-original="${page.image}" data-original-title="${escapeHtml(page.title)}">查看原始版面</button>
          </div>
        </div>
      </article>
    `;
  }

  function sourceColumnMarkup(item, page) {
    const ocrText = (page.ocr || []).filter(Boolean).join('\n');
    return `
      <section class="source-column" aria-label="产品页 ${page.page}">
        <div class="source-column__head">
          <span class="source-column__page">产品页 ${pad2(page.printed)}</span>
          <span class="source-column__meta">P${pad2(page.page)} · ${pad2(page.printed)} / ${pad2(item.end)}</span>
        </div>
        <p class="page-title">${escapeHtml(page.title)}</p>
        ${certsMarkup(page.certs)}
        ${specMarkup(page.specs, page.specsShared)}
        <div class="product-list">
          ${filterModels(page.models).map((model) => productMarkup(model, item, page)).join('')}
        </div>
        <details class="page-ocr">
          <summary>本页完整文字信息</summary>
          <pre class="page-ocr__text">${escapeHtml(ocrText)}</pre>
        </details>
      </section>
    `;
  }

  function renderSeries(index, options = {}) {
    active = Math.max(0, Math.min(series.length - 1, Number(index) || 0));
    const item = series[active];
    updateDial();

    $('#seriesKicker').textContent = `SERIES ${pad2(item.number)}`;
    $('#seriesTitle').textContent = item.name;
    $('#seriesSubtitle').textContent = `印刷页 ${pageRange(item)} · ${item.pages.length} 个产品页`;
    $('#seriesPageCount').textContent = `${pad2(item.start)} — ${pad2(item.end)}`;
    pagesRoot.classList.toggle('is-single', item.pages.length === 1);
    pagesRoot.innerHTML = item.pages.map((page) => sourceColumnMarkup(item, page)).join('');

    $$('.product-original', pagesRoot).forEach((button) => {
      button.addEventListener('click', () => openOriginal(button.dataset.original, button.dataset.originalTitle));
    });

    if (options.scroll !== false) stage.scrollTop = 0;
    if (options.hash !== false) {
      history.replaceState(null, '', `#series-${pad2(item.number)}`);
    }
    $('#catalogLive').textContent = `已切换到 ${item.name}，${item.pages.length} 个产品页`;
  }

  function selectSeries(index, options = {}) {
    const next = (index + series.length) % series.length;
    renderSeries(next, options);
  }

  function stepSeries(direction) {
    selectSeries(active + direction);
  }

  /* ---------- Modals ---------- */

  function openModal(id) {
    const modal = document.getElementById(id);
    if (!modal) return;
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    const focus = $('input, button:not([data-close])', modal);
    if (focus) setTimeout(() => focus.focus({ preventScroll: true }), 50);
  }

  function closeModal(id) {
    const modal = document.getElementById(id);
    if (!modal) return;
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
  }

  function closeAll() {
    $$('.catalog-modal.is-open').forEach((modal) => {
      modal.classList.remove('is-open');
      modal.setAttribute('aria-hidden', 'true');
    });
  }

  function openOriginal(src, title) {
    const img = $('#catalogOriginalImg');
    if (!img) return;
    img.src = src;
    img.alt = title || '原始版面';
    $('#catalogOriginalTitle').textContent = title || '原始版面';
    openModal('catalogOriginalModal');
  }

  /* ---------- Search ---------- */

  const searchItems = [];
  series.forEach((item, seriesIndex) => {
    searchItems.push({
      type: '系列',
      title: item.name,
      sub: `印刷页 ${pageRange(item)} · ${item.pages.length} 个产品页`,
      seriesIndex,
      hay: `${item.name} ${item.start} ${item.end}`
    });
    item.pages.forEach((page) => {
      filterModels(page.models).forEach((model) => {
        searchItems.push({
          type: '型号',
          title: model.name,
          sub: `${item.name} · 产品页 ${page.printed}`,
          seriesIndex,
          page,
          hay: `${model.name} ${item.name} ${(page.specs || []).map((spec) => `${spec.label} ${spec.value}`).join(' ')}`
        });
      });
    });
  });

  function normalize(value) {
    return String(value || '').toLowerCase().replace(/[\s\-—–_/（）()·,，.。:：]+/g, '');
  }

  function openSearch() {
    const input = $('#catalogSearchInput');
    const results = $('#catalogSearchResults');
    if (input) input.value = '';
    if (results) results.replaceChildren();
    const empty = $('#catalogSearchEmpty');
    if (empty) empty.hidden = true;
    openModal('catalogSearchModal');
    setTimeout(() => input && input.focus(), 80);
  }

  function renderSearch(query) {
    const q = normalize(query);
    const results = $('#catalogSearchResults');
    const empty = $('#catalogSearchEmpty');
    if (!results) return;
    results.replaceChildren();
    if (!q) {
      if (empty) empty.hidden = true;
      return;
    }
    const matches = searchItems
      .map((item) => {
        const hay = normalize(item.hay);
        const pos = hay.indexOf(q);
        return { item, pos };
      })
      .filter((entry) => entry.pos >= 0)
      .sort((a, b) => a.pos - b.pos)
      .slice(0, 12);
    if (!matches.length) {
      if (empty) empty.hidden = false;
      return;
    }
    if (empty) empty.hidden = true;
    matches.forEach(({ item }) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'catalog-search-result';
      button.innerHTML = `
        <span class="catalog-search-result__type">${escapeHtml(item.type)}</span>
        <span>
          <strong class="catalog-search-result__title">${escapeHtml(item.title)}</strong>
          <span class="catalog-search-result__sub">${escapeHtml(item.sub)}</span>
        </span>
        <span class="catalog-search-result__page">→</span>
      `;
      button.addEventListener('click', () => {
        closeModal('catalogSearchModal');
        selectSeries(item.seriesIndex);
      });
      results.appendChild(button);
    });
  }

  /* ---------- Share / PDF / Help / contact ---------- */

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (error) {
      const helper = document.createElement('textarea');
      helper.value = text;
      helper.style.position = 'fixed';
      helper.style.opacity = '0';
      document.body.appendChild(helper);
      helper.select();
      const ok = document.execCommand('copy');
      helper.remove();
      return ok;
    }
  }

  function wireUi() {
    $('#catalogBrand')?.addEventListener('click', (event) => {
      event.preventDefault();
      selectSeries(0);
    });
    $('#prevSeries')?.addEventListener('click', () => stepSeries(-1));
    $('#nextSeries')?.addEventListener('click', () => stepSeries(1));
    dial?.addEventListener('wheel', (event) => {
      event.preventDefault();
      stepSeries(event.deltaY > 0 ? 1 : -1);
    }, { passive: false });

    $('#catalogSearchBtn')?.addEventListener('click', openSearch);
    $('#catalogPdfBtn')?.addEventListener('click', () => {
      const link = document.createElement('a');
      link.href = 'assets/qianxun-catalog.pdf';
      link.download = '千寻电气产品图册.pdf';
      document.body.appendChild(link);
      link.click();
      link.remove();
      showToast('PDF 正在下载');
    });
    $('#catalogShareBtn')?.addEventListener('click', () => openModal('catalogShareModal'));
    $('#catalogHelpBtn')?.addEventListener('click', () => openModal('catalogHelpModal'));

    $('#catalogSearchInput')?.addEventListener('input', (event) => renderSearch(event.target.value));

    $('#catalogCopyUrl')?.addEventListener('click', async () => {
      const value = $('#catalogShareUrl')?.value || location.href;
      showToast(await copyText(value) ? '网址已复制' : '复制失败，请手动选择网址');
    });

    $$('[data-copy]').forEach((button) => {
      button.addEventListener('click', async () => {
        showToast(await copyText(button.dataset.copy) ? '已复制' : '复制失败');
      });
    });

    $$('[data-close]').forEach((button) => {
      button.addEventListener('click', () => closeModal(button.dataset.close));
    });

    $$('.catalog-modal').forEach((modal) => {
      modal.addEventListener('click', (event) => {
        if (event.target === modal) closeModal(modal.id);
      });
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        if (document.querySelector('.catalog-modal.is-open')) {
          closeAll();
          event.preventDefault();
          return;
        }
      }
      const tag = (event.target && event.target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
      if (event.key === '/' || ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k')) {
        event.preventDefault();
        openSearch();
        return;
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        stepSeries(-1);
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        stepSeries(1);
      }
    });

    window.addEventListener('resize', positionDialNodes);
    window.addEventListener('hashchange', () => {
      const match = location.hash.match(/^#series-(\d+)/);
      if (match) selectSeries(Number(match[1]) - 1, { hash: false });
    });
  }

  /* ---------- Ambient static starfield ---------- */

  function initStars() {
    const canvas = $('#catalogStarfield');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const draw = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = window.innerWidth;
      const height = window.innerHeight;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      const count = Math.round(Math.min(170, Math.max(70, width / 9)));
      for (let i = 0; i < count; i += 1) {
        const x = Math.random() * width;
        const y = Math.random() * height;
        const r = Math.random() * 1.25 + .2;
        const alpha = Math.random() * .55 + .12;
        ctx.fillStyle = `rgba(190, 220, 255, ${alpha})`;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    };
    draw();
    window.addEventListener('resize', draw);
  }

  function restoreHash() {
    const match = location.hash.match(/^#series-(\d+)/);
    if (match) return Math.max(0, Math.min(series.length - 1, Number(match[1]) - 1));
    return 0;
  }

  buildDial();
  wireUi();
  initStars();
  renderSeries(restoreHash(), { scroll: false, hash: false });
})();
