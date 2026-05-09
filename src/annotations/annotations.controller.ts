import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { AnnotationsService } from './annotations.service';

@Controller('annotations')
export class AnnotationsController {
  constructor(private readonly annotationsService: AnnotationsService) {}

  @Get()
  getAnnotations(@Query('documentId') documentId: string) {
    return this.annotationsService.getAnnotationsByDocument(documentId);
  }

  @Post()
  createAnnotation(
    @Body()
    body: {
      documentId: string;
      text: string;
      label: 'Condition' | 'Medication' | 'Symptom' | 'Procedure';
      startOffset: number;
      endOffset: number;
    },
  ) {
    return this.annotationsService.createAnnotation(body);
  }

  @Delete(':id')
  deleteAnnotation(@Param('id') id: string) {
    this.annotationsService.deleteAnnotation(id);
    return { success: true };
  }
}
