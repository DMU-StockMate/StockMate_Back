import { BoardType } from 'src/modules/enums/board-type.enum';
import { ContentStatus } from 'src/modules/enums/content-status.enum';

export interface CommunityAuthorResponse {
  userId: number;
  nickname: string;
  profileImageUrl: string | null;
}

export interface CommunityStockRefResponse {
  stockId: number;
  ticker: string;
  companyName: string;
}

export interface CommunityPostResponse {
  postId: number;
  boardType: BoardType;
  userId: number;
  author: CommunityAuthorResponse | null;
  stock: CommunityStockRefResponse | null;
  title: string;
  content?: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  status: ContentStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface CommunityCommentResponse {
  commentId: number;
  postId: number;
  userId: number;
  author: CommunityAuthorResponse | null;
  content: string;
  status: ContentStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface PageMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PagedResult<T> {
  items: T[];
  meta: PageMeta;
}
