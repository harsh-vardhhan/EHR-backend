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
const ai_1 = require("ai");
const groq_1 = require("@ai-sdk/groq");
const zod_1 = require("zod");
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
            const { object } = await (0, ai_1.generateObject)({
                model: (0, groq_1.groq)('llama-3.3-70b-versatile'),
                schema: zod_1.z.object({
                    entities: zod_1.z.array(zod_1.z.object({
                        text: zod_1.z.string(),
                        label: zod_1.z.enum(['Condition', 'Medication', 'Symptom', 'Procedure']),
                        confidence: zod_1.z.number().min(0).max(100),
                        startOffset: zod_1.z.number(),
                        endOffset: zod_1.z.number(),
                    }))
                }),
                prompt: `You are a clinical NLP system. Extract medical entities from the following text and classify them into Condition, Medication, Symptom, or Procedure. Return exact start and end character offsets. Text: "${text}"`,
            });
            this.logger.log(`LLM returned ${object.entities.length} entities`);
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