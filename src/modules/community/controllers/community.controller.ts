import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { JwtAuthGuard } from 'src/modules/users/guards/jwt-auth.guard';
import { CommunityService } from '../services/community.service';
import { CreatePostDto } from '../dto/create-post.dto';
import { UpdatePostDto } from '../dto/update-post.dto';
import { CreateCommentDto } from '../dto/create-comment.dto';
import { FindPostsQueryDto } from '../dto/find-posts-query.dto';
import { FindCommentsQueryDto } from '../dto/find-comments-query.dto';

@ApiTags('community')
@Controller()
export class CommunityController {
  constructor(private readonly communityService: CommunityService) {}

  // ---- 자유 게시판 ----

  @Get('community/posts/free')
  @ApiOperation({ summary: '자유게시판 목록 조회' })
  findFreePosts(@Query() query: FindPostsQueryDto) {
    return this.communityService.findFreePosts(query);
  }

  @Post('community/posts/free')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('accessToken')
  @ApiOperation({ summary: '자유게시판 글 작성' })
  createFreePost(@Req() req, @Body() dto: CreatePostDto) {
    return this.communityService.createFreePost(req.user.userId, dto);
  }

  // ---- 종목 게시판 ----

  @Get('community/posts/stock')
  @ApiOperation({ summary: '전체 종목게시판 목록 조회' })
  findAllStockPosts(@Query() query: FindPostsQueryDto) {
    return this.communityService.findAllStockPosts(query);
  }

  @Get('stocks/:ticker/community/posts')
  @ApiOperation({ summary: '특정 종목 게시판 목록 조회' })
  findStockPostsByTicker(@Param('ticker') ticker: string, @Query() query: FindPostsQueryDto) {
    return this.communityService.findStockPostsByTicker(ticker, query);
  }

  @Post('stocks/:ticker/community/posts')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('accessToken')
  @ApiOperation({ summary: '특정 종목 게시판 글 작성' })
  createStockPost(@Req() req, @Param('ticker') ticker: string, @Body() dto: CreatePostDto) {
    return this.communityService.createStockPost(req.user.userId, ticker, dto);
  }

  // ---- 게시글 상세/수정/삭제 ----

  @Get('community/posts/:postId')
  @ApiOperation({ summary: '게시글 상세 조회' })
  findPostDetail(@Param('postId', ParseIntPipe) postId: number) {
    return this.communityService.findPostDetail(postId);
  }

  @Patch('community/posts/:postId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('accessToken')
  @ApiOperation({ summary: '게시글 수정' })
  updatePost(@Req() req, @Param('postId', ParseIntPipe) postId: number, @Body() dto: UpdatePostDto) {
    return this.communityService.updatePost(req.user.userId, postId, dto);
  }

  @Delete('community/posts/:postId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('accessToken')
  @ApiOperation({ summary: '게시글 삭제' })
  deletePost(@Req() req, @Param('postId', ParseIntPipe) postId: number) {
    return this.communityService.deletePost(req.user.userId, postId);
  }

  // ---- 댓글 ----

  @Get('community/posts/:postId/comments')
  @ApiOperation({ summary: '댓글 목록 조회' })
  findComments(@Param('postId', ParseIntPipe) postId: number, @Query() query: FindCommentsQueryDto) {
    return this.communityService.findComments(postId, query);
  }

  @Post('community/posts/:postId/comments')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('accessToken')
  @ApiOperation({ summary: '댓글 작성' })
  createComment(@Req() req, @Param('postId', ParseIntPipe) postId: number, @Body() dto: CreateCommentDto) {
    return this.communityService.createComment(req.user.userId, postId, dto);
  }

  @Patch('community/comments/:commentId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('accessToken')
  @ApiOperation({ summary: '댓글 수정' })
  updateComment(@Req() req, @Param('commentId', ParseIntPipe) commentId: number, @Body() dto: CreateCommentDto) {
    return this.communityService.updateComment(req.user.userId, commentId, dto);
  }

  @Delete('community/comments/:commentId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('accessToken')
  @ApiOperation({ summary: '댓글 삭제' })
  deleteComment(@Req() req, @Param('commentId', ParseIntPipe) commentId: number) {
    return this.communityService.deleteComment(req.user.userId, commentId);
  }

  // ---- 좋아요 ----

  @Post('community/posts/:postId/like')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('accessToken')
  @ApiOperation({ summary: '게시글 좋아요' })
  likePost(@Req() req, @Param('postId', ParseIntPipe) postId: number) {
    return this.communityService.likePost(req.user.userId, postId);
  }

  @Delete('community/posts/:postId/like')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('accessToken')
  @ApiOperation({ summary: '게시글 좋아요 취소' })
  unlikePost(@Req() req, @Param('postId', ParseIntPipe) postId: number) {
    return this.communityService.unlikePost(req.user.userId, postId);
  }
}
