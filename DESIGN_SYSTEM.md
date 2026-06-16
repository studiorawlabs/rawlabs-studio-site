# Rawlabs Studios - Design System & UI Guidelines

This document serves as a reference guide for the design choices, UI tokens, styling conventions, and custom interactive components implemented across the **Rawlabs Studios** web platform. Use these rules to maintain a premium, cohesive user experience when building new pages or editing existing components.

---

## 🌌 Visual Design Philosophy

Rawlabs Studios uses a **Premium Sleek Dark Purple Space Theme** characterized by:
*   **Deep Radial Gradients**: Dynamic dark background gradients that create depth and visual focus.
*   **High-End Glassmorphism**: Semi-transparent card overlays with thick blur, thin borders, and radial mask gradient borders.
*   **Signature Neon Glows**: Interactive accents that utilize soft purple, violet, and lavender glows (`#a891ff` and `#cbb2ff`) on hover and active states.
*   **Micro-Animations & Smooth Transitions**: Custom page-transition wipes, hover elevations (`translateY`), scale effects, and CSS keyframe pulses (`cardGlow`) to make the UI feel alive and responsive.

---

## 🎨 Color Tokens & Palette

### 1. Core Base Template Colors (SCSS Variables)
Defined in `public/assets/sass/libs/_vars.scss`:
*   `$palette(bg)`: `#312450` (Original template dark purple background)
*   `$palette(accent1)`: `#5e42a6` (Deep violet)
*   `$palette(accent2)`: `#5052b5` (Indigo)
*   `$palette(accent3)`: `#b74e91` (Magenta/Pink accent)
*   `$palette(fg)`: `rgba(255, 255, 255, 0.55)` (Muted default text)
*   `$palette(fg-bold)`: `#ffffff` (Headers/Bold text)

### 2. Premium Dark Mode Theme (Custom Overrides)
Applied globally in premium pages (e.g., `contact.astro`, `internal-services.astro`, `beats-arrangements.astro`):
*   **Deep Radial Space Background**:
    ```css
    radial-gradient(circle at 50% 0%, #190f33 0%, #0c0818 100%) !important;
    ```
    *Alternative variation used on internal pages:*
    ```css
    radial-gradient(circle at 50% 0%, #150c2c 0%, #07040f 100%) !important;
    ```
*   **Default Premium Typography Color**: `#e2dcf0` (Soft lavender-white, highly legible against dark backdrops).
*   **Signature Lavender Accent (Glow/Active)**: `#a891ff` (Main color for active buttons, sliders, hover outlines).
*   **Subtle Accent (Completed/Secondary)**: `#cbb2ff` (Secondary glows, completed wizard states).

---

## 📏 Layout & Spacing Rules

*   **Responsive Widths**:
    *   Large Desktop/Inner Content: Max-width is set to `1000px` (with `90%` width relative to viewport) centered using `margin: 0 auto`.
    *   Padding: Standard inner container padding is `3em 2em` (`3em 0 6em 0` for `#main.wrapper`).
*   **Breakpoints**:
    *   `xlarge`: `1281px - 1680px`
    *   `large`: `981px - 1280px` (Sidebar collapses into sticky header)
    *   `medium`: `737px - 980px`
    *   `small`: `481px - 736px` (Grids collapse to 1 column)
    *   `xsmall`: `361px - 480px`

---

## ✨ Premium Components & UI Patterns

### 1. Glassmorphic Grid Cards (`.service-card`, `.beat-card`)
A signature visual component used to display features, tools, or products.
```css
/* Card Base */
.service-card {
    background: rgba(255, 255, 255, 0.02) !important;
    backdrop-filter: blur(16px) !important;
    -webkit-backdrop-filter: blur(16px) !important;
    border: 1px solid rgba(168, 145, 255, 0.08) !important;
    border-radius: 20px;
    padding: 2.2em 2em;
    transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
    position: relative;
    overflow: hidden;
}

/* Linear Mask Gradient Border Effect */
.service-card::before {
    content: "";
    position: absolute;
    top: 0; left: 0; right: 0; bottom: 0;
    border-radius: 20px;
    padding: 1px;
    background: linear-gradient(135deg, rgba(168, 145, 255, 0.05), rgba(203, 178, 255, 0.05));
    -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
    -webkit-mask-composite: xor;
    mask-composite: exclude;
    transition: background 0.4s ease;
    pointer-events: none;
}

/* Hover Elevation & Neon Lavender Glow */
.service-card:hover {
    transform: translateY(-5px);
    background: rgba(255, 255, 255, 0.04) !important;
    border-color: rgba(168, 145, 255, 0.25) !important;
    box-shadow: 0 15px 35px rgba(168, 145, 255, 0.12), 0 5px 15px rgba(0, 0, 0, 0.2);
}

.service-card:hover::before {
    background: linear-gradient(135deg, rgba(168, 145, 255, 0.3), rgba(203, 178, 255, 0.3));
}
```

