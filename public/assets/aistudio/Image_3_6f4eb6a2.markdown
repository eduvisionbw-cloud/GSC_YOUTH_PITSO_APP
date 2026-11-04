---
name: Gaborone South Youth Pitso
colors:
  surface: '#faf8ff'
  surface-dim: '#d2d9f4'
  surface-bright: '#faf8ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f3ff'
  surface-container: '#eaedff'
  surface-container-high: '#e2e7ff'
  surface-container-highest: '#dae2fd'
  on-surface: '#131b2e'
  on-surface-variant: '#444650'
  inverse-surface: '#283044'
  inverse-on-surface: '#eef0ff'
  outline: '#747781'
  outline-variant: '#c4c6d1'
  surface-tint: '#435c9a'
  primary: '#001b4b'
  on-primary: '#ffffff'
  primary-container: '#12306b'
  on-primary-container: '#819adb'
  inverse-primary: '#b1c5ff'
  secondary: '#7c5800'
  on-secondary: '#ffffff'
  secondary-container: '#fdbf40'
  on-secondary-container: '#6f4e00'
  tertiary: '#002315'
  on-tertiary: '#ffffff'
  tertiary-container: '#003b26'
  on-tertiary-container: '#00b17a'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dae2ff'
  primary-fixed-dim: '#b1c5ff'
  on-primary-fixed: '#001946'
  on-primary-fixed-variant: '#2a4480'
  secondary-fixed: '#ffdea8'
  secondary-fixed-dim: '#fabc3e'
  on-secondary-fixed: '#271900'
  on-secondary-fixed-variant: '#5e4200'
  tertiary-fixed: '#6ffbbe'
  tertiary-fixed-dim: '#4edea3'
  on-tertiary-fixed: '#002113'
  on-tertiary-fixed-variant: '#005236'
  background: '#faf8ff'
  on-background: '#131b2e'
  surface-variant: '#dae2fd'
typography:
  display:
    fontFamily: Outfit
    fontSize: 44px
    fontWeight: '700'
    lineHeight: 52px
    letterSpacing: -0.02em
  display-mobile:
    fontFamily: Outfit
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-lg:
    fontFamily: Outfit
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.015em
  headline-lg-mobile:
    fontFamily: Outfit
    fontSize: 26px
    fontWeight: '600'
    lineHeight: 34px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Outfit
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  headline-sm:
    fontFamily: Outfit
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  title-md:
    fontFamily: Outfit
    fontSize: 18px
    fontWeight: '500'
    lineHeight: 26px
  body-lg:
    fontFamily: Outfit
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Outfit
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: Outfit
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-lg:
    fontFamily: Outfit
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.02em
  label-sm:
    fontFamily: Outfit
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.04em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1.5rem
  gutter-mobile: 1rem
  margin: 2rem
  margin-mobile: 1rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2.5rem
---

## Brand & Style

This design system establishes a high-trust, welcoming civic and economic portal dedicated to youth empowerment, township economy innovation, and grassroots community pride within Gaborone South. 

The aesthetic is Modern Civic: authoritative yet approachable, functional without sterile bureaucracy, and energetic without resorting to juvenile motifs. By uniting Botswana's democratic gathering tradition (*Pitso*) with forward-looking economic mobility, the interface evokes civic dignity, optimism, clarity, and communal ownership. Layouts emphasize structured, high-legibility cards, prominent call-to-actions, and transparent public information architecture tailored for diverse community stakeholders—from township entrepreneurs and students to constituency leaders.

## Colors

The palette balances the stability of sovereign deep blue with the energetic enterprise of warm gold, grounded on crisp, low-fatigue slate neutrals.

- **Primary (`#12306B`):** Deep National Blue. Anchors the primary civic identity, top navigation banners, structural header bars, primary buttons, and authoritative headlines.
- **Secondary / Accent CTA (`#E0A526`):** Vibrant Warm Gold. Reserved for primary conversion touchpoints, registration actions, urgent notices, and focal highlights. Hover state shifts to `#C9921E`.
- **Tertiary / Success (`#10B981`):** Emerald Green. Used exclusively for verified status badges, successful application confirmations, and economic milestone indicators.
- **Backgrounds:**
  - Base canvas: `#F4F6FA` (cool slate-tinted grey, reducing harsh screen glare under bright sunlight).
  - Surface cards & modals: `#FFFFFF`.
  - Borders & Dividers: `#E2E8F0`.
- **Text & Hierarchy:**
  - Headings & High Emphasis: `#0F172A` (Slate Navy).
  - Body & Form Text: `#334155` (Mid Slate).
  - Secondary & Metadata: `#64748B` (Muted Slate).
- **Tonal Tints:** Muted gold (`#FEF3C7`) and soft blue (`#E0E7FF`) provide subtle tinted backdrops for chips, callout containers, and schedule pill tags.

## Typography

The typographic system relies on **Outfit**, an open, geometric neo-grotesque that projects technical clarity alongside an optimistic, communal humanism. 

