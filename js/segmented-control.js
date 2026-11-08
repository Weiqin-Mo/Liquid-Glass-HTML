/* Interruptible spring motion shared by both segmented demos. */
(() => {
    function init(root) {
        const pill = root.querySelector('.seg-indicator');
        const items = [...root.querySelectorAll('.seg-item')];
        if (!pill || !items.length || root.dataset.segmentedReady) return;
        root.dataset.segmentedReady = 'true';
        root.setAttribute('role', 'group');
        root.setAttribute('aria-label', root.getAttribute('aria-label') || '分段选择');
        let selected = items.find(i => i.classList.contains('active')) || items[0];
        let pointer = null, frame = 0, previousTime = 0, glass = false;
        const reduced = matchMedia('(prefers-reduced-motion: reduce)');
        const values = { x: 0, width: 0, scale: 1, y: 0, mix: 0 };
        const target = { ...values }, velocity = { ...values, scale: 0 };
        function layout(item) {
            // Layout coordinates are unaffected by the animated pill's scale.
            return { x: item.offsetLeft, width: item.offsetWidth };
        }
        function nearest() {
            const centre = values.x + values.width / 2;
            return items.reduce((best, item) => {
                const a = layout(item), b = layout(best);
                return Math.abs(a.x + a.width / 2 - centre) < Math.abs(b.x + b.width / 2 - centre) ? item : best;
            }, items[0]);
        }
        function render() {
            pill.style.left = values.x + 'px';
            pill.style.width = values.width + 'px';
            pill.style.transform = `translateY(${values.y}px) scale(${values.scale})`;
            if (glass) {
                SmallLiquidGlass.update(pill);
                SmallLiquidGlass.setMix(pill, Math.max(0, Math.min(1, values.mix)));
            }
        }
        function stopGlass() {
            if (glass) SmallLiquidGlass.apply(pill, false);
            glass = false;
        }
        function tick(time) {
            frame = 0;
            if (!root.isConnected) { stopGlass(); return; }
            const dt = Math.min(.032, previousTime ? (time - previousTime) / 1000 : 1 / 60);
            previousTime = time;
            const steps = Math.max(1, Math.ceil(dt / .008)), h = dt / steps;
            let moving = false;
            for (let n = 0; n < steps; n++) for (const key of Object.keys(values)) {
                if (pointer?.dragging && key === 'x') continue;
                const k = key === 'scale' ? 320 : 400;
                const damping = key === 'scale' ? 27 : 38;
                velocity[key] += ((target[key] - values[key]) * k - velocity[key] * damping) * h;
                values[key] += velocity[key] * h;
            }
            for (const key of Object.keys(values)) {
                const spatial = key === 'x' || key === 'width' || key === 'y';
                if (Math.abs(target[key] - values[key]) > (spatial ? .08 : .002) || Math.abs(velocity[key]) > (spatial ? .4 : .02)) moving = true;
            }
            render();
            if (moving) frame = requestAnimationFrame(tick);
            else if (!pointer) {
                Object.assign(values, target);
                render();
                stopGlass();
                previousTime = 0;
            }
        }
        function animate() {
            if (reduced.matches) {
                Object.assign(values, target);
                render();
                if (!pointer) stopGlass();
                return;
            }
            if (!glass) {
                glass = true;
                SmallLiquidGlass.apply(pill, true);
                SmallLiquidGlass.setMix(pill, values.mix);
            }
            if (!frame) { previousTime = 0; frame = requestAnimationFrame(tick); }
        }
        function commit(item, notify = true) {
            const changed = selected !== item;
            selected = item;
            items.forEach(i => {
                i.classList.toggle('active', i === item);
                i.setAttribute('aria-pressed', String(i === item));
                i.tabIndex = i === item ? 0 : -1;
            });
            Object.assign(target, layout(item));
            if (changed && notify) root.dispatchEvent(new CustomEvent('segmentchange', { bubbles: true, detail: { value: item.dataset.seg || item.textContent.trim() } }));
        }
        function release(cancelled = false) {
            if (!pointer) return;
            const old = pointer;
            pointer = null;
            if (root.hasPointerCapture(old.id)) root.releasePointerCapture(old.id);
            root.classList.remove('dragging');
            commit(cancelled ? old.original : old.dragging ? nearest() : selected);
            target.scale = 1; target.y = 0; target.mix = 0;
            animate();
        }
        pill.style.transition = 'none';
        commit(selected, false);
        Object.assign(values, target);
        render();
        root.addEventListener('pointerdown', e => {
            if (pointer || !e.isPrimary || e.button !== 0) return;
            const item = e.target.closest('.seg-item');
            if (!items.includes(item)) return;
            const original = selected;
            pointer = { id: e.pointerId, x: e.clientX, y: e.clientY, startX: values.x, original, dragging: false };
            root.setPointerCapture(e.pointerId);
            commit(item);
            target.scale = Math.min(1.35, Math.max(1, parseFloat(getComputedStyle(root).getPropertyValue('--thumb-scale')) || 1.18));
            target.mix = 1;
            animate();
        });
        root.addEventListener('pointermove', e => {
            if (!pointer || pointer.id !== e.pointerId) return;
            const dx = e.clientX - pointer.x;
            if (!pointer.dragging && Math.abs(dx) < 4) return;
            if (!pointer.dragging) {
                pointer.dragging = true;
                // Preserve the grab offset rather than jumping to the pointer centre.
                pointer.startX = values.x - Math.sign(dx) * 4;
                root.classList.add('dragging');
            }
            const min = layout(items[0]).x, last = layout(items.at(-1));
            const max = last.x + last.width - values.width;
            const desired = pointer.startX + dx;
            const clamped = Math.max(min, Math.min(max, desired));
            values.x = target.x = clamped + Math.tanh((desired - clamped) / 30) * 4;
            velocity.x = 0;
            target.y = Math.tanh((e.clientY - pointer.y) / 30) * 3;
            target.width = layout(nearest()).width;
            render(); animate();
        });
        root.addEventListener('pointerup', e => { if (pointer?.id === e.pointerId) release(); });
        root.addEventListener('pointercancel', () => release(true));
        root.addEventListener('lostpointercapture', () => release(true));
        window.addEventListener('blur', () => release(true));
        root.addEventListener('click', e => {
            const item = e.target.closest('.seg-item');
            if (e.detail !== 0 || !items.includes(item) || pointer) return;
            commit(item); target.scale = 1; target.mix = 0; animate();
        });
        root.addEventListener('keydown', e => {
            const index = items.indexOf(selected);
            const next = { ArrowRight: (index + 1) % items.length, ArrowLeft: (index + items.length - 1) % items.length, Home: 0, End: items.length - 1 }[e.key];
            if (next === undefined) return;
            e.preventDefault();
            commit(items[next]); items[next].focus();
            target.scale = 1; target.mix = 0; animate();
        });
        new ResizeObserver(() => {
            if (!pointer) { Object.assign(target, layout(selected)); animate(); }
        }).observe(root);
    }
    window.SegmentedControl = { init };
})();
