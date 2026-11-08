const assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm'), path = require('node:path');
function el() {
    const classes = new Set();
    return { style:{setProperty(k,v){this[k]=v;},removeProperty(k){delete this[k];}},dataset:{},attrs:{},handlers:{},children:[],
        classList:{contains:k=>classes.has(k),toggle(k){if(classes.has(k)){classes.delete(k);return false;}classes.add(k);return true;}},
        setAttribute(k,v){this.attrs[k]=v;},removeAttribute(k){delete this.attrs[k];},
        append(child){this.children.push(child);},addEventListener(k,f){this.handlers[k]=f;},
        focus(){this.focused=true;},closest(){return null;},setPointerCapture(){},
        get offsetWidth(){return parseFloat(this.style.width)||250;},
        get offsetHeight(){return parseFloat(this.style.height)||600;},
        getBoundingClientRect(){const left=parseFloat(this.style.left)||700,top=parseFloat(this.style.top)||100;return{left,top,width:this.offsetWidth,height:this.offsetHeight,right:left+this.offsetWidth,bottom:top+this.offsetHeight};},
        animate(frames,options){const a={frames,options,cancel(){this.cancelled=true;}};this.animation=a;return a;}
    };
}
function panelTest(reduced) {
    const panel=el(),header=el(),body=el();let refreshes=0;
    panel.querySelector=s=>s==='.panel-header'?header:body;
    const ctx={document:{getElementById:()=>panel,createElement:()=>el(),documentElement:{}},
        window:{addEventListener(){},updateElementFilter(){refreshes++;}},
        matchMedia:()=>({matches:reduced}),innerWidth:1000,innerHeight:800,
        getComputedStyle:()=>({borderRadius:'24px',getPropertyValue:()=> '24px'})};
    vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../floating-panel.js'),'utf8'),ctx);
    const toggle=header.children[0],orb=panel.children[0];
    toggle.handlers.click();
    assert.equal(panel.dataset.collapsed,'true');assert.equal(panel.style.width,'56px');
    assert(body.inert&&header.inert);assert(orb.focused);
    if(!reduced){assert(panel.animation.frames.some(f=>f.transform==='scale(.82,1.18)'));panel.animation.onfinish();}
    assert(!panel.dataset.morphing);assert.equal(refreshes,1);
    orb.handlers.click();
    assert.equal(panel.dataset.collapsed,'false');assert.equal(panel.style.width,'250px');
    assert(!body.inert&&!header.inert);assert(toggle.focused);
    if(!reduced)panel.animation.onfinish();
    assert.equal(refreshes,2);
    panel.handlers.keydown({key:'Escape',preventDefault(){}});
    if(!reduced)panel.animation.onfinish();
    orb.handlers.pointerdown({isPrimary:true,button:0,target:orb,currentTarget:orb,pointerId:1,clientX:900,clientY:650});
    orb.handlers.pointermove({pointerId:1,clientX:800,clientY:600});orb.handlers.pointerup();
    orb.handlers.click();assert.equal(panel.dataset.collapsed,'true','drag must not expand the orb');
}
panelTest(false);panelTest(true);
const control=el(),disabled=el(),docEvents={},effects=[],thumbEffects=[],timers=new Map();let timerId=0;
const ctx={document:{querySelectorAll:s=>s==='.switch'?[control]:s==='.btn--disabled'?[disabled]:[],
    createElement:()=>el(),addEventListener:(n,f)=>docEvents[n]=f},
    window:{applyLiquidGlassEffect:(e,on)=>effects.push(on),addEventListener(){}},
    SmallLiquidGlass:{apply:(e,on)=>thumbEffects.push(on)},matchMedia:()=>({matches:false}),
    setTimeout:f=>{timers.set(++timerId,f);return timerId;},clearTimeout:id=>timers.delete(id)};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../liquid-glass-buttons.js'),'utf8'),ctx);
assert(disabled.disabled);
control.handlers.click();assert.equal(control.attrs['aria-checked'],'true');assert.equal(thumbEffects.at(-1),true);
control.children[0].handlers.transitionend({propertyName:'transform'});assert.equal(thumbEffects.at(-1),false);
control.handlers.click();assert.equal(control.attrs['aria-checked'],'false');
const button=el();button.tagName='BUTTON';button.closest=()=>button;
docEvents.pointerdown({button:0,pointerId:2,target:button});assert.equal(effects.at(-1),true);
docEvents.pointerup({pointerId:2});assert.equal(effects.at(-1),false);
docEvents.keydown({key:'Enter',target:button});assert.equal(effects.at(-1),true);
docEvents.keyup({key:'Enter',target:button});assert.equal(effects.at(-1),false);
console.log('PASS: panel/orb morph, settings remain mounted, drag/click separation, reduced motion, switch lens and button bindings');
