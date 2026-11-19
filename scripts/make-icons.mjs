import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../public');

function png(size) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  const margin = Math.round(size * 0.22);
  for (let y = 0; y < size; y += 1) {
    const row = y * (size * 4 + 1);
    raw[row] = 0;
    for (let x = 0; x < size; x += 1) {
      const inner = x >= margin && x < size - margin && y >= margin && y < size - margin;
      const offset = row + 1 + x * 4;
      raw[offset] = inner ? 0x92 : 0x11;
      raw[offset + 1] = inner ? 0xe6 : 0x11;
      raw[offset + 2] = inner ? 0x22 : 0x11;
      raw[offset + 3] = 255;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([signature, chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type), data]);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(zlib.crc32(body));
  return Buffer.concat([length, body, crc]);
}

fs.writeFileSync(path.join(dir, 'icon-192.png'), png(192));
fs.writeFileSync(path.join(dir, 'icon-512.png'), png(512));
