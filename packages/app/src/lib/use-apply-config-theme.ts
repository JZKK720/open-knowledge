import { useTheme } from 'next-themes';
import { useEffect } from 'react';

export function useApplyConfigTheme(themeValue: string | undefined): void {
  const { setTheme } = useTheme();
  // biome-ignore lint/correctness/useExhaustiveDependencies: setTheme excluded by design — re-adding it re-fires on every cross-window theme flip and storms every window (see STORM GUARD above).
  useEffect(() => {
    if (themeValue === 'light' || themeValue === 'dark' || themeValue === 'system') {
      setTheme(themeValue);
    }
  }, [themeValue]);
}
