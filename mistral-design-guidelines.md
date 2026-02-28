# Mistral AI-Inspired Design System Guidelines

> **Purpose:** Hand this document to Claude Code to restyle your frontend with a Mistral AI-inspired design language. This captures the brand's retro-warm pixel aesthetic, color system, typography, spacing, and component patterns.

---

## 1. Design Philosophy

Mistral's design language intentionally rejects the cold, futuristic, gradient-heavy aesthetic common in AI/tech. Instead, it embraces:

- **Warm retro-digital**: Pixel art, 8-bit references, nostalgic computing vibes
- **Deliberate simplicity**: Clean layouts, flat colors, no unnecessary decoration
- **Playful but precise**: Fun illustrations paired with organized, grid-based structure
- **Modular & blocky**: Everything feels like it's built from discrete blocks/pixels
- **High contrast**: Pure flat colors, no gradients — crisp and readable

Think: the confidence of a European design house meets early-internet nostalgia. NOT cold silicon valley minimalism.

---

## 2. Color Palette

### 2.1 Primary Rainbow (Mistral Rainbow — used for accents, CTAs, brand moments)

| Name          | Hex       | RGB            | Usage                                      |
|---------------|-----------|----------------|---------------------------------------------|
| Red           | `#E10500` | 225, 5, 0      | Errors, destructive actions, alerts          |
| Orange Dark   | `#FA500F` | 250, 80, 15    | Hover states, secondary accents              |
| Orange        | `#FF8205` | 255, 130, 5    | **Primary brand accent**, CTAs, links, focus |
| Orange Light  | `#FFAF00` | 255, 175, 0    | Highlights, badges, tags                     |
| Yellow        | `#FFD800` | 255, 216, 0    | Warnings, attention-grabbing elements        |

### 2.2 Neutral Backgrounds (Beige System — warm, NOT grey)

| Name          | Hex       | RGB            | Usage                                       |
|---------------|-----------|----------------|----------------------------------------------|
| Beige Light   | `#FFFAEB` | 255, 250, 235  | **Page background (light mode)**             |
| Beige Medium  | `#FFF0C3` | 255, 240, 195  | Card backgrounds, sidebars, secondary areas  |
| Beige Dark    | `#E9E2CB` | 233, 226, 203  | Borders, dividers, disabled states           |

### 2.3 Dark Tones

| Name          | Hex       | RGB            | Usage                                       |
|---------------|-----------|----------------|----------------------------------------------|
| Black         | `#000000` | 0, 0, 0        | Primary text, headings                       |
| Black Tinted  | `#1E1E1E` | 30, 30, 30     | **Dark mode background**, code blocks        |

### 2.4 Dark Mode Adaptation

| Element            | Light Mode   | Dark Mode    |
|--------------------|--------------|--------------|
| Page background    | `#FFFAEB`    | `#1E1E1E`    |
| Card/surface       | `#FFF0C3`    | `#2A2A2A`    |
| Primary text       | `#000000`    | `#FFFAEB`    |
| Secondary text     | `#1E1E1E`    | `#E9E2CB`    |
| Borders            | `#E9E2CB`    | `#3A3A3A`    |
| Accent (unchanged) | `#FF8205`    | `#FF8205`    |

### 2.5 Key Rules
- **NO gradients.** All colors are flat and pure.
- **NO blues or purples.** This is what makes Mistral stand out from every other AI brand.
- The warm beige system replaces cold greys — use `#FFFAEB` instead of `#F5F5F5`.
- Rainbow colors are for accents only — never dominate a page.

---

## 3. Typography

### 3.1 Font Stack

```css
font-family: Arial, Helvetica, 'Liberation Sans', sans-serif;
```

Mistral uses **Arial** as their sole typeface. Yes, it's intentionally plain. The design system leans on color, spacing, and pixel art to create distinction — the typography stays out of the way.

### 3.2 Type Scale

