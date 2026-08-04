import {
<<<<<<< HEAD
=======
  BadRequestException,
>>>>>>> community/function
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
<<<<<<< HEAD
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
=======
import { DataSource, Repository } from 'typeorm';

import { Stock, StockStatus } from '../../stocks/entities/stock.entity';
import { CreateCommunityCommentDto } from '../dto/create-community-comment.dto';
import { CreateCommunityPostDto } from '../dto/create-community-post.dto';
import { CommunityCommentQueryDto } from '../dto/community-comment-query.dto';
import { CommunityPostQueryDto } from '../dto/community-post-query.dto';
import { UpdateCommunityCommentDto } from '../dto/update-community-comment.dto';
import { UpdateCommunityPostDto } from '../dto/update-community-post.dto';
import { CommunityComment } from '../entities/community-comment.entity';
import { CommunityPostLike } from '../entities/community-post-like.entity';
import {
  CommunityBoardType,
  CommunityContentStatus,
  CommunityPost,
} from '../entities/community-post.entity';
>>>>>>> community/function

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
<<<<<<< HEAD
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
=======

    private readonly dataSource: DataSource,
  ) {}

  async findFreePosts(query: CommunityPostQueryDto) {
    return this.findPosts(CommunityBoardType.FREE, query);
  }

  async createFreePost(userId: number, dto: CreateCommunityPostDto) {
    const post = this.postRepository.create({
      boardType: CommunityBoardType.FREE,
      userId,
      stockId: null,
      title: dto.title,
      content: dto.content,
      status: CommunityContentStatus.ACTIVE,
    });

    const saved = await this.postRepository.save(post);
    return this.findPostDetail(saved.postId, false);
  }

  async findStockPosts(ticker: string, query: CommunityPostQueryDto) {
    const stock = await this.findActiveStock(ticker);
    return this.findPosts(CommunityBoardType.STOCK, query, stock.stockId);
  }

  async findAllStockPosts(query: CommunityPostQueryDto) {
    return this.findPosts(CommunityBoardType.STOCK, query);
  }

  async createStockPost(
    userId: number,
    ticker: string,
    dto: CreateCommunityPostDto,
  ) {
    const stock = await this.findActiveStock(ticker);
    const post = this.postRepository.create({
      boardType: CommunityBoardType.STOCK,
      userId,
      stockId: stock.stockId,
      title: dto.title,
      content: dto.content,
      status: CommunityContentStatus.ACTIVE,
    });

    const saved = await this.postRepository.save(post);
    return this.findPostDetail(saved.postId, false);
  }

  async findPostDetail(postId: number, increaseViewCount = true) {
    const post = await this.findActivePost(postId);

    if (increaseViewCount) {
      await this.postRepository.increment(
        { postId, status: CommunityContentStatus.ACTIVE },
        'viewCount',
        1,
      );
      post.viewCount += 1;
    }

    return this.toPostResponse(post, true);
  }

  async updatePost(userId: number, postId: number, dto: UpdateCommunityPostDto) {
    if (!dto.title && !dto.content) {
      throw new BadRequestException('수정할 제목 또는 내용을 입력해야 합니다.');
    }

    const post = await this.findActivePost(postId);
    this.assertOwner(userId, post.userId);

    if (dto.title !== undefined) {
      post.title = dto.title;
    }

    if (dto.content !== undefined) {
      post.content = dto.content;
    }

    const saved = await this.postRepository.save(post);
    return this.toPostResponse(saved, true);
  }

  async deletePost(userId: number, postId: number) {
    const post = await this.findActivePost(postId);
    this.assertOwner(userId, post.userId);

    post.status = CommunityContentStatus.DELETED;
    post.deletedAt = new Date();
    await this.postRepository.save(post);

    return {
      message: '게시글이 삭제되었습니다.',
      postId,
    };
  }

  async findComments(postId: number, query: CommunityCommentQueryDto) {
    await this.findActivePost(postId);

    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const [comments, total] = await this.commentRepository.findAndCount({
      where: {
        postId,
        status: CommunityContentStatus.ACTIVE,
      },
      relations: {
        user: true,
      },
      order: {
        createdAt: 'ASC',
      },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      items: comments.map((comment) => this.toCommentResponse(comment)),
      meta: this.toPageMeta(total, page, limit),
    };
  }

  async createComment(
    userId: number,
    postId: number,
    dto: CreateCommunityCommentDto,
  ) {
    const post = await this.findActivePost(postId);

    const comment = await this.dataSource.transaction(async (manager) => {
      const savedComment = await manager.getRepository(CommunityComment).save({
        postId: post.postId,
        userId,
        content: dto.content,
        status: CommunityContentStatus.ACTIVE,
      });

      await manager
        .getRepository(CommunityPost)
        .increment({ postId: post.postId }, 'commentCount', 1);

      return savedComment;
    });

    const saved = await this.commentRepository.findOne({
      where: { commentId: comment.commentId },
      relations: { user: true },
    });

    return this.toCommentResponse(saved ?? comment);
  }

  async updateComment(
    userId: number,
    commentId: number,
    dto: UpdateCommunityCommentDto,
  ) {
    const comment = await this.findActiveComment(commentId);
    this.assertOwner(userId, comment.userId);

    comment.content = dto.content;
    const saved = await this.commentRepository.save(comment);
    return this.toCommentResponse(saved);
  }

  async deleteComment(userId: number, commentId: number) {
    const comment = await this.findActiveComment(commentId);
    this.assertOwner(userId, comment.userId);

    await this.dataSource.transaction(async (manager) => {
      await manager.getRepository(CommunityComment).update(
        { commentId },
        {
          status: CommunityContentStatus.DELETED,
          deletedAt: new Date(),
        },
      );

      await manager
        .getRepository(CommunityPost)
        .decrement({ postId: comment.postId }, 'commentCount', 1);
    });

    return {
      message: '댓글이 삭제되었습니다.',
      commentId,
    };
  }

  async likePost(userId: number, postId: number) {
    const post = await this.findActivePost(postId);

    await this.dataSource.transaction(async (manager) => {
      const likeRepository = manager.getRepository(CommunityPostLike);
      const exists = await likeRepository.findOne({
        where: {
          postId: post.postId,
          userId,
        },
      });

      if (exists) {
        throw new ConflictException('이미 좋아요한 게시글입니다.');
      }

      await likeRepository.save({
        postId: post.postId,
        userId,
      });
      await manager
        .getRepository(CommunityPost)
        .increment({ postId: post.postId }, 'likeCount', 1);
    });

    return {
      message: '게시글 좋아요가 추가되었습니다.',
      postId,
    };
  }

  async unlikePost(userId: number, postId: number) {
    const post = await this.findActivePost(postId);

    await this.dataSource.transaction(async (manager) => {
      const result = await manager.getRepository(CommunityPostLike).delete({
        postId: post.postId,
        userId,
      });

      if (!result.affected) {
        throw new NotFoundException('취소할 좋아요를 찾을 수 없습니다.');
      }

      await manager
        .getRepository(CommunityPost)
        .decrement({ postId: post.postId }, 'likeCount', 1);
    });

    return {
      message: '게시글 좋아요가 취소되었습니다.',
      postId,
    };
  }

  private async findPosts(
    boardType: CommunityBoardType,
    query: CommunityPostQueryDto,
    stockId?: number,
  ) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const sort = query.sort ?? 'latest';
    const searchType = query.searchType ?? 'all';
    const keyword = query.keyword?.trim();
>>>>>>> community/function

    const qb = this.postRepository
      .createQueryBuilder('post')
      .leftJoinAndSelect('post.user', 'user')
      .leftJoinAndSelect('post.stock', 'stock')
<<<<<<< HEAD
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
=======
      .where('post.boardType = :boardType', { boardType })
      .andWhere('post.status = :status', {
        status: CommunityContentStatus.ACTIVE,
      });

    if (boardType === CommunityBoardType.FREE) {
      qb.andWhere('post.stockId IS NULL');
    }

    if (stockId !== undefined) {
      qb.andWhere('post.stockId = :stockId', { stockId });
    }

    if (keyword) {
      const keywordPattern = `%${keyword}%`;

      if (searchType === 'title') {
        qb.andWhere('post.title LIKE :keyword', {
          keyword: keywordPattern,
        });
      } else if (searchType === 'content') {
        qb.andWhere('post.content LIKE :keyword', {
          keyword: keywordPattern,
        });
      } else {
        qb.andWhere(
          '(post.title LIKE :keyword OR post.content LIKE :keyword)',
          { keyword: keywordPattern },
        );
      }
    }

    if (sort === 'views') {
      qb.orderBy('post.viewCount', 'DESC');
    } else if (sort === 'likes') {
      qb.orderBy('post.likeCount', 'DESC');
    } else if (sort === 'comments') {
      qb.orderBy('post.commentCount', 'DESC');
    } else {
      qb.orderBy('post.createdAt', 'DESC');
    }

    qb.addOrderBy('post.postId', 'DESC')
>>>>>>> community/function
      .skip((page - 1) * limit)
      .take(limit);

    const [posts, total] = await qb.getManyAndCount();

    return {
<<<<<<< HEAD
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
=======
      items: posts.map((post) => this.toPostResponse(post)),
      meta: this.toPageMeta(total, page, limit),
    };
  }

  private async findActivePost(postId: number) {
    const post = await this.postRepository.findOne({
      where: {
        postId,
        status: CommunityContentStatus.ACTIVE,
      },
      relations: {
        user: true,
        stock: true,
      },
    });

    if (!post) {
      throw new NotFoundException('게시글을 찾을 수 없습니다.');
    }

    return post;
  }

  private async findActiveComment(commentId: number) {
    const comment = await this.commentRepository.findOne({
      where: {
        commentId,
        status: CommunityContentStatus.ACTIVE,
      },
      relations: {
        user: true,
      },
    });

    if (!comment) {
      throw new NotFoundException('댓글을 찾을 수 없습니다.');
    }
>>>>>>> community/function

    return comment;
  }

<<<<<<< HEAD
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
=======
  private async findActiveStock(ticker: string) {
    const stock = await this.stockRepository.findOne({
      where: {
        ticker,
        status: StockStatus.ACTIVE,
        isActive: true,
      },
    });

    if (!stock) {
      throw new NotFoundException('종목을 찾을 수 없습니다.');
    }

    return stock;
  }

  private assertOwner(userId: number, ownerId: number) {
    if (userId !== ownerId) {
      throw new ForbiddenException('작성자 본인만 수정 또는 삭제할 수 있습니다.');
    }
  }

  private toPostResponse(post: CommunityPost, includeContent = false) {
    return {
      postId: post.postId,
      boardType: post.boardType,
      userId: post.userId,
      author: post.user
        ? {
            userId: post.user.user_id,
            nickname: post.user.nickname,
            profileImageUrl: post.user.profile_image_url,
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
      content: includeContent ? post.content : undefined,
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
            profileImageUrl: comment.user.profile_image_url,
          }
        : null,
      content: comment.content,
      status: comment.status,
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
    };
  }

  private toPageMeta(total: number, page: number, limit: number) {
    return {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
>>>>>>> community/function
  }
}
