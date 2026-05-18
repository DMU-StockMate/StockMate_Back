import {
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';

import { unlink } from 'fs/promises';
import { join } from 'path';

@Injectable()
export class FileService {
  createProfileImageUrl(filename: string): string {
    return `/uploads/profile/${filename}`;
  }

  async deleteProfileImageByUrl(
    profileImageUrl: string | null,
  ): Promise<void> {
    if (!profileImageUrl) return;

    const filename = profileImageUrl.split('/').pop();

    if (!filename) return;

    const filePath = join(
      process.cwd(),
      'uploads',
      'profile',
      filename,
    );

    try {
      await unlink(filePath);
    } catch (error) {
      // 파일이 이미 없으면 무시
      return;
    }
  }

  async replaceProfileImage(
    oldProfileImageUrl: string | null,
    newFilename: string,
  ): Promise<string> {
    try {
      await this.deleteProfileImageByUrl(oldProfileImageUrl);

      return this.createProfileImageUrl(newFilename);
    } catch (error) {
      throw new InternalServerErrorException(
        '프로필 이미지 처리 중 오류가 발생했습니다.',
      );
    }
  }
}