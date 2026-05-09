"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DocumentsService = void 0;
const common_1 = require("@nestjs/common");
const MOCK_NOTE = `Patient is a 67-year-old male presenting with chest pain and 
shortness of breath for the past 3 days. He has a known history 
of hypertension and type 2 diabetes mellitus. Current medications 
include lisinopril 10mg daily, metformin 500mg twice daily, and 
aspirin 81mg daily.

On examination, blood pressure was 158/94 mmHg and oxygen 
saturation was 94% on room air. Chest X-ray revealed pulmonary 
oedema consistent with acute decompensated heart failure.

Plan: Start furosemide 40mg intravenously, cardiology consult 
requested, repeat echocardiogram ordered.`;
let DocumentsService = class DocumentsService {
    documents = [
        {
            id: 'doc-1',
            text: MOCK_NOTE,
        },
    ];
    getDocument(id) {
        const doc = this.documents.find((d) => d.id === id);
        if (!doc) {
            throw new common_1.NotFoundException(`Document with id ${id} not found`);
        }
        return doc;
    }
};
exports.DocumentsService = DocumentsService;
exports.DocumentsService = DocumentsService = __decorate([
    (0, common_1.Injectable)()
], DocumentsService);
//# sourceMappingURL=documents.service.js.map