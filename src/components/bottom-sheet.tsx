"use client";

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  type ReactNode,
  type TouchEvent as ReactTouchEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { useBodyScrollLock } from "@/hooks/use-body-scroll-lock";

// Snap points as percentages of viewport height (from bottom)
const MOBILE_NAV_HEIGHT = 44; // Height of fixed bottom nav bar (icon-only)

const SNAP_POINTS = {
  COLLAPSED: 56 + MOBILE_NAV_HEIGHT, // Grabber visible above the nav bar
  MID: 0.3, // 30% of viewport
  EXPANDED: 0.9, // 90% of viewport
};

// Velocity threshold for flicking to next snap point (pixels per second)
const VELOCITY_THRESHOLD = 300;

// Distance threshold for snap decision when velocity is low
const DISTANCE_THRESHOLD = 50;

export type SnapPoint = "collapsed" | "mid" | "expanded";

interface BottomSheetProps {
  children: ReactNode;
  header?: ReactNode;
  defaultSnapPoint?: SnapPoint;
  onSnapPointChange?: (snapPoint: SnapPoint) => void;
  requestedSnapPoint?: SnapPoint | null;
  expandOnInteraction?: boolean;
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
  requestedSnapPoint,
  expandOnInteraction = true,
}: BottomSheetProps) {
  const [snapPoint, setSnapPoint] = useState<SnapPoint>(defaultSnapPoint);
  const [isDragging, setIsDragging] = useState(false);
  const [viewportHeight, setViewportHeight] = useState(0);

  const contentRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef(0);
  const dragStartSheetY = useRef(0);
  const lastClientY = useRef(0);
  const lastTime = useRef(0);
  const velocityY = useRef(0);

  // Track drag state
  const isDraggingSheet = useRef(false);
  const canStartDrag = useRef(false);
  // Track if we've determined this touch should be scrolling (not dragging)
  const isScrolling = useRef(false);

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

      // High velocity flick up (negative velocity means moving up/expanding)
      if (velocity < -VELOCITY_THRESHOLD) {
        if (currentHeight < mid) return "mid";
        return "expanded";
      }

      // High velocity flick down (positive velocity means moving down/collapsing)
      if (velocity > VELOCITY_THRESHOLD) {
        if (currentHeight > mid) return "mid";
        return "collapsed";
      }

      // Low velocity: snap to nearest, but apply distance threshold
      const distances = [
        { point: "collapsed" as SnapPoint, dist: Math.abs(currentHeight - collapsed) },
        { point: "mid" as SnapPoint, dist: Math.abs(currentHeight - mid) },
        { point: "expanded" as SnapPoint, dist: Math.abs(currentHeight - expanded) },
      ];

      distances.sort((a, b) => a.dist - b.dist);

      // If closest distance is very small, snap to it
      if (distances[0].dist < DISTANCE_THRESHOLD) {
        return distances[0].point;
      }

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

  // Respond to external snap point requests (e.g. when a place is selected)
  useEffect(() => {
    if (requestedSnapPoint && viewportHeight > 0) {
      const currentHeight = sheetHeight.get();
      const targetHeight = getSnapHeight(requestedSnapPoint);
      if (currentHeight < targetHeight) {
        snapTo(requestedSnapPoint);
      }
    }
  }, [requestedSnapPoint, viewportHeight, getSnapHeight, sheetHeight, snapTo]);

  // Check if content is scrolled to top (also checks nested scroll containers like ScrollArea)
  const isContentAtTop = useCallback(() => {
    if (!contentRef.current) return true;
    if (contentRef.current.scrollTop > 1) return false;
    const nestedScrollable = contentRef.current.querySelector('[data-radix-scroll-area-viewport], [data-scroll-container]');
    if (nestedScrollable && nestedScrollable.scrollTop > 1) return false;
    return true;
  }, []);

  // Handle pointer start on grabber (always initiates drag)
  const handleGrabberStart = useCallback(
    (clientY: number) => {
      isDraggingSheet.current = true;
      canStartDrag.current = true;
      isScrolling.current = false;
      dragStartY.current = clientY;
      dragStartSheetY.current = sheetHeight.get();
      lastClientY.current = clientY;
      lastTime.current = Date.now();
      velocityY.current = 0;
      setIsDragging(true);
    },
    [sheetHeight]
  );

  // Handle pointer start on content area
  const handleContentStart = useCallback(
    (clientY: number) => {
      dragStartY.current = clientY;
      dragStartSheetY.current = sheetHeight.get();
      lastClientY.current = clientY;
      lastTime.current = Date.now();
      velocityY.current = 0;
      isDraggingSheet.current = false;
      isScrolling.current = false;
      // Can potentially start drag if at top - but we'll verify during move
      canStartDrag.current = isContentAtTop();
    },
    [sheetHeight, isContentAtTop]
  );

  // Handle pointer move
  const handlePointerMove = useCallback(
    (clientY: number) => {
      // Calculate velocity
      const currentTime = Date.now();
      const dt = currentTime - lastTime.current;
      if (dt > 0) {
        // Positive velocity = moving down (finger moving down screen)
        velocityY.current = ((clientY - lastClientY.current) / dt) * 1000;
      }
      lastClientY.current = clientY;
      lastTime.current = currentTime;

      // Delta from start: negative = finger moved up, positive = finger moved down
      const deltaFromStart = clientY - dragStartY.current;

      // If already dragging sheet, continue dragging
      if (isDraggingSheet.current) {
        // Calculate new height (dragging up = increasing height)
        const newHeight = Math.max(
          SNAP_POINTS.COLLAPSED,
          Math.min(viewportHeight * SNAP_POINTS.EXPANDED, dragStartSheetY.current - deltaFromStart)
        );
        sheetHeight.set(newHeight);
        return true; // Indicate we handled the event
      }

      // If we've already determined this is a scroll gesture, let it scroll
      if (isScrolling.current) {
        return false;
      }

      // Check current scroll position (including nested scroll containers)
      const directScrollTop = contentRef.current?.scrollTop ?? 0;
      const nestedScrollable = contentRef.current?.querySelector('[data-radix-scroll-area-viewport], [data-scroll-container]');
      const nestedScrollTop = nestedScrollable?.scrollTop ?? 0;
      const effectiveScrollTop = Math.max(directScrollTop, nestedScrollTop);
      
      // If content has scrolled away from top, this is definitely a scroll gesture
      // Don't try to start sheet drag
      if (effectiveScrollTop > 1) {
        isScrolling.current = true;
        return false;
      }

      // Finger moving UP (negative delta) = user wants to scroll down to see more content
      // This should always be handled by native scroll
      if (deltaFromStart < -5) {
        isScrolling.current = true;
        return false;
      }

      // Check if we should start dragging the sheet
      // Only when: at top, finger moving DOWN significantly, and we started at top
      // Use a larger threshold (20px) to avoid accidental triggers
      if (canStartDrag.current && effectiveScrollTop <= 1 && deltaFromStart > 20) {
        isDraggingSheet.current = true;
        dragStartY.current = clientY; // Reset start position
        dragStartSheetY.current = sheetHeight.get();
        setIsDragging(true);
        return true;
      }

      return false;
    },
    [viewportHeight, sheetHeight]
  );

  // Handle pointer end
  const handlePointerEnd = useCallback(() => {
    if (isDraggingSheet.current) {
      const currentHeight = sheetHeight.get();
      // velocityY is positive when moving down, which should collapse
      const nearest = findNearestSnapPoint(currentHeight, velocityY.current);
      snapTo(nearest);
    }
    isDraggingSheet.current = false;
    canStartDrag.current = false;
    isScrolling.current = false;
    setIsDragging(false);
  }, [findNearestSnapPoint, sheetHeight, snapTo]);

  // Touch event handlers for grabber
  const onGrabberTouchStart = useCallback(
    (e: ReactTouchEvent) => {
      e.stopPropagation();
      handleGrabberStart(e.touches[0].clientY);
    },
    [handleGrabberStart]
  );

  const onGrabberMouseDown = useCallback(
    (e: ReactMouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      handleGrabberStart(e.clientY);
    },
    [handleGrabberStart]
  );

  // Touch event handlers for content
  const onContentTouchStart = useCallback(
    (e: ReactTouchEvent) => {
      handleContentStart(e.touches[0].clientY);
    },
    [handleContentStart]
  );

  // Global move/end handlers
  useEffect(() => {
    const handleTouchMove = (e: globalThis.TouchEvent) => {
      const handled = handlePointerMove(e.touches[0].clientY);
      // Prevent default only when dragging sheet to stop map pan and page scroll
      if (handled || isDraggingSheet.current) {
        e.preventDefault();
      }
    };

    const handleTouchEnd = () => {
      handlePointerEnd();
    };

    const handleMouseMove = (e: globalThis.MouseEvent) => {
      if (isDragging) {
        handlePointerMove(e.clientY);
      }
    };

    const handleMouseUp = () => {
      if (isDragging) {
        handlePointerEnd();
      }
    };

    window.addEventListener("touchmove", handleTouchMove, { passive: false });
    window.addEventListener("touchend", handleTouchEnd);
    window.addEventListener("touchcancel", handleTouchEnd);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
      window.removeEventListener("touchcancel", handleTouchEnd);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, handlePointerMove, handlePointerEnd]);

  useEffect(() => {
    if (!expandOnInteraction || !contentRef.current) return;

    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT") {
        if (snapPoint !== "expanded") {
          snapTo("expanded");
        }
      }
    };

    const content = contentRef.current;
    content.addEventListener("focusin", handleFocusIn);

    return () => {
      content.removeEventListener("focusin", handleFocusIn);
    };
  }, [expandOnInteraction, snapPoint, snapTo]);

  // Handle backdrop tap to snap to mid
  const handleBackdropClick = useCallback(() => {
    if (snapPoint === "expanded") {
      snapTo("mid");
    }
  }, [snapPoint, snapTo]);

  // Determine if backdrop should receive pointer events
  const showBackdrop = snapPoint === "expanded";

  return (
    <>
      {/* Semi-transparent backdrop - interactive when expanded */}
      <motion.div
        className={`fixed inset-0 bg-black z-[41] md:hidden ${
          showBackdrop ? "pointer-events-auto" : "pointer-events-none"
        }`}
        style={{ opacity: backdropOpacity }}
        onClick={handleBackdropClick}
        data-testid="bottom-sheet-backdrop"
      />

      {/* Bottom sheet container */}
      <motion.div
        ref={sheetRef}
        className="fixed left-0 right-0 bottom-0 z-[42] md:hidden bg-background rounded-t-2xl shadow-[0_-4px_20px_rgba(0,0,0,0.15)] flex flex-col"
        style={{
          height: sheetHeight,
          paddingBottom: "calc(2.75rem + env(safe-area-inset-bottom, 0px))",
        }}
        onPointerDown={(e) => e.stopPropagation()}
        data-testid="mobile-bottom-sheet"
      >
        {/* Grabber area - always draggable */}
        <div
          className="flex flex-col items-center pt-2 pb-1 shrink-0 cursor-grab active:cursor-grabbing select-none touch-none"
          onTouchStart={onGrabberTouchStart}
          onMouseDown={onGrabberMouseDown}
          data-testid="bottom-sheet-grabber"
        >
          <div className="w-10 h-1 bg-muted-foreground/30 rounded-full" />
        </div>

        {/* Optional header */}
        {header && <div className="shrink-0 px-4 pb-2 border-b">{header}</div>}

        {/* Content area */}
        <div
          ref={contentRef}
          className="flex-1 min-h-0 relative"
          onTouchStart={onContentTouchStart}
          style={{
            touchAction: "pan-y",
          }}
          data-testid="bottom-sheet-content"
        >
          {children}
        </div>
      </motion.div>
    </>
  );
}
