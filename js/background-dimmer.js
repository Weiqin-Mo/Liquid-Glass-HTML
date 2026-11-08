/* Background-only dimming. Glass naturally samples the dimmed image. */
(() => {
    function set(value) {
        const percent = Math.min(100, Math.max(0, Number(value) || 0));
        document.querySelector('.bg')?.style.setProperty('--background-dim', String(percent / 100));
    }
    window.BackgroundDimmer = { set };
    set(45);
})();
