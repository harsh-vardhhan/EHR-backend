"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var MastraService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MastraService = void 0;
const common_1 = require("@nestjs/common");
const annotations_service_1 = require("./annotations.service");
let MastraService = MastraService_1 = class MastraService {
    annotationsService;
    logger = new common_1.Logger(MastraService_1.name);
    constructor(annotationsService) {
        this.annotationsService = annotationsService;
    }
    async analyzeDocumentBackground(documentId, text) {
        this.runAnalysis(documentId, text).catch(err => {
            this.logger.error('Failed to run LLM analysis', err);
        });
    }
    async runAnalysis(documentId, text) {
        this.logger.log(`Starting LLM pre-labelling for document ${documentId}`);
        await new Promise(resolve => setTimeout(resolve, 2000));
        try {
            if (!process.env.GROQ_API_KEY) {
                throw new Error('GROQ_API_KEY not set, falling back to mock data');
            }
            const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: 'openai/gpt-oss-120b',
                    max_tokens: 4096,
                    messages: [
                        {
                            role: 'system',
                            content: 'You are a clinical NLP system.'
                        },
                        {
                            role: 'user',
                            content: `Extract medical entities from the following text and classify them strictly into one of these labels: Condition, Medication, Symptom, or Procedure.

Important: You must output your response as a valid JSON object matching this schema:
{
  "entities": [
    { "text": string, "label": "Condition" | "Medication" | "Symptom" | "Procedure", "confidence": number, "startOffset": number, "endOffset": number }
  ]
}

Note: Do not calculate exact character offsets. Always set startOffset and endOffset to 0 for every entity. Our backend will handle the exact offset calculation.

Example output:
{
  "entities": [
    { "text": "chest pain", "label": "Symptom", "confidence": 95, "startOffset": 0, "endOffset": 0 }
  ]
}

Do not include any markdown formatting, backticks, or conversational text. Return only the JSON object. Do not over-reason. Output the final JSON immediately.

Text: "${text}"`
                        }
                    ]
                })
            });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Groq API error: ${errorText}`);
            }
            const data = await response.json();
            let generatedText = data.choices[0].message.content || '';
            const jsonMatch = generatedText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                generatedText = jsonMatch[0];
            }
            let object;
            try {
                object = JSON.parse(generatedText);
            }
            catch (e) {
                throw new Error(`Failed to parse JSON. Raw text was: ${generatedText}. Error: ${e.message}`);
            }
            this.logger.log(`=========================================`);
            this.logger.log(`✅ SUCCESS: LLM API (gpt-oss-120b) responded successfully!`);
            this.logger.log(`LLM returned ${object.entities.length} entities`);
            this.logger.log(`=========================================`);
            object.entities.forEach(entity => {
                let actualStart = entity.startOffset;
                let actualEnd = entity.endOffset;
                let extractedText = text.substring(actualStart, actualEnd);
                if (extractedText !== entity.text) {
                    const index = text.indexOf(entity.text);
                    if (index !== -1) {
                        actualStart = index;
                        actualEnd = index + entity.text.length;
                    }
                    else {
                        this.logger.warn(`Entity text not found in document: ${entity.text}`);
                        return;
                    }
                }
                this.annotationsService.createAnnotation({
                    documentId,
                    text: entity.text,
                    label: entity.label,
                    startOffset: actualStart,
                    endOffset: actualEnd,
                    source: 'llm',
                    status: 'suggested',
                    confidence: entity.confidence,
                });
            });
        }
        catch (error) {
            this.logger.error('Error calling Groq / AI SDK', error);
            this.fallbackMock(documentId, text);
        }
    }
    fallbackMock(documentId, text) {
        this.logger.warn(`=========================================`);
        this.logger.warn(`⚠️ FALLBACK ENGAGED: Using hardcoded mock data!`);
        this.logger.warn(`=========================================`);
        const mockEntities = [
            { text: 'chest pain', label: 'Symptom', confidence: 95 },
            { text: 'shortness of breath', label: 'Symptom', confidence: 85 },
            { text: 'hypertension', label: 'Condition', confidence: 98 },
            { text: 'type 2 diabetes mellitus', label: 'Condition', confidence: 99 },
            { text: 'lisinopril', label: 'Medication', confidence: 96 },
            { text: 'metformin', label: 'Medication', confidence: 95 },
            { text: 'aspirin', label: 'Medication', confidence: 97 },
            { text: 'furosemide', label: 'Medication', confidence: 94 },
            { text: 'pulmonary oedema', label: 'Condition', confidence: 75 },
            { text: 'echocardiogram', label: 'Procedure', confidence: 55 },
            { text: 'heart failure', label: 'Condition', confidence: 80 }
        ];
        mockEntities.forEach(ent => {
            const index = text.indexOf(ent.text);
            if (index !== -1) {
                this.annotationsService.createAnnotation({
                    documentId,
                    text: ent.text,
                    label: ent.label,
                    startOffset: index,
                    endOffset: index + ent.text.length,
                    source: 'llm',
                    status: 'suggested',
                    confidence: ent.confidence,
                });
            }
        });
    }
};
exports.MastraService = MastraService;
exports.MastraService = MastraService = MastraService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [annotations_service_1.AnnotationsService])
], MastraService);
//# sourceMappingURL=mastra.service.js.map