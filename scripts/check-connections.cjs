// Read-only diagnostics: never creates databases, tables, or Redis keys.
require('dotenv').config({ quiet: true });
const mysql = require('mysql2/promise');
const Redis = require('ioredis');

async function checkMysql() {
  let connection;
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      connectTimeout: 5000,
    });
    const [server] = await connection.query(
      'SELECT @@hostname AS hostname, @@port AS port',
    );
    const [databases] = await connection.query('SHOW DATABASES');
    const names = databases.map((row) => row.Database);
    console.log('MySQL server:', server[0]);
    console.log('Visible databases:', names.join(', '));
    // Selecting the configured database also verifies access, without modifying it.
    await connection.changeUser({ database: process.env.DB_NAME });
    const [tables] = await connection.query('SHOW TABLES');
    console.log(`MySQL OK: ${process.env.DB_NAME}, ${tables.length} tables`);
  } catch (error) {
    process.exitCode = 1;
    console.error(`MySQL FAILED: ${error.code || error.name}`);
  } finally {
    if (connection) await connection.end();
  }
}

async function checkRedis() {
  const redis = new Redis({
    host: process.env.REDIS_HOST,
    port: Number(process.env.REDIS_PORT || 6379),
    lazyConnect: true,
    connectTimeout: 5000,
    retryStrategy: () => null,
    maxRetriesPerRequest: 0,
  });
  redis.on('error', () => {});
  try {
    await redis.connect();
    console.log(`Redis OK: ${await redis.ping()}`);
  } catch (error) {
    process.exitCode = 1;
    console.error(`Redis FAILED: ${error.code || error.name}`);
  } finally {
    redis.disconnect();
  }
}

Promise.allSettled([checkMysql(), checkRedis()]).then((results) => {
  for (const result of results) {
    if (result.status === 'rejected') {
      process.exitCode = 1;
      console.error('Diagnostic failed:', result.reason.code || result.reason.name);
    }
  }
});
