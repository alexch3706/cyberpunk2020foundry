#!/usr/bin/env node
/**
 * Build a FoundryVTT LevelDB compendium from packs-src JSON files.
 *
 * Usage: node tools/build-compendium.mjs <pack-name>
 *
 * Reads packs-src/<pack-name>/*.json and writes packs/<pack-name>/ as LevelDB.
 */

import { ClassicLevel } from 'classic-level';
import { readdir, readFile, mkdir, rm } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

async function buildPack(packName) {
  const srcDir = join(ROOT, 'packs-src', packName);
  const destDir = join(ROOT, 'packs', packName);

  const files = (await readdir(srcDir)).filter(f => f.endsWith('.json'));
  if (files.length === 0) {
    console.error(`No .json files found in ${srcDir}`);
    process.exit(1);
  }

  console.log(`Found ${files.length} items in packs-src/${packName}/`);

  // Remove old db
  await rm(destDir, { recursive: true, force: true });
  await mkdir(destDir, { recursive: true });

  const db = new ClassicLevel(destDir, {
    keyEncoding: 'utf8',
    valueEncoding: 'json'
  });

  await db.open();

  const batch = db.batch();
  let count = 0;

  for (const file of files) {
    const raw = await readFile(join(srcDir, file), 'utf-8');
    const item = JSON.parse(raw);
    const key = `!items!${item._id}`;
    item._key = key;
    item.flags = item.flags ?? {};
    item.flags.exportSource = item.flags.exportSource ?? {
      world: 'cyberpunk_2020',
      system: 'cyberpunk2020-rilerena',
      coreVersion: '0.7.9',
      systemVersion: '0.2.6'
    };
    batch.put(key, item);
    count++;
  }

  await batch.write();
  await db.close();
  console.log(`Built ${count} items → ${destDir}`);
}

const packs = process.argv.slice(2);
if (packs.length === 0) {
  // If no arguments, build all packs in packs-src
  readdir(join(ROOT, 'packs-src'), { withFileTypes: true }).then(dirents => {
    const allPacks = dirents.filter(d => d.isDirectory()).map(d => d.name);
    if (allPacks.length === 0) {
      console.log('No packs found in packs-src/');
      return;
    }
    console.log(`Building ${allPacks.length} packs...`);
    
    // Sequential build
    let promise = Promise.resolve();
    for (const pack of allPacks) {
      promise = promise.then(() => buildPack(pack).catch(err => console.error(`Error building ${pack}:`, err)));
    }
  }).catch(console.error);
} else {
  let promise = Promise.resolve();
  for (const pack of packs) {
    promise = promise.then(() => buildPack(pack).catch(err => {
      console.error(err);
      process.exit(1);
    }));
  }
}