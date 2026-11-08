/* Shared button/select binding and a switch with a real refracting thumb. */
(() => {
    const pressed = new Map(), timers = new WeakMap();
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const find = target => target.closest('.btn,.icon-btn,.avatar,.menu-item,.select');
    document.querySelectorAll('.btn--disabled').forEach(el => { el.disabled = true; });
    function effect(el, on) { window.applyLiquidGlassEffect(el, on); }
    document.querySelectorAll('.switch').forEach(el => {
        el.removeAttribute('onclick');
        const thumb = document.createElement('span');
        thumb.className = 'switch-thumb';
        thumb.setAttribute('aria-hidden', 'true'); el.append(thumb);
        const end = () => { clearTimeout(timers.get(el)); SmallLiquidGlass.apply(thumb, false); };
        el.addEventListener('click', () => {
            clearTimeout(timers.get(el));
            if (!reduced.matches) SmallLiquidGlass.apply(thumb, true);
            const enabled = el.classList.toggle('active');
            el.setAttribute('aria-checked', String(enabled));
            // Fallback also handles interrupted transitions and hidden tabs.
            timers.set(el, setTimeout(end, reduced.matches ? 0 : 440));
        });
        thumb.addEventListener('transitionend', e => { if (e.propertyName === 'transform') end(); });
    });
    function valid(el) { return el && !el.disabled && !el.classList.contains('btn--disabled') && el.tagName !== 'SELECT'; }
    document.addEventListener('pointerdown', e => {
        if (e.button !== 0) return;
        const el = find(e.target);
        if (!valid(el)) return;
        pressed.set(e.pointerId, el); effect(el, true);
    });
    const release = e => { const el = pressed.get(e.pointerId); if (el) effect(el, false); pressed.delete(e.pointerId); };
    document.addEventListener('pointerup', release);
    document.addEventListener('pointercancel', release);
    document.addEventListener('keydown', e => {
        const el = find(e.target);
        if (valid(el) && ['Enter',' '].includes(e.key)) effect(el, true);
    });
    document.addEventListener('keyup', e => {
        const el = find(e.target);
        if (valid(el) && ['Enter',' '].includes(e.key)) effect(el, false);
    });
    document.addEventListener('focusin', e => { if (e.target.matches('.select')) effect(e.target, true); });
    document.addEventListener('focusout', e => {
        const el = find(e.target); if (el) effect(el, false);
    });
    window.addEventListener('blur', () => { for (const el of pressed.values()) effect(el, false); pressed.clear(); });
})();
