# Wheel Run design system

## Overview

Wheel Run is a single-page browser game for Squeekchain Genesis Code. A warm hamster and amber controls sit against a quiet, blue-green underground cave. The original Canvas illustration carries the identity; the surrounding interface stays flat and compact.

The header puts the identity at the leading edge and help/sound at the trailing edge. The game is the main content, with its score HUD, a short ready-state introduction, and one primary action. Live chain information follows the game. Three concise explanations and a small footer complete the page. This arrangement is specific to the game, not a template for a marketing site.

Source of truth: `src/style.css` for interface tokens and patterns, `index.html` for structure, `src/app.ts` for states, and `src/renderer.ts` for the illustration. The design was checked against the actual production export at 320, 390, 768, and 1440 CSS pixels.

## Colors

The interface uses a hex palette with primitive and semantic CSS properties in `src/style.css`.

| Semantic token | Value / primitive | Use |
| --- | --- | --- |
| `--page` | `--ink-950`, `#141718` | Page background |
| `--surface` | `--ink-900`, `#1b2021` | Game controls and dialog |
| `--hover` | `--ink-800`, `#252b2b` | Neutral hover and keycaps |
| `--border` | `--ink-700`, `#353d3c` | Separators and game outline |
| `--text` | `--cream-100`, `#f3eee3` | Primary text |
| `--muted` | `--stone-400`, `#a8afaa` | Secondary text on solid dark surfaces |
| `--accent` | `--amber-400`, `#f3bc66` | Primary button, multiplier, headline emphasis, IDLE indicator |
| `--accent-hover` | `--amber-300`, `#ffd38d` | Primary hover |
| `--focus` | `--amber-300`, `#ffd38d` | Keyboard outline |
| `--active` | `--sage-400`, `#a7c7a4` | ACTIVE indicator and activity icon |
| `--warning` | `--rose-400`, `#efb2a5` | Offline indicator |

The accent also belongs to the game's warm visual identity; static accent text is not a control. Clickable actions have a button shape, a familiar placement, or link treatment. The status dot always accompanies a word, so state does not depend on color.

Cave text uses `#c2c7bf`, with `#b5bbaa` on the bottom scene caption. Primary button text is `#27291f`. The paused/result surface is `#182123ed`; the dialog backdrop is `#080d10ba`. There is one intentional dark theme, with no theme switch.

The Canvas palette is separately defined in `src/renderer.ts`: sky `#1a2527`, rock layers `#202f31`, `#253638`, `#304345`, edge `#151e20`, floor `#292d28`, and moss `#78806a`. Hamster colors include `#c99560`, `#e0b47a`, `#f5e9ca`, with a teal `#7db6a5` scarf. Bright fireflies stay out of the ready screen's text area. Decorative vines were darkened after measuring their overlap with small text.

Solid UI contrast was checked by the pinned probe and axe. `artifacts/visual-measurements.json` records actual sampled Canvas backgrounds under text at 320, 390, and 1440; every sampled pair meets 4.5:1 for normal text or 3:1 for large text. This is a sampled ready-state check, not a guarantee about every possible moving frame.

## Typography

Both fonts are local variable WOFF2 files, with `font-display: swap` and sans-serif fallbacks. Bricolage Grotesque (`Bricolage` in CSS) gives the identity and headings their rounded character. DM Sans handles prose, controls, labels, and numeric data. Their font faces were confirmed loaded in the browser. Font licenses live beside the assets in `public/fonts/` and are copied into the export.

| Token | Default size | Role |
| --- | ---: | --- |
| `--small` | 12px / 0.75rem | Captions, metric labels, keycaps |
| `--label` | 14px / 0.875rem | Utility buttons, secondary copy, metric values |
| `--body` | 16px / 1rem | Main description and primary controls |
| `--title` | 24px / 1.5rem | Brand, HUD numbers, dialog title |
| `--heading` | 40px / 2.5rem | Compact hero and result headings |
| `--display` | 64px / 4rem | Wide hero |

At widths up to 22rem, `--heading` becomes 2rem (32px). The main heading switches from display to heading size below 70rem. Body text uses 1.6 line height; major headings use 1.02–1.1. Tracking is natural for interface text, and slightly tight for large headings (`-0.055em` on the wide hero, `-0.045em` on mobile). Weights are 400, 600, and 700. Numbers use `font-variant-numeric: tabular-nums`. Keycaps use the body family rather than an additional monospace font.

Headings use balanced wrapping, descriptions use pretty wrapping, and longer explanation copy has a character-based maximum width. Status labels use the literal ACTIVE/IDLE casing required by the brief; surrounding copy is sentence case. The display headline is four words. Instructions sit beside controls.

## Layout

`.page-shell` is centered with a 1328px outer maximum and 48px inline padding. The spacing vocabulary is a 4px base: the declared `--space-*` tokens cover 4, 8, 12, 16, 24, 32, and 48px; existing component rules also use corresponding literal values and intermediate multiples such as 20, 28, 40, and 56px.

The game stage is a vertical flex layout. The HUD and ready/result content remain in normal flow, while the decorative Canvas is absolute behind them. Stage heights use rem-based minimums, and text can make the stage taller. `.hud-stats` is an adaptive grid with `min-width: 0`, allowing scores to reflow instead of forcing horizontal overflow. The header and live metrics also wrap. At 200% root text size on a 390px viewport, content grows vertically, the start action stays inside the stage, and horizontal overflow remains zero. Native browser zoom was not tested.

