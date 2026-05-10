import { Module } from '@nestjs/common';
import { AnnotationsModule } from '../annotations/annotations.module';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';

@Module({
  imports: [AnnotationsModule],
  controllers: [DocumentsController],
  providers: [DocumentsService],
})
export class DocumentsModule {}
