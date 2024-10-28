import { useAppKitTheme } from '@reown/appkit/vue';
import { defineStore } from 'pinia';
import { onMounted, ref, watch } from 'vue';

export type ThemeMode = 'Dark Theme' | 'Light Theme' | 'System Mode';

export const themes: ThemeMode[] = ['Dark Theme', 'Light Theme', 'System Mode'];

const isThemeMode = (value: any): value is ThemeMode => themes.includes(value);

const getHtml = () => document.querySelector('html')!;

export const useThemeStore = defineStore('theme', () => {
  const icon = ref<ThemeMode>('Dark Theme');
  const isDisplayDark = ref(false);
  const mode = ref<ThemeMode>('System Mode');
  const { setThemeMode: setWalletConnectTheme } = useAppKitTheme();

  const css = () => {
    if (mode.value == 'Dark Theme') {
      getHtml().classList.add('dark');
    } else if (mode.value == 'Light Theme') {
      getHtml().classList.remove('dark');
    } else if (
      window.matchMedia &&
      window.matchMedia('(prefers-color-scheme: dark)').matches
    ) {
      getHtml().classList.add('dark');
    } else {
      getHtml().classList.remove('dark');
    }

    icon.value = getHtml().classList.contains('dark')
      ? 'Light Theme'
      : 'Dark Theme';
    isDisplayDark.value = getHtml().classList.contains('dark');
  };

  const isSystemDark = () =>
    window.matchMedia &&
    window.matchMedia('(prefers-color-scheme: dark)').matches;

  const set = (value: ThemeMode) => {
    mode.value = value;
    localStorage.setItem('chainbills::theme', value);
    css();
  };

  onMounted(() => {
    const saved = localStorage.getItem('chainbills::theme');
    if (saved && isThemeMode(saved)) mode.value = saved;

    css();

    window
      .matchMedia('(prefers-color-scheme: dark)')
      .addEventListener('change', () => {
        if (mode.value == 'System Mode') css();
      });

    setWalletConnectTheme(isDisplayDark.value ? 'dark' : 'light');
    watch(
      () => isDisplayDark.value,
      (yes) => setWalletConnectTheme(yes ? 'dark' : 'light')
    );

    window.addEventListener('storage', () => {
      const saved = localStorage.getItem('chainbills::theme');
      if (saved && isThemeMode(saved)) {
        mode.value = saved;
        css();
      }
    });
  });

  return { icon, isDisplayDark, isSystemDark, mode, set };
});
