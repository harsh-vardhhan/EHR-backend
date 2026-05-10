"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnnotationsService = void 0;
const common_1 = require("@nestjs/common");
const crypto_1 = require("crypto");
let AnnotationsService = class AnnotationsService {
    annotations = [];
    getAnnotationsByDocument(documentId) {
        return this.annotations.filter((a) => a.documentId === documentId);
    }
    createAnnotation(data) {
        const newAnnotation = {
            ...data,
            id: (0, crypto_1.randomUUID)(),
            createdAt: new Date().toISOString(),
        };
        this.annotations.push(newAnnotation);
        return newAnnotation;
    }
    updateAnnotation(id, updates) {
        const index = this.annotations.findIndex((a) => a.id === id);
        if (index === -1) {
            throw new common_1.NotFoundException(`Annotation with id ${id} not found`);
        }
        this.annotations[index] = { ...this.annotations[index], ...updates };
        return this.annotations[index];
    }
    deleteAnnotation(id) {
        const index = this.annotations.findIndex((a) => a.id === id);
        if (index === -1) {
            throw new common_1.NotFoundException(`Annotation with id ${id} not found`);
        }
        this.annotations.splice(index, 1);
    }
};
exports.AnnotationsService = AnnotationsService;
exports.AnnotationsService = AnnotationsService = __decorate([
    (0, common_1.Injectable)()
], AnnotationsService);
//# sourceMappingURL=annotations.service.js.map