| Breakpoint | Implemented adaptation |
| --- | --- |
| Above 70rem | 48px page gutters, 64px headline, wide cave composition |
| Up to 70rem | 32px gutters, 40px headline, smaller stage minimum |
| Up to 53rem | Tighter live metrics/explanation gaps; RPM mini-meter hidden; footer wraps |
| Up to 40rem | 16px gutters, centered ready copy, touch buttons, stacked live section and explanations, icon-only utilities with accessible names |
| Up to 22rem | 12px gutters, 32px headline, smaller brand/HUD type and tighter spacing |

The first 390px screen contains the product and Start running. The secondary explanations remain below it. The canvas uses a uniform scale and anchors the illustrated scene to the stage bottom; tall text layouts leave quiet sky above the artwork rather than stretching the hamster. Gameplay uses logical coordinates and a capped device-pixel ratio of 2.

This is one page with no routing layer. Layout checks covered the listed widths, root text enlargement, and touch emulation; localization, RTL, and physical device layouts were not validated.

## Elevation & Depth

The interface has no box shadows or card grid. A one-pixel border outlines the game, and thin separators divide the controls, live strip, and footer. The cave gets its depth from three independently scrolling rock layers and tonal silhouettes. Text remains HTML above the Canvas.

The HUD uses stacking level 2, pause/result content 3, and the settlement notice 4. The native modal dialog provides the top layer and dimmed backdrop. Decorative layers do not intercept pointer input.

## Shapes

The game has a 16px outer radius, reduced to 12px on phones; the Canvas corners are inset by the one-pixel border. Primary buttons have 9px corners. Utility buttons and touch controls use 8px. Keycaps use 5px; the live activity icon uses 12px; status dots are circular. Icons are original, consistent outline SVGs using `currentColor`, generally a 1.7px stroke. The play symbol is filled.

## Components and states

| Pattern | Source | Behavior |
| --- | --- | --- |
| Identity and utilities | `index.html`, `.brand`, `.utilities` | Brand at the leading edge; help and sound at the trailing edge; wrapping at enlarged text |
| Primary action | `.primary-button`, `src/app.ts` | Filled amber; Start running, Resume run, or Run again according to phase; darker text and brighter hover |
| Utility action | `.utility-button`, `.icon-button` | Neutral background on hover; explicit accessible names for icon-only controls |
| Keyboard focus | `:focus-visible` | 3px amber outline with 5px offset; Canvas uses a 2px inset outline; system highlight in forced-colors mode |
| HUD | `.hud`, `.hud-stats`, `hud()` | Score/Best/Mult, stable-width digits; updates are not continuously announced |
| Ready and result panels | `.intro`, `.run-overlay`, `renderPhase()` | Ready, running, paused, and game-over states; semantic HTML controls and results |
| Touch/keyboard controls | `.game-controls`, `.control-button` | Native buttons plus keyboard shortcuts; controls unavailable outside a run are truly disabled |
| Live status | `.chain-strip`, `.live-badge`, `updateReading()` | Connecting, ACTIVE, IDLE, and Offline; values never invented; automatic recovery explained next to the status |
| Settlement notice | `.quake-notice`, `settle()` | Harmless debris and restrained 1.2-second quake, plus a 2.5-second text cue; no collision effect |
| Help | Native `dialog`, `#help-dialog` | Modal background behavior, Escape dismissal, focus return, keyboard/touch instructions, and Reduce effects checkbox |
| Sound | `GameAudio`, `#sound-button` | Muted initially; Web Audio starts only after the user enables it; pressed state and name reflect the setting |
| Accessible status | `#announcer` | Polite announcements for state changes and results, not every frame or poll |

Typical action targets are at least 44px high; the primary action is at least 52px in practice. Neutral hover transitions are 150ms on the background color. Press feedback uses `scale(0.96)` only when reduced motion is not requested. There is no continuous ready-screen animation. System reduced motion and the manual Reduce effects setting suppress parallax, screen shake, and debris; essential user-started gameplay remains animated. A run automatically pauses when the page is hidden or the window loses focus.

## Do's and don'ts

- Start with the existing `.page-shell`, semantic text tokens, and button patterns. Keep the game and its primary action ahead of supporting copy.
- Use one filled primary action in a state. Give utility controls accessible names when their visible text is hidden on mobile.
- Keep ready/result content in normal flow so text enlargement works. Decorative Canvas artwork may sit behind it, but its colors must be measured where text crosses it.
- Keep fonts, icons, and artwork local. New illustrations should use the existing cave/hamster palette and respect the quiet text region.
- Preserve the ACTIVE/IDLE/Offline distinction, confirmed-round semantics, and clearly local scores. Do not turn an unavailable feed into fabricated live data.
- Do not add a wallet, shared leaderboard, token-reward claim, or extra font to this game.
- If a related page is needed later, reuse this shell, flat surface system, and native controls; choose static export paths explicitly and keep asset URLs relative. Additional pages are not implemented here.

Review evidence and remaining accessibility/browser limitations are in `artifacts/validation.md`. Attribution for the pinned guidance is in `NOTICE.md`.
