import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { CommunityPost } from '../entities/community-post.entity';
import { CommunityComment } from '../entities/community-comment.entity';
import { CommunityPostLike } from '../entities/community-post-like.entity';
import { Stock } from 'src/modules/stocks/entities/stock.entity';
import { BoardType } from 'src/modules/enums/board-type.enum';
import { ContentStatus } from 'src/modules/enums/content-status.enum';
import { CreatePostDto } from '../dto/create-post.dto';
import { UpdatePostDto } from '../dto/update-post.dto';
import { CreateCommentDto } from '../dto/create-comment.dto';
import {
  CommunitySearchType,
  CommunitySortType,
  FindPostsQueryDto,
} from '../dto/find-posts-query.dto';
import { FindCommentsQueryDto } from '../dto/find-comments-query.dto';
import {
  CommunityCommentResponse,
  CommunityPostResponse,
  PagedResult,
} from '../community.types';

@Injectable()
export class CommunityService {
  constructor(
    @InjectRepository(CommunityPost)
    private readonly postRepository: Repository<CommunityPost>,

    @InjectRepository(CommunityComment)
    private readonly commentRepository: Repository<CommunityComment>,

    @InjectRepository(CommunityPostLike)
    private readonly likeRepository: Repository<CommunityPostLike>,

    @InjectRepository(Stock)
    private readonly stockRepository: Repository<Stock>,
  ) {}

  private to_post_response(post: CommunityPost, withContent = true): CommunityPostResponse {
    return {
      postId: post.post_id,
      boardType: post.board_type,
      userId: post.user_id,
      author: post.user
        ? {
            userId: post.user.user_id,
            nickname: post.user.nickname,
            profileImageUrl: post.user.profile_image_url ?? null,
          }
        : null,
      stock: post.stock
        ? { stockId: post.stock.stockId, ticker: post.stock.ticker, companyName: post.stock.companyName }
        : null,
      title: post.title,
      ...(withContent ? { content: post.content } : {}),
      viewCount: post.view_count,
      likeCount: post.like_count,
      commentCount: post.comment_count,
      status: post.status,
      createdAt: post.created_at,
      updatedAt: post.updated_at,
    };
  }

  private to_comment_response(comment: CommunityComment): CommunityCommentResponse {
    return {
      commentId: comment.comment_id,
      postId: comment.post_id,
      userId: comment.user_id,
      author: comment.user
        ? {
            userId: comment.user.user_id,
            nickname: comment.user.nickname,
            profileImageUrl: comment.user.profile_image_url ?? null,
          }
        : null,
      content: comment.content,
      status: comment.status,
      createdAt: comment.created_at,
      updatedAt: comment.updated_at,
    };
  }

  private get_order_column(sort?: CommunitySortType): string {
    switch (sort) {
      case CommunitySortType.VIEWS:
        return 'post.view_count';
      case CommunitySortType.LIKES:
        return 'post.like_count';
      case CommunitySortType.COMMENTS:
        return 'post.comment_count';
      default:
        return 'post.created_at';
    }
  }

  private async resolveStockIdByTicker(ticker: string): Promise<number> {
    const stock = await this.stockRepository.findOne({ where: { ticker } });
    if (!stock) {
      throw new NotFoundException('해당 종목을 찾을 수 없습니다.');
    }
    return stock.stockId;
  }

  private async findActivePostEntity(postId: number): Promise<CommunityPost> {
    const post = await this.postRepository.findOne({
      where: { post_id: postId },
      relations: ['user', 'stock'],
    });

    if (!post || post.status === ContentStatus.DELETED) {
      throw new NotFoundException('게시글을 찾을 수 없습니다.');
    }

    return post;
  }

  async findPosts(
    boardType: BoardType,
    query: FindPostsQueryDto,
    stockId?: number,
  ): Promise<PagedResult<CommunityPostResponse>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const qb = this.postRepository
      .createQueryBuilder('post')
      .leftJoinAndSelect('post.user', 'user')
      .leftJoinAndSelect('post.stock', 'stock')
      .where('post.board_type = :boardType', { boardType })
      .andWhere('post.status = :status', { status: ContentStatus.ACTIVE });

    if (stockId) {
      qb.andWhere('post.stock_id = :stockId', { stockId });
    }

    if (query.keyword) {
      const kw = `%${query.keyword}%`;
      if (query.searchType === CommunitySearchType.CONTENT) {
        qb.andWhere('post.content LIKE :kw', { kw });
      } else if (query.searchType === CommunitySearchType.TITLE) {
        qb.andWhere('post.title LIKE :kw', { kw });
      } else {
        qb.andWhere('(post.title LIKE :kw OR post.content LIKE :kw)', { kw });
      }
    }

