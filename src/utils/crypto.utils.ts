import { AES } from 'crypto-js';
import * as CryptoJS from 'crypto-js';

export class CryptoUtils {
  static encryptPrimaryKey(value: string, pkSecretKey: string) {
    return encodeURIComponent(AES.encrypt(value, pkSecretKey).toString());
  }

  static decryptPrimaryKey(value: string, pkSecretKey: string) {
    return AES.decrypt(decodeURIComponent(value), pkSecretKey).toString(
      CryptoJS.enc.Utf8,
    );
  }
}
