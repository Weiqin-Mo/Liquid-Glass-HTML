/* One draggable surface morphs between panel and droplet; settings stay mounted. */
(() => {
    const panel = document.getElementById('floatingPanel');
    if (!panel) return;
    const header = panel.querySelector('.panel-header'), body = panel.querySelector('.panel-body');
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const toggle = document.createElement('button');
    toggle.type = 'button'; toggle.className = 'panel-toggle'; toggle.textContent = '−';
    toggle.setAttribute('aria-label', '收起控制面板'); toggle.setAttribute('aria-expanded', 'true');
    header.append(toggle);
    const orb = document.createElement('button');
    orb.type = 'button'; orb.className = 'panel-orb'; orb.setAttribute('aria-label', '展开控制面板');
    orb.setAttribute('aria-expanded', 'false');
    orb.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3C9 7 5 11 5 15a7 7 0 0 0 14 0c0-4-4-8-7-12Z"/><path d="M8 15a4 4 0 0 0 4 4"/></svg>';
    panel.append(orb); panel.setAttribute('role', 'region'); panel.setAttribute('aria-label', '效果调节');
    let collapsed = false, animation = null, drag = null, suppressClick = false;
    let openSize = { width:panel.offsetWidth, height:panel.offsetHeight };
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(Math.max(lo,hi),v));
    function position(rect) {
        panel.style.left = rect.left + 'px'; panel.style.top = rect.top + 'px';
        panel.style.right = 'auto'; panel.style.bottom = 'auto';
    }
    function finish() {
        delete panel.dataset.morphing;
        panel.style.removeProperty('--lg-filter');
        window.updateElementFilter(panel);
    }
    function morph(next) {
        const from = panel.getBoundingClientRect();
        const fromRadius = getComputedStyle(panel).borderRadius || '24px';
        animation?.cancel();
        if (!collapsed && !animation) openSize = { width:from.width, height:from.height };
        collapsed = next;
        const width = next ? 56 : Math.min(openSize.width, innerWidth - 24);
        const height = next ? 56 : Math.min(openSize.height, innerHeight - 40);
        const to = { left:clamp(from.right-width,12,innerWidth-width-12), top:clamp(from.bottom-height,12,innerHeight-height-12), width,height };
        panel.dataset.collapsed = String(next);
        header.inert = body.inert = next;
        toggle.setAttribute('aria-expanded', String(!next)); orb.setAttribute('aria-expanded', String(!next));
        panel.style.width = width + 'px'; panel.style.height = height + 'px';
        panel.style.borderRadius = next ? '50%' : 'var(--radius,24px)'; position(to);
        (next ? orb : toggle).focus({preventScroll:true});
        if (reduced.matches) { animation = null; finish(); return; }
        panel.dataset.morphing = 'true'; panel.style.setProperty('--lg-filter','none');
        const shape = rect => ({left:rect.left+'px',top:rect.top+'px',width:rect.width+'px',height:rect.height+'px'});
        const radius = next ? '50%' : getComputedStyle(document.documentElement).getPropertyValue('--radius') || '24px';
        animation = panel.animate([
            {...shape(from),borderRadius:fromRadius,transform:'scale(1)',offset:0},
            {...shape(to),borderRadius:next?'48% 52% 45% 55% / 60% 58% 42% 40%':radius,transform:next?'scale(.82,1.18)':'scale(1.025,.97)',offset:.72},
            {...shape(to),borderRadius:radius,transform:next?'scale(1.07,.94)':'scale(.99,1.015)',offset:.88},
            {...shape(to),borderRadius:radius,transform:'scale(1)',offset:1}
        ],{duration:next?480:560,easing:'cubic-bezier(.22,.8,.25,1)'});
        const current = animation;
        current.onfinish = () => { if (animation !== current) return; animation = null; finish(); };
    }
    toggle.addEventListener('click', () => morph(true));
    orb.addEventListener('click', () => { if (!suppressClick) morph(false); suppressClick = false; });
    function start(e) {
        if (!e.isPrimary || e.button !== 0 || e.target.closest('.panel-toggle') || animation) return;
        const rect = panel.getBoundingClientRect();
        drag = { id:e.pointerId,x:e.clientX,y:e.clientY,left:rect.left,top:rect.top,moved:false };
        e.currentTarget.setPointerCapture(e.pointerId);
    }
    for (const handle of [header,orb]) {
        handle.addEventListener('pointerdown', start);
        handle.addEventListener('pointermove', e => {
            if (!drag || drag.id !== e.pointerId) return;
            const dx=e.clientX-drag.x,dy=e.clientY-drag.y;
            if (Math.hypot(dx,dy)>4) drag.moved=true;
            if (!drag.moved) return;
            position({left:clamp(drag.left+dx,12,innerWidth-panel.offsetWidth-12),top:clamp(drag.top+dy,12,innerHeight-panel.offsetHeight-12)});
        });
        const end = () => { if (!drag) return; suppressClick=collapsed&&drag.moved; drag=null; window.updateElementFilter(panel); };
        handle.addEventListener('pointerup',end); handle.addEventListener('pointercancel',end);
        handle.addEventListener('lostpointercapture',end);
    }
    panel.addEventListener('keydown',e=>{if(e.key==='Escape'&&!collapsed){e.preventDefault();morph(true);}});
    window.addEventListener('resize',()=>{const r=panel.getBoundingClientRect();position({left:clamp(r.left,12,innerWidth-r.width-12),top:clamp(r.top,12,innerHeight-r.height-12)});});
})();
