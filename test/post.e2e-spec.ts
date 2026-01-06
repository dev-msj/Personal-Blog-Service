import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { DataSource } from 'typeorm';
import { DbCleaner } from './utils/db-cleaner';
import { AuthHelper } from './utils/auth-helper';
import { setupApp } from '../src/config/app-setup';

describe('Post API (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let dbCleaner: DbCleaner;
  let authHelper: AuthHelper;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideModule(CacheModule)
      .useModule(CacheModule.register({ isGlobal: true }))
      .compile();

    app = moduleFixture.createNestApplication();
    setupApp(app);
    await app.init();

    dataSource = moduleFixture.get<DataSource>(DataSource);
    dbCleaner = new DbCleaner(dataSource);
    authHelper = new AuthHelper(app);
  }, 60000);

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await dbCleaner.cleanAll();
    await dbCleaner.cleanCache();
  });

  describe('POST /posts', () => {
    it('인증된 사용자가 새 글을 생성할 수 있다', async () => {
      // Given: 테스트 사용자 생성
      await authHelper.createTestUser('testuser@example.com', 'Password123!');

      // When: 새 글 생성 요청
      const response = await request(app.getHttpServer())
        .post('/posts')
        .set('Authorization', authHelper.getAuthHeader())
        .set('Cookie', authHelper.getRefreshToken())
        .send({
          title: '테스트 글 제목',
          contents: '테스트 글 내용입니다.',
        });

      // Then: 성공 응답
      expect(response.status).toBe(201);
      expect(response.body.code).toBe(200);
      expect(response.body.message).toBe('Success!');
    });

    it('인증되지 않은 사용자는 글을 생성할 수 없다', async () => {
      // When: 인증 없이 글 생성 요청
      const response = await request(app.getHttpServer()).post('/posts').send({
        title: '테스트 글 제목',
        contents: '테스트 글 내용입니다.',
      });

      // Then: 인증 실패 (HttpExceptionFilter가 HTTP 200으로 반환하고 body.code에 실제 상태 코드 포함)
      expect(response.status).toBe(200);
      expect(response.body.code).toBe(403);
    });
  });

  describe('GET /posts', () => {
    it('전체 게시글 목록을 조회할 수 있다', async () => {
      // Given: 테스트 사용자 및 게시글 생성
      await authHelper.createTestUser('testuser@example.com', 'Password123!');

      await request(app.getHttpServer())
        .post('/posts')
        .set('Authorization', authHelper.getAuthHeader())
        .set('Cookie', authHelper.getRefreshToken())
        .send({ title: '테스트 글', contents: '테스트 내용' });

      // When: 게시글 목록 조회
      const response = await request(app.getHttpServer())
        .get('/posts?page=1')
        .set('Authorization', authHelper.getAuthHeader())
        .set('Cookie', authHelper.getRefreshToken());

      // Then: 목록 응답
      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.paginationMeta.total).toBe(1);
    });
  });

  describe('GET /posts/:encryptedPostId', () => {
    it('특정 게시글을 조회할 수 있다', async () => {
      // Given: 테스트 사용자 및 게시글 생성
      await authHelper.createTestUser('testuser@example.com', 'Password123!');
      const createPayload = { title: '조회할 글', contents: '조회할 내용' };

      await request(app.getHttpServer())
        .post('/posts')
        .set('Authorization', authHelper.getAuthHeader())
        .set('Cookie', authHelper.getRefreshToken())
        .send(createPayload);

      // 목록에서 게시글 ID 가져오기
      const listResponse = await request(app.getHttpServer())
        .get('/posts?page=1')
        .set('Authorization', authHelper.getAuthHeader())
        .set('Cookie', authHelper.getRefreshToken());

      const postId = listResponse.body.data[0].postId;

      // When: 특정 게시글 조회
      const response = await request(app.getHttpServer())
        .get(`/posts/${postId}`)
        .set('Authorization', authHelper.getAuthHeader())
        .set('Cookie', authHelper.getRefreshToken());

      // Then: 게시글 정보 반환
      expect(response.status).toBe(200);
      expect(response.body.title).toBe(createPayload.title);
      expect(response.body.contents).toBe(createPayload.contents);
    });
  });

  describe('PATCH /posts/:encryptedPostId', () => {
    it('자신의 게시글을 수정할 수 있다', async () => {
      // Given: 테스트 사용자 및 게시글 생성
      await authHelper.createTestUser('testuser@example.com', 'Password123!');
      const modifyTitle = '수정된 제목';

      await request(app.getHttpServer())
        .post('/posts')
        .set('Authorization', authHelper.getAuthHeader())
        .set('Cookie', authHelper.getRefreshToken())
        .send({ title: '원본 제목', contents: '원본 내용' });

      const listResponse = await request(app.getHttpServer())
        .get('/posts?page=1')
        .set('Authorization', authHelper.getAuthHeader())
        .set('Cookie', authHelper.getRefreshToken());

      const postId = listResponse.body.data[0].postId;

      // When: 게시글 수정
      const response = await request(app.getHttpServer())
        .patch(`/posts/${postId}`)
        .set('Authorization', authHelper.getAuthHeader())
        .set('Cookie', authHelper.getRefreshToken())
        .send({ title: modifyTitle });

      // Then: 수정 성공
      expect(response.status).toBe(200);
      expect(response.body.code).toBe(200);

      // 수정 확인
      const getResponse = await request(app.getHttpServer())
        .get(`/posts/${postId}`)
        .set('Authorization', authHelper.getAuthHeader())
        .set('Cookie', authHelper.getRefreshToken());

      expect(getResponse.body.title).toBe(modifyTitle);
    });
  });

  describe('DELETE /posts/:encryptedPostId', () => {
    it('자신의 게시글을 삭제할 수 있다', async () => {
      // Given: 테스트 사용자 및 게시글 생성
      await authHelper.createTestUser('testuser@example.com', 'Password123!');

      await request(app.getHttpServer())
        .post('/posts')
        .set('Authorization', authHelper.getAuthHeader())
        .set('Cookie', authHelper.getRefreshToken())
        .send({ title: '삭제할 글', contents: '삭제할 내용' });

      const listResponse = await request(app.getHttpServer())
        .get('/posts?page=1')
        .set('Authorization', authHelper.getAuthHeader())
        .set('Cookie', authHelper.getRefreshToken());

      const postId = listResponse.body.data[0].postId;

      // When: 게시글 삭제
      const response = await request(app.getHttpServer())
        .delete(`/posts/${postId}`)
        .set('Authorization', authHelper.getAuthHeader())
        .set('Cookie', authHelper.getRefreshToken());

      // Then: 삭제 성공
      expect(response.status).toBe(200);
      expect(response.body.code).toBe(200);
    });
  });
});
