import { useAppKitTheme } from '@reown/appkit/vue';
import { defineStore } from 'pinia';
import { onMounted, ref, watch } from 'vue';
import { useAnalyticsStore } from './analytics';

export type ThemeMode = 'Dark Theme' | 'Light Theme' | 'System Mode';

export const themes: ThemeMode[] = ['Dark Theme', 'Light Theme', 'System Mode'];

const isThemeMode = (value: any): value is ThemeMode => themes.includes(value);

const getHtml = () => document.querySelector('html')!;

/** Runs `apply` (a synchronous DOM mutation) inside `document.startViewTransition`
 *  when the browser supports it, which cross-fades the old and new pixels over
 *  the 240ms `::view-transition-old/new(root)` duration set in `main.css`.
 *  Falls back to calling `apply` directly on unsupported browsers, and skips
 *  the transition under `prefers-reduced-motion: reduce` so the theme swap is
 *  instant rather than animated for users who asked for less motion. */
const withViewTransition = (apply: () => void) => {
  const reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const supportsViewTransition = typeof document.startViewTransition === 'function';
  if (reducedMotion || !supportsViewTransition) {
    apply();
  } else {
    document.startViewTransition(apply);
  }
};

export const useThemeStore = defineStore('theme', () => {
  const analytics = useAnalyticsStore();
  const icon = ref<ThemeMode>('Dark Theme');
  const isDisplayDark = ref(false);
  const mode = ref<ThemeMode>('System Mode');
  const { setThemeMode: setWalletConnectTheme } = useAppKitTheme();

  const css = () => {
    if (mode.value == 'Dark Theme') {
      getHtml().classList.add('dark');
    } else if (mode.value == 'Light Theme') {
      getHtml().classList.remove('dark');
    } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      getHtml().classList.add('dark');
    } else {
      getHtml().classList.remove('dark');
    }

    icon.value = getHtml().classList.contains('dark') ? 'Light Theme' : 'Dark Theme';
    isDisplayDark.value = getHtml().classList.contains('dark');
  };

  const isSystemDark = () => window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;

  const set = (value: ThemeMode) => {
    mode.value = value;
    localStorage.setItem('chainbills::theme', value);
    withViewTransition(css);
  };

  onMounted(() => {
    const saved = localStorage.getItem('chainbills::theme');
    if (saved && isThemeMode(saved)) mode.value = saved;

    css();

    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (mode.value == 'System Mode') withViewTransition(css);
    });

    setWalletConnectTheme(isDisplayDark.value ? 'dark' : 'light');
    watch(
      () => isDisplayDark.value,
      (yes) => setWalletConnectTheme(yes ? 'dark' : 'light')
    );
    watch(
      () => mode.value,
      (value) => {
        analytics.recordEvent('changed_app_theme', {
          theme: value.split(' ')[0],
        });
      }
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
