export function ThemeScript() {
  const script = `
    (function() {
      try {
        var stored = localStorage.getItem('theme-preference');
        var theme = stored || (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
        document.documentElement.setAttribute('data-theme', theme);
        document.documentElement.classList.add('no-transitions');
      } catch (e) {}
    })();
  `;

  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
