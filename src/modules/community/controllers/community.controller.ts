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
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';

import { JwtAuthGuard } from '../../users/guards/jwt-auth.guard';
import { CommunityCommentQueryDto } from '../dto/community-comment-query.dto';
import { CommunityPostQueryDto } from '../dto/community-post-query.dto';
import { CreateCommunityCommentDto } from '../dto/create-community-comment.dto';
import { CreateCommunityPostDto } from '../dto/create-community-post.dto';
import { UpdateCommunityCommentDto } from '../dto/update-community-comment.dto';
import { UpdateCommunityPostDto } from '../dto/update-community-post.dto';
import { CommunityService } from '../services/community.service';

@ApiTags('community')
@Controller()
export class CommunityController {
  constructor(private readonly communityService: CommunityService) {}

  @Get('community/posts/free')
  @ApiOperation({ summary: '자유 게시글 목록 조회' })
  findFreePosts(@Query() query: CommunityPostQueryDto) {
    return this.communityService.findFreePosts(query);
  }

  @Post('community/posts/free')
  @ApiBearerAuth('accessToken')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: '자유 게시글 작성' })
  createFreePost(@Req() req, @Body() dto: CreateCommunityPostDto) {
    return this.communityService.createFreePost(req.user.userId, dto);
  }

  @Get('stocks/:ticker/community/posts')
  @ApiOperation({ summary: '특정 종목 게시글 목록 조회' })
  @ApiParam({ name: 'ticker', example: '005930' })
  findStockPosts(
    @Param('ticker') ticker: string,
    @Query() query: CommunityPostQueryDto,
  ) {
    return this.communityService.findStockPosts(ticker, query);
  }

  @Post('stocks/:ticker/community/posts')
  @ApiBearerAuth('accessToken')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: '특정 종목 게시글 작성' })
  @ApiParam({ name: 'ticker', example: '005930' })
  createStockPost(
    @Req() req,
    @Param('ticker') ticker: string,
    @Body() dto: CreateCommunityPostDto,
  ) {
    return this.communityService.createStockPost(req.user.userId, ticker, dto);
  }

  @Get('community/posts/stock')
  @ApiOperation({ summary: '전체 종목 게시글 목록 조회 (특정 종목으로 필터링하지 않음)' })
  findAllStockPosts(@Query() query: CommunityPostQueryDto) {
    return this.communityService.findAllStockPosts(query);
  }

  @Get('community/posts/:postId')
  @ApiOperation({ summary: '게시글 상세 조회 및 조회수 증가' })
  findPostDetail(@Param('postId', ParseIntPipe) postId: number) {
    return this.communityService.findPostDetail(postId);
  }

  @Patch('community/posts/:postId')
  @ApiBearerAuth('accessToken')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: '게시글 수정' })
  updatePost(
    @Req() req,
    @Param('postId', ParseIntPipe) postId: number,
    @Body() dto: UpdateCommunityPostDto,
  ) {
    return this.communityService.updatePost(req.user.userId, postId, dto);
  }

  @Delete('community/posts/:postId')
  @ApiBearerAuth('accessToken')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: '게시글 삭제' })
  deletePost(@Req() req, @Param('postId', ParseIntPipe) postId: number) {
    return this.communityService.deletePost(req.user.userId, postId);
  }

  @Get('community/posts/:postId/comments')
  @ApiOperation({ summary: '댓글 목록 조회' })
  findComments(
    @Param('postId', ParseIntPipe) postId: number,
    @Query() query: CommunityCommentQueryDto,
  ) {
    return this.communityService.findComments(postId, query);
  }

  @Post('community/posts/:postId/comments')
  @ApiBearerAuth('accessToken')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: '댓글 작성' })
  createComment(
    @Req() req,
    @Param('postId', ParseIntPipe) postId: number,
    @Body() dto: CreateCommunityCommentDto,
  ) {
    return this.communityService.createComment(req.user.userId, postId, dto);
  }

  @Patch('community/comments/:commentId')
  @ApiBearerAuth('accessToken')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: '댓글 수정' })
  updateComment(
    @Req() req,
    @Param('commentId', ParseIntPipe) commentId: number,
    @Body() dto: UpdateCommunityCommentDto,
  ) {
    return this.communityService.updateComment(
      req.user.userId,
      commentId,
      dto,
    );
  }

  @Delete('community/comments/:commentId')
  @ApiBearerAuth('accessToken')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: '댓글 삭제' })
  deleteComment(
    @Req() req,
    @Param('commentId', ParseIntPipe) commentId: number,
  ) {
    return this.communityService.deleteComment(req.user.userId, commentId);
  }

  @Post('community/posts/:postId/like')
  @ApiBearerAuth('accessToken')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: '게시글 좋아요' })
  likePost(@Req() req, @Param('postId', ParseIntPipe) postId: number) {
    return this.communityService.likePost(req.user.userId, postId);
  }

  @Delete('community/posts/:postId/like')
  @ApiBearerAuth('accessToken')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: '게시글 좋아요 취소' })
  unlikePost(@Req() req, @Param('postId', ParseIntPipe) postId: number) {
    return this.communityService.unlikePost(req.user.userId, postId);
  }
}
