(function () {
  'use strict';

  const DATA = window.QIANXUN_AB;
  if (!DATA || !Array.isArray(DATA.series) || !DATA.series.length) return;

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const series = DATA.series;
  const nav = $('#seriesNav');
  const stage = $('#seriesStage');
  const combosRoot = $('#seriesCombos');
  const detailRoot = $('#modelDetail');
  let activeSeries = 0;
  let activeModelId = null;
  const modelById = new Map();
  const searchItems = [];

  const toast = $('#catalogToast');
  let toastTimer = 0;

  const ICONS = {
    voltage: '<path d="M13 2 4.5 13.5H10l-1 8.5 8.5-11H12z"/>',
    current: '<path d="M7 7h10v10H7z"/><path d="M4 12h3m10 0h3M9 4v3m6-3v3M9 17v3m6-3v3"/>',
    frequency: '<path d="M3 12c2.5-5 4.5-5 7 0s4.5 5 7 0 3.5-3 4 0"/><path d="M3 18h18"/>',
    resistance: '<path d="M4 12h4l2-5 4 10 2-5h4"/><path d="M4 4v16M20 4v16"/>',
    shield: '<path d="M12 3 20 6v5c0 5-3.4 8.4-8 10-4.6-1.6-8-5-8-10V6z"/><path d="m8.5 12 2.3 2.3 4.7-5"/>',
    thermometer: '<path d="M10 14.5V5a2 2 0 1 1 4 0v9.5a4 4 0 1 1-4 0z"/><path d="M12 9v7"/>',
    flame: '<path d="M12 3c1.7 3.2 1 5.1-.4 6.5-1.2 1.2-1.6 2.3-.8 3.7 2.2-.3 3.4-2.1 3.3-4.4 2.8 2.2 4.5 4.4 4.4 7A6.5 6.5 0 0 1 12 22a6.5 6.5 0 0 1-6.5-6.2c0-3.8 2.8-6.3 4.2-7.5C10.9 6.9 12.2 4.7 12 3z"/>',
    droplet: '<path d="M12 3s6 6.2 6 11a6 6 0 0 1-12 0c0-4.8 6-11 6-11z"/><path d="M9 14.5a3 3 0 0 0 6 0"/>',
    power: '<path d="M12 3v9"/><path d="M7.1 5.5a8 8 0 1 0 9.8 0"/>',
    info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 10.5v5M12 7.5h.01"/>',
    cert: '<path d="M12 3 19 6v5c0 4.3-2.8 7-7 9-4.2-2-7-4.7-7-9V6z"/><path d="m9 12 2 2 4-4"/>'
  };

  function icon(key) {
    return `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[key] || ICONS.info}</svg>`;
  }

  function iconForLabel(label) {
    const value = String(label || '');
    if (value.includes('电压')) return 'voltage';
    if (value.includes('电流')) return 'current';
    if (value.includes('频率')) return 'frequency';
    if (value.includes('电阻')) return 'resistance';
    if (value.includes('温度') || value.includes('蒸汽')) return 'thermometer';
    if (value.includes('耐压') || value.includes('防护')) return 'shield';
    if (value.includes('功率')) return 'power';
    if (value.includes('保护')) return 'flame';
    return 'info';
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function pad2(value) {
    return String(value == null ? '' : value).padStart(2, '0');
  }

  function pageRange(item) {
    if (item.start == null || item.end == null) return '—';
    return item.start === item.end ? pad2(item.start) : `${pad2(item.start)}–${pad2(item.end)}`;
  }

  function normalize(value) {
    return String(value || '').toLowerCase().replace(/[\s\-—–_/（）()·,，.。:：]+/g, '');
  }

  function seriesModelCount(item) {
    return item.combos.reduce((sum, combo) => sum + combo.a.length + combo.b.length, 0);
  }

  function showToast(message, duration = 1800) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('is-show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('is-show'), duration);
  }

  /* ---------- data IDs and navigation ---------- */

  series.forEach((item, seriesIndex) => {
    item.combos.forEach((combo, comboIndex) => {
      ['a', 'b'].forEach((part) => {
        combo[part].forEach((model, modelIndex) => {
          model.id = `s${seriesIndex}-c${comboIndex}-${part}-${modelIndex}`;
          model.seriesIndex = seriesIndex;
          model.comboIndex = comboIndex;
          model.part = part.toUpperCase();
          model.seriesName = item.name;
          modelById.set(model.id, model);
        });
      });
    });
  });

  function buildNav() {
    nav.replaceChildren();
    series.forEach((item, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'series-nav__item';
      button.dataset.index = String(index);
      button.setAttribute('aria-current', 'false');
      button.innerHTML = `
        <span class="series-nav__num">${pad2(item.number)}</span>
        <span>
          <span class="series-nav__name" title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</span>
        </span>
      `;
      button.addEventListener('click', () => selectSeries(index));
      nav.appendChild(button);
    });
    $('#seriesTotal').textContent = `${series.length} 个系列`;
    $('#modelTotal').textContent = `${modelById.size} 个型号`;
  }

  function updateNav() {
    $$('.series-nav__item', nav).forEach((item, index) => {
      item.classList.toggle('is-active', index === activeSeries);
      item.setAttribute('aria-current', index === activeSeries ? 'true' : 'false');
    });
  }

  /* ---------- thumbnails ---------- */

  function groupMarkup(part, models, comboIndex, comboCount) {
    if (!models.length) return '';
    const isA = part === 'A';
    return `
      <section class="product-group product-group--${isA ? 'a' : 'b'}" aria-label="${isA ? 'A 主产品' : 'B 配套产品'}">
        <div class="thumb-grid">
          ${models.map((model) => `
            <button class="thumb-card" type="button" data-model-id="${model.id}" aria-pressed="false" aria-label="${escapeHtml(model.name)}">
              <span class="thumb-visual">
                ${model.render
                  ? `<img src="${escapeHtml(model.render)}" alt="${escapeHtml(model.name)}" loading="eager" decoding="async">`
                  : '<span class="thumb-missing">暂无产品图</span>'}
              </span>
              <span class="thumb-model">${escapeHtml(model.name)}</span>
            </button>
          `).join('')}
        </div>
      </section>
    `;
  }

  function comboMarkup(combo, comboIndex, comboCount) {
    return `
      <section class="combo-block" aria-label="A+B 组合 ${comboIndex + 1}">
        ${comboCount > 1 ? `<div class="combo-label">组合 ${pad2(comboIndex + 1)} / ${pad2(comboCount)}</div>` : ''}
        ${groupMarkup('A', combo.a, comboIndex, comboCount)}
        ${groupMarkup('B', combo.b, comboIndex, comboCount)}
      </section>
    `;
  }

  function renderSeries(index, options = {}) {
    activeSeries = Math.max(0, Math.min(series.length - 1, Number(index) || 0));
    const item = series[activeSeries];
    const totalModels = seriesModelCount(item);
    updateNav();

    $('#seriesKicker').textContent = `SERIES ${pad2(item.number)}`;
    $('#seriesTitle').textContent = item.name;
    combosRoot.innerHTML = item.combos.map((combo, comboIndex) => comboMarkup(combo, comboIndex, item.combos.length)).join('');

    $$('.thumb-card', combosRoot).forEach((card) => {
      card.addEventListener('click', () => {
        selectModel(card.dataset.modelId);
        openImageViewer(card.dataset.modelId);
      });
    });

    const firstModel = item.combos.flatMap((combo) => [...combo.a, ...combo.b])[0];
    const preferred = options.modelId && modelById.has(options.modelId) ? options.modelId : (firstModel ? firstModel.id : null);
    renderDetail(preferred);
    if (preferred) setActiveCard(preferred);

    stage.scrollTop = 0;
    if (options.hash !== false) {
      history.replaceState(null, '', `#series-${pad2(item.number)}`);
    }
    $('#catalogLive').textContent = `已切换到 ${item.name}，${item.combos.length} 个 A+B 组合`;
  }

  function setActiveCard(modelId) {
    activeModelId = modelId;
    $$('.thumb-card', combosRoot).forEach((card) => {
      const isActive = card.dataset.modelId === modelId;
      card.classList.toggle('is-active', isActive);
      card.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
  }

  function selectModel(modelId, options = {}) {
    if (!modelById.has(modelId)) return;
    setActiveCard(modelId);
    renderDetail(modelId);
    if (options.focus !== false) {
      const card = $(`.thumb-card[data-model-id="${modelId}"]`, combosRoot);
      if (card) card.focus({ preventScroll: true });
    }
    $('#catalogLive').textContent = `已选择 ${modelById.get(modelId).name}`;
  }

  function selectSeries(index, options = {}) {
    const item = series[(index + series.length) % series.length];
    renderSeries(series.indexOf(item), options);
  }

  function stepSeries(direction) {
    selectSeries(activeSeries + direction);
  }

  /* ---------- detail parameters ---------- */

  function renderDetail(modelId) {
    const model = modelById.get(modelId);
    if (!model) {
      detailRoot.innerHTML = '<div class="detail-empty">请选择一个 A / B 型号查看参数。</div>';
      return;
    }
    const item = series[model.seriesIndex];
    const specs = model.specs || [];
    const partLabel = model.part === 'A' ? 'A · 主产品' : 'B · 配套产品';
    const partClass = model.part === 'A' ? 'detail-badge--a' : 'detail-badge--b';
    const pageLabel = model.page != null ? `印刷页 ${pad2(model.page)}` : '系列参数';

    detailRoot.innerHTML = `
      <div class="detail-eyebrow">
        <span>SELECTED MODEL</span>
        <span>${escapeHtml(model.part)} / ${escapeHtml(pageLabel)}</span>
      </div>
      <h3 class="detail-title">${escapeHtml(model.name)}</h3>
      <div class="detail-badges">
        <span class="detail-badge ${partClass}">${partLabel}</span>
        <span class="detail-badge">${escapeHtml(item.name)}</span>
      </div>

      <div class="detail-section">
        <div class="detail-section__head">
          <strong>技术参数</strong>
          <span>MODEL PARAMETERS</span>
        </div>
        ${specs.length ? `
          <div class="param-list">
            ${specs.map((spec) => `
              <div class="param-row">
                <span class="param-icon">${icon(iconForLabel(spec.label))}</span>
                <span class="param-label" title="${escapeHtml(spec.label)}">${escapeHtml(spec.label)}</span>
                <strong class="param-value">${escapeHtml(spec.value)}</strong>
              </div>
            `).join('')}
          </div>
        ` : '<div class="detail-empty">该型号暂无独立参数。</div>'}
      </div>


    `;

    $$('.thumb-card', combosRoot).forEach((card) => {
      card.classList.toggle('is-active', card.dataset.modelId === modelId);
      card.setAttribute('aria-pressed', card.dataset.modelId === modelId ? 'true' : 'false');
    });
  }

  /* ---------- modals ---------- */

  function openModal(id) {
    const modal = document.getElementById(id);
    if (!modal) return;
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    const focus = $('input, button:not([data-close])', modal);
    if (focus) setTimeout(() => focus.focus({ preventScroll: true }), 50);
  }

  function openImageViewer(modelId) {
    const model = modelById.get(modelId);
    if (!model || !model.render) return;
    const item = series[model.seriesIndex];
    const img = $('#catalogImageViewerImg');
    const title = $('#catalogImageViewerTitle');
    const sub = $('#catalogImageViewerSub');
    if (!img) return;
    img.src = model.render;
    img.alt = model.name;
    title.textContent = model.name;
    sub.textContent = `${item.name} · ${model.part === 'A' ? 'A 主产品' : 'B 配套产品'}`;
    openModal('catalogImageViewer');
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

  /* ---------- search ---------- */

  series.forEach((item, seriesIndex) => {
    searchItems.push({
      type: '系列',
      title: item.name,
      sub: `印刷页 ${pageRange(item)} · ${item.combos.length} 个 A+B 组合`,
      seriesIndex,
      hay: `${item.name} ${item.catalogName || ''} ${item.start || ''} ${item.end || ''}`
    });
    item.combos.forEach((combo) => {
      ['a', 'b'].forEach((part) => {
        combo[part].forEach((model) => {
          searchItems.push({
            type: `${model.part} 型号`,
            title: model.name,
            sub: `${item.name} · 印刷页 ${model.page != null ? pad2(model.page) : '系列'}`,
            seriesIndex,
            modelId: model.id,
            hay: `${model.name} ${item.name} ${model.specs.map((spec) => `${spec.label} ${spec.value}`).join(' ')}`
          });
        });
      });
    });
  });

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
      .map((item) => ({ item, pos: normalize(item.hay).indexOf(q) }))
      .filter((entry) => entry.pos >= 0)
      .sort((a, b) => a.pos - b.pos)
      .slice(0, 14);

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
        selectSeries(item.seriesIndex, { modelId: item.modelId, hash: false });
      });
      results.appendChild(button);
    });
  }

  /* ---------- utility actions ---------- */

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
      if (event.key === 'Escape' && document.querySelector('.catalog-modal.is-open')) {
        closeAll();
        event.preventDefault();
        return;
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

    window.addEventListener('hashchange', () => {
      const match = location.hash.match(/^#series-(\d+)/);
      if (match) selectSeries(Number(match[1]) - 1, { hash: false });
    });
  }

  /* ---------- ambient starfield ---------- */

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
        const radius = Math.random() * 1.25 + .2;
        const alpha = Math.random() * .55 + .12;
        ctx.fillStyle = `rgba(190, 220, 255, ${alpha})`;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
      }
    };
    draw();
    window.addEventListener('resize', draw);
  }

  function initialSeries() {
    const match = location.hash.match(/^#series-(\d+)/);
    return match ? Math.max(0, Math.min(series.length - 1, Number(match[1]) - 1)) : 0;
  }

  buildNav();
  wireUi();
  initStars();
  renderSeries(initialSeries(), { hash: false });
})();
