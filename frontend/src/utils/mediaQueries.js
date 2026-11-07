/**
 * Responsive interaction & pointer capability detection.
 * Helps prevent mouse-specific interactions (hover videos, zoom lenses)
 * from activating on touch-screen devices.
 */

export function canHover() {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(hover: hover) and (pointer: fine)').matches;
}

