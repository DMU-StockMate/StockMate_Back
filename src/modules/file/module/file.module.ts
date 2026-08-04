import { Module } from '@nestjs/common';

import { FileService } from '../service/file.service';

@Module({
  providers: [FileService],
  exports: [FileService],
})
export class FileModule {}