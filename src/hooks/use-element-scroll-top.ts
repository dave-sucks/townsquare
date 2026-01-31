"use client";

import { useState, useCallback, type RefObject } from "react";

/**
 * Hook to track whether an element's scroll position is at the top.
 * Used to determine when to switch from scrolling content to dragging the sheet.
 */
export function useElementScrollTop(ref: RefObject<HTMLElement | null>) {
  const [isAtTop, setIsAtTop] = useState(true);

  const handleScroll = useCallback(() => {
    if (ref.current) {
      // Consider "at top" if scroll position is within 1px (for sub-pixel rendering)
      setIsAtTop(ref.current.scrollTop <= 1);
    }
  }, [ref]);

  const getScrollTop = useCallback(() => {
    return ref.current?.scrollTop ?? 0;
  }, [ref]);

  return { isAtTop, handleScroll, getScrollTop };
}
