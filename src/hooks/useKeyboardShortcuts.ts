import { useEffect } from 'react';

interface Shortcut {
  key: string;
  metaKey?: boolean;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  callback: () => void;
  description: string;
}

export const useKeyboardShortcuts = (shortcuts: Shortcut[]) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        if (e.key === 'Escape') {
          // Allow Escape even in inputs
        } else {
          return;
        }
      }

      for (const shortcut of shortcuts) {
        const metaMatch = shortcut.metaKey ? (e.metaKey || e.ctrlKey) : true;
        const shiftMatch = shortcut.shiftKey ? e.shiftKey : !e.shiftKey;
        const keyMatch = e.key.toLowerCase() === shortcut.key.toLowerCase();

        if (metaMatch && shiftMatch && keyMatch) {
          // For meta shortcuts, require meta key
          if (shortcut.metaKey && !(e.metaKey || e.ctrlKey)) continue;
          // For non-meta shortcuts, don't trigger when meta is pressed
          if (!shortcut.metaKey && (e.metaKey || e.ctrlKey)) continue;
          
          e.preventDefault();
          shortcut.callback();
          return;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts]);
};

export type { Shortcut };
