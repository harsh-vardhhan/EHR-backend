export interface ConceptQuery {
  text: string;
  label: string;
}

export interface ResolvedConcept {
  queryText: string;
  conceptCode?: string;
  conceptId?: number;
  conceptName?: string;
  vocabularyId?: string;
  domainId?: string;
}

export class OmopHubClient {
  private apiKey: string | undefined;
  private baseUrl = 'https://api.omophub.com/v1';

  constructor() {
    this.apiKey = process.env.OMOPHUB_API_KEY;
  }

  /**
   * Helper to map our frontend/LLM labels to standard OMOP vocabularies
   */
  private getVocabularies(label: string): string[] {
    switch (label) {
      case 'Clinical Condition':
        return ['ICD10CM', 'SNOMED'];
      case 'Medication Statement':
        return ['RxNorm'];
      case 'Clinical Finding':
      case 'Medical Procedure':
        return ['SNOMED'];
      default:
        return ['SNOMED', 'RxNorm', 'ICD10CM'];
    }
  }

  /**
   * Helper to map our frontend/LLM labels to OMOP domains
   */
  private getDomains(label: string): string[] {
    switch (label) {
      case 'Clinical Condition':
        return ['Condition'];
      case 'Medication Statement':
        return ['Drug'];
      case 'Clinical Finding':
        return ['Condition', 'Observation'];
      case 'Medical Procedure':
        return ['Procedure'];
      default:
        return [];
    }
  }

  /**
   * Normalizes raw clinical entities into standardized search strings.
   * Strips out adjectives, qualifiers, action words, and dosages that prevent dictionary matching.
   */
  private normalizeText(text: string, label: string): string {
    let cleaned = text.trim();

    // 1. Common clinical acronym expansions
    const acronymMap: Record<string, string> = {
      copd: 'chronic obstructive pulmonary disease',
      cad: 'coronary artery disease',
      ckd: 'chronic kidney disease',
      mdd: 'major depressive disorder',
      gad: 'generalized anxiety disorder',
      gerd: 'gastroesophageal reflux disease',
      cabg: 'coronary artery bypass graft',
      uti: 'urinary tract infection',
    };

    // Replace matching parenthetical acronyms, e.g. "Generalized Anxiety Disorder (GAD)" -> "Generalized Anxiety Disorder"
    cleaned = cleaned.replace(/\s*\(\s*(copd|cad|ckd|mdd|gad|gerd|cabg|uti)\s*\)/i, '');
    
    // Check if it's just the acronym
    if (acronymMap[cleaned.toLowerCase()]) {
      cleaned = acronymMap[cleaned.toLowerCase()];
    }

    if (label === 'Medication Statement') {
      // Remove action verbs commonly found at start of medication instructions
      cleaned = cleaned.replace(/^(initiate|continue|prescribe|add|start|take|give|administer|discharge\s+on)\s+/i, '');

      // Remove dosage quantities (e.g., 50mg, 10g, 5 units, 1g, 50 mg)
      cleaned = cleaned.replace(/\b\d+(\.\d+)?\s*(mg|mcg|g|ml|tab|tablet|unit|units|capsule|cap|puff|puffs)\b/gi, '');

      // Remove frequencies and durations (e.g., daily, twice daily, BID, at bedtime, twice a day, every 8 hours, for 5 days)
      cleaned = cleaned.replace(/\b(daily|weekly|nightly|at\s+bedtime|twice\s+daily|three\s+times\s+daily|bid|tid|qhs|prn|for\s+\d+\s+(days|weeks|months|days course))\b/gi, '');

      // Remove trailing conjunction fragments left over
      cleaned = cleaned.replace(/\b(and|or|for|of|course|daily)\b/gi, '');
      
      // Clean up multiple spaces
      cleaned = cleaned.replace(/\s+/g, ' ').trim();
    } else if (label === 'Clinical Condition' || label === 'Clinical Finding') {
      // Remove leading descriptors / severity qualifiers that block matching
      cleaned = cleaned.replace(/^(severe|moderate|mild|acute|chronic|intermittent|exertional|suspected|possible|worsening|history\s+of|history\s+post-)\s+/i, '');
      
      // Remove trailing words like "headaches" or observations like "noted", "reported"
      cleaned = cleaned.replace(/\b(headaches|noted|reported|present|history)\b/gi, '');
      
      cleaned = cleaned.replace(/\s+/g, ' ').trim();
    }

    // Clean trailing punctuation
    cleaned = cleaned.replace(/[.,;:]+$/, '').trim();

    return cleaned || text;
  }

