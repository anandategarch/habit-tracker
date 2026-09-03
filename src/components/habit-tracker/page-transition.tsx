'use client';

import { type ReactNode } from 'react';
import {
  motion,
  AnimatePresence,
  useReducedMotion,
  useScroll,
  useTransform,
} from 'framer-motion';

/**
 * PageTransition — wraps tab content with a smooth enter/exit transition.
 *
 * ANIM-2 / Feature 4: Page Transitions Parallax.
 * Uses framer-motion's `AnimatePresence mode="wait"` so the exiting tab
 * finishes animating out before the new tab animates in (no overlap).
 *
 * Animation: subtle slide-in from the right + fade. Direction matches the
 * mental model of forward navigation (new content arrives from the right).
 * Exit mirrors enter (slide out to the left + fade).
 *
 * Accessibility: respects `prefers-reduced-motion`. When reduced motion is
 * preferred, the motion is reduced to opacity-only (no x-translate) so the
 * transition is still visible but doesn't move — recommended by WCAG 2.3.3.
 *
 * Performance: uses `will-change: transform, opacity` (via framer-motion's
 * internal `MotionValue`) so the animation runs on the GPU compositor thread
 * without triggering layout/paint.
 *
 * @param children  Tab content to animate.
 * @param tabId     Key for AnimatePresence — change this to trigger the
 *                  exit→enter transition. Typically the active tab string.
 */
export function PageTransition({ children, tabId }: { children: ReactNode; tabId: string }) {
  const prefersReducedMotion = useReducedMotion();

  // Reduced motion: opacity-only transition (no horizontal slide).
  const variants = prefersReducedMotion
    ? {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
      }
    : {
        initial: { opacity: 0, x: 20 },
        animate: { opacity: 1, x: 0 },
        exit: { opacity: 0, x: -20 },
      };

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={tabId}
        initial={variants.initial}
        animate={variants.animate}
        exit={variants.exit}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        style={{ willChange: 'transform, opacity' }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

/**
 * StaggerGroup + StaggerItem — fade-up stagger for child cards.
 *
 * Wrap a grid/list of cards with `<StaggerGroup>` and replace each card's
 * wrapper with `<StaggerItem>` (or wrap the card in `<StaggerItem>`).
 * The parent's `staggerChildren` variant cascades the enter animation
 * through children with a 60ms delay between each.
 *
 * Equivalent to the existing `anim-stagger` CSS class but driven by
 * framer-motion — smoother spring physics + native reduced-motion handling.
 *
 * Usage:
 *   <StaggerGroup className="grid grid-cols-2 gap-4">
 *     <StaggerItem><Card>...</Card></StaggerItem>
 *     <StaggerItem><Card>...</Card></StaggerItem>
 *   </StaggerGroup>
 */

const staggerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.06, delayChildren: 0.04 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] as const },
  },
};

const itemVariantsReduced = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.2 },
  },
};

export function StaggerGroup({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  const prefersReducedMotion = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial="hidden"
      animate="visible"
      variants={staggerVariants}
      // Reduced motion: skip the cascade — children just fade in.
      transition={prefersReducedMotion ? { duration: 0 } : undefined}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  const prefersReducedMotion = useReducedMotion();
  return (
    <motion.div
      className={className}
      variants={prefersReducedMotion ? itemVariantsReduced : itemVariants}
      style={{ willChange: 'transform, opacity' }}
    >
      {children}
    </motion.div>
  );
}

/**
 * ParallaxBackground — subtle background layer that shifts opposite to
 * scroll direction. Decorative only (pointer-events-none, behind content).
 *
 * ANIM-2 / Feature 4: Page Transitions Parallax.
 * Uses framer-motion's `useScroll` + `useTransform` to map scroll progress
 * to a small translateY (±12px). The shift is intentionally subtle — large
 * movements cause motion sickness and clash with the otherwise restrained
 * motion design system.
 *
 * Accessibility: when `prefers-reduced-motion` is set, the layer is rendered
 * statically (no parallax).
 *
 * Performance: `position: fixed` keeps the layer out of the document flow;
 * framer-motion applies transforms via the compositor (no layout thrash).
 *
 * @param className Optional className for the layer (e.g. gradient background).
 */
export function ParallaxBackground({ className = '' }: { className?: string }) {
  // Delegate to inner component so hooks are always called unconditionally
  // (cannot conditionally call useScroll/useTransform based on reduced motion).
  return <ParallaxBackgroundInner className={className} />;
}

function ParallaxBackgroundInner({ className = '' }: { className?: string }) {
  const prefersReducedMotion = useReducedMotion();
  const { scrollY } = useScroll();

  // Map scroll 0→1000px → translateY 0→-24px (background drifts up slower
  // than content, giving a parallax depth effect). Clamp via framer-motion's
  // default interpolation (no extrapolation).
  const y = useTransform(scrollY, [0, 1000], [0, prefersReducedMotion ? 0 : -24]);

  if (prefersReducedMotion) {
    // Static layer — no motion subscription.
    return (
      <div
        aria-hidden="true"
        className={`pointer-events-none fixed inset-0 -z-10 ${className}`}
      />
    );
  }

  return (
    <motion.div
      aria-hidden="true"
      className={`pointer-events-none fixed inset-0 -z-10 ${className}`}
      style={{ y, willChange: 'transform' }}
    />
  );
}