| Element          | Size    | Weight   | Line Height | Letter Spacing |
|------------------|---------|----------|-------------|----------------|
| Display / Hero   | 48px    | Bold     | 1.1         | -0.02em        |
| H1               | 36px    | Bold     | 1.2         | -0.01em        |
| H2               | 28px    | Bold     | 1.3         | 0              |
| H3               | 22px    | Bold     | 1.4         | 0              |
| Body             | 16px    | Regular  | 1.6         | 0              |
| Body Small       | 14px    | Regular  | 1.5         | 0              |
| Caption / Label  | 12px    | Medium   | 1.4         | 0.02em         |
| Code / Mono      | 14px    | Regular  | 1.6         | 0              |

### 3.3 Code Font

```css
font-family: 'JetBrains Mono', 'Fira Code', 'SF Mono', 'Consolas', monospace;
```

### 3.4 Key Rules
- **All caps** for labels, tags, and small UI elements (with letter-spacing: 0.05em)
- **Bold for headings only** — body text stays regular weight
- Text color is always pure black (`#000`) or warm off-white (`#FFFAEB`) — never grey text on grey backgrounds

---

## 4. Spacing & Layout

### 4.1 Base Unit

Use an **8px grid system**. All spacing should be multiples of 8.

```
4px   — micro (icon padding, inline gaps)
8px   — xs (tight element gaps)
16px  — sm (within components)
24px  — md (between related sections)
32px  — lg (between components)
48px  — xl (section spacing)
64px  — 2xl (major section breaks)
96px  — 3xl (page-level spacing)
```

### 4.2 Container

```css
.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 24px;
}
```

### 4.3 Layout Principles
- **Generous whitespace** — Mistral's pages breathe. Don't cram.
- **Grid-aligned** — everything snaps to the 8px grid
- **Modular blocks** — components should feel like distinct, stackable units (pixel-block mentality)

---

## 5. Components

### 5.1 Buttons

```css
/* Primary Button */
.btn-primary {
  background: #FF8205;
  color: #000000;
  font-family: Arial, sans-serif;
  font-size: 14px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 12px 24px;
  border: none;
  border-radius: 0;           /* Square/blocky — pixel aesthetic */
  cursor: pointer;
  transition: background 0.15s ease;
}
.btn-primary:hover {
  background: #FA500F;
}

/* Secondary Button */
.btn-secondary {
  background: transparent;
  color: #000000;
  border: 2px solid #000000;
  border-radius: 0;
  padding: 10px 22px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.btn-secondary:hover {
  background: #000000;
  color: #FFFAEB;
}

/* Ghost / Subtle Button */
.btn-ghost {
  background: transparent;
  color: #FF8205;
  border: none;
  padding: 8px 16px;
  font-weight: 700;
  text-transform: uppercase;
}
.btn-ghost:hover {
  color: #FA500F;
  text-decoration: underline;
}
```

**Key:** Buttons are **square** (border-radius: 0). This is core to the pixel/blocky aesthetic. If you want a softer variant, use `border-radius: 4px` max — never fully rounded pills.

### 5.2 Cards

```css
.card {
  background: #FFF0C3;
  border: 2px solid #E9E2CB;
  border-radius: 0;             /* or 4px for slightly softer */
  padding: 24px;
  transition: border-color 0.15s ease;
}
.card:hover {
  border-color: #FF8205;
}

/* Dark mode card */
.dark .card {
  background: #2A2A2A;
  border-color: #3A3A3A;
}
.dark .card:hover {
  border-color: #FF8205;
}
```

### 5.3 Input Fields

```css
.input {
  background: #FFFAEB;
  border: 2px solid #E9E2CB;
  border-radius: 0;
  padding: 12px 16px;
  font-family: Arial, sans-serif;
  font-size: 16px;
  color: #000000;
  outline: none;
  transition: border-color 0.15s ease;
}
.input:focus {
  border-color: #FF8205;
}
.input::placeholder {
  color: #E9E2CB;
}
```

### 5.4 Navigation / Sidebar

```css
.sidebar {
  background: #FFFAEB;
  border-right: 2px solid #E9E2CB;
  width: 280px;
  padding: 24px 16px;
}
.nav-item {
  padding: 10px 16px;
  font-size: 14px;
  font-weight: 500;
  color: #1E1E1E;
  border-radius: 0;
  cursor: pointer;
  transition: background 0.1s ease;
}
.nav-item:hover {
  background: #FFF0C3;
}
.nav-item.active {
  background: #FF8205;
  color: #000000;
  font-weight: 700;
}
```

