import { useEffect } from 'react';
import { useEventStore } from '../store';

export const useThemeSync = (): void => {
  const activeTheme = useEventStore((state) => state.activeTheme);

  useEffect(() => {
    if (activeTheme) {
      document.documentElement.setAttribute('data-theme', activeTheme);
    }
  }, [activeTheme]);
};