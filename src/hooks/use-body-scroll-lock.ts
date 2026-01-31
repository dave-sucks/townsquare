"use client";

import { useEffect, useRef } from "react";

/**
 * Hook to lock body scroll when the bottom sheet is open.
 * Handles iOS Safari rubber-banding by using overflow hidden and touch-action.
 */
export function useBodyScrollLock(isLocked: boolean) {
  const scrollPositionRef = useRef(0);

  useEffect(() => {
    if (!isLocked) return;

    // Store current scroll position
    scrollPositionRef.current = window.scrollY;

    // Apply scroll lock styles
    const originalStyles = {
      overflow: document.body.style.overflow,
      position: document.body.style.position,
      top: document.body.style.top,
      left: document.body.style.left,
      right: document.body.style.right,
      touchAction: document.body.style.touchAction,
    };

    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollPositionRef.current}px`;
    document.body.style.left = "0";
    document.body.style.right = "0";
    document.body.style.touchAction = "none";

    // Also prevent scroll on document element for iOS
    const htmlEl = document.documentElement;
    const originalHtmlStyles = {
      overflow: htmlEl.style.overflow,
    };
    htmlEl.style.overflow = "hidden";

    return () => {
      // Restore original styles
      document.body.style.overflow = originalStyles.overflow;
      document.body.style.position = originalStyles.position;
      document.body.style.top = originalStyles.top;
      document.body.style.left = originalStyles.left;
      document.body.style.right = originalStyles.right;
      document.body.style.touchAction = originalStyles.touchAction;

      htmlEl.style.overflow = originalHtmlStyles.overflow;

      // Restore scroll position
      window.scrollTo(0, scrollPositionRef.current);
    };
  }, [isLocked]);
}
