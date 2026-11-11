# Spark Design Reference

> The Spark house brand reference, maintained in this repository and reviewed on 2026-11-11. It covers product UI, social banners, promotional art and generated images. This reference constrains visual expression only. Product requirements, real content, working behavior, architecture, permissions and accessibility remain authoritative. It does not grant tools or authorize changes. The literal values in `tokens.css` are the source of truth; this document explains their roles and adds the brand values the token contract has no slot for. Use the wordmark, mascots and character art the user supplies. Never invent a logo, and never reuse a wordmark from a reference image.

## 1. Scope and intent

Best for: AI character and story products, Thai-language social banners, top-up and sale promotions, feature announcements, creator and fan community pages. Avoid for: dense enterprise dashboards, print-first editorial layouts, or anything that needs a light, conservative look.

Spark has two registers that share one palette. The product register is quiet: a near-black canvas, flat neutral surfaces, white text, and the brand gradient used once or twice per view. The campaign register is loud: deep indigo fields, glowing violet light, holographic lettering, crystals and sparkles. Decide which register the brief needs before composing. An announcement of a product feature sits between the two: the product canvas with one glowing UI mock and a gradient headline word.

An already selected but unapplied reference does not authorize a restyle; follow the host's existing application and Design contract.

## 2. Visual identity and material

The signature is the three-stop pastel gradient, pink to lavender to sky blue: `linear-gradient(90deg, #ffc8f9 0%, #b29fff 48.74%, #94e0ff 100%)`. The stops are fixed. Do not reorder them, add stops, or shift them toward saturated neon. `--accent` is the middle lavender stop and stands in wherever a single flat color is required.

Where the gradient belongs:

- The fill of the one primary call to action in a view, as a pill, with `--accent-on` text.
- One word or phrase in a headline, applied as clipped text. The rest of the headline stays `--fg`.
- A 1px to 2px border around the hero object: a featured card, an avatar ring, a search-style pill on a banner. The interior stays an opaque dark fill so the border does not bleed through.
- A soft aura flanking a gradient control: `-2px 0 8px #ffc8f973, 2px 0 8px #94e0ff73`, pink on the left and blue on the right.

Where it does not belong: body text, large background washes behind reading text, every card in a grid, icons that are not selected, or semantic state. If three things in one view carry the gradient, remove one.

The canvas is cool and nearly black. Surfaces step up by lightness, not by hue. Decoration comes from light: a low-opacity violet radial glow behind the focal object, a faint dotted or sparkle field, and four-point sparkle stars in white, pink or sky blue placed at the corners of the focal object. Keep sparkles to three or fewer per composition.

## 3. Foundations

- `--bg` is the page or artboard field. `--surface` is the canonical opaque card and control layer. `--surface-warm` is the indigo campaign panel, used for promotional blocks and banner fields, not for ordinary product cards. Transparent or blurred effects always keep an opaque fallback.
- `--fg`, `--fg-2`, `--muted` and `--meta` form the information hierarchy. `--meta` is a muted periwinkle reserved for small labels such as counts, handles and timestamps. Check contrast over the rendered surface, and never place essential text directly over character art without a dark scrim.
- `--accent`, `--accent-on`, `--accent-hover` and `--accent-active` are the flat action sequence, used when the gradient is unavailable or already spent. The secondary button is a neutral pill: `--surface` fill, `--border` edge, `--fg` text. A light pill with `--accent-on` text is allowed once for a quiet follow-style action.
- `--success`, `--warn` and `--danger` mark real state only, with a text or shape cue beside the color. They are tuned to read as text on dark fills.
- `--font-display` is Noto Sans Thai, for headlines in Thai and English. `--font-body` is DM Sans with a Thai fallback, for controls and reading text. `--font-mono` serves code and aligned values. Both families are open-licensed web fonts; load them when the project can, and rely on the declared fallback stacks when it cannot.
- Use `--text-xs` through `--text-4xl` as one ladder. Headlines use `--leading-tight` and `--tracking-display`. Thai needs vertical room for stacked vowels and tone marks: never set a Thai headline tighter than `--leading-tight`, never clip it with a fixed-height box, and do not add negative letter spacing beyond the token.
- Repeat `--space-1` through `--space-12` for gaps. `--radius-sm` is for chips and small tiles, `--radius-md` for inputs and menu rows, `--radius-lg` for cards and panels, `--radius-pill` for buttons, tags and search pills. Large hero frames on banners may go to 24px.
- Default to `--elev-flat`. `--elev-ring` outlines a neutral card; `--elev-raised` lifts menus, sheets and the floating UI mock on an announcement. Glow is decoration and never the only cue for selected, disabled or focused.

