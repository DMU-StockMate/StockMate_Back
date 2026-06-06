import { Module } from '@nestjs/common';
import { DartController } from './controllers/dart.controller';
import { DartService } from './services/dart.service';

@Module({
  controllers: [DartController],
  providers: [DartService],
  exports: [DartService],
})
export class DartModule {}