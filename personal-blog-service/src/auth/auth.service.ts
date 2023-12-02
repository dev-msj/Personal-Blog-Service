import { Injectable } from '@nestjs/common';

@Injectable()
export class AuthService {
  verifyAccessToken() {
    return {
      uid: 'asdf',
    };
  }
}
