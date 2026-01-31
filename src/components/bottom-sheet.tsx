"use client";

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  type ReactNode,
  type TouchEvent,
  type MouseEvent,
} from "react";
import { motion, useMotionValue, useTransform, animate, type PanInfo } from "framer-motion";
import { useBodyScrollLock } from "@/hooks/use-body-scroll-lock";
import { useElementScrollTop } from "@/hooks/use-element-scroll-top";

// Snap points as percentages of viewport height (from bottom)
const SNAP_POINTS = {
  COLLAPSED: 56, // Just the grabber visible (in pixels)
  MID: 0.3, // 30% of viewport
  EXPANDED: 0.9, // 90% of viewport
};

// Velocity threshold for flicking to next snap point
const VELOCITY_THRESHOLD = 500;

// Distance threshold for snap decision when velocity is low
const DISTANCE_THRESHOLD = 50;

export type SnapPoint = "collapsed" | "mid" | "expanded";

interface BottomSheetProps {
  children: ReactNode;
  header?: ReactNode;
  defaultSnapPoint?: SnapPoint;
  onSnapPointChange?: (snapPoint: SnapPoint) => void;
}

/**
 * Production-quality bottom sheet with:
 * - Three snap points (collapsed, mid, expanded)
 * - Smooth drag with velocity-based snapping
 * - Proper drag vs scroll handoff
 * - Prevents map from receiving touch events
 * - Body scroll lock when mid/expanded
 * - Safe area handling for iPhone notch
 * - Backdrop when expanded
 */
