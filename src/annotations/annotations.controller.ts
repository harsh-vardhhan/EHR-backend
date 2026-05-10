import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
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
      source: 'human' | 'llm';
      status?: 'suggested' | 'accepted' | 'rejected' | 'corrected';
      confidence?: number;
    },
  ) {
    return this.annotationsService.createAnnotation(body);
  }

  @Delete(':id')
  deleteAnnotation(@Param('id') id: string) {
    this.annotationsService.deleteAnnotation(id);
    return { success: true };
  }

  @Patch(':id')
  updateAnnotation(
    @Param('id') id: string,
    @Body() updates: Partial<{ label: string; status: string; text: string }>,
  ) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    return this.annotationsService.updateAnnotation(id, updates as any);
  }
}
