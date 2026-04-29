import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1777453897802 implements MigrationInterface {
  name = 'InitialSchema1777453897802';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE \`USER_INFO\` (\`UID\` varchar(100) NOT NULL, \`NICKNAME\` varchar(100) NOT NULL, \`INTRODUCE\` varchar(500) NOT NULL, \`CREATE_DATETIME\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`MODIFY_DATETIME\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), UNIQUE INDEX \`IDX_ffe75b702eadb72fd7712eade4\` (\`NICKNAME\`), PRIMARY KEY (\`UID\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`USER_AUTH\` (\`UID\` varchar(100) NOT NULL, \`PASSWORD\` varchar(1000) NOT NULL, \`SALT\` varchar(50) NOT NULL, \`SOCIAL_YN\` char(1) NOT NULL, \`REFRESH_TOKEN\` varchar(500) NOT NULL, \`USER_ROLE\` enum ('ADMIN', 'USER') NOT NULL, \`CREATE_DATETIME\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`MODIFY_DATETIME\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), PRIMARY KEY (\`UID\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`POST\` (\`POST_ID\` int NOT NULL AUTO_INCREMENT, \`POST_UID\` varchar(100) NOT NULL, \`TITLE\` varchar(500) NOT NULL, \`WRITE_DATETIME\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`CONTENTS\` text NOT NULL, \`HITS\` int NOT NULL DEFAULT '0', \`CREATE_DATETIME\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`MODIFY_DATETIME\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), INDEX \`IDX_f451f4f930c50960c6f021fa72\` (\`POST_UID\`), PRIMARY KEY (\`POST_ID\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`POST_LIKE\` (\`POST_ID\` int NOT NULL, \`UID\` varchar(100) NOT NULL, \`CREATE_DATETIME\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`MODIFY_DATETIME\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), PRIMARY KEY (\`POST_ID\`, \`UID\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `ALTER TABLE \`USER_INFO\` ADD CONSTRAINT \`FK_97b38392e0343ed6c501df70847\` FOREIGN KEY (\`UID\`) REFERENCES \`USER_AUTH\`(\`UID\`) ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`POST\` ADD CONSTRAINT \`FK_f451f4f930c50960c6f021fa726\` FOREIGN KEY (\`POST_UID\`) REFERENCES \`USER_AUTH\`(\`UID\`) ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`POST_LIKE\` ADD CONSTRAINT \`FK_1f4e0f3b36ee1450948518cf404\` FOREIGN KEY (\`POST_ID\`) REFERENCES \`POST\`(\`POST_ID\`) ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`POST_LIKE\` ADD CONSTRAINT \`FK_f2920116bfdcb5d337ddfa2ed90\` FOREIGN KEY (\`UID\`) REFERENCES \`USER_AUTH\`(\`UID\`) ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`POST_LIKE\` DROP FOREIGN KEY \`FK_f2920116bfdcb5d337ddfa2ed90\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`POST_LIKE\` DROP FOREIGN KEY \`FK_1f4e0f3b36ee1450948518cf404\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`POST\` DROP FOREIGN KEY \`FK_f451f4f930c50960c6f021fa726\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`USER_INFO\` DROP FOREIGN KEY \`FK_97b38392e0343ed6c501df70847\``,
    );
    await queryRunner.query(`DROP TABLE \`POST_LIKE\``);
    await queryRunner.query(
      `DROP INDEX \`IDX_f451f4f930c50960c6f021fa72\` ON \`POST\``,
    );
    await queryRunner.query(`DROP TABLE \`POST\``);
    await queryRunner.query(`DROP TABLE \`USER_AUTH\``);
    await queryRunner.query(
      `DROP INDEX \`IDX_ffe75b702eadb72fd7712eade4\` ON \`USER_INFO\``,
    );
    await queryRunner.query(`DROP TABLE \`USER_INFO\``);
  }
}
