'use strict';
if (!globalThis.crypto) { globalThis.crypto = require('node:crypto').webcrypto; }
require('dotenv').config({ path: '/root/sql-playground/backend/.env' });
const { resetDatabase } = require('/root/sql-playground/backend/src/services/resetService');
const { resetStudentDb } = require('/root/sql-playground/backend/src/services/studentDbService');
const mongoose = require('mongoose');

async function main() {
  // Connect MongoDB
  await mongoose.connect(process.env.MONGODB_URI);
  const { ModelStudentCourse } = require('/root/sql-playground/backend/src/models/student_course');

  // 1. Reset guest DB
  console.log('Resetting guest database...');
  const r = await resetDatabase();
  console.log(`  Done: ${r.statementsExecuted} stmts, ${r.durationMs}ms`);

  // 2. Get all active student DBs
  const students = await ModelStudentCourse.find({ active: true, deleted: { $ne: true } }).lean();
  const dbNames = [...new Set(students.map(s => s.dbName).filter(Boolean))];
  console.log(`Found ${dbNames.length} student database(s) to rebuild...`);

  let ok = 0, fail = 0;
  for (const dbName of dbNames) {
    // small pause between DBs to avoid memory pressure
    await new Promise(r => setTimeout(r, 3000));
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        process.stdout.write(`  ${dbName} (attempt ${attempt}) ... `);
        await resetStudentDb(dbName);
        console.log('OK');
        ok++;
        break;
      } catch (e) {
        console.log(`FAILED: ${e.message}`);
        if (attempt < 3) await new Promise(r => setTimeout(r, 8000));
        else fail++;
      }
    }
  }
  console.log(`\nDone. OK: ${ok}, Failed: ${fail}`);
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
