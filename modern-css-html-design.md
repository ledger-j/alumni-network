# Modern CSS & HTML: Adaptive Website Design Reference
> Research compiled May 2026 | Jean Henkel, Maastricht

---

## Table of Contents

1. [Gemini Code Assist for CSS/HTML](#1-gemini-code-assist-for-csshtml)
2. [CSS Color Level 4 — New Color System](#2-css-color-level-4--new-color-system)
3. [Modern CSS Features 2025–2026](#3-modern-css-features-20252026)
4. [Responsible CSS & HTML Best Practices](#4-responsible-css--html-best-practices)
5. [Modern HTML Elements Reference](#5-modern-html-elements-reference)
6. [Free Icon Libraries](#6-free-icon-libraries)
7. [LinkedIn Brand & Icon Reference](#7-linkedin-brand--icon-reference)
8. [Maastricht University Corporate Design](#8-maastricht-university-corporate-design)
9. [Integrated Code Examples](#9-integrated-code-examples)

---

## 1. Gemini Code Assist for CSS/HTML

**Google Gemini Code Assist** (powered by Gemini 2.5 Pro & Flash) is now generally available for individuals and integrates directly into VS Code and JetBrains IDEs.

### Key Capabilities for CSS/Web Work

| Feature | Description | Status |
|---|---|---|
| **Agent Mode** | Multi-file edits with step-by-step plan preview, full-project context | GA – VS Code & IntelliJ |
| **Inline Diff View** | See changes side-by-side before accepting | GA |
| **Gemini CLI** | Terminal-first coding, context-aware of open files | Preview (v0.1.20+) |
| **GitHub Actions** | Autonomous PR review, issue triage, on-demand collaboration | Beta |
| **MCP Ecosystem Tools** | Integration with ecosystem tools for extended workflows | GA |

### Getting Started

```bash
# Install VS Code Extension
# Extension Marketplace → "Gemini Code Assist"

# OR install Gemini CLI
npm install -g @google/gemini-cli
gemini  # starts interactive session
```

### Prompting Gemini for CSS

Gemini 2.5 excels at "creating visually compelling web apps" and CSS generation. Effective prompt patterns:

```
// Prompt pattern for modern CSS generation:
"Generate a responsive card component using:
 - CSS Container Queries (not media queries)
 - OKLCH colors for vibrant, accessible palette
 - Native CSS nesting
 - @layer for cascade management
 - @property for animated custom properties"
```

> **Tip:** In Agent Mode, describe the *goal* (e.g., "refactor my color system to use OKLCH design tokens") and Gemini proposes a step-by-step plan before touching any files.

---

## 2. CSS Color Level 4 — New Color System

CSS Color Module Level 4 (W3C Candidate Recommendation, April 2025) fundamentally expands the color capabilities of the web, introducing wide-gamut color support with 50% more colors available on modern displays.

### Color Spaces Available

| Function | Color Space | Use Case | Gamut |
|---|---|---|---|
| `oklch()` | Oklab perceptual | Primary design colors, gradients | Wide (P3+) |
| `oklab()` | Oklab | Color mixing, smooth gradients | Wide (P3+) |
| `lch()` | CIELCh | Perceptually uniform colors | Wide |
| `lab()` | CIELAB | Scientific color accuracy | Wide |
| `hwb()` | HWB | Human-readable hue/white/black | sRGB |
| `color()` | Specified space | P3, Rec2020, sRGB-linear | Varies |
| `rgb()` / `hsl()` | sRGB | Legacy/fallback | sRGB |

### OKLCH — The Recommended Modern Color Function

OKLCH is the **recommended choice** for modern web design: perceptually uniform, wide-gamut, and fully supported in all major browsers as of 2025.

```css
/* OKLCH Syntax: oklch(Lightness Chroma Hue / Alpha) */

:root {
  /* Design tokens using OKLCH */
  --color-primary:      oklch(0.45 0.22 265);   /* Deep blue */
  --color-accent:       oklch(0.70 0.18 145);   /* Vibrant green */
  --color-warning:      oklch(0.78 0.17 68);    /* Warm amber */
  --color-error:        oklch(0.55 0.22 25);    /* Accessible red */
  --color-surface:      oklch(0.98 0.005 265);  /* Near-white with hue */
  --color-text:         oklch(0.20 0.02 265);   /* Near-black */
}

/* Lightness:  0 = black  →  1 = white */
/* Chroma:     0 = gray   →  0.4+ = vivid  */
/* Hue:        0–360 degrees on color wheel */
```

### color-mix() — Dynamic Color Blending

```css
/* CSS Color Level 5 — widely supported in 2025 */
.button-hover {
  background: color-mix(in oklch, var(--color-primary) 80%, white);
}

.transparent-overlay {
  background: color-mix(in oklch, var(--color-accent) 40%, transparent);
}

/* Darken by mixing with black */
.dark-variant {
  color: color-mix(in oklch, var(--color-primary), black 20%);
}
```

### Relative Color Syntax

```css
/* Derive new colors from existing ones */
:root {
  --brand: oklch(0.45 0.22 265);
}

.light-variant {
  /* Take brand color, increase lightness to 0.85 */
  background: oklch(from var(--brand) 0.85 c h);
}

.desaturated {
  /* Same hue/lightness, reduce chroma */
  color: oklch(from var(--brand) l 0.05 h);
}
```

### Fallback Strategy

```css
/* Always provide sRGB fallback */
.element {
  color: #0a66c2;                         /* Fallback: sRGB */
  color: oklch(0.45 0.18 264);            /* Modern: wide-gamut */
}

/* Or use @supports */
@supports (color: oklch(0 0 0)) {
  :root {
    --color-primary: oklch(0.45 0.22 265);
  }
}
```

### Browser Support (May 2026)

| Browser | OKLCH | color-mix() | Relative Color |
|---|---|---|---|
| Chrome 111+ | ✅ Full | ✅ Full | ✅ Full |
| Firefox 113+ | ✅ Full | ✅ Full | ✅ Full |
| Safari 16.4+ | ✅ Full | ✅ Full | ✅ Full |
| Edge 111+ | ✅ Full | ✅ Full | ✅ Full |

---

## 3. Modern CSS Features 2025–2026

### 3.1 Native CSS Nesting

Native CSS nesting is now **fully supported** in all modern browsers (Chrome 120+, Firefox 117+, Safari 17.2+, Edge 120+). No preprocessor needed.

```css
/* Native CSS nesting — no Sass required */
.card {
  padding: 1.5rem;
  border-radius: 0.75rem;
  background: var(--color-surface);

  /* Nest child selectors */
  & .card-title {
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--color-primary);
  }

  /* Nest pseudo-classes */
  &:hover {
    box-shadow: 0 4px 20px oklch(0 0 0 / 0.12);
    transform: translateY(-2px);
  }

  /* Nest media queries */
  @media (width > 768px) {
    display: grid;
    grid-template-columns: 1fr 2fr;
  }
}
```

### 3.2 Container Queries

Style components based on their **container size**, not the viewport. This is the 2026 standard for component-based responsive design.

```css
/* Define a containment context */
.card-wrapper {
  container-type: inline-size;
  container-name: card;
}

/* Style based on container width */
@container card (width > 600px) {
  .card {
    display: grid;
    grid-template-columns: 200px 1fr;
  }

  .card-image {
    border-radius: 0.5rem 0 0 0.5rem;
  }
}

/* Container query units */
.card-title {
  font-size: clamp(1rem, 5cqi, 2rem); /* cqi = container inline percent */
}
```

### 3.3 Cascade Layers — `@layer`

`@layer` gives explicit, predictable control over CSS specificity — essential for large codebases and design systems.

```css
/* Declare layer order (first = lowest priority) */
@layer reset, base, tokens, components, utilities;

@layer reset {
  *, *::before, *::after { box-sizing: border-box; }
  * { margin: 0; }
}

@layer tokens {
  :root {
    --spacing-sm: 0.5rem;
    --spacing-md: 1rem;
    --spacing-lg: 2rem;
    --radius-md: 0.5rem;
    --radius-lg: 1rem;
  }
}

@layer components {
  .button {
    padding: var(--spacing-sm) var(--spacing-md);
    border-radius: var(--radius-md);
    background: var(--color-primary);
    color: white;
    border: none;
    cursor: pointer;

    &:hover {
      background: color-mix(in oklch, var(--color-primary), black 15%);
    }
  }
}

@layer utilities {
  .text-center { text-align: center; }
  .mt-lg { margin-top: var(--spacing-lg); }
}
```

### 3.4 CSS Custom Functions (2025)

Define reusable logic directly in CSS — previously only possible with Sass.

```css
/* Define a custom function */
@function --fluid-size(--min, --max, --bp-min: 320px, --bp-max: 1200px) {
  result: clamp(
    var(--min),
    calc(var(--min) + (var(--max) - var(--min)) *
      ((100vw - var(--bp-min)) / (var(--bp-max) - var(--bp-min)))),
    var(--max)
  );
}

/* Use it */
h1 { font-size: --fluid-size(1.5rem, 3rem); }
h2 { font-size: --fluid-size(1.25rem, 2.25rem); }
```

### 3.5 CSS `if()` Conditional Function

```css
/* Conditional styles without JavaScript */
.button {
  color: if(
    style(--variant: primary): white;
    else: var(--color-primary)
  );
  background: if(
    style(--variant: primary): var(--color-primary);
    else: transparent
  );
}
```

### 3.6 CSS `@property` — Typed Custom Properties

```css
/* Typed custom property for animatable values */
@property --gradient-angle {
  syntax: "<angle>";
  inherits: false;
  initial-value: 0deg;
}

@property --card-opacity {
  syntax: "<number>";
  inherits: true;
  initial-value: 1;
}

/* Now animate the gradient angle */
.hero-gradient {
  background: linear-gradient(var(--gradient-angle),
    oklch(0.45 0.22 265),
    oklch(0.70 0.18 145)
  );
  animation: rotate-gradient 6s linear infinite;
}

@keyframes rotate-gradient {
  to { --gradient-angle: 360deg; }
}
```

### 3.7 Scroll-Driven Animations

No JavaScript needed for scroll-linked animations — now supported in all major browsers (2025 Baseline).

```css
/* Scroll-driven progress bar */
.progress-bar {
  position: fixed;
  top: 0;
  left: 0;
  height: 3px;
  background: var(--color-primary);
  transform-origin: left;
  animation: grow-bar linear;
  animation-timeline: scroll(root block);
}

@keyframes grow-bar {
  from { transform: scaleX(0); }
  to   { transform: scaleX(1); }
}

/* Fade-in as element enters viewport */
.reveal {
  animation: fade-in linear both;
  animation-timeline: view();
  animation-range: entry 0% entry 40%;
}

@keyframes fade-in {
  from { opacity: 0; transform: translateY(2rem); }
  to   { opacity: 1; transform: translateY(0); }
}
```

### 3.8 View Transitions — Cross-Document

Native page transitions with zero JavaScript for same-origin MPAs:

```css
/* Add to both pages to opt in */
@view-transition {
  navigation: auto;
}

/* Customize the transition */
::view-transition-old(root) {
  animation: slide-out 0.3s ease-in;
}

::view-transition-new(root) {
  animation: slide-in 0.3s ease-out;
}

@keyframes slide-out {
  to { transform: translateX(-100%); opacity: 0; }
}
@keyframes slide-in {
  from { transform: translateX(100%); opacity: 0; }
}

/* Name individual elements for matched transitions */
.hero-image {
  view-transition-name: hero-image;
}
```

### 3.9 CSS Anchor Positioning

Position elements relative to other elements, natively — perfect for tooltips and popovers.

```css
.anchor-button {
  anchor-name: --my-button;
}

.tooltip {
  position: absolute;
  position-anchor: --my-button;
  top: anchor(bottom);
  left: anchor(center);
  translate: -50% 0.5rem;

  /* Fallback positioning */
  position-try-fallbacks: --flip-above;
}

@position-try --flip-above {
  top: auto;
  bottom: anchor(top);
  translate: -50% -0.5rem;
}
```

### 3.10 Modern Selectors — `:has()`, `:is()`, `:where()`

```css
/* :has() — The "parent selector" */
/* Style a card differently when it contains an image */
.card:has(img) {
  padding: 0;
}

/* Style form label when input is focused */
.form-group:has(input:focus) label {
  color: var(--color-primary);
  font-weight: 600;
}

/* :is() — Group selectors, preserves specificity */
:is(h1, h2, h3, h4) {
  line-height: 1.2;
  font-weight: 700;
}

/* :where() — Group selectors, zero specificity (easy to override) */
:where(header, footer, nav) a {
  text-decoration: none;
  color: inherit;
}

/* Combine for powerful rules */
.container:has(> .sidebar):where(:not(.fullwidth)) main {
  max-width: 800px;
}
```

### 3.11 `corner-shape` — Beyond Border-Radius

```css
.squircle {
  border-radius: 2rem;
  corner-shape: superellipse(4); /* squircle shape */
}

.scalloped {
  border-radius: 1rem;
  corner-shape: notch;
}
```

---

## 4. Responsible CSS & HTML Best Practices

### 4.1 CSS Architecture

```
styles/
├── tokens.css          @layer tokens     — design variables (colors, spacing, type)
├── reset.css           @layer reset      — normalize defaults
├── base.css            @layer base       — body, typography, base elements
├── components/         @layer components — reusable UI components
│   ├── button.css
│   ├── card.css
│   └── nav.css
├── utilities.css       @layer utilities  — single-purpose helper classes
└── main.css                              — imports + @layer order declaration
```

```css
/* main.css */
@layer reset, base, tokens, components, utilities;

@import "reset.css" layer(reset);
@import "tokens.css" layer(tokens);
@import "base.css" layer(base);
@import url("components/button.css") layer(components);
@import url("components/card.css") layer(components);
@import "utilities.css" layer(utilities);
```

### 4.2 Design Token System

```css
/* tokens.css — Single source of truth */
:root {
  /* === COLOR TOKENS === */
  /* Primitives */
  --color-blue-50:   oklch(0.97 0.03 265);
  --color-blue-500:  oklch(0.50 0.22 265);
  --color-blue-900:  oklch(0.20 0.10 265);

  /* Semantic aliases */
  --color-brand:           var(--color-blue-500);
  --color-brand-light:     oklch(from var(--color-brand) 0.90 c h);
  --color-brand-dark:      oklch(from var(--color-brand) 0.30 c h);
  --color-on-brand:        white;

  --color-surface:         oklch(0.99 0.005 265);
  --color-surface-raised:  oklch(0.96 0.008 265);
  --color-border:          oklch(0.88 0.015 265);
  --color-text-primary:    oklch(0.15 0.02 265);
  --color-text-secondary:  oklch(0.45 0.02 265);
  --color-text-muted:      oklch(0.65 0.01 265);

  /* === TYPOGRAPHY TOKENS === */
  --font-sans:   system-ui, -apple-system, "Segoe UI", sans-serif;
  --font-mono:   "Fira Code", "Cascadia Code", ui-monospace, monospace;

  --text-xs:   0.75rem;
  --text-sm:   0.875rem;
  --text-base: 1rem;
  --text-lg:   1.125rem;
  --text-xl:   1.25rem;
  --text-2xl:  1.5rem;
  --text-3xl:  1.875rem;
  --text-4xl:  2.25rem;

  --leading-tight:  1.25;
  --leading-normal: 1.5;
  --leading-loose:  1.75;

  /* === SPACING TOKENS === */
  --space-1:  0.25rem;
  --space-2:  0.5rem;
  --space-3:  0.75rem;
  --space-4:  1rem;
  --space-6:  1.5rem;
  --space-8:  2rem;
  --space-12: 3rem;
  --space-16: 4rem;

  /* === SHAPE TOKENS === */
  --radius-sm:   0.25rem;
  --radius-md:   0.5rem;
  --radius-lg:   0.75rem;
  --radius-xl:   1rem;
  --radius-full: 9999px;

  /* === SHADOW TOKENS === */
  --shadow-sm:  0 1px 3px oklch(0 0 0 / 0.08);
  --shadow-md:  0 4px 12px oklch(0 0 0 / 0.10);
  --shadow-lg:  0 8px 32px oklch(0 0 0 / 0.12);
}

/* Dark mode via color-scheme */
@media (prefers-color-scheme: dark) {
  :root {
    --color-surface:         oklch(0.12 0.02 265);
    --color-surface-raised:  oklch(0.17 0.02 265);
    --color-border:          oklch(0.28 0.02 265);
    --color-text-primary:    oklch(0.92 0.01 265);
    --color-text-secondary:  oklch(0.70 0.01 265);
    --color-text-muted:      oklch(0.50 0.01 265);
  }
}
```

### 4.3 Responsive Design — 2026 Standards

```css
/* ✅ MODERN: Container queries over media queries for components */
.component-wrapper {
  container-type: inline-size;
}

@container (width > 480px) {
  .component { /* styles */ }
}

/* ✅ MODERN: clamp() for fluid typography (no breakpoints needed) */
body {
  font-size: clamp(1rem, 0.9rem + 0.5vw, 1.125rem);
}

h1 {
  font-size: clamp(1.75rem, 1.25rem + 2.5vw, 3.5rem);
}

/* ✅ MODERN: Intrinsically responsive grid */
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(280px, 100%), 1fr));
  gap: var(--space-6);
}

/* ✅ MODERN: Logical properties for i18n */
.card {
  margin-inline: auto;       /* left + right */
  padding-block: var(--space-6); /* top + bottom */
  border-inline-start: 3px solid var(--color-brand);
}
```

### 4.4 Accessibility — Responsible CSS

```css
/* 1. Respect user motion preferences */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}

/* 2. Visible focus indicators (never remove outline without replacement) */
:focus-visible {
  outline: 2px solid var(--color-brand);
  outline-offset: 3px;
  border-radius: var(--radius-sm);
}

/* 3. High contrast mode support */
@media (forced-colors: active) {
  .button {
    border: 2px solid ButtonText;
  }
}

/* 4. Color contrast — use OKLCH for reliable lightness */
/* OKLCH lightness 0.0–0.4 on white: WCAG AA+ contrast */
/* OKLCH lightness 0.7–1.0 on black: WCAG AA+ contrast */

/* 5. Respect user color scheme preference */
:root {
  color-scheme: light dark;
}
```

---

## 5. Modern HTML Elements Reference

### 5.1 Semantic Structure Elements

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light dark">
  <title>Page Title</title>
  <link rel="stylesheet" href="styles/main.css">
</head>
<body>

  <header role="banner">
    <nav aria-label="Primary navigation">
      <ul role="list">
        <li><a href="/">Home</a></li>
        <li><a href="/about" aria-current="page">About</a></li>
      </ul>
    </nav>
  </header>

  <main id="main-content">
    <article>
      <header>
        <h1>Article Title</h1>
        <time datetime="2026-05-22">May 22, 2026</time>
      </header>
      <section aria-labelledby="section-heading">
        <h2 id="section-heading">Section Title</h2>
        <p>Content…</p>
        <figure>
          <img src="image.webp" alt="Descriptive alt text" loading="lazy" decoding="async">
          <figcaption>Image caption</figcaption>
        </figure>
      </section>
    </article>

    <aside aria-label="Related content">
      <!-- Sidebar content -->
    </aside>
  </main>

  <footer role="contentinfo">
    <address>Contact information</address>
  </footer>

</body>
</html>
```

### 5.2 Interactive Elements — No JavaScript Required

#### `<dialog>` — Native Modal

```html
<!-- Trigger -->
<button popovertarget="my-modal">Open Modal</button>

<!-- Modal dialog -->
<dialog id="my-modal" aria-labelledby="modal-title">
  <article>
    <header>
      <h2 id="modal-title">Modal Title</h2>
      <button autofocus formmethod="dialog" value="cancel"
              aria-label="Close modal">✕</button>
    </header>
    <p>Modal content here.</p>
    <footer>
      <button value="confirm">Confirm</button>
      <button formmethod="dialog" value="cancel">Cancel</button>
    </footer>
  </article>
</dialog>

<script>
  const modal = document.getElementById('my-modal');
  document.querySelector('[popovertarget]').addEventListener('click', () => {
    modal.showModal();
  });
</script>
```

#### Popover API — No JavaScript Needed

```html
<!-- Zero-JavaScript popover -->
<button popovertarget="my-popover" popovertargetaction="toggle">
  Show Info
</button>

<div id="my-popover" popover>
  <p>This popover requires zero JavaScript!</p>
</div>
```

#### `<details>` & `<summary>` — Native Accordion

```html
<!-- Pure HTML accordion — no JS needed -->
<details>
  <summary>What is OKLCH?</summary>
  <p>OKLCH is a perceptually uniform color space that provides
     vibrant, wide-gamut colors with consistent lightness.</p>
</details>

<!-- Group as exclusive accordion with name attribute -->
<details name="faq">
  <summary>Question 1</summary>
  <p>Answer 1</p>
</details>
<details name="faq">
  <summary>Question 2</summary>
  <p>Answer 2</p>
</details>
```

### 5.3 Forms — Modern Input Types

```html
<form>
  <!-- Modern input types -->
  <label for="email">Email</label>
  <input type="email" id="email" name="email"
         autocomplete="email" required>

  <label for="search">Search</label>
  <input type="search" id="search" list="suggestions">
  <datalist id="suggestions">
    <option value="CSS Color Level 4">
    <option value="Container Queries">
    <option value="OKLCH">
  </datalist>

  <!-- Range with output -->
  <label for="opacity">Opacity: <output for="opacity">50</output>%</label>
  <input type="range" id="opacity" name="opacity"
         min="0" max="100" value="50"
         oninput="this.previousElementSibling.querySelector('output').value = this.value">

  <!-- Color picker -->
  <label for="brand-color">Brand Color</label>
  <input type="color" id="brand-color" value="#0a66c2">
</form>
```

### 5.4 Media — Performance Optimized

```html
<!-- Responsive image with WebP + AVIF -->
<picture>
  <source srcset="hero.avif 1x, hero@2x.avif 2x" type="image/avif">
  <source srcset="hero.webp 1x, hero@2x.webp 2x" type="image/webp">
  <img src="hero.jpg" alt="Hero image description"
       width="1200" height="675"
       loading="lazy"
       decoding="async"
       fetchpriority="high">
</picture>

<!-- Native lazy-loaded video -->
<video controls preload="none" poster="thumbnail.webp"
       width="1280" height="720">
  <source src="video.av1.mp4" type="video/mp4; codecs=av01">
  <source src="video.mp4" type="video/mp4">
  <track kind="captions" src="captions.vtt" srclang="en" label="English">
</video>
```

---

## 6. Free Icon Libraries

### Top Libraries Compared

| Library | Icons | License | Formats | Frameworks | Best For |
|---|---|---|---|---|---|
| **Lucide** | 1,500+ | ISC (MIT-like) | SVG, React, Vue, Angular | React, Vue, Svelte | Clean UI, shadcn/ui |
| **Tabler Icons** | 6,146+ | MIT | SVG, PNG, React, Vue, Figma | All major | Dashboards, admin |
| **Phosphor** | 1,248+ | MIT | SVG, React, Vue, Flutter | All major | Flexible, 6 weights |
| **Heroicons** | 300+ | MIT | SVG, React, Vue, Figma | Tailwind CSS | Tailwind projects |
| **Bootstrap Icons** | 2,000+ | MIT | SVG, Web Font, React | Bootstrap | Bootstrap projects |
| **Iconify** | 200,000+ | Varies (mostly MIT) | SVG, Web Component, API | Framework-agnostic | Maximum choice |
| **Material Symbols** | 3,000+ | Apache 2.0 | SVG, Font, Figma | All major | Google/Material Design |

### Integration Examples

#### Lucide (React / Vanilla)

```bash
npm install lucide-react
```

```jsx
// React
import { Linkedin, GraduationCap, Mail, ChevronRight } from 'lucide-react';

<Linkedin size={24} color="currentColor" />
```

```html
<!-- Vanilla HTML via CDN -->
<script src="https://unpkg.com/lucide@latest/dist/umd/lucide.js"></script>
<i data-lucide="linkedin" class="icon"></i>
<script>lucide.createIcons();</script>
```

#### Tabler Icons

```bash
npm install @tabler/icons
```

```html
<!-- CDN -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/dist/tabler-icons.min.css">
<i class="ti ti-brand-linkedin"></i>
```

#### Iconify (Universal)

```html
<!-- One script, access to 200,000+ icons -->
<script src="https://code.iconify.design/3/3.1.1/iconify.min.js"></script>

<!-- LinkedIn icon from multiple icon sets -->
<span class="iconify" data-icon="mdi:linkedin"></span>
<span class="iconify" data-icon="ri:linkedin-fill"></span>
<span class="iconify" data-icon="ph:linkedin-logo"></span>
```

#### Phosphor Icons (6 Weights)

```html
<script src="https://unpkg.com/@phosphor-icons/web"></script>

<!-- 6 weights: thin, light, regular, bold, fill, duotone -->
<i class="ph ph-linkedin-logo"></i>          <!-- regular -->
<i class="ph-fill ph-linkedin-logo"></i>     <!-- fill -->
<i class="ph-duotone ph-linkedin-logo"></i>  <!-- duotone -->
```

---

## 7. LinkedIn Brand & Icon Reference

### Official Brand Colors

| Color | Role | HEX | RGB | OKLCH Equivalent |
|---|---|---|---|---|
| **Science Blue** | Primary Brand | `#0a66c2` | 10, 102, 194 | `oklch(0.46 0.18 264)` |
| **Congress Blue** | Dark variant | `#004182` | 0, 65, 130 | `oklch(0.30 0.15 264)` |
| **White** | Background | `#FFFFFF` | 255, 255, 255 | `oklch(1 0 0)` |
| **Black** | Text | `#000000` | 0, 0, 0 | `oklch(0 0 0)` |

> **Source:** brand.linkedin.com (official brand guidelines)

### LinkedIn [in] Logo — SVG Code

```html
<!-- Official LinkedIn [in] square logo — Bootstrap Icons (MIT) -->
<svg xmlns="http://www.w3.org/2000/svg"
     width="24" height="24"
     fill="currentColor"
     viewBox="0 0 16 16"
     aria-label="LinkedIn"
     role="img">
  <path d="M0 1.146C0 .513.526 0 1.175 0h13.65C15.474 0 16 .513 16 1.146v13.708c0 .633-.526 1.146-1.175 1.146H1.175C.526 16 0 15.487 0 14.854zm4.943 12.248V6.169H2.542v7.225zm-1.2-8.212c.837 0 1.358-.554 1.358-1.248-.015-.709-.52-1.248-1.342-1.248S2.4 3.226 2.4 3.934c0 .694.521 1.248 1.327 1.248zm4.908 8.212V9.359c0-.216.016-.432.08-.586.173-.431.568-.878 1.232-.878.869 0 1.216.662 1.216 1.634v3.865h2.401V9.25c0-2.22-1.184-3.252-2.764-3.252-1.274 0-1.845.7-2.165 1.193v.025h-.016l.016-.025V6.169h-2.4c.03.678 0 7.225 0 7.225z"/>
</svg>
```

### LinkedIn CSS Styling

```css
/* LinkedIn brand color as CSS token */
:root {
  --color-linkedin:      oklch(0.46 0.18 264);   /* #0a66c2 */
  --color-linkedin-dark: oklch(0.30 0.15 264);   /* #004182 */
  --color-linkedin-hover: oklch(0.38 0.17 264);
}

.linkedin-button {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 1.25rem;
  background: var(--color-linkedin);
  color: white;
  border: none;
  border-radius: 1.5rem;
  font-weight: 600;
  text-decoration: none;
  cursor: pointer;
  transition: background 0.2s ease;

  &:hover {
    background: var(--color-linkedin-hover);
  }
}

.linkedin-icon-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  background: var(--color-linkedin);
  color: white;
  border-radius: var(--radius-md);
  transition: background 0.2s ease, transform 0.2s ease;

  &:hover {
    background: var(--color-linkedin-dark);
    transform: scale(1.1);
  }
}
```

### Brand Usage Rules (from brand.linkedin.com)

- **Do:** Use the approved [in] logo and full "LinkedIn" wordmark exactly as provided
- **Do:** Maintain minimum clear space around the logo
- **Don't:** Change the logo colors — only official blue, black, or white variants
- **Don't:** Distort, rotate, or add effects to the logo
- **Download:** brand.linkedin.com/in-logo (official transparent PNG, multiple sizes)

---

## 8. Maastricht University Corporate Design

### Brand Colors

| Color | Role | HEX | RGB | CMYK | PMS | OKLCH |
|---|---|---|---|---|---|---|
| **Dark Blue** | Primary / Logo | `#001C3D` | 0, 28, 61 | 100/60/0/80 | 295 | `oklch(0.14 0.07 264)` |
| **White** | Primary / Background | `#FFFFFF` | 255, 255, 255 | — | — | `oklch(1 0 0)` |
| **Orange-Red** | Accent 1 | `#E84E10` | 232, 78, 16 | 0/80/100/0 | 1665 | `oklch(0.60 0.20 38)` |
| **Light Blue** | Accent 2 | `#00A2DB` | 0, 162, 219 | 90/0/0/5 | 2995 | `oklch(0.65 0.14 224)` |
| **Orange** | Bachelor's | `#F39425` | 243, 148, 37 | 0/50/90/0 | 7411 | `oklch(0.74 0.15 70)` |
| **Red** | Master's | `#AE0B12` | 174, 11, 18 | 0/100/100/30 | 1805 | `oklch(0.38 0.19 27)` |

> **Source:** maastrichtuniversity.nl/support/communications-guide/house-style/colours

### Typography

- **Primary (Print & Web):** Thesis Sans — designed by Lucas de Groot (LucasFonts)
  - Website weights: Semi Light, Plain, Bold, Tabular Lining Figures
  - Other weights: Semi Bold, Regular, Expert (all with Italic variants)
  - UM holds a license — professional users must contact UM preferred suppliers
- **Digital fallback:** Verdana (stationery, reports, other digital media)
- **Presentations:** Calibri (PowerPoint)

> **Source:** maastrichtuniversity.nl/support/communications-guide/house-style/typography

### Logo Guidelines

- **Structure:** Two interlocking triangles forming a UM monogram + "Maastricht University" wordmark in Thesis Sans Bold
- **Color:** Preferably UM dark blue (`#001C3D`) or black on white/light backgrounds
- **Image brand** and **word brand** must remain together (exception: UM social media)
- **Minimum width:** 30 mm including fixed white space
- **Background:** Always white or light — never dark backgrounds without contrast check

### UM Design System Applied in CSS

```css
/* Maastricht University Design Tokens */
:root {
  /* Primary palette */
  --um-dark-blue:    oklch(0.14 0.07 264);  /* #001C3D */
  --um-white:        oklch(1 0 0);           /* #FFFFFF */
  --um-orange-red:   oklch(0.60 0.20 38);   /* #E84E10 */
  --um-light-blue:   oklch(0.65 0.14 224);  /* #00A2DB */

  /* Degree programme colors */
  --um-bachelor:     oklch(0.74 0.15 70);   /* #F39425 — orange */
  --um-master:       oklch(0.38 0.19 27);   /* #AE0B12 — red */

  /* Semantic aliases */
  --um-brand:        var(--um-dark-blue);
  --um-accent:       var(--um-orange-red);
  --um-cta:          var(--um-light-blue);

  /* Typography */
  --um-font-primary: "TheSans", "Thesis Sans", "Verdana", sans-serif;
  --um-font-fallback: "Verdana", "Geneva", sans-serif;
}

/* UM-styled header */
.um-header {
  background: var(--um-dark-blue);
  color: var(--um-white);
  padding: var(--space-4) var(--space-8);
  font-family: var(--um-font-primary);

  & .um-logo {
    min-width: 30mm; /* minimum per brand guidelines */
    height: auto;
  }

  & nav a {
    color: var(--um-white);
    text-decoration: none;
    padding: var(--space-2) var(--space-3);
    border-radius: var(--radius-sm);
    transition: background 0.15s ease;

    &:hover, &[aria-current="page"] {
      background: oklch(from var(--um-dark-blue) l c h / 0.3);
      outline: 1px solid oklch(1 0 0 / 0.4);
    }
  }
}

/* UM accent bar (orange-red) */
.um-accent-bar {
  height: 4px;
  background: linear-gradient(
    90deg,
    var(--um-orange-red),
    var(--um-light-blue)
  );
}

/* UM card component */
.um-card {
  background: var(--um-white);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
  overflow: hidden;
  border-top: 4px solid var(--um-orange-red);

  & .um-card-header {
    background: var(--um-dark-blue);
    color: var(--um-white);
    padding: var(--space-4) var(--space-6);
    font-family: var(--um-font-primary);
    font-weight: bold;
  }

  & .um-card-body {
    padding: var(--space-6);
    font-family: var(--um-font-fallback);
  }
}

/* UM CTA button */
.um-button-primary {
  background: var(--um-orange-red);
  color: var(--um-white);
  padding: var(--space-3) var(--space-6);
  border: none;
  border-radius: var(--radius-md);
  font-family: var(--um-font-primary);
  font-weight: bold;
  cursor: pointer;
  transition: background 0.2s ease;

  &:hover {
    background: oklch(from var(--um-orange-red) calc(l - 0.08) c h);
  }

  &:focus-visible {
    outline: 2px solid var(--um-orange-red);
    outline-offset: 3px;
  }
}
```

---

## 9. Integrated Code Examples

### Complete Page Boilerplate — Modern Adaptive Website

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light dark">
  <meta name="description" content="Page description">
  <title>Modern Adaptive Website</title>

  <!-- View Transitions for cross-document navigation -->
  <style>
    @view-transition { navigation: auto; }
  </style>

  <!-- Icon library (Iconify — 200,000+ icons, no build step) -->
  <script src="https://code.iconify.design/3/3.1.1/iconify.min.js" defer></script>

  <link rel="stylesheet" href="styles/main.css">
</head>

<body>
  <a href="#main-content" class="skip-link">Skip to main content</a>

  <header class="site-header" role="banner">
    <img src="logo.svg" alt="Company Logo" width="180" height="48" class="logo">
    <nav aria-label="Primary">
      <ul role="list">
        <li><a href="/">Home</a></li>
        <li><a href="/about">About</a></li>
        <li><a href="/contact">Contact</a></li>
      </ul>
    </nav>
  </header>

  <main id="main-content">
    <!-- Hero -->
    <section class="hero" aria-labelledby="hero-heading">
      <h1 id="hero-heading">Modern. Accessible. Adaptive.</h1>
      <p>Built with CSS Color Level 4, container queries, and semantic HTML.</p>
      <a href="#learn-more" class="button button-primary">Learn More</a>
    </section>

    <!-- Feature grid with container queries -->
    <section id="learn-more" aria-labelledby="features-heading">
      <h2 id="features-heading">Features</h2>
      <div class="feature-grid">
        <article class="feature-card">
          <span class="iconify" data-icon="ph:paint-bucket-bold" aria-hidden="true"></span>
          <h3>OKLCH Colors</h3>
          <p>Wide-gamut, perceptually uniform colors.</p>
        </article>
        <article class="feature-card">
          <span class="iconify" data-icon="ph:layout-bold" aria-hidden="true"></span>
          <h3>Container Queries</h3>
          <p>Components responsive to their context.</p>
        </article>
        <article class="feature-card">
          <span class="iconify" data-icon="ph:accessibility-bold" aria-hidden="true"></span>
          <h3>Accessible</h3>
          <p>WCAG AA compliant by design.</p>
        </article>
      </div>
    </section>

    <!-- FAQ Accordion — no JS -->
    <section aria-labelledby="faq-heading">
      <h2 id="faq-heading">FAQ</h2>
      <details name="faq">
        <summary>What is CSS Color Level 4?</summary>
        <p>A W3C specification enabling wide-gamut colors including OKLCH, oklab, and more.</p>
      </details>
      <details name="faq">
        <summary>Do I need JavaScript for these features?</summary>
        <p>No — popovers, accordions, dialogs, scroll animations, and view transitions are all native CSS/HTML.</p>
      </details>
    </section>

    <!-- Contact with social icons -->
    <section aria-labelledby="connect-heading">
      <h2 id="connect-heading">Connect</h2>
      <ul class="social-links" role="list">
        <li>
          <a href="https://linkedin.com/in/yourprofile"
             aria-label="Connect on LinkedIn"
             class="linkedin-icon-badge">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"
                 fill="currentColor" viewBox="0 0 16 16" aria-hidden="true">
              <path d="M0 1.146C0 .513.526 0 1.175 0h13.65C15.474 0 16 .513 16 1.146v13.708c0 .633-.526 1.146-1.175 1.146H1.175C.526 16 0 15.487 0 14.854zm4.943 12.248V6.169H2.542v7.225zm-1.2-8.212c.837 0 1.358-.554 1.358-1.248-.015-.709-.52-1.248-1.342-1.248S2.4 3.226 2.4 3.934c0 .694.521 1.248 1.327 1.248zm4.908 8.212V9.359c0-.216.016-.432.08-.586.173-.431.568-.878 1.232-.878.869 0 1.216.662 1.216 1.634v3.865h2.401V9.25c0-2.22-1.184-3.252-2.764-3.252-1.274 0-1.845.7-2.165 1.193v.025h-.016l.016-.025V6.169h-2.4c.03.678 0 7.225 0 7.225z"/>
            </svg>
          </a>
        </li>
      </ul>
    </section>
  </main>

  <footer role="contentinfo">
    <p>© 2026. Built with modern CSS & semantic HTML.</p>
  </footer>
</body>
</html>
```

### Skip Link & Accessibility Utilities

```css
/* Skip link */
.skip-link {
  position: absolute;
  left: -9999px;
  top: auto;
  width: 1px;
  height: 1px;
  overflow: hidden;

  &:focus {
    position: fixed;
    top: var(--space-4);
    left: var(--space-4);
    width: auto;
    height: auto;
    padding: var(--space-3) var(--space-6);
    background: var(--color-brand);
    color: white;
    border-radius: var(--radius-md);
    z-index: 9999;
    font-weight: 600;
  }
}

/* Screen reader only utility */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}
```

---

## Quick Reference Links

| Resource | URL |
|---|---|
| W3C CSS Color Level 4 Spec | https://www.w3.org/TR/css-color-4/ |
| CSS Wrapped 2025 (Chrome) | https://developer.chrome.com/blog/css-wrapped-2025 |
| MDN CSS Reference | https://developer.mozilla.org/en-US/docs/Web/CSS |
| Gemini Code Assist | https://developers.google.com/gemini-code-assist |
| Tabler Icons | https://tabler.io/icons |
| Lucide Icons | https://lucide.dev |
| Phosphor Icons | https://phosphoricons.com |
| Iconify (universal) | https://iconify.design |
| LinkedIn Brand Guidelines | https://brand.linkedin.com |
| UM House Style (Colors) | https://www.maastrichtuniversity.nl/support/communications-guide/house-style/colours |
| UM House Style (Typography) | https://www.maastrichtuniversity.nl/support/communications-guide/house-style/typography |
| CanIUse CSS Nesting | https://caniuse.com/css-nesting |
| OKLCH Color Picker | https://oklch.com |

---

*Document generated May 22, 2026 — Jean Henkel, Maastricht*