All sizes are tuned for rapid parsing on handheld devices under variable lighting conditions. Headings use tight letter tracking and distinct semi-bold/bold weights to anchor dense agendas, speaker directories, and grant opportunities. Body copy utilizes open counters and generous line heights to ensure long-form civic policy and pitso resolutions remain readable across all literacy and device spectrums.

## Layout & Spacing

The layout utilizes a fluid 12-column grid system on desktop (max width: 1200px) that compresses into a single-column stacked layout on mobile viewports (<640px) and a 6-column grid on tablets (640px–1024px).

All spatial margins adhere to an 8pt modular grid. Exterior margins contract from `2rem` (32px) on desktop to `1rem` (16px) on mobile screens to preserve maximum surface area for content cards. Components maintain strict inner breathing room: dense list components consume `space-sm` (8px) to `space-md` (16px), whereas dashboard modules, workshop schedules, and resource cards utilize `space-lg` (24px). All interactive touchpoints adhere strictly to a minimum 44px dimensional threshold to accommodate one-handed mobile navigation.

## Elevation & Depth

Visual hierarchy uses crisp, ambient drop shadows combined with low-contrast structural outlines rather than heavy skeuomorphic shading. This guarantees legibility across both budget mobile screens and high-resolution displays.

- **Level 0 (Flat / Canvas):** Neutral background `#F4F6FA` with zero elevation.
- **Level 1 (Card & Module Default):** Pure white `#FFFFFF` surface enclosed with a 1px border of `#E2E8F0` and an ambient shadow: `0px 1px 3px rgba(15, 23, 42, 0.05), 0px 4px 6px -2px rgba(15, 23, 42, 0.03)`.
- **Level 2 (Interactive Hover & Elevated Modules):** Subtle lift using `0px 4px 12px -2px rgba(18, 48, 107, 0.08), 0px 2px 6px -1px rgba(18, 48, 107, 0.04)`.
- **Level 3 (Modals, Registration Drawers & Flyouts):** Focused depth with `0px 12px 24px -4px rgba(15, 23, 42, 0.12), 0px 8px 16px -4px rgba(15, 23, 42, 0.06)`, framed with a persistent 1px border of `#E2E8F0`.

## Shapes

The geometric identity relies on uniform, friendly corner radii that soften institutional structure without degrading precision. 

With a roundedness factor of `2`:
- Standard interactive elements (inputs, select fields, action buttons) feature a consistent `0.5rem` (8px) radius.
- Cards, dialogue frames, notice banners, and media containers leverage `rounded-lg` (`1rem` / 16px) and `rounded-xl` (`1.5rem` / 24px) for structural presence.
- Status badges and contextual indicators use full pills (`9999px`) to distinguish categorical tags from interactive planar surfaces.

## Components

### Buttons
- **Primary CTA (Gold):** Background `#E0A526`, text `#0F172A`, font weight 600. Min-height 48px, horizontal padding 24px, radius 8px. Hover shifts to `#C9921E`. Focus ring: 3px solid `#FEF3C7` with 1px inset `#E0A526`.
- **Secondary (Civic Blue):** Background `#12306B`, text `#FFFFFF`, font weight 600. Min-height 48px, horizontal padding 24px, radius 8px. Hover shifts to `#0C224E`.
- **Outline / Ghost:** Background transparent, 1.5px border `#12306B`, text `#12306B`. Hover state applies `#E0E7FF` at 40% opacity.

### Cards & Programme Panels
- Constructed on `#FFFFFF` surfaces with a 1px border `#E2E8F0` and `rounded-xl` (16px) geometry.
- Section headers within cards utilize Slate Navy `#0F172A` paired with small gold or blue category chips. Card paddings default to 20px on mobile and 24px on desktop.

### Form Inputs & Selectors
- Standard height: 48px to fulfill mobile accessibility.
- Background `#FFFFFF`, border 1px solid `#CBD5E1`, text `#0F172A`, placeholder `#94A3B8`, radius 8px.
- Active/Focus: Border changes to 2px solid `#12306B`, box-shadow `0 0 0 3px rgba(18, 48, 107, 0.12)`.
- Error state: Border `#EF4444`, message text `#DC2626` in `label-sm`.

### Status Chips & Badges
- **Eco-Grant / Success:** Background `#ECFDF5`, text `#065F46`, border 1px solid `#A7F3D0`.
- **Township Economy Track:** Background `#FEF3C7`, text `#92400E`, border 1px solid `#FDE68A`.
- **Civic Pitso Session:** Background `#E0E7FF`, text `#1E40AF`, border 1px solid `#C7D2FE`.
- Radii are fully pill-shaped (`9999px`) with padding 4px 12px, font style `label-sm`.

### Checkboxes & Radios
- Size: 22px × 22px with a 44px touch target overlay.
- Default: Border 2px solid `#94A3B8`, background `#FFFFFF`.
- Checked: Background `#12306B`, checkmark icon white `#FFFFFF`.

### Pitso Agenda & Timeline Lists
- Chronological feeds feature a 2px left-accent border in `#12306B`.
- Session list items display full timestamp pill tags, speaker credentials, and venue designation tags (`Babusi Community Hall`) using high-contrast slate text tiers.