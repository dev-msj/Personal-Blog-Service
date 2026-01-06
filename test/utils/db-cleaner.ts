import { DataSource } from 'typeorm';

/**
 * 테스트 후 DB 데이터를 정리하는 유틸리티
 */
export class DbCleaner {
  constructor(private readonly dataSource: DataSource) {}

  /**
   * 모든 테이블의 데이터를 삭제
   * 외래 키 제약 조건을 비활성화한 후 삭제하고 다시 활성화
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

      for (const row of tables) {
        const tableName = row.TABLE_NAME || row.table_name;
        if (tableName) {
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
