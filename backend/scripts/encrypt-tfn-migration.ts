/**
 * One-time migration script: Encrypt existing plaintext TFN values and compute HMAC hashes.
 * Run with: npx tsx scripts/encrypt-tfn-migration.ts
 */

import "../src/load-env.js";
import { PrismaClient } from "@prisma/client";
import { encryptField, hmacField, isEncrypted, isEncryptionAvailable } from "../src/utils/encryption.js";

const prisma = new PrismaClient();

async function migrate() {
  if (!isEncryptionAvailable()) {
    console.error("ERROR: FIELD_ENCRYPTION_KEY is not set or too short. Cannot encrypt.");
    process.exit(1);
  }

  console.log("Starting TFN encryption migration...\n");

  // 1. IndividualProfile
  const individuals = await prisma.individualProfile.findMany({
    where: { tfn: { not: null } },
    select: { id: true, accountId: true, tfn: true, tfnHash: true },
  });

  let encryptedCount = 0;
  for (const record of individuals) {
    if (!record.tfn) continue;

    const needsEncrypt = !isEncrypted(record.tfn);
    const needsHash = !record.tfnHash;

    if (!needsEncrypt && !needsHash) {
      console.log(`  [IndividualProfile ${record.id}] Already encrypted + hashed. Skipping.`);
      continue;
    }

    const plainTfn = record.tfn; // It's plaintext since it's not encrypted
    const encryptedTfn = needsEncrypt ? encryptField(plainTfn) : record.tfn;
    const hash = needsHash ? hmacField(plainTfn) : record.tfnHash;

    await prisma.individualProfile.update({
      where: { id: record.id },
      data: {
        tfn: encryptedTfn,
        tfnHash: hash,
      },
    });

    console.log(`  [IndividualProfile ${record.id}] Encrypted TFN (was: ${plainTfn.substring(0, 3)}***) + computed hash`);
    encryptedCount++;
  }

  // 2. TrustProfile
  const trusts = await prisma.trustProfile.findMany({
    where: { tfn: { not: null } },
    select: { id: true, accountId: true, tfn: true, tfnHash: true },
  });

  for (const record of trusts) {
    if (!record.tfn) continue;

    const needsEncrypt = !isEncrypted(record.tfn);
    const needsHash = !record.tfnHash;

    if (!needsEncrypt && !needsHash) {
      console.log(`  [TrustProfile ${record.id}] Already encrypted + hashed. Skipping.`);
      continue;
    }

    const plainTfn = record.tfn;
    const encryptedTfn = needsEncrypt ? encryptField(plainTfn) : record.tfn;
    const hash = needsHash ? hmacField(plainTfn) : record.tfnHash;

    await prisma.trustProfile.update({
      where: { id: record.id },
      data: { tfn: encryptedTfn, tfnHash: hash },
    });

    console.log(`  [TrustProfile ${record.id}] Encrypted TFN + computed hash`);
    encryptedCount++;
  }

  // 3. PartnershipProfile
  const partnerships = await prisma.partnershipProfile.findMany({
    where: { tfn: { not: null } },
    select: { id: true, accountId: true, tfn: true, tfnHash: true },
  });

  for (const record of partnerships) {
    if (!record.tfn) continue;

    const needsEncrypt = !isEncrypted(record.tfn);
    const needsHash = !record.tfnHash;

    if (!needsEncrypt && !needsHash) {
      console.log(`  [PartnershipProfile ${record.id}] Already encrypted + hashed. Skipping.`);
      continue;
    }

    const plainTfn = record.tfn;
    const encryptedTfn = needsEncrypt ? encryptField(plainTfn) : record.tfn;
    const hash = needsHash ? hmacField(plainTfn) : record.tfnHash;

    await prisma.partnershipProfile.update({
      where: { id: record.id },
      data: { tfn: encryptedTfn, tfnHash: hash },
    });

    console.log(`  [PartnershipProfile ${record.id}] Encrypted TFN + computed hash`);
    encryptedCount++;
  }

  console.log(`\nMigration complete. Encrypted ${encryptedCount} TFN records.`);
  await prisma.$disconnect();
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
