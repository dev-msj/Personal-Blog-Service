import { AES } from 'crypto-js';
import * as CryptoJS from 'crypto-js';

export class CryptoUtils {
  static encryptPostPK(value: string, pkSecretKey: string) {
    return encodeURIComponent(AES.encrypt(value, pkSecretKey).toString());
  }

  static decryptPostPK(value: string, pkSecretKey: string) {
    return AES.decrypt(decodeURIComponent(value), pkSecretKey).toString(
      CryptoJS.enc.Utf8,
    );
  }
}
