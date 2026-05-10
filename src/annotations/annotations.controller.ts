import {
  Body,
  Controller,
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
  async getAnnotations(@Query('documentId') documentId: string) {
    return this.annotationsService.getAnnotationsByDocument(documentId);
  }

  @Post()
  async createAnnotation(
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

  @Patch(':id')
  async updateAnnotation(
    @Param('id') id: string,
    @Body() updates: Partial<{ label: string; status: string; text: string }>,
  ) {
    return this.annotationsService.updateAnnotation(id, updates as any);
  }
}
