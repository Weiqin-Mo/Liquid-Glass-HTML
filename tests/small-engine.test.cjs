const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function element(name = 'div') {
    const attrs = {}, classes = new Set(), properties = new Map();
    return {
        name, children: [], attrs, isConnected: true, offsetWidth: 44, offsetHeight: 21,
        screenLeft: 100, screenTop: 60, screenScale: 1,
        getBoundingClientRect() { return {left:this.screenLeft, top:this.screenTop,
            width:this.offsetWidth*this.screenScale,height:this.offsetHeight*this.screenScale}; },
        style: { setProperty: (k,v) => properties.set(k,v), removeProperty: k => properties.delete(k),
            getPropertyValue: k => properties.get(k) },
        classList: { add: (...keys) => keys.forEach(k => classes.add(k)),
            remove: (...keys) => keys.forEach(k => classes.delete(k)), contains: k => classes.has(k) },
        setAttribute(k,v) { attrs[k] = String(v); if (k === 'id') this.id = v; },
        setAttributeNS(ns,k,v) { this.setAttribute(k,v); },
        append(...nodes) { this.children.push(...nodes); nodes.forEach(n => n.parent = this); },
        remove() { this.parent.children = this.parent.children.filter(n => n !== this); },
        matches(selector) { return selector.split(',').some(s => s.trim() === this.kind); },
        closest() { return this.inTitlebar ? {} : null; }
    };
}
let pixels;
const body = element('body');
const document = { body, createElementNS: (ns,name) => element(name),
    createElement: name => name === 'div' ? element() : ({ getContext: () => ({
        createImageData: (w,h) => ({ data: new Uint8ClampedArray(w*h*4) }),
        putImageData: image => { pixels = image.data; }
    }), toDataURL: () => 'data:image/png;base64,test' }) };
const context = { window: {}, document, ResizeObserver: class { observe() {} unobserve() {} },
    requestAnimationFrame: () => 1, cancelAnimationFrame() {},
    getComputedStyle: () => ({ borderTopLeftRadius: '999px' }) };
const source = fs.readFileSync(path.join(__dirname, '../small-liquid-glass-engine.js'), 'utf8');
// Expose the numeric map builder inside this isolated test VM only.
vm.runInNewContext(source.replace('window.SmallLiquidGlass = {', 'window.testBuildMap = buildMap; window.SmallLiquidGlass = {'), context);
const engine = context.window.SmallLiquidGlass;
for (const kind of ['.slider-thumb','.seg-indicator','.btn','.icon-btn']) {
    const el = element(); el.kind = kind;
    assert(engine.isControl(el), `${kind} should use the independent engine`);
    el.inTitlebar = true;
    assert(!engine.isControl(el), `${kind} inside titlebar must stay excluded`);
    engine.apply(el, true);
    assert(!el.classList.contains('small-glass-active'));
}
const thumb = element(); thumb.kind = '.slider-thumb';
engine.apply(thumb, true);
assert(thumb.classList.contains('small-glass-active'));
const lens = body.children.find(el => el.className === 'small-glass-lens');
assert(lens, 'a body-level lens escapes the parent glass backdrop root');
assert.equal(lens.parent, body);
assert(thumb.classList.contains('small-glass-source'), 'hide the original white source so the lens sees the scene');
assert.match(lens.style.getPropertyValue('--lg-filter'), /^url\(#small-glass-/);
const defs = body.children[0].children[0], filter = defs.children[0];
assert.equal(filter.attrs.width, '44'); assert.equal(filter.attrs.height, '21');
engine.setParameters({ refractionStrength: 2 });
assert.equal(defs.children.length, 1, 'parameter updates reuse the active filter');
thumb.offsetWidth = 36; engine.update(thumb);
assert.equal(filter.attrs.width, '36');
thumb.screenLeft = 200; thumb.screenScale = 1.5; engine.update(thumb);
assert.equal(lens.style.left, '200px');
assert.equal(filter.attrs.width, '54', 'portal map follows final screen coordinates');
assert.equal(lens.style.width, '54px');
engine.apply(thumb, false);
assert.equal(defs.children.length, 0, 'release removes the SVG filter');
assert(!thumb.classList.contains('glass-active'));
assert(!thumb.classList.contains('small-glass-source'), 'release restores the opaque source');
assert(!body.children.includes(lens), 'release removes the independent lens');
assert.equal(thumb.style.getPropertyValue('--lg-filter'), undefined);

for (const [w,h] of [[34,16],[44,21],[28,14],[36,18]]) {
    const map = context.window.testBuildMap(w,h,h/2,true,1.2);
    const shift = (x,y,c) => (pixels[(y*w+x)*4+c]/255-.5)*map.scale;
    const left = shift(0, Math.floor(h/2), 0), right = shift(w-1, Math.floor(h/2), 0);
    assert(left > 1 && right < -1); assert(Math.abs(left+right) < .1);
    const top = shift(0, 0, 1), bottom = shift(0, h-1, 1);
    assert(top > .5 && bottom < -.5, 'cap bends upper/lower rail edges symmetrically');
    assert(Math.abs(top+bottom) < .1);
    const midX = Math.floor(w/2);
    const upper = shift(midX, 0, 1), lower = shift(midX, h-1, 1);
    assert(upper > .5 && lower < -.5, 'top/bottom edges must also refract outside the end caps');
    assert(Math.abs(upper+lower) < .1, 'top/bottom refraction is symmetric');
    assert(Math.abs(shift(midX, Math.floor(h/2), 1)) < .05, 'lens centre stays neutral');
    let lastScale = 0;
    for (const amount of [1.2, 2, 3, 4, 5, 6]) {
        const stronger = context.window.testBuildMap(w,h,h/2,true,amount);
        assert(stronger.scale > lastScale, 'the entire strength range must increase displacement');
        lastScale = stronger.scale;
    }
    const neutral = context.window.testBuildMap(w,h,h/2,true,0);
    assert.equal(neutral.scale, 0);
}
console.log('PASS: titlebar exclusion, portal lens, screen geometry, filter reuse/cleanup and symmetric cap refraction');