    qb.orderBy(this.get_order_column(query.sort), 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [posts, total] = await qb.getManyAndCount();

    return {
      items: posts.map((post) => this.to_post_response(post, false)),
      meta: { total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) },
    };
  }

  findFreePosts(query: FindPostsQueryDto) {
    return this.findPosts(BoardType.FREE, query);
  }

  findAllStockPosts(query: FindPostsQueryDto) {
    return this.findPosts(BoardType.STOCK, query);
  }

  async findStockPostsByTicker(ticker: string, query: FindPostsQueryDto) {
    const stockId = await this.resolveStockIdByTicker(ticker);
    return this.findPosts(BoardType.STOCK, query, stockId);
  }

  async findPostDetail(postId: number): Promise<CommunityPostResponse> {
    const post = await this.findActivePostEntity(postId);
    await this.postRepository.increment({ post_id: postId }, 'view_count', 1);
    post.view_count += 1;
    return this.to_post_response(post);
  }

  async createFreePost(userId: number, dto: CreatePostDto): Promise<CommunityPostResponse> {
    const post = this.postRepository.create({
      board_type: BoardType.FREE,
      user_id: userId,
      stock_id: null,
      title: dto.title,
      content: dto.content,
    });
    const saved = await this.postRepository.save(post);
    return this.findPostDetail(saved.post_id);
  }

  async createStockPost(userId: number, ticker: string, dto: CreatePostDto): Promise<CommunityPostResponse> {
    const stockId = await this.resolveStockIdByTicker(ticker);
    const post = this.postRepository.create({
      board_type: BoardType.STOCK,
      user_id: userId,
      stock_id: stockId,
      title: dto.title,
      content: dto.content,
    });
    const saved = await this.postRepository.save(post);
    return this.findPostDetail(saved.post_id);
  }

  async updatePost(userId: number, postId: number, dto: UpdatePostDto): Promise<CommunityPostResponse> {
    const post = await this.findActivePostEntity(postId);
    if (post.user_id !== userId) {
      throw new ForbiddenException('본인이 작성한 게시글만 수정할 수 있습니다.');
    }

    if (dto.title !== undefined) post.title = dto.title;
    if (dto.content !== undefined) post.content = dto.content;

    const saved = await this.postRepository.save(post);
    return this.to_post_response(saved);
  }

  async deletePost(userId: number, postId: number) {
    const post = await this.findActivePostEntity(postId);
    if (post.user_id !== userId) {
      throw new ForbiddenException('본인이 작성한 게시글만 삭제할 수 있습니다.');
    }

    post.status = ContentStatus.DELETED;
    post.deleted_at = new Date();
    await this.postRepository.save(post);

    return { message: '게시글이 삭제되었습니다.', postId };
  }

  async findComments(
    postId: number,
    query: FindCommentsQueryDto,
  ): Promise<PagedResult<CommunityCommentResponse>> {
    await this.findActivePostEntity(postId);

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const [comments, total] = await this.commentRepository.findAndCount({
      where: { post_id: postId, status: ContentStatus.ACTIVE },
      relations: ['user'],
      order: { created_at: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      items: comments.map((comment) => this.to_comment_response(comment)),
      meta: { total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) },
    };
  }

  async createComment(userId: number, postId: number, dto: CreateCommentDto): Promise<CommunityCommentResponse> {
    await this.findActivePostEntity(postId);

    const comment = this.commentRepository.create({
      post_id: postId,
      user_id: userId,
      content: dto.content,
    });
    const saved = await this.commentRepository.save(comment);
    await this.postRepository.increment({ post_id: postId }, 'comment_count', 1);

    const withUser = await this.commentRepository.findOne({
      where: { comment_id: saved.comment_id },
      relations: ['user'],
    });
    return this.to_comment_response(withUser!);
  }

  private async findOwnedCommentEntity(userId: number, commentId: number): Promise<CommunityComment> {
    const comment = await this.commentRepository.findOne({
      where: { comment_id: commentId },
      relations: ['user'],
    });

    if (!comment || comment.status === ContentStatus.DELETED) {
      throw new NotFoundException('댓글을 찾을 수 없습니다.');
    }
    if (comment.user_id !== userId) {
      throw new ForbiddenException('본인이 작성한 댓글만 수정/삭제할 수 있습니다.');
    }

    return comment;
  }

  async updateComment(userId: number, commentId: number, dto: CreateCommentDto): Promise<CommunityCommentResponse> {
    const comment = await this.findOwnedCommentEntity(userId, commentId);
    comment.content = dto.content;
    const saved = await this.commentRepository.save(comment);
    return this.to_comment_response(saved);
  }

  async deleteComment(userId: number, commentId: number) {
    const comment = await this.findOwnedCommentEntity(userId, commentId);
    comment.status = ContentStatus.DELETED;
    comment.deleted_at = new Date();
    await this.commentRepository.save(comment);
    await this.postRepository.decrement({ post_id: comment.post_id }, 'comment_count', 1);

    return { message: '댓글이 삭제되었습니다.', commentId };
  }

  async likePost(userId: number, postId: number) {
    await this.findActivePostEntity(postId);

    const existing = await this.likeRepository.findOne({ where: { post_id: postId, user_id: userId } });
    if (existing) {
      throw new ConflictException('이미 좋아요한 게시글입니다.');
    }

    await this.likeRepository.save(this.likeRepository.create({ post_id: postId, user_id: userId }));
    await this.postRepository.increment({ post_id: postId }, 'like_count', 1);

    return { message: '좋아요가 추가되었습니다.', postId };
  }

  async unlikePost(userId: number, postId: number) {
    const existing = await this.likeRepository.findOne({ where: { post_id: postId, user_id: userId } });
    if (!existing) {
      throw new NotFoundException('좋아요 기록을 찾을 수 없습니다.');
    }

    await this.likeRepository.remove(existing);
    await this.postRepository.decrement({ post_id: postId }, 'like_count', 1);

    return { message: '좋아요가 취소되었습니다.', postId };
  }
}
