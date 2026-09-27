#!/usr/bin/env node
// Fails if a store asset would be refused at upload, before anything is built.
//
// Both stores reject at the last moment: App Store Connect refuses a screenshot
// that is one pixel off its size classes, Play Console refuses an icon that is
// not 512x512. The build takes 45 minutes; this takes a second. It
// reads the actual files with no image library — PNG and JPEG headers only —
// so it runs in any job that has Node.
//
// Usage:
//   node scripts/store/check_store_art.mjs                 # everything
//   node scripts/store/check_store_art.mjs --store ios     # App Store files
//   node scripts/store/check_store_art.mjs --store play    # Play files

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { basename, extname, join } from 'node:path';

const argv = process.argv.slice(2);
const storeArg = argv.includes('--store') ? argv[argv.indexOf('--store') + 1] : 'all';
const want = store => storeArg === 'all' || storeArg === store;

const problems = [];
const ok = message => console.log(`  ok ${message}`);
const bad = message => problems.push(message);

// ---------------------------------------------------------------------------
// Reading image headers without an image library.
// ---------------------------------------------------------------------------

function pngInfo(buffer) {
  const signature = buffer.subarray(0, 8).toString('hex');
  if (signature !== '89504e470d0a1a0a') return null;
  // Every read below is an absolute file offset: the IHDR chunk type is bytes
  // 12-15, then width (16), height (20), bit depth (24) and colour type (25).
  if (buffer.subarray(12, 16).toString('ascii') !== 'IHDR') return null;
  const colourType = buffer[25];
  // The tRNS chunk gives palette images an alpha channel; without it a
  // palette image is opaque. One pass over the chunks is enough.
  let hasTrns = false;
  let at = 8;
  while (at + 8 <= buffer.length) {
    const length = buffer.readUInt32BE(at);
    const type = buffer.subarray(at + 4, at + 8).toString('ascii');
    if (type === 'tRNS') hasTrns = true;
    if (type === 'IEND') break;
    at += 12 + length;
  }
  const alpha = colourType === 4 || colourType === 6 || (colourType === 3 && hasTrns);
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20), alpha, format: 'png', colourType };
}

function jpegInfo(buffer) {
  if (buffer.readUInt16BE(0) !== 0xffd8) return null;
  let at = 2;
  while (at + 4 < buffer.length) {
    if (buffer[at] !== 0xff) { at += 1; continue; }
    const marker = buffer[at + 1];
    const length = buffer.readUInt16BE(at + 2);
    // SOF0..SOF15, excluding the two non-frame markers in that range.
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { width: buffer.readUInt16BE(at + 7), height: buffer.readUInt16BE(at + 5), alpha: false, format: 'jpeg' };
    }
    at += 2 + length;
  }
  return null;
}

function imageInfo(path) {
  const buffer = readFileSync(path);
  return pngInfo(buffer) || jpegInfo(buffer);
}

function checkImage(path, { sizes, exact, min, max, noAlpha, ratio, note }) {
  const label = path.split(/[\\/]/).slice(-3).join('/');
  if (!existsSync(path)) return bad(`${label}: missing`);
  const info = imageInfo(path);
  if (!info) return bad(`${label}: not a PNG or JPEG`);
  const { width, height, alpha, format } = info;
  const size = `${width}x${height}`;
  if (exact && size !== exact) return bad(`${label}: ${size}, must be ${exact}${note ? ` (${note})` : ''}`);
  if (sizes && !sizes.includes(size)) {
    return bad(`${label}: ${size} is not an accepted size class (${sizes.join(', ')})${note ? ` — ${note}` : ''}`);
  }
  if (min && (width < min || height < min)) {
    return bad(`${label}: ${size}, both sides must be at least ${min} px`);
  }
  if (max && (width > max || height > max)) {
    return bad(`${label}: ${size}, both sides must be at most ${max} px`);
  }
  // Play only: "the maximum dimension can't be more than twice the minimum
  // dimension". Apple has no such rule (1320x2868 is 2.17 and is exactly the
  // 6.9-inch class), which is why this is opt-in rather than automatic.
  if (ratio && Math.max(width, height) > 2 * Math.min(width, height)) {
    return bad(`${label}: ${size}, the long side is more than twice the short side, which Play rejects`);
  }
  if (noAlpha && alpha) {
    return bad(`${label}: has an alpha channel; the store requires a 24-bit opaque ${format.toUpperCase()}`);
  }
  ok(`${label} ${size} ${format}${alpha ? ' (alpha)' : ''}`);
  return null;
}

function readText(path) {
  return existsSync(path) ? readFileSync(path, 'utf8').trim() : '';
}