### 5.5 Tags / Badges

```css
.tag {
  display: inline-block;
  background: #FFD800;
  color: #000000;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 4px 8px;
  border-radius: 0;
}
.tag-outline {
  background: transparent;
  border: 2px solid #000000;
  color: #000000;
}
```

### 5.6 Code Blocks

```css
.code-block {
  background: #1E1E1E;
  color: #FFFAEB;
  font-family: 'JetBrains Mono', monospace;
  font-size: 14px;
  line-height: 1.6;
  padding: 24px;
  border-radius: 0;
  border: 2px solid #3A3A3A;
  overflow-x: auto;
}
.inline-code {
  background: #FFF0C3;
  color: #000000;
  font-family: 'JetBrains Mono', monospace;
  font-size: 14px;
  padding: 2px 6px;
  border-radius: 0;
}
```

### 5.7 Tooltips & Toasts

```css
.tooltip {
  background: #000000;
  color: #FFFAEB;
  font-size: 12px;
  padding: 8px 12px;
  border-radius: 0;
}
.toast-success {
  background: #FF8205;
  color: #000000;
  border-left: 4px solid #FA500F;
}
.toast-error {
  background: #E10500;
  color: #FFFAEB;
  border-left: 4px solid #000000;
}
```

---

## 6. Pixel Art & Iconography

### 6.1 Icon Style
- Use **pixel-art style icons** where possible (8-bit / 16-bit aesthetic)
- If pixel art icons aren't available, use simple **outline icons** (Lucide, Heroicons) — avoid filled/solid icon sets
- Icon sizes: 16px, 20px, 24px (matching the 8px grid)
- Icon color matches text color, or uses the orange accent for interactive icons

### 6.2 Illustrations
- Pixel art illustrations for empty states, onboarding, error pages
- Modular, grid-based compositions — everything should feel block-assembled
- Color palette restricted to the Mistral Rainbow + beige + black

### 6.3 Decorative Touches
- Consider pixel-grid borders or pixel-pattern backgrounds for hero sections
- Subtle pixel-dot patterns as background textures (at very low opacity, ~5%)
- Animated pixel elements for loading states (block-by-block reveal)

---

## 7. Animations & Interactions

### 7.1 General Principles
- **Fast and snappy** — nothing slow or floaty
- **Block-based transitions** — favor step-based or pixel-reveal animations over smooth easing
- Keep transitions under **200ms** for UI interactions, **300ms** for page-level

### 7.2 Recommended CSS

```css
/* Standard transition */
transition: all 0.15s ease;

/* Hover lift for cards */
.card:hover {
  transform: translateY(-2px);
  border-color: #FF8205;
}

/* Focus ring (accessibility) */
*:focus-visible {
  outline: 3px solid #FF8205;
  outline-offset: 2px;
}

/* Loading skeleton — blocky, not wave */
.skeleton {
  background: #E9E2CB;
  animation: skeleton-pulse 1s ease-in-out infinite;
}
@keyframes skeleton-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
```

---

## 8. CSS Variables (Copy-Paste Ready)