### 2. Glowing Buttons (`.glowing-button`)
For primary Call-To-Action (CTA) interactions.
```css
.glowing-button {
    position: relative;
    background: #a891ff !important;
    color: #fff !important;
    border-color: #a891ff !important;
    box-shadow: 0 0 15px rgba(168, 145, 255, 0.5) !important;
    transition: all 0.3s ease !important;
    font-weight: bold !important;
    text-transform: uppercase;
    letter-spacing: 0.05em;
}

.glowing-button:hover {
    box-shadow: 0 0 25px rgba(168, 145, 255, 0.95), 0 0 40px rgba(168, 145, 255, 0.4) !important;
    transform: translateY(-2px);
}
```

### 3. Glassmorphic Selection Buttons (`.package-btn`)
Used for selecting packages inside forms.
*   **Off State**: Transparent background `rgba(255, 255, 255, 0.02)` and border `1px solid rgba(255, 255, 255, 0.1)`.
*   **Hover State**: Border lights up to `rgba(168, 145, 255, 0.4)` and card scales/translates upward.
*   **Active/Selected State**:
    ```css
    .package-btn.active {
        background: rgba(168, 145, 255, 0.12) !important;
        border-color: #a891ff !important;
        color: #fff;
        transform: translateY(-4px);
        box-shadow: 0 0 30px rgba(168, 145, 255, 0.35) !important;
    }
    ```

### 4. Interactive Form Elements
*   **Text Inputs/Textareas**:
    *   Normal: `background: rgba(255, 255, 255, 0.02)`, `border: 1px solid rgba(255, 255, 255, 0.1)`.
    *   Focus: `border-color: #a891ff`, `box-shadow: 0 0 15px rgba(168, 145, 255, 0.25)`.
*   **Custom Checkboxes (`.checkbox-item`)**:
    *   Hides native checkboxes, using custom stylized CSS boxes (`::before` / `::after`) that light up to `#a891ff` when checked.
*   **Collapsible Container Wrappers (`.collapsible-wrapper`)**:
    *   Animates expanding/collapsing sections (like B2B inputs) using a CSS grid transition:
        ```css
        .collapsible-wrapper {
            display: grid;
            grid-template-rows: 0fr;
            transition: grid-template-rows 0.35s cubic-bezier(0.165, 0.84, 0.44, 1);
            overflow: hidden;
        }
        .collapsible-wrapper.open {
            grid-template-rows: 1fr;
            margin-top: 1.5em;
            margin-bottom: 1.5em;
        }
        .collapsible-content {
            min-height: 0;
            overflow: hidden;
            border-left: 2px solid #a891ff;
            padding-left: 2em;
        }
        ```

