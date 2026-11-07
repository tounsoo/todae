// How Conversation.ScrollButton's glide steps toward the end. Each 60th of a
// second covers a share of the distance left, at least a few pixels, so the
// glide slows into an end that may still be moving away while a message
// grows. A frame covers what its own length gives, so a 120Hz screen glides at
// the same pace as a 60Hz one.
const SHARE = 0.18;
const MIN_STEP = 4;
// Frames of a 60Hz screen per millisecond. A literal, so a bundle that
// imports nothing from Todae keeps nothing of this module.
const FRAMES_PER_MS = 0.06;

/** How far to move in a frame `ms` long, with `left` pixels to the end. */
export function glideStep(left: number, ms: number): number {
  const frames = ms * FRAMES_PER_MS;
  const share = 1 - (1 - SHARE) ** frames;
  return Math.min(left, Math.max(left * share, MIN_STEP * frames));
}