Campaign palette. These literals extend the tokens for banner and promotional art only:

- Indigo field: `#191037` at the center falling to `#0f0b23` at the edges, with a violet glow of `#442e77` to `#7c5da9` behind the headline.
- Pastel lights: lilac `#c5b6dd`, ice blue `#cce7fa`, soft pink `#e4bee2`. Use them for crystal facets, light tiles and large numerals.
- Hot pink `#ff4fa3` for small bonus and percent badges and for one sticker word. It never fills a button or a large area.
- Light price tile: ice-blue fill `#dbeafb`, a 2px `#8fb4ee` edge, dark label plate `#2e2e3a` with white text, price in `#3f6fd8`.

## 4. Composition and responsive behavior

Product pages and feature announcements: one focal object, centered or left-aligned, with generous dark space around it. Headline first, a short tag pill above it if the brief has a category, the focal UI mock below, and the call-to-action pill at the bottom right or under the headline. Supporting cards are flat and quiet so the gradient object reads at a glance.

Banners and promotional art, by artboard shape:

- Wide strip, around 6:1. Three beats on one baseline: sticker title at the left third, the offer line in white in the middle, the big number in pastel gradient at the right. Crystals sit at the far corners, partly cropped and slightly blurred. Nothing else.
- Cover, around 8:3. Text block in the left 40 percent over a dark gradient scrim that fades to transparent; character art fills the right 60 percent and may bleed off the edge. Headline in bold white, an English tagline below in a lighter italic weight, then a gradient-bordered pill.
- Square, 1:1. Brand mark top left at small size. Title lockup in the top third, the grid or rules panel in the middle, dates in a dark pill at the bottom. A mascot may overlap the bottom-left corner of the grid.

Keep a safe margin of at least 4 percent of the short side on every artboard. One headline, one number, one action. If the brief supplies more copy than the shape holds, shrink the supporting copy and keep the headline large.

Use `--container-max` with `--container-gutter-desktop`, `--container-gutter-tablet` and `--container-gutter-phone` for pages. Major regions follow `--section-y-desktop`, `--section-y-tablet` and `--section-y-phone`; compact controls use the ordinary spacing scale. Recompose at narrow widths instead of shrinking a fixed canvas: keep the primary action and reading order, stack the text block above the art, and constrain media within the viewport. Test long Thai and English labels at intermediate widths. Cropped crystals and bleeding art must never create horizontal scrolling.

## 5. Components and interaction

- Primary button: gradient fill, `--radius-pill`, `--accent-on` text at medium weight, optional trailing arrow, optional aura. One per view. Hover lifts brightness slightly; pressed removes the aura; disabled drops to `--surface` with `--muted` text.
- Secondary button: neutral pill as described in the foundations. Tertiary actions are text in `--fg-2`.
- Tag pill: small, `--surface-warm` fill, lavender 1px edge, `--fg` text. Used above a headline to name the category.
- Hero card: `--surface` or `--surface-warm` interior, `--radius-lg` or 24px, 1px to 2px gradient border, a soft violet outer glow. Only the focal card gets this treatment.
- Menu and sheet: opaque dark panel, `--border-soft` edge, `--elev-raised`. Rows use `--radius-md`; the hovered or selected row lightens, and its trailing control may take the gradient.
- Icon tile: square with `--radius-md`, `--surface` fill, `--border-soft` edge, white glyph. An empty slot uses a dashed lavender edge.
- Avatar: circular with a gradient ring. Verified or status marks sit beside the name, not on the image.
- Rules or info panel on campaign art: dark translucent panel over the field with an opaque fallback, `--radius-lg`, a hairline light edge, and small lavender diamond bullets.
- Sticker title on campaign art: heavy italic display lettering with a holographic foil fill running pink, lilac and ice blue in diagonal bands, a thick dark outline, a thin white outer stroke and a slight tilt. Reserve it for the event name. A second line may use a flat hot pink fill.
- Big number: `--text-4xl` or larger on an artboard, pastel gradient fill from white to lilac, soft violet glow. Units and labels sit beside it at a third of the size.
- Bonus badge: small hot pink pill overlapping the top-left corner of a tile, white bold text.