### 5. Premium Limited Opening Offer Banner (`.offer-banner`, `.offer-banner-contact`)
A champagne-gold, glassmorphic banner placed beneath the section heading (above the pricing grid) to indicate a limited-time introductory offer. Uses a warm gold accent (`#e8c87a` / `rgba(212, 168, 83, ...)`) to subtly contrast with the purple space theme and convey exclusivity.
```css
@keyframes offerPulse {
	0%, 100% {
		box-shadow: 0 0 15px rgba(212, 168, 83, 0.04), inset 0 0 15px rgba(212, 168, 83, 0.02);
	}
	50% {
		box-shadow: 0 0 25px rgba(212, 168, 83, 0.1), inset 0 0 20px rgba(212, 168, 83, 0.04);
	}
}
.offer-banner {
	display: inline-flex;
	align-items: center;
	gap: 0.75em;
	margin: 0.8em 0 2em 0;
	padding: 0.6em 1.5em;
	background: linear-gradient(135deg, rgba(212, 168, 83, 0.1), rgba(212, 168, 83, 0.03), rgba(212, 168, 83, 0.06)) !important;
	border: 1px solid rgba(212, 168, 83, 0.2) !important;
	border-radius: 10px;
	color: #f5e6b8 !important;
	font-size: 0.78em;
	letter-spacing: 0.12em;
	text-transform: uppercase;
	font-weight: 700;
	backdrop-filter: blur(10px);
	-webkit-backdrop-filter: blur(10px);
	box-shadow: 0 0 15px rgba(212, 168, 83, 0.04), inset 0 0 15px rgba(212, 168, 83, 0.02);
	animation: offerPulse 3s ease-in-out infinite;
	transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
	width: fit-content;
	position: relative;
}
.offer-banner::before,
.offer-banner::after {
	content: "◇";
	font-size: 0.7em;
	color: rgba(212, 168, 83, 0.4);
	opacity: 0.6;
}
.offer-banner-icon {
	font-size: 1.1em;
	color: #f5d68a;
	opacity: 1;
	filter: drop-shadow(0 0 4px rgba(212, 168, 83, 0.3));
}
.offer-banner:hover {
	background: linear-gradient(135deg, rgba(212, 168, 83, 0.14), rgba(212, 168, 83, 0.05), rgba(212, 168, 83, 0.08)) !important;
	border-color: rgba(212, 168, 83, 0.35) !important;
	color: #fff4e0 !important;
	box-shadow: 0 0 35px rgba(212, 168, 83, 0.15), inset 0 0 25px rgba(212, 168, 83, 0.04);
	transform: translateY(-1px);
	animation: none;
}
```
*   **Usage**: Placed below the heading `<p>` and above the `.pricing-grid` in [`index.astro`](src/pages/index.astro), and below the `<label>` and above `.package-button-group` in [`contact.astro`](src/pages/contact.astro). A smaller variant `.offer-banner-contact` is used in the contact form.
*   **Text**: German — `"✦ Limitiertes Eröffnungsangebot ✦"` (flanked by filled star-diamond icons).
*   **Color Tokens**: Champagne gold `#f5e6b8` / `#f5d68a` for text and icons, warm gold `rgba(212, 168, 83, ...)` for borders/glows. Glassmorphism: `backdrop-filter: blur(10px)`.
*   **Animation**: Gentle `offerPulse` keyframe loop (3s ease-in-out infinite) that subtly oscillates the glow intensity.

### 6. Diagonal Page Transition Overlay (`PageTransition.astro`)
Flashes a full-screen, angled transition wipe during page changes:
*   A `250vw` by `250vh` background wipe angled at `rotate(-45deg)`.
*   Uses a smooth glass backdrop-filter: `blur(20px)` and dark purple gradient.
*   Transition: `transform 0.9s cubic-bezier(0.25, 1, 0.5, 1)`.
*   Integrates automatically into client-side click events for internal URLs.

---

## 🛠️ Implementation Guidelines for Future Work

When developing new pages, components, or features, adhere to the following principles:

1.  **Do Not Mix Layout Styles**: Standard pages should pull from `/assets/css/main.css`. Custom styled landing pages must use layout wrappers that apply the premium dark radial space background:
    ```html
    <style>
      body, #wrapper, #main, section.wrapper {
        background: radial-gradient(circle at 50% 0%, #190f33 0%, #0c0818 100%) !important;
        color: #e2dcf0 !important;
      }
    </style>
    ```
2.  **Strictly Avoid Raw/Bright Standard Colors**: Avoid pure green, red, or basic blue. If color indication is needed:
    *   **Success/Accent**: Use the glowing lavender `#a891ff` or purple `#5e42a6`.
    *   **Error**: Use a muted red-glow `rgba(244, 67, 54, 0.1)` for background and `#ff5e5e` for text.
    *   **Info/Muted State**: Use `rgba(255, 255, 255, 0.4)`.
3.  **Typography Consistency**:
    *   Headers (`h1`, `h2`, `h3`) should have `letter-spacing: -0.02em` or `-0.05em` for large headers.
    *   Body text should use `rgba(255, 255, 255, 0.55)` (for standard descriptions) or `#e2dcf0` (for high-contrast paragraph reading).
4.  **Use Vanilla CSS (No Tailwind CSS)**:
    *   Maintain the SASS codebase under `public/assets/sass/` or write native `<style>` blocks in Astro pages. Do not introduce Tailwind utility classes.
5.  **Interactive Elements Must Support Transitions**:
    *   Any state changes (hover, active, focus) must include transitions (`transition: all 0.3s ease` or similar).
    *   Always supply an elegant transition-out for elements using animations or dynamic filters.