function checkText(path, limit, { required = true } = {}) {
  const label = path.split(/[\\/]/).slice(-2).join('/');
  if (!existsSync(path)) {
    if (required) bad(`${label}: missing`);
    return '';
  }
  const text = readText(path);
  if (!text) {
    if (required) bad(`${label}: empty`);
    return '';
  }
  if (text.length > limit) bad(`${label}: ${text.length} characters, the store allows ${limit}`);
  else ok(`${label} ${text.length}/${limit}`);
  return text;
}

function listingBranding(label, text) {
  // This app is not Zingo and is not a Zcash wallet; either phrase in a store
  // listing is a trademark problem and a false description of the network.
  // The MIT licence's attribution is required, not a leak, so the sentences
  // that carry it are allowed — exactly the ones the listings actually use.
  const allowed = [
    /fork of Zingo, an MIT-licensed wallet/,
    /bifurcación de Zingo, una billetera con licencia MIT/,
    /Zingo Labs, Foursquare/,
    /Zingo Labs, la aplicación Swarm/,
    /Based on Zingo Mobile \(MIT licence\) and zingolib/,
    /not affiliated with the Electric Coin Company, the Zcash Foundation or Zingo Labs/,
  ];
  for (const rx of [/Zingo/i, /Zcash wallet/i, /Real Secure Money/i]) {
    const found = text.match(new RegExp(rx.source, 'gi'));
    if (!found) continue;
    for (const hit of found) {
      const at = text.indexOf(hit);
      const around = text.slice(Math.max(0, at - 60), at + hit.length + 60);
      if (allowed.some(pattern => pattern.test(around))) continue;
      bad(`${label}: upstream wording "${hit}" in ...${around.replace(/\s+/g, ' ')}...`);
    }
  }
}

// ---------------------------------------------------------------------------
// Apple: fastlane deliver tree.
// ---------------------------------------------------------------------------

// Apple's iPhone screenshot classes, as published in "Screenshot
// specifications" and re-read 2026-09-22. Portrait and landscape.
const IOS_SCREENSHOT_SIZES = [
  '1320x2868', '2868x1320',   // 6.9-inch (required for a new iPhone app)
  '1290x2796', '2796x1290',   // 6.7-inch
  '1284x2778', '2778x1284',   // 6.5-inch (iPhone 11/12 Pro Max class)
  '1242x2688', '2688x1242',   // 6.5-inch (iPhone XS Max class)
  '1170x2532', '2532x1170',   // 6.1-inch
  '1125x2436', '2436x1125',   // 5.8-inch
  '1242x2208', '2208x1242',   // 5.5-inch
  '2048x2732', '2732x2048',   // iPad Pro 12.9-inch
];

const IOS_APP_INFO = [
  ['name.txt', 30],
  ['subtitle.txt', 30],
  ['promotional_text.txt', 170],
  ['description.txt', 4000],
  ['keywords.txt', 100],
  ['release_notes.txt', 4000],
  ['copyright.txt', 200],
];

function checkIos() {
  const locales = ['en-US'];
  for (const locale of locales) {
    const dir = join('fastlane', 'metadata', locale);
    console.log(`App Store listing ${locale}:`);
    if (!existsSync(dir)) {
      bad(`fastlane/metadata/${locale}: missing — there is nothing for fastlane deliver to upload`);
      continue;
    }
    for (const [name, limit] of IOS_APP_INFO) {
      const text = checkText(join(dir, name), limit, { required: name !== 'release_notes.txt' && name !== 'copyright.txt' });
      if (text) listingBranding(`fastlane/metadata/${locale}/${name}`, text);
    }
    for (const name of ['support_url.txt', 'privacy_url.txt', 'marketing_url.txt']) {
      const path = join(dir, name);
      const text = checkText(path, 500, { required: name !== 'marketing_url.txt' });
      if (text && !text.startsWith('https://')) bad(`${name}: must be an https:// URL, got "${text}"`);
    }

    const shots = join('fastlane', 'screenshots', locale);
    if (!existsSync(shots)) {
      bad(`fastlane/screenshots/${locale}: missing — Apple requires at least one screenshot`);
    } else {
      const files = readdirSync(shots).filter(n => ['.png', '.jpg', '.jpeg'].includes(extname(n).toLowerCase()));
      // Apple's minimum is one, its maximum ten. Fewer than three is allowed
      // but sells badly, so it is said out loud rather than failed.
      if (!files.length) bad(`fastlane/screenshots/${locale}: no screenshots; Apple requires at least one`);
      if (files.length < 3) {
        console.log(`  note ${files.length} screenshot(s) in ${locale}; Apple accepts this, three or more sell better`);
      }
      if (files.length > 10) bad(`fastlane/screenshots/${locale}: ${files.length} screenshots; Apple accepts 10`);
      for (const file of files) {
        checkImage(join(shots, file), { sizes: IOS_SCREENSHOT_SIZES, min: 320, max: 3840, note: 'Apple size class' });
      }
    }
  }

  // The App Store icon is taken from the build, but the same 1024 px file is
  // kept here so the artwork can be reviewed and re-uploaded by hand.
  const icon = join('store', 'ios', 'icon-1024.png');
  if (existsSync(icon)) {
    checkImage(icon, { exact: '1024x1024', noAlpha: true, note: 'Apple refuses an icon with an alpha channel' });
  } else {
    ok('store/ios/icon-1024.png not present — the icon travels inside the build (AppIcon asset catalog)');
  }

  const review = join('fastlane', 'metadata', 'review_information');
  if (!existsSync(review)) {
    bad('fastlane/metadata/review_information: missing — App Review asks for a contact and notes');
  } else {
    for (const [name, limit] of [['notes.txt', 4000], ['first_name.txt', 100], ['last_name.txt', 100], ['email_address.txt', 200], ['phone_number.txt', 50]]) {
      checkText(join(review, name), limit, { required: name === 'notes.txt' });
    }
  }
}

