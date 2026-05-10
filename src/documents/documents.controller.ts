import { Controller, Get, Param, Post } from '@nestjs/common';
import { DocumentsService } from './documents.service';
import { MastraService } from '../annotations/mastra.service';

@Controller('documents')
export class DocumentsController {
  constructor(
    private readonly documentsService: DocumentsService,
    private readonly mastraService: MastraService,
  ) {}

  @Get(':id')
  getDocument(@Param('id') id: string) {
    return this.documentsService.getDocument(id);
  }

  @Post(':id/analyze')
  analyzeDocument(@Param('id') id: string) {
    const doc = this.documentsService.getDocument(id);
    this.mastraService.analyzeDocumentBackground(doc.id, doc.text);
    return { success: true, message: 'Analysis started' };
  }
}
