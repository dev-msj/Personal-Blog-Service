import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';

/**
 * E2E 테스트용 인증 헬퍼
 * 테스트에서 인증된 사용자로 API를 호출할 수 있도록 지원
 */
export class AuthHelper {
  private accessToken: string;
  private refreshToken: string;

  constructor(private readonly app: INestApplication) {}

  /**
   * 테스트용 사용자 생성 및 토큰 발급
   */
  async createTestUser(
    uid: string = 'test@example.com',
    password: string = 'testPassword123!',
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const response = await request(this.app.getHttpServer())
      .post('/users/auth/join')
      .send({ uid, password })
      .expect(201);

    this.accessToken = response.body.accessToken;
    this.refreshToken = response.headers['set-cookie']?.[0] || '';

    return {
      accessToken: this.accessToken,
      refreshToken: this.refreshToken,
    };
  }

  /**
   * 기존 사용자로 로그인하여 토큰 발급
   */
  async login(
    uid: string,
    password: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const response = await request(this.app.getHttpServer())
      .post('/users/auth/login')
      .send({ uid, password })
      .expect(201);

    this.accessToken = response.body.accessToken;
    this.refreshToken = response.headers['set-cookie']?.[0] || '';

    return {
      accessToken: this.accessToken,
      refreshToken: this.refreshToken,
    };
  }

  /**
   * Authorization 헤더 값 반환
   */
  getAuthHeader(): string {
    return `Bearer ${this.accessToken}`;
  }

  /**
   * 현재 액세스 토큰 반환
   */
  getAccessToken(): string {
    return this.accessToken;
  }

  /**
   * 현재 리프레시 토큰 반환
   */
  getRefreshToken(): string {
    return this.refreshToken;
  }
}
