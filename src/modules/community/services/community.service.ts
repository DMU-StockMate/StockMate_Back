import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
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

    const qb = this.postRepository
      .createQueryBuilder('post')
      .leftJoinAndSelect('post.user', 'user')
      .leftJoinAndSelect('post.stock', 'stock')
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
      .skip((page - 1) * limit)
      .take(limit);

    const [posts, total] = await qb.getManyAndCount();

    return {
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

    return comment;
  }

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
  }
}
