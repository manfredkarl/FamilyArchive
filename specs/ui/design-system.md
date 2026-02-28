# Design System — OmasApp

> **Design philosophy:** The interface should feel like sitting in Oma's warm living room — cozy, unhurried, and full of love. Every choice prioritizes readability, comfort, and emotional warmth over trendy aesthetics.

---

## 1. Color Palette

### Primary Colors

| Name | Hex | Usage |
|------|-----|-------|
| **Warm Amber** | `#D97706` | Primary buttons, active states, links |
| **Deep Amber** | `#B45309` | Button hover, focus rings |
| **Golden Honey** | `#F59E0B` | Accents, highlights, decorative elements |

### Background Colors

| Name | Hex | Usage |
|------|-----|-------|
| **Cream** | `#FFFBEB` | Page background |
| **Soft Linen** | `#FEF3C7` | Card backgrounds, conversation bubbles (assistant) |
| **Warm White** | `#FEFCE8` | Alternate card background |

### Text Colors

| Name | Hex | Usage |
|------|-----|-------|
| **Espresso** | `#451A03` | Primary text (high contrast on cream) |
| **Warm Brown** | `#78350F` | Secondary text, timestamps |
| **Cocoa** | `#92400E` | Tertiary text, captions |

### Entity Highlight Colors

| Entity Type | Background | Text | Chip style |
|-------------|-----------|------|------------|
| **Person** | `#DBEAFE` | `#1E40AF` | Blue chip |
| **Place** | `#D1FAE5` | `#065F46` | Green chip |
| **Year** | `#FEF3C7` | `#92400E` | Amber chip |
| **Event** | `#EDE9FE` | `#5B21B6` | Purple chip |

### State Colors

| State | Color | Usage |
|-------|-------|-------|
| **Success** | `#059669` | Confirmation, connected |
| **Error** | `#DC2626` | Error messages, disconnected |
| **Listening** | `#16A34A` | Mic active, pulsing |
| **Thinking** | `#D97706` | Processing, animated |
| **Speaking** | `#7C3AED` | TTS active |

---

## 2. Typography

### Font Stack

```css
--font-heading: 'Georgia', 'Times New Roman', 'Palatino', serif;
--font-body: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
--font-mono: 'Consolas', 'Monaco', monospace;
```

### Scale

| Level | Size | Weight | Font | Line Height | Usage |
|-------|------|--------|------|-------------|-------|
| **Display** | 36px | 700 | Heading | 1.2 | Page titles |
| **H1** | 30px | 700 | Heading | 1.3 | Section headers |
| **H2** | 24px | 600 | Heading | 1.3 | Card titles |
| **H3** | 20px | 600 | Heading | 1.4 | Sub-sections |
| **Body** | 18px | 400 | Body | 1.6 | All body text (minimum) |
| **Body Large** | 20px | 400 | Body | 1.6 | Conversation messages |
| **Small** | 16px | 400 | Body | 1.5 | Timestamps, captions |
| **Tiny** | 14px | 400 | Body | 1.4 | Metadata only (never primary content) |

> ⚠️ **Minimum body text is 18px.** Nothing the user reads regularly should be smaller.

---

## 3. Spacing

### Base Unit: 8px

| Token | Value | Usage |
|-------|-------|-------|
| `--space-xs` | 4px | Inline spacing between icon and text |
| `--space-sm` | 8px | Tight component padding |
| `--space-md` | 16px | Default content padding |
| `--space-lg` | 24px | Card padding, section gaps |
| `--space-xl` | 32px | Between major sections |
| `--space-2xl` | 48px | Page margins, top/bottom breathing room |
| `--space-3xl` | 64px | Hero areas |

> **Generous spacing is mandatory.** When in doubt, add more space. White space communicates calm.

---

## 4. Components

### 4.1 Buttons

```
┌──────────────────────┐
│   Gespräch starten   │   ← Primary: 18px text, 16px 32px padding
└──────────────────────┘     min 48×48 touch target, round-lg (12px radius)
```

| Variant | Background | Text | Border | Hover |
|---------|-----------|------|--------|-------|
| **Primary** | `#D97706` | `#FFFFFF` | none | `#B45309` |
| **Secondary** | transparent | `#D97706` | 2px `#D97706` | `#FEF3C7` bg |
| **Danger** | `#DC2626` | `#FFFFFF` | none | `#B91C1C` |
| **Ghost** | transparent | `#78350F` | none | `#FEF3C7` bg |

- Border radius: 12px (round-lg)
- Padding: 16px 32px (min)
- Font size: 18px
- Font weight: 600
- Min size: 48×48px
- Focus ring: 3px solid `#B45309`, 2px offset
- Disabled: opacity 0.5, cursor not-allowed

### 4.2 Cards

