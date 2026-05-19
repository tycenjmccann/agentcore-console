# Theme System Documentation

## Overview
The AgentCore Console uses a CSS custom property-based theme system that supports light and dark modes with seamless transitions.

## Architecture

### Components

1. **ThemeProvider** (`src/components/theme-provider.tsx`)
   - React Context provider for theme state management
   - Handles localStorage persistence
   - Prevents flash of unstyled content (FOUC)

2. **ThemeToggle** (`src/components/layout/ThemeToggle.tsx`)
   - Interactive button component in the header
   - Accessible with keyboard navigation (Enter/Space)
   - Smooth icon transitions with animations

3. **Theme Utilities** (`src/lib/theme.ts`)
   - `getInitialTheme()`: Determines initial theme preference
   - `useTheme()`: Custom hook for accessing theme context
   - Type definitions for theme values

### Theme Detection Logic

The theme is determined in this order:
1. **localStorage**: Check for saved user preference
2. **System Preference**: Respect `prefers-color-scheme` media query
3. **Default**: Fall back to dark mode

## CSS Variables

All theme-aware colors are defined as CSS custom properties in `src/styles/globals.css`:

### Usage Example
```css
.my-component {
  background-color: var(--color-surface-2);
  color: var(--color-text-primary);
  border-color: var(--color-border);
}
```

### Available Variables

#### Background & Surfaces
- `--color-background`: Main background color
- `--color-foreground`: Main foreground color
- `--color-surface-0` to `--color-surface-4`: Layered surface colors

#### Text Colors
- `--color-text-primary`: Primary text
- `--color-text-secondary`: Secondary text
- `--color-text-muted`: Muted/disabled text

#### Borders
- `--color-border`: Default border color
- `--color-border-hover`: Border color on hover

#### Brand Colors
- `--color-brand-50` to `--color-brand-900`: Brand color scale (constant across themes)

## Using the Theme in Components

### Client Component Example
```tsx
"use client";

import { useTheme } from "@/lib/theme";

export function MyComponent() {
  const { theme, setTheme, toggleTheme } = useTheme();
  
  return (
    <div className="bg-surface-1 text-[var(--color-text-primary)]">
      Current theme: {theme}
      <button onClick={toggleTheme}>Toggle</button>
    </div>
  );
}
```

### Using Tailwind Classes
For Tailwind CSS, use the custom surface colors:
```tsx
<div className="bg-surface-2 border border-surface-4">
  Content
</div>
```

For other colors, use CSS variables:
```tsx
<p className="text-[var(--color-text-secondary)]">
  Secondary text
</p>
```

## Accessibility

The theme toggle includes:
- **ARIA Labels**: Clear labels for screen readers
- **Keyboard Navigation**: Full keyboard support (Tab, Enter, Space)
- **Focus Indicators**: Visible focus rings
- **Role**: Proper `role="switch"` with `aria-checked`

## FOUC Prevention

The layout includes an inline script that applies the theme before React hydrates:

```html
<script>
  (function() {
    var theme = localStorage.getItem('theme') || 
                (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
    document.documentElement.setAttribute('data-theme', theme);
  })();
</script>
```

## Extending the Theme

### Adding New Colors

1. Add to `src/styles/globals.css`:
```css
:root {
  --color-my-new-color: #value-for-light;
}

[data-theme="dark"] {
  --color-my-new-color: #value-for-dark;
}
```

2. Optionally add to Tailwind config:
```js
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        'my-new': 'var(--color-my-new-color)',
      },
    },
  },
};
```

### Adding New Themes

To add more themes (e.g., "high-contrast"):

1. Update the `Theme` type in `src/lib/theme.ts`:
```typescript
export type Theme = "light" | "dark" | "high-contrast";
```

2. Add CSS variables for the new theme:
```css
[data-theme="high-contrast"] {
  --color-background: #000000;
  --color-text-primary: #ffffff;
  /* ... */
}
```

3. Update the toggle logic in `ThemeToggle.tsx` for multiple themes

## Testing

### Manual Testing Checklist
- [ ] Toggle switches between light and dark
- [ ] Theme persists on page reload
- [ ] No FOUC on initial page load
- [ ] Keyboard navigation works (Tab to toggle, Enter/Space to activate)
- [ ] Screen reader announces theme changes
- [ ] All components respect theme colors
- [ ] System preference is respected when no saved preference exists

### Browser Testing
Test on:
- Chrome/Edge (Chromium)
- Firefox
- Safari

## Performance Considerations

- Theme transitions use CSS properties for GPU acceleration
- localStorage access is minimal and non-blocking
- Theme provider prevents unnecessary re-renders
- CSS custom properties enable instant theme switching without JavaScript

## Troubleshooting

### Theme Not Persisting
- Check browser localStorage is enabled
- Verify `localStorage.setItem` is not blocked

### FOUC Still Occurring
- Ensure inline script in layout.tsx runs before hydration
- Check that `suppressHydrationWarning` is on `<html>` tag

### Colors Not Updating
- Verify CSS variables are used instead of hardcoded colors
- Check that `data-theme` attribute is set on document element
- Ensure CSS transitions don't interfere

## Best Practices

1. **Always use CSS variables** for theme-aware colors
2. **Test in both themes** during development
3. **Avoid hardcoding colors** that should change with theme
4. **Use semantic color names** (surface, text, border) not absolute (gray-200)
5. **Respect user preferences** (don't force a theme)

## Future Enhancements

- [ ] Add system theme change listener
- [ ] Add theme preview/selector with all themes
- [ ] Add per-component theme overrides
- [ ] Add theme export/import for custom themes
- [ ] Add theme analytics tracking

---

**Last Updated**: 2025-01-19  
**Maintainer**: Frontend Team
