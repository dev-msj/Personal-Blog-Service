import { DataSource } from 'typeorm';

/**
 * 테이블명 상수
 */
export const Tables = {
  USER_AUTH: 'USER_AUTH',
  USER_INFO: 'USER_INFO',
  POST: 'POST',
  POST_LIKE: 'POST_LIKE',
} as const;

/**
 * 테스트 후 DB 데이터를 정리하는 유틸리티
 */
export class DbCleaner {
  constructor(private readonly dataSource: DataSource) {}

  /**
   * 모든 도메인 테이블의 데이터를 삭제.
   * TypeORM 시스템 테이블(migrations, typeorm_metadata)은 제외한다.
   * 시스템 테이블을 함께 TRUNCATE하면 다음 globalSetup의 runMigrations가
   * 적용 이력을 잃고 InitialSchema를 재실행해 'Table already exists'로 실패한다.
   */
  async cleanAll(): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();

    try {
      await queryRunner.query('SET FOREIGN_KEY_CHECKS = 0');

      const tables = await queryRunner.query(`
        SELECT TABLE_NAME
        FROM information_schema.tables
        WHERE table_schema = DATABASE()
        AND table_type = 'BASE TABLE'
      `);

      const systemTables = new Set(['migrations', 'typeorm_metadata']);
      for (const row of tables) {
        const tableName = row.TABLE_NAME || row.table_name;
        if (tableName && !systemTables.has(tableName)) {
          await queryRunner.query(`TRUNCATE TABLE \`${tableName}\``);
        }
      }

      await queryRunner.query('SET FOREIGN_KEY_CHECKS = 1');
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * 특정 테이블들만 데이터 삭제
   */
  async cleanTables(tableNames: string[]): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();

    try {
      await queryRunner.query('SET FOREIGN_KEY_CHECKS = 0');

      for (const tableName of tableNames) {
        await queryRunner.query(`TRUNCATE TABLE \`${tableName}\``);
      }

      await queryRunner.query('SET FOREIGN_KEY_CHECKS = 1');
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Redis 캐시 전체 삭제
   */
  async cleanCache(): Promise<void> {
    await this.dataSource.queryResultCache?.clear();
  }
}