- Background: `#FEF3C7` (Soft Linen)
- Border: 1px solid `#FDE68A`
- Border radius: 16px
- Padding: 24px
- Shadow: `0 2px 8px rgba(180, 83, 9, 0.08)`
- Hover (if clickable): shadow increases to `0 4px 16px rgba(180, 83, 9, 0.15)`

### 4.3 Chat Bubbles

| Role | Background | Alignment | Border radius |
|------|-----------|-----------|---------------|
| **User (Oma)** | `#D97706` text `#FFFFFF` | Right | 16px 16px 4px 16px |
| **Assistant (AI)** | `#FEF3C7` text `#451A03` | Left | 16px 16px 16px 4px |

- Padding: 16px 20px
- Max width: 80%
- Font size: 20px (Body Large)

### 4.4 Input Fields

- Background: `#FFFFFF`
- Border: 2px solid `#FDE68A`
- Border radius: 12px
- Padding: 16px 20px
- Font size: 18px
- Focus: border color `#D97706`, shadow `0 0 0 3px rgba(217, 119, 6, 0.2)`
- Placeholder color: `#92400E` at 60% opacity

### 4.5 Entity Chips

- Border radius: 20px (pill)
- Padding: 6px 14px
- Font size: 14px
- Font weight: 600
- Colors per entity type (see Entity Highlight Colors above)

### 4.6 Navigation Bar

- Background: `#FFFBEB` (Cream)
- Border bottom: 2px solid `#FDE68A`
- Height: 64px
- Font size: 18px
- Active link: color `#D97706`, underline 3px
- Link spacing: 24px gap

### 4.7 Voice State Indicator

| State | Icon | Color | Animation |
|-------|------|-------|-----------|
| Idle | 🎤 grey mic | `#9CA3AF` | none |
| Listening | 🎤 green mic | `#16A34A` | Pulsing glow ring |
| Processing | ⏳ dots | `#D97706` | Bouncing dots |
| Thinking | 🧠 brain | `#D97706` | Gentle rotation |
| Speaking | 🔊 speaker | `#7C3AED` | Sound wave bars |
| Error | ⚠️ warning | `#DC2626` | none |

---

## 5. Layout

### Page Structure

```
┌─────────────────────────────────┐
│           Nav Bar (64px)        │
├─────────────────────────────────┤
│                                 │
│        Content Area             │
│    (max-width: 800px,           │
│     centered, padded 24px)      │
│                                 │
└─────────────────────────────────┘
```

- Max content width: 800px (conversation), 1000px (timeline)
- Side padding: 24px (mobile), 48px (desktop)
- Top padding below nav: 32px

### Responsive Breakpoints

| Breakpoint | Width | Adjustments |
|-----------|-------|-------------|
| **Mobile** | < 640px | Stack elements vertically, full-width cards, 24px padding |
| **Tablet** | 640–1024px | 2-column where useful, 32px padding |
| **Desktop** | > 1024px | Centered content, 48px padding |

---

## 6. Accessibility

| Requirement | Implementation |
|-------------|---------------|
| Color contrast | All text meets WCAG 2.1 AA (4.5:1 normal, 3:1 large) |
| Focus indicators | 3px solid `#B45309`, 2px offset on all focusable elements |
| Touch targets | 48×48px minimum |
| Language | `lang="de"` on `<html>` |
| ARIA landmarks | `<header>`, `<nav>`, `<main>`, `<footer>` |
| Live regions | `aria-live="polite"` for conversation state changes |
| Motion | `prefers-reduced-motion: reduce` disables all animations |
| Font scaling | Supports up to 200% browser zoom without horizontal scroll |

---

## 7. Iconography

Use emoji for warmth and simplicity — avoid abstract SVG icons.

| Concept | Emoji | Usage |
|---------|-------|-------|
| App identity | 💛 | Header, favicon concept |
| Microphone | 🎤 | Voice toggle |
| Send | ➤ | Send message button |
| History | 📖 | History nav link |
| Ask | 🔍 | Ask/search nav link |
| Timeline | 📅 | Timeline nav link |
| Person | 👤 | Person entities |
| Place | 📍 | Place entities |
| Year | 📆 | Year entities |
| Event | ⭐ | Event entities |
| Back | ← | Back navigation |
| End | ⏹ | End conversation |
| Loading | ⏳ | Processing states |
| Error | ⚠️ | Error states |

---

## 8. Motion & Animation

All animations respect `prefers-reduced-motion`.

| Animation | Duration | Easing | Usage |
|-----------|----------|--------|-------|
| Button hover | 200ms | ease-in-out | Background color transition |
| Card hover | 200ms | ease-in-out | Shadow elevation |
| Message appear | 300ms | ease-out | Slide up + fade in |
| Listening pulse | 1.5s loop | ease-in-out | Mic indicator glow |
| Thinking dots | 1.2s loop | ease-in-out | Three bouncing dots |
| Page transition | 200ms | ease-out | Fade in |
