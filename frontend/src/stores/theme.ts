import { defineStore } from 'pinia';
import { onMounted, ref } from 'vue';

export type ThemeMode = 'Dark Theme' | 'Light Theme' | 'System Mode';

export const themes: ThemeMode[] = ['Dark Theme', 'Light Theme', 'System Mode'];

const isThemeMode = (value: any): value is ThemeMode => themes.includes(value);

export const useThemeStore = defineStore('theme', () => {
  const icon = ref<ThemeMode>('Dark Theme');
  const mode = ref<ThemeMode>('System Mode');

  const css = () => {
    if (mode.value == 'Dark Theme') {
      document.body.classList.add('dark');
    } else if (mode.value == 'Light Theme') {
      document.body.classList.remove('dark');
    } else if (
      window.matchMedia &&
      window.matchMedia('(prefers-color-scheme: dark)').matches
    ) {
      document.body.classList.add('dark');
    } else {
      document.body.classList.remove('dark');
    }

    icon.value = document.body.classList.contains('dark')
      ? 'Light Theme'
      : 'Dark Theme';
  };

  const isSystemDark = () =>
    window.matchMedia &&
    window.matchMedia('(prefers-color-scheme: dark)').matches;

  const set = (value: ThemeMode) => {
    mode.value = value;
    localStorage.setItem('theme', value);
    css();
  };

  onMounted(() => {
    const saved = localStorage.getItem('theme');
    if (saved && isThemeMode(saved)) mode.value = saved;

    css();

    window
      .matchMedia('(prefers-color-scheme: dark)')
      .addEventListener('change', () => {
        if (mode.value == 'System Mode') css();
      });
  });

  return { icon, mode, isSystemDark, set };
});
