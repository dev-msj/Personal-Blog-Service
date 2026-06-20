import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUserTable1781912043621 implements MigrationInterface {
  name = 'CreateUserTable1781912043621';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE \`user\` (\`user_id\` bigint NOT NULL AUTO_INCREMENT, \`created_datetime\` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), \`modified_datetime\` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3), PRIMARY KEY (\`user_id\`)) ENGINE=InnoDB`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE \`user\``);
  }
}