Every action has explicit hover, pressed, focus, disabled and pending states. Use `--focus-ring` for a keyboard cue that stays visible over glow and gradient. Fields keep visible labels and entered values, with nearby validation and a recoverable error. Dialogs and menus use the project's accessible primitives, focus containment, Escape and focus restoration.

### Motion language

Motion is light passing over a surface: a single sheen sweep across a gradient control or sticker title, a slow drift of the background glow, a brief sparkle twinkle when something is earned. Use `--motion-fast` for control feedback, `--motion-base` for panels and reveals, and `--ease-standard` throughout, animating transform or opacity. Looping sheen and twinkle are optional, slow, and never carry meaning. Respect reduced motion by showing the final arrangement with a static gradient and immediate state feedback. Static artboards for export contain no motion.

## 6. Content, imagery and accessibility

Generated images follow the same palette. When writing a prompt for image generation, describe the subject first, then add the brand vocabulary that fits the register:

- Crystals and gems: faceted square or diamond-cut crystals with pastel pink, lilac and ice-blue faces, glossy with soft internal glow, slightly iridescent, on a deep indigo field. Piles and treasure chests of the same crystals express quantity.
- Character art: polished anime illustration, luminous eyes, hair shading that moves through pink, lavender and aqua, fine line work, pearlescent highlights, butterflies or glass ornaments as accents. Semi-realistic portraits are acceptable for themed events and take a violet color grade.
- Mascots: chibi proportion, thick clean outline, flat cel shading, a simple expressive face.
- Backgrounds: deep indigo to near-black, one violet light source behind the subject, soft bokeh, floating out-of-focus crystals or confetti near the corners, no busy scenery behind text.
- Holographic foil: diagonal bands of pink, lilac and ice blue with crisp white glints, used on lettering and stickers only.

Ask for no text, letters, numbers, logos or watermarks inside generated images, then set all copy in real HTML text over them so Thai renders correctly and stays editable. Leave the text side of the frame dark and empty in the prompt. Themed events may shift the mood, for example gothic violet for a horror event, while keeping the indigo field, the pastel lights and the layout rules.

Use the user's content and available evidence. Do not invent prices, bonus rates, dates, prizes, testimonials, follower counts or product capabilities to fill a layout; a missing value is shown as a clearly labeled gap. Product UI shown inside an announcement must match the real feature.

Copy is short and warm, in the language of the brief. Thai headlines read as natural spoken Thai, not translated English. Set Thai and Latin text in the same weight so mixed lines look even. Prices keep the currency sign beside the number.

Essential content and actions are available to keyboard, touch and assistive technology without hover or color as the only path. Keep semantic headings, landmarks, labels, status feedback and predictable focus order. Pastel text is for large display sizes on dark fields; small text is `--fg` or `--fg-2`. The catalog preview is an abstract style illustration, not product evidence.

## 7. Implementation checklist

- Root `tokens.css` is connected to the active runtime style entry and changed UI consumes the semantic roles.
- The register was chosen on purpose, and the gradient appears on at most two elements in a product view.
- Gradient stops match the fixed three-stop definition, and campaign literals are used only on campaign art.
- Thai headlines are unclipped, legible and set with enough line height; all copy is real text, not baked into a generated image.
- No wordmark, price, date or statistic was invented, and no mark was copied from a reference image.
- Responsive layout, long labels, keyboard, focus, contrast and reduced motion have been checked within the available verification environment.
- Report only checks actually run; local source review is not browser, device or deployed runtime evidence.