  /**
   * Resolves a batch of queries in a single bulk API request to OMOPHub.
   * If the API key is missing or the request fails, it returns empty resolved concepts gracefully.
   */
  async resolveBulkConcepts(
    queries: ConceptQuery[],
  ): Promise<Map<string, ResolvedConcept>> {
    const resultMap = new Map<string, ResolvedConcept>();

    // Prepopulate map with original terms
    for (const q of queries) {
      resultMap.set(q.text.toLowerCase(), { queryText: q.text });
    }

    if (!this.apiKey) {
      console.warn(
        '[OmopHubClient] OMOPHUB_API_KEY is not set. Skipping resolution.',
      );
      return resultMap;
    }

    if (queries.length === 0) {
      return resultMap;
    }

    try {
      // 1. Initial Query using Normalized Text
      const searches = queries.map((q, idx) => {
        const normalized = this.normalizeText(q.text, q.label);
        return {
          search_id: `s_${idx}`,
          query: normalized,
          vocabulary_ids: this.getVocabularies(q.label),
          domain_ids: this.getDomains(q.label),
          page_size: 1,
        };
      });

      const payload = {
        defaults: {
          standard_concept: 'S',
        },
        searches,
      };

      console.log(
        `[OmopHubClient] Querying OMOPHub bulk search with ${queries.length} terms...`,
      );
      const response = await fetch(`${this.baseUrl}/search/bulk`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`OMOPHub HTTP error! status: ${response.status}`);
      }

      const body = await response.json();
      if (body.success && Array.isArray(body.data)) {
        for (const item of body.data) {
          if (
            item.status === 'completed' &&
            Array.isArray(item.results) &&
            item.results.length > 0
          ) {
            const best = item.results[0];
            const searchId = item.search_id;
            const idx = parseInt(searchId.split('_')[1], 10);
            
            if (!isNaN(idx) && queries[idx]) {
              const originalText = queries[idx].text;
              resultMap.set(originalText.toLowerCase(), {
                queryText: originalText,
                conceptCode: best.concept_code,
                conceptId: best.concept_id,
                conceptName: best.concept_name,
                vocabularyId: best.vocabulary_id,
                domainId: best.domain_id,
              });
            }
          }
        }
      }

      // 2. Identify queries that failed to resolve a concept code
      const failedQueries: { query: ConceptQuery; idx: number }[] = [];
      queries.forEach((q, idx) => {
        const res = resultMap.get(q.text.toLowerCase());
        if (!res || !res.conceptCode) {
          failedQueries.push({ query: q, idx });
        }
      });

      // 3. Fallback Search with Relaxed Constraints
      if (failedQueries.length > 0) {
        console.log(
          `[OmopHubClient] Retrying fallback search for ${failedQueries.length} failed queries with relaxed vocabulary/domain constraints...`,
        );

        const fallbackSearches = failedQueries.map((item) => {
          const normalized = this.normalizeText(item.query.text, item.query.label);
          return {
            search_id: `f_${item.idx}`,
            query: normalized,
            vocabulary_ids: ['SNOMED', 'RxNorm', 'ICD10CM'],
            domain_ids: [], // Relax domain constraints
            page_size: 1,
          };
        });

        const fallbackPayload = {
          defaults: {
            standard_concept: 'S',
          },
          searches: fallbackSearches,
        };

        const fallbackResponse = await fetch(`${this.baseUrl}/search/bulk`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify(fallbackPayload),
        });

        if (fallbackResponse.ok) {
          const fallbackBody = await fallbackResponse.json();
          if (fallbackBody.success && Array.isArray(fallbackBody.data)) {
            for (const item of fallbackBody.data) {
              if (
                item.status === 'completed' &&
                Array.isArray(item.results) &&
                item.results.length > 0
              ) {
                const best = item.results[0];
                const searchId = item.search_id;
                const idx = parseInt(searchId.split('_')[1], 10);
                
                if (!isNaN(idx) && queries[idx]) {
                  const originalText = queries[idx].text;
                  resultMap.set(originalText.toLowerCase(), {
                    queryText: originalText,
                    conceptCode: best.concept_code,
                    conceptId: best.concept_id,
                    conceptName: best.concept_name,
                    vocabularyId: best.vocabulary_id,
                    domainId: best.domain_id,
                  });
                  console.log(
                    `[OmopHubClient] Fallback resolved: "${originalText}" -> "${best.concept_name}" (${best.concept_code})`,
                  );
                }
              }
            }
          }
        }
      }
    } catch (error: any) {
      console.error(
        '[OmopHubClient] Failed to resolve bulk concepts from OMOPHub:',
        error.message,
      );
    }

    return resultMap;
  }
}
