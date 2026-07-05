import {
  SageMakerRuntimeClient,
  InvokeEndpointCommand,
} from '@aws-sdk/client-sagemaker-runtime';

export interface PiiDetection {
  text: string;
  type: 'NAME' | 'DATE' | 'PHONE' | 'SSN' | 'MRN' | 'EMAIL';
  start: number;
  end: number;
}

export class PiiScrubberService {
  private sagemakerClient = new SageMakerRuntimeClient({
    region: process.env.AWS_REGION || 'ap-south-1',
  });

  /**
   * Helper to replace a matched string with a label-embedded mask of equal length.
   * e.g., "Robert Miller" (length 13) with label "NAME" -> "[NAMEXXXXXXX]" (length 13)
   */
  private maskString(matchedText: string, label: string): string {
    const L = matchedText.length;
    if (L <= label.length + 2) {
      return 'X'.repeat(L);
    }
    const prefix = `[${label}`;
    const suffix = ']';
    const paddingLength = L - prefix.length - suffix.length;
    return `${prefix}${'X'.repeat(paddingLength)}${suffix}`;
  }

  /**
   * Scrubs PII from the text, returning the scrubbed text and details of detections.
   */
  scrubText(text: string): {
    scrubbedText: string;
    detections: PiiDetection[];
  } {
    let scrubbed = text;
    const detections: PiiDetection[] = [];

    // 1. Dynamic metadata extraction (Names to scrub globally)
    // Patient Name: <Name>
    const patientNameRegex =
      /[Pp]atient\s*[Nn]ame:\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/g;
    // Physician: <Name> or Dr. <Name>
    const physicianNameRegex =
      /(?:[Pp]hysician:\s*(?:Dr\.\s*)?|Dr\.\s*)([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/g;

    const namesToScrub = new Set<string>();

    let match;
    patientNameRegex.lastIndex = 0;
    while ((match = patientNameRegex.exec(text)) !== null) {
      if (match[1]) namesToScrub.add(match[1].trim());
    }

    physicianNameRegex.lastIndex = 0;
    while ((match = physicianNameRegex.exec(text)) !== null) {
      if (match[1]) namesToScrub.add(match[1].trim());
    }

    // Also extract first names/last names separately to scrub them if they appear individually
    const individualNames = new Set<string>();
    for (const fullName of namesToScrub) {
      const parts = fullName.split(/\s+/);
      for (const part of parts) {
        if (part.length > 2 && !/^(Dr|Mr|Mrs|Ms|MD|DO)$/i.test(part)) {
          individualNames.add(part);
        }
      }
    }

    // 2. Regex patterns for standard PII types
    const patterns: { type: PiiDetection['type']; regex: RegExp }[] = [
      {
        type: 'SSN',
        regex: /\b\d{3}-\d{2}-\d{4}\b/g,
      },
      {
        type: 'PHONE',
        regex: /\b(?:\+?1[-. ]?)?\(?\d{3}\)?[-. ]?\d{3}[-. ]?\d{4}\b/g,
      },
      {
        type: 'EMAIL',
        regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
      },
      {
        type: 'MRN',
        regex: /\bMRN\s*#?\s*[0-9-]+/gi,
      },
      {
        // Standalone 9-digit MRN format like 294-819-301
        type: 'MRN',
        regex: /\b\d{3}-\d{3}-\d{3}\b/g,
      },
      {
        // DOB: 10/24/1966 or Dates of birth
        type: 'DATE',
        regex:
          /(?:DOB|Birthdate|Date of Birth):\s*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/gi,
      },
      {
        // Standalone Date formats (e.g. 10/24/1966)
        type: 'DATE',
        regex: /\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/g,
      },
    ];

    // Function to apply replacements and record offsets
    const applyRegexReplacement = (
      regex: RegExp,
      type: PiiDetection['type'],
      captureGroupIndex = 0,
    ) => {
      let m;
      // We must run in a loop but reset regex index because we modify the string.
      // To keep it simple, we search for matches in the original text, find their indexes,
      // and perform replace in the scrubbed text.
      regex.lastIndex = 0;
      while ((m = regex.exec(text)) !== null) {
        const fullMatchStr = m[0];
        const matchStr =
          captureGroupIndex > 0 && m[captureGroupIndex]
            ? m[captureGroupIndex]
            : fullMatchStr;

        // Find offset in original text
        const start =
          m.index + (captureGroupIndex > 0 ? m[0].indexOf(matchStr) : 0);
        const end = start + matchStr.length;

        // Only add if not already covered
        if (!detections.some((d) => d.start === start && d.end === end)) {
          detections.push({
            text: matchStr,
            type,
            start,
            end,
          });
        }
      }
    };

    // Apply patterns
    for (const p of patterns) {
      const captureGroup =
        p.regex.source.includes('(') && !p.regex.source.startsWith('\\b(')
          ? 1
          : 0;
      applyRegexReplacement(p.regex, p.type, captureGroup);
    }

    // Apply Name matching for extracted names
    const allNameTokens = [...namesToScrub, ...individualNames].sort(
      (a, b) => b.length - a.length,
    );
    for (const name of allNameTokens) {
      if (name.length < 3) continue;
      const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const nameRegex = new RegExp(`\\b${escapedName}\\b`, 'gi');
      let m;
      while ((m = nameRegex.exec(text)) !== null) {
        const start = m.index;
        const end = start + name.length;
        if (!detections.some((d) => start >= d.start && end <= d.end)) {
          detections.push({
            text: m[0],
            type: 'NAME',
            start,
            end,
          });
        }
      }
    }

    // Sort detections descending by start offset to perform replacement from right-to-left
    // (This ensures that replacing strings doesn't shift the start/end indexes of previous detections in our loop!)
    detections.sort((a, b) => b.start - a.start);

    const chars = [...text];
    for (const det of detections) {
      const mask = this.maskString(det.text, det.type);
      chars.splice(det.start, det.text.length, ...mask);
    }

    scrubbed = chars.join('');

    // Return sorted ascending by start offset
    detections.sort((a, b) => a.start - b.start);

    return {
      scrubbedText: scrubbed,
      detections,
    };
  }

  /**
   * Asynchronously scrubs PII from the text, using the SageMaker GLiNER endpoint
   * to perform ML-based Named Entity Recognition (NER) for high-accuracy contextual scrubbing.
   */
  async scrubTextMl(text: string): Promise<{
    scrubbedText: string;
    detections: PiiDetection[];
  }> {
    // 1. Run the standard regex-based scrubber first (acts as baseline)
    const { detections } = this.scrubText(text);

    const localMlUrl = process.env.LOCAL_ML_URL;
    if (localMlUrl) {
      try {
        console.log(
          `[PiiScrubberService] Invoking local Python ML server for PII detection: "${localMlUrl}"...`,
        );
        const piiLabels = [
          'Patient Name',
          'Doctor Name',
          'Phone Number',
          'Social Security Number',
          'Date of Birth',
          'Physical Address',
          'Email Address',
        ];

        const payload = {
          text,
          labels: piiLabels,
          relations: [],
          threshold: 0.35,
        };

        const response = await fetch(localMlUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (response.ok) {
          const parsedData = await response.json();
          const labelMap: Record<string, PiiDetection['type']> = {
            'Patient Name': 'NAME',
            'Doctor Name': 'NAME',
            'Phone Number': 'PHONE',
            'Social Security Number': 'SSN',
            'Date of Birth': 'DATE',
            'Physical Address': 'EMAIL',
            'Email Address': 'EMAIL',
          };

          if (parsedData.entities && Array.isArray(parsedData.entities)) {
            for (const ent of parsedData.entities) {
              const start = ent.start;
              const end = ent.end;
              const type = labelMap[ent.label] || 'NAME';

              const isOverlap = detections.some(
                (d) =>
                  (start >= d.start && start < d.end) ||
                  (end > d.start && end <= d.end) ||
                  (d.start >= start && d.start < end),
              );

              if (!isOverlap) {
                detections.push({
                  text: ent.text,
                  type,
                  start,
                  end,
                });
              }
            }
          }
          console.log(
            `[PiiScrubberService] Local ML PII extraction completed. Total detections: ${detections.length}`,
          );
        }
      } catch (err: any) {
        console.warn(
          `[PiiScrubberService] Local ML-based PII scrubbing failed (falling back to regex-only). Error: ${err.message || err}`,
        );
      }
    } else if (process.env.MOCK_SAGEMAKER === 'true') {
      console.log(
        '[PiiScrubberService] MOCK_SAGEMAKER is active. Bypassing SageMaker ML PII scrubbing.',
      );
    } else {
      const endpointName =
        process.env.SAGEMAKER_ENDPOINT_NAME || 'gliner-relex-endpoint';

      try {
        const piiLabels = [
          'Patient Name',
          'Doctor Name',
          'Phone Number',
          'Social Security Number',
          'Date of Birth',
          'Physical Address',
          'Email Address',
        ];

        const payload = {
          text,
          labels: piiLabels,
          relations: [], // Empty relations array triggers entity-only mode in inference.py
          threshold: 0.35,
        };

        console.log(
          `[PiiScrubberService] Invoking SageMaker for PII detection: "${endpointName}"...`,
        );

        const command = new InvokeEndpointCommand({
          EndpointName: endpointName,
          ContentType: 'application/json',
          Body: Buffer.from(JSON.stringify(payload)),
        });

        const response = await this.sagemakerClient.send(command);

        if (response.Body) {
          const responseText = Buffer.from(response.Body).toString('utf-8');
          const parsedData = JSON.parse(responseText);

          const labelMap: Record<string, PiiDetection['type']> = {
            'Patient Name': 'NAME',
            'Doctor Name': 'NAME',
            'Phone Number': 'PHONE',
            'Social Security Number': 'SSN',
            'Date of Birth': 'DATE',
            'Physical Address': 'EMAIL',
            'Email Address': 'EMAIL',
          };

          if (parsedData.entities && Array.isArray(parsedData.entities)) {
            for (const ent of parsedData.entities) {
              const start = ent.start;
              const end = ent.end;
              const type = labelMap[ent.label] || 'NAME';

              // Check if this offset is already covered by our regex scrubber
              const isOverlap = detections.some(
                (d) =>
                  (start >= d.start && start < d.end) ||
                  (end > d.start && end <= d.end) ||
                  (d.start >= start && d.start < end),
              );

              if (!isOverlap) {
                detections.push({
                  text: ent.text,
                  type,
                  start,
                  end,
                });
              }
            }
          }
        }
      } catch (err: any) {
        console.warn(
          `[PiiScrubberService] SageMaker ML-based PII scrubbing failed/skipped (falling back to regex-only). Error: ${err.message || err}`,
        );
      }
    }

    // Sort detections descending by start offset to perform replacement right-to-left
    detections.sort((a, b) => b.start - a.start);

    const chars = [...text];
    for (const det of detections) {
      const mask = this.maskString(det.text, det.type);
      chars.splice(det.start, det.text.length, ...mask);
    }

    const scrubbed = chars.join('');

    // Sort ascending by start offset before returning
    detections.sort((a, b) => a.start - b.start);

    return {
      scrubbedText: scrubbed,
      detections,
    };
  }
}
