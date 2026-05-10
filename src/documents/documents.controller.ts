import { Controller, Get, Param, Post } from '@nestjs/common';
import { DocumentsService } from './documents.service';
import { MastraService } from '../annotations/mastra.service';

@Controller('documents')
export class DocumentsController {
  constructor(
    private readonly documentsService: DocumentsService,
    private readonly mastraService: MastraService,
  ) {}

  @Get()
  getDocuments() {
    return this.documentsService.getDocuments();
  }

  @Get(':id')
  getDocument(@Param('id') id: string) {
    return this.documentsService.getDocument(id);
  }

  @Post(':id/analyze')
  async analyzeDocument(@Param('id') id: string) {
    // This might be deprecated in Phase 3, but keeping for compatibility if needed.
    const doc = await this.documentsService.getDocument(id);
    this.mastraService.analyzeDocumentBackground(
      doc.id as string,
      doc.text || '',
    );
    return { success: true, message: 'Analysis started' };
  }
}