// ---------------------------------------------------------------------------
// Google Play: fastlane supply tree.
// ---------------------------------------------------------------------------

// Play's locale codes, which are NOT fastlane's or the app's: Spanish is
// "es-ES", and a folder called "es" is refused by supply before upload.
const PLAY_LOCALES = ['en-US', 'es-ES'];

const PLAY_TEXT = [
  ['title.txt', 30],
  ['short_description.txt', 80],
  ['full_description.txt', 4000],
];

function checkPlay() {
  const root = join('fastlane', 'metadata', 'android');
  if (!existsSync(root)) {
    bad('fastlane/metadata/android: missing — there is nothing for fastlane supply to upload');
    return;
  }
  const present = readdirSync(root).filter(name => statSync(join(root, name)).isDirectory());
  for (const name of present) {
    if (!PLAY_LOCALES.includes(name)) {
      bad(`fastlane/metadata/android/${name}: not a Play locale (Play wants ${PLAY_LOCALES.join(', ')})`);
    }
  }

  for (const locale of PLAY_LOCALES) {
    const dir = join(root, locale);
    console.log(`Play listing ${locale}:`);
    if (!existsSync(dir)) {
      bad(`fastlane/metadata/android/${locale}: missing`);
      continue;
    }
    for (const [name, limit] of PLAY_TEXT) {
      const text = checkText(join(dir, name), limit);
      if (text) listingBranding(`fastlane/metadata/android/${locale}/${name}`, text);
    }
    const changelogs = join(dir, 'changelogs');
    if (!existsSync(changelogs)) {
      bad(`fastlane/metadata/android/${locale}/changelogs: missing — Play shows release notes per versionCode`);
    } else {
      const entries = readdirSync(changelogs).filter(name => name.endsWith('.txt'));
      if (!entries.length) bad(`fastlane/metadata/android/${locale}/changelogs: no release notes for any versionCode`);
      for (const entry of entries) {
        const text = checkText(join(changelogs, entry), 500);
        if (text) listingBranding(`fastlane/metadata/android/${locale}/changelogs/${entry}`, text);
      }
    }

    const images = join(dir, 'images');
    checkImage(join(images, 'icon.png'), {
      exact: '512x512',
      noAlpha: true,
      note: 'a full square with no transparency; Play masks the corners itself',
    });
    checkImage(join(images, 'featureGraphic.png'), {
      exact: '1024x500',
      noAlpha: true,
      note: 'Play requires a 24-bit opaque 1024x500 PNG or JPEG',
    });
    const phones = join(images, 'phoneScreenshots');
    if (!existsSync(phones)) {
      bad(`${locale}/images/phoneScreenshots: missing — Play requires at least 2 phone screenshots`);
      continue;
    }
    const shots = readdirSync(phones).filter(name => ['.png', '.jpg', '.jpeg'].includes(extname(name).toLowerCase()));
    if (shots.length < 2) bad(`${locale}/images/phoneScreenshots: ${shots.length} file(s); Play requires 2 to 8`);
    if (shots.length > 8) bad(`${locale}/images/phoneScreenshots: ${shots.length} files; Play accepts 8`);
    for (const shot of shots) {
      checkImage(join(phones, shot), { min: 320, max: 3840, noAlpha: true, ratio: true });
    }
  }
}

// ---------------------------------------------------------------------------

if (want('ios')) checkIos();
if (want('play')) checkPlay();

const count = storeArg === 'all' ? 'App Store and Play' : storeArg === 'ios' ? 'App Store' : 'Play';
if (problems.length) {
  console.error(`\nFAIL: the ${count} submission files have ${problems.length} problem(s):\n`);
  for (const problem of problems) console.error(`  ::error::${problem}`);
  process.exit(1);
}
console.log(`\nok: every ${count} asset is a size and a format the store accepts, and no listing reads as upstream`);
