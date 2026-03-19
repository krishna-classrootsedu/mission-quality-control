/**
 * Module flow sequencing — merges spine + applet slides into a single ordered sequence.
 *
 * Example: Spine has 33 slides. Applet A1 (10 slides) inserts after spine slide 3.
 * Result: Spine 1-3, A1 1-10, Spine 4-33 → total 43 slides numbered 1-43.
 */

export type SourceSlide = {
  sourceFile: string; // "spine" | "A1" | "A2" etc
  sourceSlideNumber: number; // original number within its source file
  textContent?: string;
  speakerNotes?: string;
  layoutType?: string;
  hasAnimation?: boolean;
  animationSequence?: unknown;
  morphPairWith?: number; // slide number of morph partner (within source file)
  metadata?: unknown;
  thumbnailStorageId?: string;
};

export type AppletInput = {
  label: string; // "A1", "A2", etc
  afterSpineSlide: number; // insert after this spine slide number
  slides: SourceSlide[]; // parsed slides from this applet
};

export type SequencedSlide = SourceSlide & {
  slideNumber: number; // position in the merged module flow (1-based)
};

export function sequenceModuleFlow(
  spineSlides: SourceSlide[],
  applets: AppletInput[]
): SequencedSlide[] {
  // Sort applets by afterSpineSlide descending so we can insert without shifting indices
  const sortedApplets = [...applets].sort(
    (a, b) => b.afterSpineSlide - a.afterSpineSlide
  );

  // Start with spine slides
  const merged: SourceSlide[] = spineSlides.map((s) => ({
    ...s,
    sourceFile: "spine",
  }));

  // Insert applets (descending order so positions stay valid)
  for (const applet of sortedApplets) {
    const insertIndex = applet.afterSpineSlide; // 0-based index after this spine slide
    const appletSlides = applet.slides.map((s) => ({
      ...s,
      sourceFile: applet.label,
    }));
    merged.splice(insertIndex, 0, ...appletSlides);
  }

  // Number sequentially
  return merged.map((slide, i) => ({
    ...slide,
    slideNumber: i + 1,
  }));
}

/**
 * Build a human-readable preview of the module flow.
 * Returns segments like: "Slides 1-3 (Spine)" etc.
 */
export function describeModuleFlow(sequenced: SequencedSlide[]): string[] {
  if (sequenced.length === 0) return [];

  const segments: string[] = [];
  let segStart = 1;
  let currentSource = sequenced[0].sourceFile;

  for (let i = 1; i <= sequenced.length; i++) {
    const nextSource =
      i < sequenced.length ? sequenced[i].sourceFile : null;
    if (nextSource !== currentSource) {
      const label = currentSource === "spine" ? "Spine" : currentSource;
      if (segStart === i) {
        segments.push(`Slide ${segStart} (${label})`);
      } else {
        segments.push(`Slides ${segStart}\u2013${i} (${label})`);
      }
      segStart = i + 1;
      if (nextSource) currentSource = nextSource;
    }
  }

  return segments;
}
