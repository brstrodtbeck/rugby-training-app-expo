# Theme and design tokens

This folder holds the app’s theme (colors, typography, spacing) and themed styling utilities.

## Design tokens

Use these instead of magic numbers so the UI stays consistent.

### Typography scale

Import from `./colors` (or `../theme/colors` from screens/components):

- **`typography.fontSize`**: `caption` (11), `xs` (12), `sm` (13), `body` (14), `base` (16), `md` (18), `lg` (20), `xl` (22), `title` (24), `h2` (28), `h1` (32), `display` (48)
- **`FONTS`**: `regular`, `medium`, `semibold`, `bold`, `extrabold` (weights 400–800)

Use `typography.fontSize.body`, `typography.fontSize.title`, etc. for `fontSize`, and `FONTS.semibold` for `fontWeight`, instead of raw numbers.

### Spacing scale

Import from `./colors`:

- **`spacing`**: `xxs` (4), `xs` (6), `sm` (8), `md` (12), `base` (16), `lg` (20), `xl` (24), `xxl` (32), `xxxl` (40)

Use for `margin`, `padding`, and `gap` (e.g. `padding: spacing.md`, `marginBottom: spacing.base`).

## Theming

- **Colors** come from the active theme (see `themeDefinitions.ts` and `ThemeContext.tsx`). Use `useTheme()` or `useThemedStyles()` so components react to theme changes.
- Prefer **`useThemedStyles(theme => StyleSheet.create({ ... }))`** over the static `THEME` import so styles update when the user switches theme.
- **`SHADOWS`** and **`FONTS`** in `colors.ts` are shared style helpers.

## When touching screens or components

- Use **typography** and **spacing** for new or edited styles instead of magic numbers.
- Use **`useTheme()`** / **`useThemedStyles()`** for colors and any theme-dependent styles; avoid hardcoded hex colors.
