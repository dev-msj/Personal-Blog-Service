import { DecryptPrimaryKeyPipe } from './decrypt-primary-key.pipe';
import { CryptoUtils } from '../utils/crypto.utils';

describe('DecryptPrimaryKeyPipe', () => {
  const pkSecretKey = 'test-secret-key!';
  let pipe: DecryptPrimaryKeyPipe;

  beforeAll(() => {
    pipe = new DecryptPrimaryKeyPipe({ pkSecretKey } as any);
  });

  it('암호화된 값을 복호화하여 반환한다', () => {
    // Given
    const originalValue = '123';
    const encrypted = CryptoUtils.encryptPrimaryKey(originalValue, pkSecretKey);

    // When
    const result = pipe.transform(encrypted);

    // Then
    expect(result).toBe(originalValue);
  });

  it('UUID 문자열도 복호화할 수 있다', () => {
    // Given
    const uuid = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
    const encrypted = CryptoUtils.encryptPrimaryKey(uuid, pkSecretKey);

    // When
    const result = pipe.transform(encrypted);

    // Then
    expect(result).toBe(uuid);
  });
});
