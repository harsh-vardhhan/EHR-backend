import { Module } from '@nestjs/common';
import { DocumentsModule } from './documents/documents.module';
import { AnnotationsModule } from './annotations/annotations.module';

@Module({
  imports: [DocumentsModule, AnnotationsModule],
})
export class AppModule {}
