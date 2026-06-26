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
   * Resolves a batch of queries in a single bulk API request to OMOPHub.
   * If the API key is missing or the request fails, it returns empty resolved concepts gracefully.
   */
  async resolveBulkConcepts(queries: ConceptQuery[]): Promise<Map<string, ResolvedConcept>> {
    const resultMap = new Map<string, ResolvedConcept>();

    // Prepopulate map with original terms
    for (const q of queries) {
      resultMap.set(q.text.toLowerCase(), { queryText: q.text });
    }

    if (!this.apiKey) {
      console.warn('[OmopHubClient] OMOPHUB_API_KEY is not set. Skipping resolution.');
      return resultMap;
    }

    if (queries.length === 0) {
      return resultMap;
    }

    try {
      const searches = queries.map((q, idx) => ({
        search_id: `s_${idx}`,
        query: q.text,
        vocabulary_ids: this.getVocabularies(q.label),
        domain_ids: this.getDomains(q.label),
        page_size: 1,
      }));

      const payload = {
        defaults: {
          standard_concept: 'S',
        },
        searches,
      };

      console.log(`[OmopHubClient] Querying OMOPHub bulk search with ${queries.length} terms...`);
      const response = await fetch(`${this.baseUrl}/search/bulk`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`OMOPHub HTTP error! status: ${response.status}`);
      }

      const body = (await response.json()) as any;
      if (body.success && Array.isArray(body.data)) {
        for (const item of body.data) {
          if (item.status === 'completed' && Array.isArray(item.results) && item.results.length > 0) {
            const best = item.results[0];
            resultMap.set(item.query.toLowerCase(), {
              queryText: item.query,
              conceptCode: best.concept_code,
              conceptId: best.concept_id,
              conceptName: best.concept_name,
              vocabularyId: best.vocabulary_id,
              domainId: best.domain_id,
            });
          }
        }
      }
    } catch (error: any) {
      console.error('[OmopHubClient] Failed to resolve bulk concepts from OMOPHub:', error.message);
    }

    return resultMap;
  }
}
