// Material browser shared by index.html and embed.html.
// Mount with OSViewer.mount(element); materials come from window.OS_MATERIALS.
(function () {
  const BASE_CONTROLS = ["Scale", "Displacement", "Detail", "Hue", "Saturation", "Brightness"];
  const CATEGORIES = ["All", "Flesh & Tissue", "Scales & Spikes", "Glow", "Skin & Moss", "Rock & Coral"];

  function el(tag, attrs, children) {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (k === "text") n.textContent = v;
      else if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v);
    }
    (children || []).forEach((c) => n.append(c));
    return n;
  }

  const ICON_PREV = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>';
  const ICON_NEXT = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>';

  function mount(root, opts) {
    opts = opts || {};
    const all = window.OS_MATERIALS || [];
    let list = all.slice();
    let index = 0;

    const img = el("img", { alt: "", decoding: "async" });
    const count = el("span", { class: "count" });
    const prev = el("button", { class: "nav prev", type: "button", "aria-label": "Previous material" });
    const next = el("button", { class: "nav next", type: "button", "aria-label": "Next material" });
    prev.innerHTML = ICON_PREV;
    next.innerHTML = ICON_NEXT;
    const stage = el("div", { class: "stage" }, [img, prev, next, count]);

    const cat = el("span", { class: "cat" });
    const title = el("h2", { id: "os-title" });
    const desc = el("p", { class: "desc" });
    const tags = el("div", { class: "tags" });
    const ctl = el("ul", { class: "controls-list" });
    const specs = el("div", { class: "specs" });
    specs.innerHTML = "<span><b>100%</b> procedural</span><span><b>Cycles</b> + EEVEE</span><span><b>Blender</b> 4.5+</span>";
    const info = el("div", { class: "info", "aria-live": "polite" },
      [cat, title, desc, tags, el("h3", { text: "Controls" }), ctl, el("h3", { text: "Every material" }), specs]);
    if (opts.brand) info.append(opts.brand);

    const filters = el("div", { class: "filters", role: "toolbar", "aria-label": "Filter by category" });
    const thumbs = el("div", { class: "thumbs", role: "listbox", "aria-label": "Materials" });
    const strip = el("div", { class: "strip" }, [filters, thumbs]);

    root.classList.add("viewer");
    root.append(stage, info, strip);

    CATEGORIES.forEach((c) => {
      const b = el("button", { type: "button", "aria-pressed": c === "All" ? "true" : "false", text: c,
        onclick: () => setFilter(c) });
      filters.append(b);
    });

    // preload the big images lazily, one step ahead
    const cache = {};
    function preload(m) {
      if (!m || cache[m.id]) return;
      cache[m.id] = new Image();
      cache[m.id].src = "assets/img/materials/" + m.id + ".jpg";
    }

    function renderThumbs() {
      thumbs.replaceChildren(...list.map((m, i) => el("button", {
        type: "button", role: "option", "aria-label": m.name, title: m.name,
        "aria-current": i === index ? "true" : "false", onclick: () => show(i),
      }, [el("img", { src: "assets/img/thumbs/" + m.id + ".jpg", alt: "", loading: "lazy" })])));
    }

    function show(i, instant) {
      index = (i + list.length) % list.length;
      const m = list[index];
      const src = "assets/img/materials/" + m.id + ".jpg";
      if (instant) {
        img.src = src;
      } else {
        img.classList.add("fading");
        const loader = new Image();
        loader.onload = loader.onerror = () => { img.src = src; img.classList.remove("fading"); };
        loader.src = src;
      }
      img.alt = m.name + " material on a sphere";
      count.textContent = String(m.n).padStart(2, "0") + " / " + all.length;
      cat.textContent = m.category;
      title.textContent = m.name;
      desc.textContent = m.description;
      tags.replaceChildren(...m.tags.map((t) => el("span", { text: t })));
      const controls = m.glow ? BASE_CONTROLS.concat("Glow") : BASE_CONTROLS;
      ctl.replaceChildren(...controls.map((c) => el("li", { text: c })));
      [...thumbs.children].forEach((b, j) => b.setAttribute("aria-current", j === index ? "true" : "false"));
      // keep the active thumbnail in view (after layout, so it also works on first load)
      requestAnimationFrame(() => {
        const active = thumbs.children[index];
        if (!active) return;
        const box = thumbs.getBoundingClientRect(), r = active.getBoundingClientRect();
        if (r.left < box.left || r.right > box.right) {
          thumbs.scrollBy({ left: r.left - box.left - box.width / 2 + r.width / 2,
                            behavior: instant ? "auto" : "smooth" });
        }
      });
      preload(list[(index + 1) % list.length]);
    }

    function setFilter(c) {
      const current = list[index];
      list = c === "All" ? all.slice() : all.filter((m) => m.category === c);
      [...filters.children].forEach((b) => b.setAttribute("aria-pressed", b.textContent === c ? "true" : "false"));
      const keep = list.indexOf(current);
      index = keep >= 0 ? keep : 0;
      renderThumbs();
      show(index);
    }

    prev.addEventListener("click", () => show(index - 1));
    next.addEventListener("click", () => show(index + 1));
    root.tabIndex = 0;
    root.addEventListener("keydown", (e) => {
      if (e.key === "ArrowLeft") { show(index - 1); e.preventDefault(); }
      if (e.key === "ArrowRight") { show(index + 1); e.preventDefault(); }
    });
    // swipe on touch screens
    let x0 = null;
    stage.addEventListener("touchstart", (e) => { x0 = e.touches[0].clientX; }, { passive: true });
    stage.addEventListener("touchend", (e) => {
      if (x0 === null) return;
      const dx = e.changedTouches[0].clientX - x0;
      if (Math.abs(dx) > 40) show(index + (dx < 0 ? 1 : -1));
      x0 = null;
    });

    const start = Math.max(0, all.findIndex((m) => m.id === (opts.start || "")));
    renderThumbs();
    show(start, true);
  }

  window.OSViewer = { mount };
})();
