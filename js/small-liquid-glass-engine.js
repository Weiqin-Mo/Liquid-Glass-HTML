/* Independent small-control renderer. One reusable SVG filter per active
 * control, local CSS-pixel coordinates, no dependency on the panel engine. */
(() => {
    const NS = 'http://www.w3.org/2000/svg';
    const active = new Map();
    let defs;
    let sequence = 0;
    let strength = 3;
    let trackingFrame = 0;
    const selector = '.slider-thumb, .switch-thumb, .seg-indicator, .btn, .icon-btn, .avatar, .switch, .select, .seg-item, .menu-item';
    // Both the top navigation bar and floating-panel title bar retain the
    // panel engine, including all their descendants.
    const isControl = el => el.matches(selector) &&
        !el.closest('.topbar, .panel-header, [data-glass-engine="panel"]');
    const smooth = t => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };

    function node(name, attrs = {}) {
        const el = document.createElementNS(NS, name);
        for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, value);
        return el;
    }

    function createFilter() {
        if (!defs) {
            const svg = node('svg', { width: 0, height: 0, 'aria-hidden': true });
            svg.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;pointer-events:none;overflow:hidden;';
            defs = node('defs');
            svg.append(defs);
            document.body.append(svg);
        }
        const filter = node('filter', { id: `small-glass-${++sequence}`,
            filterUnits: 'userSpaceOnUse', primitiveUnits: 'userSpaceOnUse',
            x: 0, y: 0, 'color-interpolation-filters': 'sRGB' });
        const image = node('feImage', { result: 'map', preserveAspectRatio: 'none' });
        const displacement = node('feDisplacementMap', { in: 'SourceGraphic', in2: 'map',
            xChannelSelector: 'R', yChannelSelector: 'G' });
        filter.append(image, displacement);
        defs.append(filter);
        return { filter, image, displacement, signature: '' };
    }

    function buildMap(width, height, radius, slider, amount) {
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        const context = canvas.getContext('2d');
        if (!context) return null;
        const image = context.createImageData(width, height);
        // The previous hard cap saturated at strength 1.6: most of the UI
        // range did nothing. A smooth curve keeps the full 0–6 range useful.
        const maxDisplacement = Math.min(width * .4, height * 1.2);
        const amplitude = maxDisplacement * (1 - Math.exp(-amount * .4));
        // Fixed symmetric range makes zero-strength neutral rather than NaN.
        const scale = Math.max(1, amplitude * 2);
        const halfW = width / 2, halfH = height / 2;
        for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
            const px = x + .5 - halfW, py = y + .5 - halfH;
            let dx = 0, dy = 0;
            if (slider) {
                const start = Math.max(0, halfW - halfH * 1.3);
                const weight = smooth((Math.abs(px) - start) / (halfW - start));
                dx = -Math.sign(px) * weight * amplitude;
                // Top/bottom edge refraction complements the left/right caps.
                // Keep it symmetric and leave the centre of the lens neutral.
                const verticalWeight = smooth((Math.abs(py) / halfH - .45) / .55);
                const verticalGain = Math.max(weight * .35, verticalWeight * .55);
                dy = -py / halfH * verticalGain * amplitude;
            } else {
                // Rounded-rectangle boundary normal, not a radial vector from
                // the centre (which is wrong for wide rectangular buttons).
                const qx = Math.abs(px) - halfW + radius;
                const qy = Math.abs(py) - halfH + radius;
                const ox = Math.max(qx, 0), oy = Math.max(qy, 0);
                const length = Math.hypot(ox, oy);
                const distance = Math.min(Math.max(qx, qy), 0) + length - radius;
                const weight = smooth(1 + distance / Math.max(2, Math.min(halfH, 8)));
                const nx = length ? ox / length : Number(qx > qy);
                const ny = length ? oy / length : Number(qy >= qx);
                dx = -Math.sign(px) * nx * weight * amplitude;
                dy = -Math.sign(py) * ny * weight * amplitude;
            }
            const i = (y * width + x) * 4;
            image.data[i] = (dx / scale + .5) * 255;
            image.data[i + 1] = (dy / scale + .5) * 255;
            image.data[i + 2] = 0; image.data[i + 3] = 255;
        }
        context.putImageData(image, 0, 0);
        return { url: canvas.toDataURL(), scale: amount === 0 ? 0 : scale };
    }

    function update(el) {
        const entry = active.get(el);
        if (!entry) return;
        if (!el.isConnected) { apply(el, false); return; }
        const rect = entry.surface ? el.getBoundingClientRect() : null;
        // Portaled lenses are untransformed and use the source's final screen
        // dimensions. Inline button filters still use local CSS coordinates.
        const width = rect ? Math.round(rect.width) : el.offsetWidth;
        const height = rect ? Math.round(rect.height) : el.offsetHeight;
        if (entry.surface) {
            entry.surface.style.left = rect.left + 'px';
            entry.surface.style.top = rect.top + 'px';
            entry.surface.style.width = rect.width + 'px';
            entry.surface.style.height = rect.height + 'px';
            entry.surface.style.display = width && height ? 'block' : 'none';
        }
        if (width < 2 || height < 2) return;
        const zoom = rect ? rect.width / (el.offsetWidth || rect.width) : 1;
        const radius = Math.min((parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0) * zoom, width / 2, height / 2);
        if (entry.surface) entry.surface.style.borderRadius = radius + 'px';
        const slider = el.matches('.slider-thumb, .switch-thumb, .seg-indicator');
        const signature = [width, height, radius, slider, strength].join(':');
        if (signature === entry.signature) return;
        const map = buildMap(width, height, radius, slider, strength);
        if (!map) return;
        for (const target of [entry.filter, entry.image, entry.displacement]) {
            target.setAttribute('x', 0); target.setAttribute('y', 0);
            target.setAttribute('width', width); target.setAttribute('height', height);
        }
        entry.image.setAttribute('href', map.url);
        entry.image.setAttributeNS('http://www.w3.org/1999/xlink', 'href', map.url);
        entry.displacement.setAttribute('scale', map.scale);
        entry.signature = signature;
    }

    const observer = new ResizeObserver(entries => entries.forEach(({ target }) => update(target)));
    function trackSurfaces() {
        trackingFrame = 0;
        refresh();
        if ([...active.values()].some(entry => entry.surface)) {
            trackingFrame = requestAnimationFrame(trackSurfaces);
        }
    }
    function apply(el, enabled) {
        if (!isControl(el)) return;
        if (enabled) {
            if (!active.has(el)) active.set(el, createFilter());
            el.classList.add('glass-active', 'small-glass-active');
            const entry = active.get(el);
            if (!entry.surface && el.matches('.slider-thumb, .switch-thumb, .seg-indicator')) {
                // Escape ancestor backdrop roots. This transparent body-level
                // surface samples the composited page, including panels/text.
                entry.surface = document.createElement('div');
                entry.surface.className = 'small-glass-lens';
                entry.surface.setAttribute('aria-hidden', 'true');
                document.body.append(entry.surface);
                el.classList.add('small-glass-source');
            }
            update(el);
            (entry.surface || el).style.setProperty('--lg-filter', `url(#${entry.filter.id})`);
            observer.observe(el);
            if (entry.surface && !trackingFrame) trackingFrame = requestAnimationFrame(trackSurfaces);
        } else {
            observer.unobserve(el);
            active.get(el)?.surface?.remove();
            active.get(el)?.filter.remove();
            active.delete(el);
            el.classList.remove('glass-active', 'small-glass-active', 'small-glass-source');
            el.style.removeProperty('--lg-filter');
            if (![...active.values()].some(entry => entry.surface)) {
                cancelAnimationFrame(trackingFrame);
                trackingFrame = 0;
            }
        }
    }
    function refresh() { for (const el of active.keys()) update(el); }
    function setParameters({ refractionStrength } = {}) {
        if (Number.isFinite(refractionStrength)) strength = Math.max(0, Math.min(6, refractionStrength));
        refresh();
    }
    function setMix(el, amount) {
        const surface = active.get(el)?.surface;
        if (surface) surface.style.backgroundColor = `rgba(255,255,255,${1 - .96 * Math.max(0, Math.min(1, amount))})`;
    }
    window.SmallLiquidGlass = { apply, update, refresh, setParameters, isControl, setMix };
})();
