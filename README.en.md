# Liquid Glass UI Web

[简体中文](./README.md) | English

A liquid glass interaction experiment built with plain HTML, CSS, and JavaScript. Canvas displacement maps, SVG filters, and `backdrop-filter` simulate background refraction across segmented controls, buttons, switches, sliders, and a collapsible settings panel.

No frontend dependencies or build step are required. Shared scripts replace the original duplicated implementation, with separate refraction engines for large panels and small controls.

## Getting started

```sh
git clone https://github.com/Weiqin-Mo/Liquid-Glass-HTML.git
cd Liquid-Glass-HTML
```

Open either page directly in your browser:

- [Full component showcase](./Liquid-Glass%20index.html): UI controls and the settings panel.
- [Segmented control showcase](./分段指示器.html): capsule movement, spring snapping, and refraction.

Keep the complete `js/` directory, CSS files, and images alongside the pages. This is no longer a self-contained, single-file implementation. Root pages load scripts from `js/`; pages in `examples/` load them from `../js/`.

The background uses `bg.jpg` in the repository root, centered and scaled to cover the viewport. A gradient background remains available if the image is missing. The demo interface currently uses Chinese labels.

## Interactions

### Segmented control

- Switching uses an interruptible spring: repeated clicks redirect the capsule from its current position.
- Dragging preserves the grab offset, with subtle vertical movement and resistance at the ends. Release snaps to the nearest option.
- The moving glass lens gradually returns to an opaque white surface as the motion settles.
- Left/Right arrows, Home/End, and native button keyboard activation are supported.
- Pointer cancellation and window blur settle the interaction. The controller respects the system's reduced-motion preference.

### Sliders, buttons, and switches

- Parameter sliders have blue filled tracks and rounded, flat white capsule thumbs. The thumbs become transparent glass while active.
- Left/right caps and top/bottom edges produce symmetric refraction while the centre remains comparatively stable.
- Switches use real thumb elements that activate the independent small-control lens during a toggle.
- Buttons respond to pointer presses and keyboard activation; select controls activate their effect on focus.
- Title bars and their descendants stay on the large-panel engine rather than the small-control engine.

### Droplet floating panel

- Click **−** in the panel header to collapse it into a 56px droplet orb.
- Click the orb to expand it with stretching, shape changes, and a rebound.
- Drag the header to move the panel, or drag the orb while collapsed. Dragging the orb does not expand it.
- Settings remain mounted and retain their values. Escape also collapses the panel.
- Long content scrolls inside the panel. Reduced-motion mode switches states without the morph animation.

## Settings

| Setting | Default | Scope |
| --- | --- | --- |
| Small-control refraction | 3.00 | Independent refraction for sliders, segmented capsules, buttons, and switches; range 0–6 |
| Background dimming | 45% | Opacity of the black background overlay; transparent glass naturally samples the dimmed background |
| Corner radius | 24px | Large-panel corners |
| Blur | 16px | Large-panel backdrop blur |
| Refraction strength | 1.20 | Large-panel edge displacement |
| Liquid distortion | 0.60 | Swirl/flow perturbation in the large-panel engine |
| Brightness | 1.10 | Large-panel glass filter brightness |
| Highlight edge | 1px | Large-panel inset edge width |
| Thumb scale | 1.30× | Active parameter-slider enlargement; segmented capsules clamp this to 1–1.35× for stability |

Large-panel settings and small-control refraction are independent. Background dimming does not directly change component opacity or filter parameters, but it does change the background visible through transparent glass.

## Two rendering engines

### Large panels

`js/liquid-glass-engine.js` retains the rounded-rectangle signed distance field (SDF) approach:

1. Compute displacement on a Canvas and add liquid distortion.
2. Encode X/Y displacement in the image's R/G channels.
3. Feed the image into SVG `feImage` and `feDisplacementMap`, referenced by the element's `backdrop-filter`.
4. Reuse filters by dimensions and parameters. Above 96 cache entries, unused filters are pruned; referenced filters are retained.

This engine serves title bars, cards, and the floating settings panel. Page-level size observers and viewport events keep its maps updated.

### Small controls

`js/small-liquid-glass-engine.js` manages its own parameters, displacement maps, and active filters. It calculates refraction for the dimensions of each control without inheriting the large-panel settings.

Active parameter-slider thumbs, segmented capsules, and switch thumbs create a transparent lens under `body`. The lens follows the source element's screen position and size, sampling the already-painted background, panels, tracks, and text below it. This avoids the backdrop sampling boundary imposed by a filtered parent. The source keeps its layout; ending the interaction removes the lens and filter and restores the white surface.

The lens processes the composited scene. It cannot see hidden content behind an opaque panel. Other small controls, such as buttons, use the independent engine directly on their own surfaces.

## Standalone examples

| Example | Purpose |
| --- | --- |
| [Glass card](./examples/liquid-glass-card.html) | Minimal large-panel engine integration |
| [Segmented control](./examples/segmented-control.html) | Shared spring controller and small-control lens |
| [Parameter controls](./examples/glass-parameters.html) | Native range inputs controlling large-panel refraction and distortion |

## Repository layout

```text
Liquid-Glass index.html          Full component showcase
分段指示器.html                   Segmented control showcase
bg.jpg                          Background image
js/                             Shared runtime scripts
  liquid-glass-engine.js         Large-panel engine
  small-liquid-glass-engine.js   Small-control engine and scene lens
  liquid-glass-controls.js       Parameter sliders and callbacks
  liquid-glass-buttons.js        Buttons, selects, and switches
  segmented-control.js          Segmented spring controller
  floating-panel.js             Dragging and droplet morph
  background-dimmer.js           Background dimming
liquid-glass-slider.css          Slider, small-control, and lens styles
floating-panel.css              Panel morph styles
examples/                       Standalone examples
tests/                          Node.js regression tests
docs/                           Technical porting documentation
```

## Porting and AI handoff

Read the [porting guide](./docs/PORTING.md) and [AI contribution instructions](./AGENTS.md) before adapting the code to another framework. These two documents are currently in Chinese and cover the actual APIs, load order, DOM/CSS contracts, coordinate systems, and lifecycle work still needed for a reusable integration.

The project is a browser experiment, not a complete framework SDK. In particular, controllers do not yet provide a unified `destroy()` API; mounting, unmounting, event cleanup, observers, animation frames, timers, and SVG resources must be addressed when porting.

## Local verification

Node.js is not needed to run the frontend. To run the regression tests, use Node.js 22 or later:

```sh
node tests/small-engine.test.cjs
node tests/segmented-control.test.cjs
node tests/panel-controls.test.cjs
```

The tests cover title-bar routing, lens position and size, filter cleanup, symmetric refraction, strength changes, interrupted spring motion, drag cancellation, keyboard input, panel morphing, and switch/button bindings.

These tests use a simulated DOM to check logic and displacement data. They do not replace browser screenshots or visual acceptance testing. Cross-browser visual verification of the refactored version is not yet complete; the visible result depends on support for SVG URL filters combined with `backdrop-filter`.

## Credits and license

The original shader concept comes from a [sunai.net discussion](https://www.sunai.net/t/topic/1381) by **Wood Chen**. The original credit is preserved in [Thanks.txt](./Thanks.txt). The small-control engine uses an independent implementation along the same displacement-map rendering pipeline.

See the [MIT License](./LICENSE).
