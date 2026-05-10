import { Module } from '@nestjs/common';
import { MastraService } from './mastra.service';
import { AnnotationsController } from './annotations.controller';
import { AnnotationsService } from './annotations.service';

@Module({
  controllers: [AnnotationsController],
  providers: [AnnotationsService, MastraService],
  exports: [AnnotationsService, MastraService],
})
export class AnnotationsModule {}
