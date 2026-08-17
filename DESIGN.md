# THE OCTOPUS Design System

## Visual Theme

Calm abyssal instrumentation. A near-black laboratory terminal, defined by thin grey rules, aligned data, dim sea-grey status color, and a functional ASCII specimen. It must look like a scientific record captured from an active system.

## Color

- Background: `oklch(0.12 0.008 220)`
- Raised surface: `oklch(0.145 0.009 220)`
- Rule: `oklch(0.29 0.012 220)`
- Primary text: `oklch(0.9 0.015 105)`
- Muted text: `oklch(0.62 0.018 205)`
- Active signal: `oklch(0.77 0.05 180)`
- Warning: `oklch(0.76 0.08 80)`
- Critical: `oklch(0.66 0.08 32)`

## Typography

One monospace family throughout: `IBM Plex Mono`, then `Cascadia Mono`, then system monospace. Labels use modest positive tracking. Numeric values use tabular figures.

## Layout

Desktop uses an exact `100dvh` CSS grid: header, ticker, specimen, dashboard, footer. The outer document never scrolls. Internal logs can scroll within fixed panels. The 1440 x 900 target is the canonical composition.

## Components

- `TerminalPanel`: 1px rule, square corners, legend label breaking the top border.
- `Metric`: compact uppercase label plus aligned mono value.
- `FeedRow`: time, source, category, evidence line.
- `StatusPill`: compact bordered state, never rounded.
- `AskPrompt`: inline terminal prompt with text input and response area.

## Motion

Motion only visualizes state: counter ticks, low-frequency trace movement, new log emphasis, and arm status changes. All motion reduces to static state with `prefers-reduced-motion`.
