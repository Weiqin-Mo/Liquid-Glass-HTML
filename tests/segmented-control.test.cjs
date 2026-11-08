const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict');
const path = require('node:path');
function fixture(reduce = false) {
    const queue = new Map(); let time = 0, id = 0, enabled = false;
    const classes = () => { const set = new Set(); return {
        add: k => set.add(k), remove: k => set.delete(k), contains: k => set.has(k),
        toggle: (k,on) => on ? set.add(k) : set.delete(k)
    }; };
    const handlers = {}, pill = { style: {}, classList: classes() };
    const items = Array.from({ length: 4 }, (_, i) => ({
        offsetLeft: 5 + i * 55, offsetWidth: 50, classList: classes(), dataset: { seg: String(i) },
        setAttribute(k,v) { this[k] = v; }, focus() {}, closest() { return this; }
    }));
    items[0].classList.add('active');
    const root = { dataset: {}, classList: classes(), isConnected: true,
        querySelector: () => pill, querySelectorAll: () => items, getAttribute: () => null,
        setAttribute() {}, addEventListener: (n,f) => handlers[n] = f, dispatchEvent() {},
        setPointerCapture(n) { this.capture = n; }, hasPointerCapture(n) { return this.capture === n; },
        releasePointerCapture() { this.capture = null; }
    };
    const ctx = { window: { addEventListener() {} }, matchMedia: () => ({ matches: reduce }),
        requestAnimationFrame: f => { queue.set(++id,f); return id; },
        getComputedStyle: () => ({ getPropertyValue: () => '1.3' }),
        ResizeObserver: class { observe() {} }, CustomEvent: class {},
        SmallLiquidGlass: { apply: (el,on) => enabled = on, update() {}, setMix(el,mix) { assert(mix >= 0 && mix <= 1); } }
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../js/segmented-control.js'), 'utf8'), ctx);
    ctx.window.SegmentedControl.init(root);
    function advance(count = 180) { for (let i=0;i<count && queue.size;i++) {
        const batch = [...queue.values()]; queue.clear(); time += 1000/60; batch.forEach(f=>f(time));
    } }
    const down = (i,x=30) => handlers.pointerdown({ target:items[i], isPrimary:true, button:0, pointerId:1, clientX:x, clientY:20 });
    const up = () => handlers.pointerup({ pointerId:1 });
    return { root, pill, items, handlers, advance, down, up, enabled: () => enabled, queue };
}
const f = fixture();
assert.equal(f.pill.style.left, '5px');
f.down(3); f.advance(5);
const mid = parseFloat(f.pill.style.left); assert(mid > 5 && mid < 170);
f.up(); f.down(1);
assert.equal(parseFloat(f.pill.style.left), mid, 'interruption must preserve current position');
f.up(); f.advance();
assert.equal(f.pill.style.left, '60px'); assert(!f.enabled());
assert.equal(f.queue.size, 0, 'settled motion must stop scheduling frames');
f.down(1,80); f.handlers.pointermove({ pointerId:1,clientX:140,clientY:30 });
assert(parseFloat(f.pill.style.left) > 100, 'first drag move must follow pointer');
f.handlers.pointercancel(); f.advance();
assert.equal(f.pill.style.left, '60px'); assert(!f.enabled());
f.handlers.keydown({ key:'End', preventDefault() {} }); f.advance();
assert.equal(f.pill.style.left,'170px'); assert.equal(f.items[3]['aria-pressed'],'true');
const r = fixture(true); r.down(2); r.up();
assert.equal(r.pill.style.left,'115px'); assert.equal(r.queue.size,0); assert(!r.enabled());
console.log('PASS: interruptible spring, drag offset, cancellation, keyboard, rest cleanup and reduced motion');
