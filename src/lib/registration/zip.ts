import "server-only";

import { deflateRawSync } from "node:zlib";

type ZipEntry = { name: string; content: Buffer };

const crcTable = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});

function crc32(buffer: Buffer) {
  let value = 0xffffffff;
  for (const byte of buffer) value = crcTable[(value ^ byte) & 0xff] ^ (value >>> 8);
  return (value ^ 0xffffffff) >>> 0;
}

function header(signature: number, name: Buffer, compressed: Buffer, original: Buffer, crc: number) {
  const result = Buffer.alloc(signature === 0x04034b50 ? 30 : 46 + name.length);
  result.writeUInt32LE(signature, 0);
  if (signature === 0x04034b50) {
    result.writeUInt16LE(20, 4);
    result.writeUInt16LE(0x800, 6);
    result.writeUInt16LE(8, 8);
    result.writeUInt32LE(crc, 14);
    result.writeUInt32LE(compressed.length, 18);
    result.writeUInt32LE(original.length, 22);
    result.writeUInt16LE(name.length, 26);
    result.writeUInt16LE(0, 28);
  } else {
    result.writeUInt16LE(20, 4);
    result.writeUInt16LE(20, 6);
    result.writeUInt16LE(0x800, 8);
    result.writeUInt16LE(8, 10);
    result.writeUInt32LE(crc, 16);
    result.writeUInt32LE(compressed.length, 20);
    result.writeUInt32LE(original.length, 24);
    result.writeUInt16LE(name.length, 28);
    result.writeUInt16LE(0, 30);
    result.writeUInt16LE(0, 32);
    result.writeUInt16LE(0, 34);
    result.writeUInt16LE(0, 36);
    result.writeUInt32LE(0, 38);
    result.writeUInt32LE(0, 42);
    name.copy(result, 46);
  }
  return result;
}

export function createZip(entries: ZipEntry[]) {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const name = Buffer.from(entry.name, "utf8");
    const compressed = deflateRawSync(entry.content);
    const crc = crc32(entry.content);
    const local = header(0x04034b50, name, compressed, entry.content, crc);
    localParts.push(local, name, compressed);
    const central = header(0x02014b50, name, compressed, entry.content, crc);
    central.writeUInt32LE(offset, 42);
    centralParts.push(central);
    offset += local.length + name.length + compressed.length;
  }

  const central = Buffer.concat(centralParts);
  const local = Buffer.concat(localParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(central.length, 12);
  end.writeUInt32LE(local.length, 16);
  return Buffer.concat([local, central, end]);
}
