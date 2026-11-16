/* Theme toggle: the grey dot in the corner switches light/dark. */
const THEME_KEY = 'theme';
const root = document.documentElement;
const toggle = document.getElementById('themeToggle');

function readSavedTheme() {
  try {
    return localStorage.getItem(THEME_KEY);
  } catch (err) {
    console.warn('Could not read saved theme:', err);
    return null;
  }
}

function saveTheme(theme) {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch (err) {
    console.warn('Could not save theme:', err);
  }
}

function applyTheme(theme) {
  root.dataset.theme = theme;
}

applyTheme(readSavedTheme() || 'light');

toggle.addEventListener('click', () => {
  const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  saveTheme(next);
});
