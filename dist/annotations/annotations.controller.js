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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnnotationsController = void 0;
const common_1 = require("@nestjs/common");
const annotations_service_1 = require("./annotations.service");
let AnnotationsController = class AnnotationsController {
    annotationsService;
    constructor(annotationsService) {
        this.annotationsService = annotationsService;
    }
    getAnnotations(documentId) {
        return this.annotationsService.getAnnotationsByDocument(documentId);
    }
    createAnnotation(body) {
        return this.annotationsService.createAnnotation(body);
    }
    deleteAnnotation(id) {
        this.annotationsService.deleteAnnotation(id);
        return { success: true };
    }
};
exports.AnnotationsController = AnnotationsController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)('documentId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AnnotationsController.prototype, "getAnnotations", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AnnotationsController.prototype, "createAnnotation", null);
__decorate([
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AnnotationsController.prototype, "deleteAnnotation", null);
exports.AnnotationsController = AnnotationsController = __decorate([
    (0, common_1.Controller)('annotations'),
    __metadata("design:paramtypes", [annotations_service_1.AnnotationsService])
], AnnotationsController);
//# sourceMappingURL=annotations.controller.js.map