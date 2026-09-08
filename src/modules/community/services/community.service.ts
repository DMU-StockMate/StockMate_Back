import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Stock } from '../../stocks/entities/stock.entity';
import { NotificationType } from '../../notification/entities/notification.entity';
import { NotificationService } from '../../notification/services/notification.service';
import { CommunityCommentQueryDto } from '../dto/community-comment-query.dto';
import { CommunityPostQueryDto } from '../dto/community-post-query.dto';
import { CreateCommunityCommentDto } from '../dto/create-community-comment.dto';
import { CreateCommunityPostDto } from '../dto/create-community-post.dto';
import { UpdateCommunityCommentDto } from '../dto/update-community-comment.dto';
import { UpdateCommunityPostDto } from '../dto/update-community-post.dto';
import { CommunityComment } from '../entities/community-comment.entity';
import { CommunityPostLike } from '../entities/community-post-like.entity';
import {
  CommunityBoardType,
  CommunityContentStatus,
  CommunityPost,
} from '../entities/community-post.entity';

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

    private readonly notificationService: NotificationService,
  ) {}

  findFreePosts(query: CommunityPostQueryDto) {
    return this.findPosts(CommunityBoardType.FREE, query);
  }

  async createFreePost(userId: number, dto: CreateCommunityPostDto) {
    const post = await this.postRepository.save(
      this.postRepository.create({
        boardType: CommunityBoardType.FREE,
        userId,
        stockId: null,
        title: dto.title,
        content: dto.content,
      }),
    );

    return this.findPostDetail(post.postId, false);
  }

  async findStockPosts(ticker: string, query: CommunityPostQueryDto) {
    const stock = await this.findStockByTicker(ticker);
    return this.findPosts(CommunityBoardType.STOCK, query, stock.stockId);
  }

  async createStockPost(
    userId: number,
    ticker: string,
    dto: CreateCommunityPostDto,
  ) {
    const stock = await this.findStockByTicker(ticker);
    const post = await this.postRepository.save(
      this.postRepository.create({
        boardType: CommunityBoardType.STOCK,
        userId,
        stockId: stock.stockId,
        title: dto.title,
        content: dto.content,
      }),
    );

    return this.findPostDetail(post.postId, false);
  }

  findAllStockPosts(query: CommunityPostQueryDto) {
    return this.findPosts(CommunityBoardType.STOCK, query);
  }

  async findPostDetail(postId: number, incrementView = true) {
    if (incrementView) {
      await this.postRepository.increment({ postId }, 'viewCount', 1);
    }

    const post = await this.findActivePost(postId);
    return this.toPostResponse(post);
  }

  async updatePost(
    userId: number,
    postId: number,
    dto: UpdateCommunityPostDto,
  ) {
    const post = await this.findActivePost(postId);

    if (post.userId !== userId) {
      throw new ForbiddenException('게시글 수정 권한이 없습니다.');
    }

    if (dto.title !== undefined) {
      post.title = dto.title;
    }

    if (dto.content !== undefined) {
      post.content = dto.content;
    }

    await this.postRepository.save(post);
    return this.findPostDetail(postId, false);
  }

  async deletePost(userId: number, postId: number) {
    const post = await this.findActivePost(postId);

    if (post.userId !== userId) {
      throw new ForbiddenException('게시글 삭제 권한이 없습니다.');
    }

    post.status = CommunityContentStatus.DELETED;
    post.deletedAt = new Date();
    await this.postRepository.save(post);

    return { message: '게시글이 삭제되었습니다.', postId };
  }

  async findComments(postId: number, query: CommunityCommentQueryDto) {
    await this.findActivePost(postId);

    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const [items, total] = await this.commentRepository.findAndCount({
      where: { postId, status: CommunityContentStatus.ACTIVE },
      relations: { user: true },
      order: { createdAt: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      items: items.map((comment) => this.toCommentResponse(comment)),
      meta: this.toMeta(total, page, limit),
    };
  }

  async createComment(
    userId: number,
    postId: number,
    dto: CreateCommunityCommentDto,
  ) {
    const post = await this.findActivePost(postId);

    const comment = await this.commentRepository.save(
      this.commentRepository.create({
        postId,
        userId,
        content: dto.content,
      }),
    );
    await this.postRepository.increment({ postId }, 'commentCount', 1);

    if (post.userId !== userId) {
      await this.notificationService.create(
        post.userId,
        NotificationType.COMMUNITY_COMMENT,
        '새 댓글이 달렸습니다',
        `"${post.title}" 글에 새 댓글이 달렸습니다.`,
        `/community/${postId}`,
      );
    }

    return this.commentRepository.findOne({
      where: { commentId: comment.commentId },
      relations: { user: true },
    });
  }

  async updateComment(
    userId: number,
    commentId: number,
    dto: UpdateCommunityCommentDto,
  ) {
    const comment = await this.findActiveComment(commentId);

    if (comment.userId !== userId) {
      throw new ForbiddenException('댓글 수정 권한이 없습니다.');
    }

    comment.content = dto.content;
    await this.commentRepository.save(comment);

    return this.toCommentResponse(comment);
  }

  async deleteComment(userId: number, commentId: number) {
    const comment = await this.findActiveComment(commentId);

    if (comment.userId !== userId) {
      throw new ForbiddenException('댓글 삭제 권한이 없습니다.');
    }

    comment.status = CommunityContentStatus.DELETED;
    comment.deletedAt = new Date();
    await this.commentRepository.save(comment);
    await this.postRepository.decrement(
      { postId: comment.postId },
      'commentCount',
      1,
    );

    return { message: '댓글이 삭제되었습니다.', commentId };
  }

  async likePost(userId: number, postId: number) {
    const post = await this.findActivePost(postId);

    const existing = await this.likeRepository.findOne({
      where: { postId, userId },
    });

    if (existing) {
      throw new ConflictException('이미 좋아요한 게시글입니다.');
    }

    await this.likeRepository.save(this.likeRepository.create({ postId, userId }));
    await this.postRepository.increment({ postId }, 'likeCount', 1);

    if (post.userId !== userId) {
      await this.notificationService.create(
        post.userId,
        NotificationType.COMMUNITY_LIKE,
        '새 좋아요를 받았습니다',
        `"${post.title}" 글에 좋아요가 달렸습니다.`,
        `/community/${postId}`,
      );
    }

    return { message: '좋아요가 등록되었습니다.', postId };
  }

  async unlikePost(userId: number, postId: number) {
    const existing = await this.likeRepository.findOne({
      where: { postId, userId },
    });

    if (!existing) {
      throw new NotFoundException('좋아요를 찾을 수 없습니다.');
    }

    await this.likeRepository.remove(existing);
    await this.postRepository.decrement({ postId }, 'likeCount', 1);

    return { message: '좋아요가 취소되었습니다.', postId };
  }

  private async findPosts(
    boardType: CommunityBoardType,
    query: CommunityPostQueryDto,
    stockId?: number,
  ) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const queryBuilder = this.postRepository
      .createQueryBuilder('post')
      .leftJoinAndSelect('post.user', 'user')
      .leftJoinAndSelect('post.stock', 'stock')
      .where('post.boardType = :boardType', { boardType })
      .andWhere('post.status = :status', {
        status: CommunityContentStatus.ACTIVE,
      })
      .skip((page - 1) * limit)
      .take(limit);

    if (stockId !== undefined) {
      queryBuilder.andWhere('post.stockId = :stockId', { stockId });
    }

    if (query.keyword?.trim()) {
      const keyword = `%${query.keyword.trim()}%`;
      const searchType = query.searchType ?? 'all';

      if (searchType === 'title') {
        queryBuilder.andWhere('post.title LIKE :keyword', { keyword });
      } else if (searchType === 'content') {
        queryBuilder.andWhere('post.content LIKE :keyword', { keyword });
      } else {
        queryBuilder.andWhere(
          '(post.title LIKE :keyword OR post.content LIKE :keyword)',
          { keyword },
        );
      }
    }

    queryBuilder.orderBy(this.getOrderColumn(query.sort), 'DESC');

    const [items, total] = await queryBuilder.getManyAndCount();

    return {
      items: items.map((post) => this.toPostResponse(post, false)),
      meta: this.toMeta(total, page, limit),
    };
  }

  private async findStockByTicker(ticker: string) {
    const stock = await this.stockRepository.findOne({
      where: { ticker, isActive: true },
    });

    if (!stock) {
      throw new NotFoundException('종목을 찾을 수 없습니다.');
    }

    return stock;
  }

  private async findActivePost(postId: number) {
    const post = await this.postRepository.findOne({
      where: { postId },
      relations: { user: true, stock: true },
    });

    if (!post || post.status === CommunityContentStatus.DELETED) {
      throw new NotFoundException('게시글을 찾을 수 없습니다.');
    }

    return post;
  }

  private async findActiveComment(commentId: number) {
    const comment = await this.commentRepository.findOne({
      where: { commentId },
      relations: { user: true },
    });

    if (!comment || comment.status === CommunityContentStatus.DELETED) {
      throw new NotFoundException('댓글을 찾을 수 없습니다.');
    }

    return comment;
  }

  private getOrderColumn(sort?: CommunityPostQueryDto['sort']) {
    switch (sort) {
      case 'views':
        return 'post.viewCount';
      case 'likes':
        return 'post.likeCount';
      case 'comments':
        return 'post.commentCount';
      default:
        return 'post.createdAt';
    }
  }

  private toPostResponse(post: CommunityPost, withContent = true) {
    return {
      postId: post.postId,
      boardType: post.boardType,
      userId: post.userId,
      author: post.user
        ? {
            userId: post.user.user_id,
            nickname: post.user.nickname,
            profileImageUrl: post.user.profile_image_url ?? null,
          }
        : null,
      stock: post.stock
        ? {
            stockId: post.stock.stockId,
            ticker: post.stock.ticker,
            companyName: post.stock.companyName,
          }
        : null,
      title: post.title,
      ...(withContent ? { content: post.content } : {}),
      viewCount: post.viewCount,
      likeCount: post.likeCount,
      commentCount: post.commentCount,
      status: post.status,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
    };
  }

  private toCommentResponse(comment: CommunityComment) {
    return {
      commentId: comment.commentId,
      postId: comment.postId,
      userId: comment.userId,
      author: comment.user
        ? {
            userId: comment.user.user_id,
            nickname: comment.user.nickname,
            profileImageUrl: comment.user.profile_image_url ?? null,
          }
        : null,
      content: comment.content,
      status: comment.status,
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
    };
  }

  private toMeta(total: number, page: number, limit: number) {
    return {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}