```css
:root {
  /* Mistral Rainbow */
  --color-red: #E10500;
  --color-orange-dark: #FA500F;
  --color-orange: #FF8205;
  --color-orange-light: #FFAF00;
  --color-yellow: #FFD800;

  /* Beige Neutrals */
  --color-beige-light: #FFFAEB;
  --color-beige-medium: #FFF0C3;
  --color-beige-dark: #E9E2CB;

  /* Dark Tones */
  --color-black: #000000;
  --color-black-tinted: #1E1E1E;

  /* Semantic Aliases */
  --bg-primary: var(--color-beige-light);
  --bg-secondary: var(--color-beige-medium);
  --bg-surface: var(--color-beige-medium);
  --bg-inverse: var(--color-black-tinted);
  --text-primary: var(--color-black);
  --text-secondary: var(--color-black-tinted);
  --text-inverse: var(--color-beige-light);
  --accent: var(--color-orange);
  --accent-hover: var(--color-orange-dark);
  --border: var(--color-beige-dark);
  --error: var(--color-red);
  --warning: var(--color-yellow);
  --success: var(--color-orange);

  /* Typography */
  --font-sans: Arial, Helvetica, 'Liberation Sans', sans-serif;
  --font-mono: 'JetBrains Mono', 'Fira Code', 'SF Mono', 'Consolas', monospace;

  /* Spacing */
  --space-xs: 8px;
  --space-sm: 16px;
  --space-md: 24px;
  --space-lg: 32px;
  --space-xl: 48px;
  --space-2xl: 64px;

  /* Border */
  --radius: 0px;              /* Square/blocky default */
  --radius-soft: 4px;         /* Softer variant if needed */
  --border-width: 2px;
}

/* Dark mode overrides */
[data-theme="dark"], .dark {
  --bg-primary: #1E1E1E;
  --bg-secondary: #2A2A2A;
  --bg-surface: #2A2A2A;
  --text-primary: #FFFAEB;
  --text-secondary: #E9E2CB;
  --border: #3A3A3A;
}
```

---

## 9. Tailwind CSS Configuration (if using Tailwind)

```javascript
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        mistral: {
          red: '#E10500',
          'orange-dark': '#FA500F',
          orange: '#FF8205',
          'orange-light': '#FFAF00',
          yellow: '#FFD800',
        },
        beige: {
          light: '#FFFAEB',
          medium: '#FFF0C3',
          dark: '#E9E2CB',
        },
        dark: {
          DEFAULT: '#000000',
          tinted: '#1E1E1E',
          surface: '#2A2A2A',
          border: '#3A3A3A',
        },
      },
      fontFamily: {
        sans: ['Arial', 'Helvetica', 'Liberation Sans', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'SF Mono', 'Consolas', 'monospace'],
      },
      borderRadius: {
        none: '0px',       // default — blocky
        soft: '4px',       // subtle rounding
      },
      spacing: {
        '18': '4.5rem',    // 72px
        '22': '5.5rem',    // 88px
      },
    },
  },
}
```

---

## 10. Do's and Don'ts Checklist

### ✅ DO
- Use flat, pure colors — no gradients ever
- Keep corners square (border-radius: 0) or barely rounded (4px max)
- Use warm beige tones instead of cold greys for backgrounds
- Make buttons uppercase with letter-spacing
- Use generous whitespace — let things breathe
- Add pixel-art illustrations for empty/special states
- Keep transitions fast (150-200ms)
- Use the orange accent sparingly for maximum impact
- Maintain high contrast between text and background

### ❌ DON'T
- Use blues, purples, or teal — this is NOT a typical tech palette
- Add gradients or glassmorphism effects
- Use rounded pill buttons or large border-radius
- Make things look "futuristic" or "sleek" — aim for warm and approachable
- Use thin/light font weights — Arial at regular/bold only
- Overuse the rainbow palette — it's for accents, not backgrounds
- Add drop shadows everywhere — keep it flat
- Use a grey (#F5F5F5) background — use beige (#FFFAEB) instead

---

## 11. Quick Reference — When Talking to Claude Code

Paste this as a concise instruction:

```
Restyle this frontend using a Mistral AI-inspired design system:
- Colors: Warm beige backgrounds (#FFFAEB, #FFF0C3), orange accent (#FF8205), 
  pure black text, NO blues/purples/gradients
- Typography: Arial font family, bold headings, uppercase labels with letter-spacing
- Corners: border-radius: 0 (square/blocky pixel aesthetic), 4px max if softening
- Spacing: 8px grid system, generous whitespace
- Buttons: Square, uppercase, orange primary (#FF8205), black outline secondary
- Cards: Beige medium background (#FFF0C3), 2px solid borders, orange hover border
- Code blocks: Dark (#1E1E1E) with JetBrains Mono
- Dark mode: #1E1E1E bg, #2A2A2A surfaces, #FFFAEB text, same orange accent
- Vibe: Warm, retro-digital, pixel-inspired — NOT cold/futuristic silicon valley
```
