import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import * as request from 'supertest';
import * as jwt from 'jsonwebtoken';
import { AppModule } from '../src/app.module';
import { DataSource } from 'typeorm';
import { DbCleaner, Tables } from './utils/db-cleaner';
import { setupApp } from '../src/config/app-setup';

describe('User Auth API (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let dbCleaner: DbCleaner;

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
  }, 60000);

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await dbCleaner.cleanTables([
      Tables.POST_LIKE,
      Tables.POST,
      Tables.USER_INFO,
      Tables.USER_AUTH,
    ]);
    await dbCleaner.cleanCache();
  });

  describe('POST /users/auth/join', () => {
    it('새로운 사용자가 회원가입할 수 있다', async () => {
      // When: 회원가입 요청
      const response = await request(app.getHttpServer())
        .post('/users/auth/join')
        .send({
          uid: 'newuser@example.com',
          password: 'Password123!',
        });

      // Then: 성공 및 토큰 발급
      expect(response.status).toBe(201);
      expect(response.body.accessToken).toBeDefined();
      expect(response.headers['set-cookie']).toBeDefined();
    });
  });

  describe('POST /users/auth/login', () => {
    it('가입된 사용자가 로그인할 수 있다', async () => {
      // Given: 사용자 생성
      const uid = 'testuser@example.com';
      const password = 'Password123!';

      await request(app.getHttpServer())
        .post('/users/auth/join')
        .send({ uid, password });

      // When: 로그인 요청
      const response = await request(app.getHttpServer())
        .post('/users/auth/login')
        .send({ uid, password });

      // Then: 성공 및 토큰 발급
      expect(response.status).toBe(201);
      expect(response.body.accessToken).toBeDefined();
      expect(response.headers['set-cookie']).toBeDefined();
    });

    it('로그인 후 발급된 refreshToken으로 API 호출이 가능하다', async () => {
      // Given: 사용자 생성 및 로그인
      const uid = 'testuser@example.com';
      const password = 'Password123!';

      await request(app.getHttpServer())
        .post('/users/auth/join')
        .send({ uid, password });

      const loginResponse = await request(app.getHttpServer())
        .post('/users/auth/login')
        .send({ uid, password });

      const accessToken = loginResponse.body.accessToken;
      const refreshToken = loginResponse.headers['set-cookie']?.[0] || '';

      // When: 발급된 토큰으로 API 호출
      const response = await request(app.getHttpServer())
        .get('/posts?page=1')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('Cookie', refreshToken);

      // Then: 성공 (refreshToken이 DB에 정상 저장되어 검증 통과)
      expect(response.status).toBe(200);
    });
  });

  describe('Token Refresh', () => {
    it('accessToken 만료 시 API 호출이 거부된다', async () => {
      // Given: 사용자 생성 및 로그인
      const uid = 'testuser@example.com';
      const password = 'Password123!';

      await request(app.getHttpServer())
        .post('/users/auth/join')
        .send({ uid, password });

      const loginResponse = await request(app.getHttpServer())
        .post('/users/auth/login')
        .send({ uid, password });

      const accessToken = loginResponse.body.accessToken;
      const refreshToken = loginResponse.headers['set-cookie']?.[0] || '';

      // accessToken에서 payload 추출 후 만료된 토큰 생성
      const decoded = jwt.decode(accessToken) as jwt.JwtPayload;
      const expiredAccessToken = jwt.sign(
        { uid: decoded.uid },
        'test-secret-key',
        { algorithm: 'HS256', issuer: 'personal_blog_test', expiresIn: '-1s' },
      );

      // When: 만료된 accessToken으로 API 호출
      const response = await request(app.getHttpServer())
        .get('/posts?page=1')
        .set('Authorization', `Bearer ${expiredAccessToken}`)
        .set('Cookie', refreshToken);

      // Then: 403 응답 (인증 실패)
      expect(response.status).toBe(403);
    });

    it('POST /users/auth/refresh로 토큰을 갱신할 수 있다', async () => {
      // Given: 사용자 생성 및 로그인
      const uid = 'testuser@example.com';
      const password = 'Password123!';

      await request(app.getHttpServer())
        .post('/users/auth/join')
        .send({ uid, password });

      const loginResponse = await request(app.getHttpServer())
        .post('/users/auth/login')
        .send({ uid, password });

      const refreshToken = loginResponse.headers['set-cookie']?.[0] || '';

      // When: refresh 엔드포인트 호출
      const refreshResponse = await request(app.getHttpServer())
        .post('/users/auth/refresh')
        .set('Cookie', refreshToken);

      // Then: 새 토큰 발급
      expect(refreshResponse.status).toBe(201);
      expect(refreshResponse.body.accessToken).toBeDefined();
      expect(refreshResponse.headers['set-cookie']).toBeDefined();
    });

    it('유효하지 않은 refreshToken으로 갱신 시 401 응답', async () => {
      // When: 유효하지 않은 refreshToken으로 refresh 요청
      const response = await request(app.getHttpServer())
        .post('/users/auth/refresh')
        .set('Cookie', 'refreshToken=invalid-token');

      // Then: 401 응답
      expect(response.status).toBe(200);
      expect(response.body.statusCode).toBe(401);
    });
  });
});
