import type { Annotation } from '../types/annotation';

export interface TextSegment {
  type: 'text' | 'annotation';
  content: string;
  annotation?: Annotation;
}

interface RenderProps {
  text: string;
  annotations: Annotation[];
}

/**
 * useDocumentSegments
 * 
 * A purely logical hook that transforms raw text and annotations into a 
 * list of renderable segments. No UI or JSX inside!
 */
export function useDocumentSegments({ text, annotations }: RenderProps): { segments: TextSegment[] } {
  if (!text) {
    return { segments: [] };
  }

  // 1. Filter and sort annotations to avoid overlaps (logic only)
  const validAnnotations = [...annotations]
    .sort((a, b) => a.startOffset - b.startOffset)
    .reduce((acc: Annotation[], curr) => {
      const last = acc[acc.length - 1];
      if (!last || curr.startOffset >= last.endOffset) {
        acc.push(curr);
      }
      return acc;
    }, []);

  if (validAnnotations.length === 0) {
    return { segments: [{ type: 'text', content: text }] };
  }

  // 2. Build the segments list
  const segments: TextSegment[] = [];
  let currentIndex = 0;

  validAnnotations.forEach((ann) => {
    // Gap text before annotation
    if (ann.startOffset > currentIndex) {
      segments.push({
        type: 'text',
        content: text.slice(currentIndex, ann.startOffset),
      });
    }

    // The annotation segment
    segments.push({
      type: 'annotation',
      content: text.slice(ann.startOffset, ann.endOffset),
      annotation: ann,
    });

    currentIndex = ann.endOffset;
  });

  // Trailing text
  if (currentIndex < text.length) {
    segments.push({
      type: 'text',
      content: text.slice(currentIndex),
    });
  }

  return { segments };
}
