/* Shared accessible slider controller. */
(() => {
        function initSlider(sliderEl) {
            const track = sliderEl.querySelector('.slider-track');
            const thumb = sliderEl.querySelector('.slider-thumb');
            const fill = sliderEl.querySelector('.slider-fill');
            if (!track || !thumb || !fill) return;

            let min = parseFloat(sliderEl.dataset.min) || 0;
            let max = parseFloat(sliderEl.dataset.max) || 100;
            let step = parseFloat(sliderEl.dataset.step) || 1;
            let value = parseFloat(sliderEl.dataset.value) ?? min;
            let active = false;
            let filterFrame = 0;
            thumb.dataset.glassProfile = 'slider';
            function refreshThumb() {
                if (!active || filterFrame) return;
                filterFrame = requestAnimationFrame(() => {
                    filterFrame = 0;
                    if (active) SmallLiquidGlass.update(thumb);
                });
            }
            thumb.addEventListener('transitionend', refreshThumb);
            const thumbObserver = new ResizeObserver(refreshThumb);
            thumbObserver.observe(thumb);

            const label = sliderEl.getAttribute('aria-label') ||
                sliderEl.closest('.panel-item')?.querySelector('.panel-item-label span')?.textContent ||
                '数值滑块';
            sliderEl.setAttribute('role', 'slider');
            sliderEl.setAttribute('tabindex', '0');
            sliderEl.setAttribute('aria-label', label);
            sliderEl.setAttribute('aria-valuemin', String(min));
            sliderEl.setAttribute('aria-valuemax', String(max));

            function setValue(val, triggerCallback = true) {
                val = Math.min(max, Math.max(min, val));
                if (step < 1) val = Math.round(val / step) * step;
                else val = Math.round(val);

                value = val;
                sliderEl.setAttribute('aria-valuenow', String(value));
                const pct = ((value - min) / (max - min)) * 100;
                thumb.style.left = pct + '%';
                fill.style.width = pct + '%';
                sliderEl.dataset.value = value;
                refreshThumb();

                const container = sliderEl.closest('.slider-row') || sliderEl.closest('.panel-item');
                let display = container ? container.querySelector('.slider-value') : null;
                if (!display) display = container ? container.querySelector('.val') : null;
                if (display) {
                    const cb = sliderEl.dataset.callback;
                    if (cb === 'updateThumbScale') display.textContent = value + 'x';
                    else if (cb === 'updateEdgeWidth') display.textContent = value + 'px';
                    else if (step < 1) display.textContent = value.toFixed(2);
                    else {
                        if (cb === 'updateRadius' || cb === 'updateBlur') display.textContent = value + 'px';
                        else display.textContent = value;
                    }
                }

                const callbackName = sliderEl.dataset.callback;
                if (callbackName && window[callbackName] && triggerCallback) {
                    window[callbackName](value, sliderEl);
                }
            }

            function updateFromClientX(clientX) {
                const rect = track.getBoundingClientRect();
                const x = Math.min(Math.max(clientX - rect.left, 0), rect.width);
                const pct = x / rect.width;
                const rawVal = min + (max - min) * pct;
                setValue(rawVal);
            }

            function activateLiquid() {
                if (!active) return;
                SmallLiquidGlass.apply(thumb, true);
            }

            function deactivateLiquid() {
                SmallLiquidGlass.apply(thumb, false);
            }

            function finishInteraction() {
                active = false;
                sliderEl.classList.remove('active');
                deactivateLiquid();
            }
            window.addEventListener('touchcancel', finishInteraction);
            window.addEventListener('blur', finishInteraction);
            sliderEl.addEventListener('blur', finishInteraction);

            sliderEl.addEventListener('mousedown', (e) => {
                e.preventDefault();
                active = true;
                sliderEl.classList.add('active');
                activateLiquid();
                updateFromClientX(e.clientX);
            });

            window.addEventListener('mousemove', (e) => {
                if (!active) return;
                updateFromClientX(e.clientX);
            });

            window.addEventListener('mouseup', () => {
                if (!active) return;
                active = false;
                sliderEl.classList.remove('active');
                deactivateLiquid();
            });

            sliderEl.addEventListener('touchstart', (e) => {
                e.preventDefault();
                active = true;
                sliderEl.classList.add('active');
                activateLiquid();
                updateFromClientX(e.touches[0].clientX);
            }, { passive: false });

            window.addEventListener('touchmove', (e) => {
                if (!active) return;
                updateFromClientX(e.touches[0].clientX);
            }, { passive: false });

            window.addEventListener('touchend', () => {
                if (!active) return;
                active = false;
                sliderEl.classList.remove('active');
                deactivateLiquid();
            });

            sliderEl.addEventListener('keydown', (e) => {
                const pageStep = step * 10;
                let nextValue = value;
                if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') nextValue -= step;
                else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') nextValue += step;
                else if (e.key === 'PageDown') nextValue -= pageStep;
                else if (e.key === 'PageUp') nextValue += pageStep;
                else if (e.key === 'Home') nextValue = min;
                else if (e.key === 'End') nextValue = max;
                else return;
                e.preventDefault();
                active = true;
                sliderEl.classList.add('active');
                activateLiquid();
                setValue(nextValue);
            });
            sliderEl.addEventListener('keyup', (e) => {
                if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End'].includes(e.key)) finishInteraction();
            });

            setValue(value, false);
            // Idle is opaque white; only active interactions attach a filter.
        }

        /* ========== 回调 ========== */
        window.updateValueDisplay = function(val, slider) {};

        window.updateSmallRefraction = function(val) {
            SmallLiquidGlass.setParameters({ refractionStrength: Number(val) });
            const display = document.getElementById('smallRefractionVal');
            if (display) display.textContent = Number(val).toFixed(2);
        };

        // Dim the background; transparent glass naturally samples this result.
        window.updateBackgroundDim = function(val) {
            const percent = Math.min(100, Math.max(0, Number(val) || 0));
            BackgroundDimmer.set(percent);
            const display = document.getElementById('backgroundDimVal');
            if (display) display.textContent = percent + '%';
        };


        window.LiquidGlassControls = { initSlider };
})();