export function BottomSheet({
  children,
  header,
  defaultSnapPoint = "mid",
  onSnapPointChange,
}: BottomSheetProps) {
  const [snapPoint, setSnapPoint] = useState<SnapPoint>(defaultSnapPoint);
  const [isDragging, setIsDragging] = useState(false);
  const [viewportHeight, setViewportHeight] = useState(0);
  
  const contentRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef(0);
  const dragStartSheetY = useRef(0);
  const isDraggingSheet = useRef(false);
  const isScrolling = useRef(false);

  const { isAtTop, handleScroll, getScrollTop } = useElementScrollTop(contentRef);

  // Calculate snap point heights in pixels
  const getSnapHeight = useCallback(
    (point: SnapPoint): number => {
      switch (point) {
        case "collapsed":
          return SNAP_POINTS.COLLAPSED;
        case "mid":
          return viewportHeight * SNAP_POINTS.MID;
        case "expanded":
          return viewportHeight * SNAP_POINTS.EXPANDED;
      }
    },
    [viewportHeight]
  );

  // Motion value for sheet height (y position from bottom)
  const sheetHeight = useMotionValue(0);
  
  // Transform for backdrop opacity (only show when approaching expanded)
  const backdropOpacity = useTransform(sheetHeight, (height) => {
    const expandedHeight = getSnapHeight("expanded");
    const midHeight = getSnapHeight("mid");
    if (height <= midHeight) return 0;
    const progress = (height - midHeight) / (expandedHeight - midHeight);
    return Math.min(progress * 0.5, 0.5);
  });

  // Lock body scroll when sheet is above collapsed
  useBodyScrollLock(snapPoint !== "collapsed");

  // Update viewport height on mount and resize
  useEffect(() => {
    const updateViewportHeight = () => {
      // Use visualViewport for accurate height on mobile
      const vh = window.visualViewport?.height ?? window.innerHeight;
      setViewportHeight(vh);
    };

    updateViewportHeight();
    window.addEventListener("resize", updateViewportHeight);
    window.visualViewport?.addEventListener("resize", updateViewportHeight);

    return () => {
      window.removeEventListener("resize", updateViewportHeight);
      window.visualViewport?.removeEventListener("resize", updateViewportHeight);
    };
  }, []);

  // Set initial height based on default snap point
  useEffect(() => {
    if (viewportHeight > 0) {
      sheetHeight.set(getSnapHeight(defaultSnapPoint));
    }
  }, [viewportHeight, defaultSnapPoint, getSnapHeight, sheetHeight]);

  // Find nearest snap point based on current height and velocity
  const findNearestSnapPoint = useCallback(
    (currentHeight: number, velocity: number): SnapPoint => {
      const collapsed = getSnapHeight("collapsed");
      const mid = getSnapHeight("mid");
      const expanded = getSnapHeight("expanded");

      // High velocity flick up
      if (velocity < -VELOCITY_THRESHOLD) {
        if (currentHeight < mid) return "mid";
        return "expanded";
      }

      // High velocity flick down
      if (velocity > VELOCITY_THRESHOLD) {
        if (currentHeight > mid) return "mid";
        return "collapsed";
      }

      // Low velocity: snap to nearest
      const distances = [
        { point: "collapsed" as SnapPoint, dist: Math.abs(currentHeight - collapsed) },
        { point: "mid" as SnapPoint, dist: Math.abs(currentHeight - mid) },
        { point: "expanded" as SnapPoint, dist: Math.abs(currentHeight - expanded) },
      ];

      distances.sort((a, b) => a.dist - b.dist);
      return distances[0].point;
    },
    [getSnapHeight]
  );

  // Animate to a snap point
  const snapTo = useCallback(
    (point: SnapPoint) => {
      const targetHeight = getSnapHeight(point);
      animate(sheetHeight, targetHeight, {
        type: "spring",
        stiffness: 300,
        damping: 30,
        mass: 0.8,
      });
      setSnapPoint(point);
      onSnapPointChange?.(point);
    },
    [getSnapHeight, sheetHeight, onSnapPointChange]
  );

  // Handle touch/mouse start on grabber
  const handleGrabberPointerDown = useCallback(
    (clientY: number) => {
      isDraggingSheet.current = true;
      isScrolling.current = false;
      dragStartY.current = clientY;
      dragStartSheetY.current = sheetHeight.get();
      setIsDragging(true);
    },
    [sheetHeight]
  );

  // Handle touch/mouse start on content area
  const handleContentPointerDown = useCallback(
    (clientY: number) => {
      dragStartY.current = clientY;
      dragStartSheetY.current = sheetHeight.get();
      isDraggingSheet.current = false;
      isScrolling.current = false;
    },
    [sheetHeight]
  );

  // Handle pointer move (both grabber and content)
  const handlePointerMove = useCallback(
    (clientY: number) => {
      const deltaY = dragStartY.current - clientY;
      const scrollTop = getScrollTop();

      // If we're scrolling content and not at top, continue scrolling
      if (isScrolling.current && scrollTop > 1) {
        return;
      }

      // If content is at top and dragging down, start sheet drag
      if (!isDraggingSheet.current && scrollTop <= 1 && deltaY < 0) {
        isDraggingSheet.current = true;
        dragStartY.current = clientY;
        dragStartSheetY.current = sheetHeight.get();
        setIsDragging(true);
      }

      // If dragging sheet
      if (isDraggingSheet.current) {
        const newHeight = Math.max(
          SNAP_POINTS.COLLAPSED,
          Math.min(viewportHeight * SNAP_POINTS.EXPANDED, dragStartSheetY.current + deltaY)
        );
        sheetHeight.set(newHeight);
      } else if (Math.abs(deltaY) > 5) {
        // Started scrolling content
        isScrolling.current = true;
      }
    },
    [getScrollTop, sheetHeight, viewportHeight]
  );

  // Handle pointer end
  const handlePointerEnd = useCallback(
    (velocityY: number) => {
      if (isDraggingSheet.current) {
        const currentHeight = sheetHeight.get();
        const nearest = findNearestSnapPoint(currentHeight, velocityY);
        snapTo(nearest);
      }
      isDraggingSheet.current = false;
      isScrolling.current = false;
      setIsDragging(false);
    },
    [findNearestSnapPoint, sheetHeight, snapTo]
  );

  // Touch event handlers for grabber
  const onGrabberTouchStart = useCallback(
    (e: TouchEvent) => {
      e.stopPropagation();
      handleGrabberPointerDown(e.touches[0].clientY);
    },
    [handleGrabberPointerDown]
  );

  const onGrabberMouseDown = useCallback(
    (e: MouseEvent) => {
      e.stopPropagation();
      handleGrabberPointerDown(e.clientY);
    },
    [handleGrabberPointerDown]
  );

  // Touch event handlers for content
  const onContentTouchStart = useCallback(
    (e: TouchEvent) => {
      handleContentPointerDown(e.touches[0].clientY);
    },
    [handleContentPointerDown]
  );

  // Global move/end handlers
  useEffect(() => {
    if (!isDragging && !isScrolling.current) return;

    let lastClientY = 0;
    let lastTime = Date.now();
    let velocityY = 0;

    const handleTouchMove = (e: globalThis.TouchEvent) => {
      const currentY = e.touches[0].clientY;
      const currentTime = Date.now();
      const dt = currentTime - lastTime;

      if (dt > 0) {
        velocityY = ((lastClientY - currentY) / dt) * 1000; // pixels per second
      }

      lastClientY = currentY;
      lastTime = currentTime;

      handlePointerMove(currentY);

      // Prevent default only when dragging sheet to stop map pan
      if (isDraggingSheet.current) {
        e.preventDefault();
      }
    };

    const handleTouchEnd = () => {
      handlePointerEnd(-velocityY); // Invert because we track height, not position
    };

    const handleMouseMove = (e: globalThis.MouseEvent) => {
      const currentY = e.clientY;
      const currentTime = Date.now();
      const dt = currentTime - lastTime;

      if (dt > 0) {
        velocityY = ((lastClientY - currentY) / dt) * 1000;
      }

      lastClientY = currentY;
      lastTime = currentTime;

      handlePointerMove(currentY);
    };

    const handleMouseUp = () => {
      handlePointerEnd(-velocityY);
    };

    window.addEventListener("touchmove", handleTouchMove, { passive: false });
    window.addEventListener("touchend", handleTouchEnd);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, handlePointerMove, handlePointerEnd]);

  // Handle backdrop tap to snap to mid
  const handleBackdropClick = useCallback(() => {
    if (snapPoint === "expanded") {
      snapTo("mid");
    }
  }, [snapPoint, snapTo]);

  return (
    <>
      {/* Semi-transparent backdrop - only when approaching expanded */}
      <motion.div
        className="fixed inset-0 bg-black z-[49] md:hidden pointer-events-none"
        style={{ opacity: backdropOpacity }}
        onClick={handleBackdropClick}
        data-testid="bottom-sheet-backdrop"
      />

      {/* Bottom sheet container */}
      <motion.div
        ref={sheetRef}
        className="fixed left-0 right-0 bottom-0 z-50 md:hidden bg-background rounded-t-2xl shadow-[0_-4px_20px_rgba(0,0,0,0.15)] flex flex-col touch-none"
        style={{
          height: sheetHeight,
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}
        data-testid="mobile-bottom-sheet"
      >
        {/* Grabber area - always draggable */}
        <div
          className="flex flex-col items-center pt-2 pb-1 shrink-0 cursor-grab active:cursor-grabbing select-none"
          onTouchStart={onGrabberTouchStart}
          onMouseDown={onGrabberMouseDown}
          data-testid="bottom-sheet-grabber"
        >
          <div className="w-10 h-1 bg-muted-foreground/30 rounded-full" />
        </div>

        {/* Optional header */}
        {header && (
          <div className="shrink-0 px-4 pb-2 border-b">
            {header}
          </div>
        )}

        {/* Scrollable content area */}
        <div
          ref={contentRef}
          className={`flex-1 overflow-y-auto overscroll-contain ${
            snapPoint === "expanded" ? "" : "overflow-hidden"
          }`}
          onScroll={handleScroll}
          onTouchStart={onContentTouchStart}
          style={{
            touchAction: snapPoint === "expanded" ? "pan-y" : "none",
          }}
          data-testid="bottom-sheet-content"
        >
          {children}
        </div>
      </motion.div>
    </>
  );
}
