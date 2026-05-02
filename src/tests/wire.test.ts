import { describe, it, expect } from 'vitest';
import {
  WireType,
  WireMessage,
  decodeVarint,
  encodeVarint,
  encodeKey,
  fieldAsInt32,
  fieldAsUint32,
  fieldAsString,
  fieldAsBool,
} from '../protobuf/wire';

// Helper to build bytes from number array
function bytes(...vals: number[]): Uint8Array {
  return new Uint8Array(vals);
}

describe('decodeVarint', () => {
  it('decodes single-byte varint', () => {
    const result = decodeVarint(bytes(0x05), 0);
    expect(result).toEqual([5n, 1]);
  });

  it('decodes zero', () => {
    const result = decodeVarint(bytes(0x00), 0);
    expect(result).toEqual([0n, 1]);
  });

  it('decodes multi-byte varint (300)', () => {
    // 300 = 0b100101100 => 0xAC 0x02
    const result = decodeVarint(bytes(0xac, 0x02), 0);
    expect(result).toEqual([300n, 2]);
  });

  it('decodes with offset', () => {
    const result = decodeVarint(bytes(0xff, 0x01), 1);
    expect(result).toEqual([1n, 1]);
  });

  it('returns null on empty data', () => {
    const result = decodeVarint(bytes(), 0);
    expect(result).toBeNull();
  });
});

describe('encodeVarint', () => {
  it('encodes small number', () => {
    const out: number[] = [];
    encodeVarint(5, out);
    expect(out).toEqual([5]);
  });

  it('encodes 300', () => {
    const out: number[] = [];
    encodeVarint(300, out);
    expect(out).toEqual([0xac, 0x02]);
  });

  it('encodes bigint', () => {
    const out: number[] = [];
    encodeVarint(300n, out);
    expect(out).toEqual([0xac, 0x02]);
  });

  it('roundtrips', () => {
    for (const val of [0, 1, 127, 128, 300, 65535, 2147483647]) {
      const out: number[] = [];
      encodeVarint(val, out);
      const [decoded] = decodeVarint(new Uint8Array(out), 0)!;
      expect(Number(decoded)).toBe(val);
    }
  });
});

describe('encodeKey', () => {
  it('encodes field 1 varint', () => {
    const out: number[] = [];
    encodeKey(1, WireType.Varint, out);
    expect(out).toEqual([0x08]); // (1 << 3) | 0 = 8
  });

  it('encodes field 2 length-delimited', () => {
    const out: number[] = [];
    encodeKey(2, WireType.LengthDelimited, out);
    expect(out).toEqual([0x12]); // (2 << 3) | 2 = 18
  });
});

describe('WireMessage', () => {
  // Build a simple protobuf: field 1 = varint 150, field 2 = string "testing"
  function buildSimpleMessage(): Uint8Array {
    const out: number[] = [];
    // field 1, varint = 150
    encodeKey(1, WireType.Varint, out);
    encodeVarint(150, out);
    // field 2, string = "testing"
    encodeKey(2, WireType.LengthDelimited, out);
    const str = new TextEncoder().encode('testing');
    encodeVarint(str.length, out);
    out.push(...str);
    return new Uint8Array(out);
  }

  it('decodes empty data returns null', () => {
    expect(WireMessage.decode(new Uint8Array(0))).toBeNull();
  });

  it('decodes varint field', () => {
    const msg = WireMessage.decode(buildSimpleMessage());
    expect(msg).not.toBeNull();
    expect(msg!.getUint32(1)).toBe(150);
  });

  it('decodes string field', () => {
    const msg = WireMessage.decode(buildSimpleMessage());
    expect(msg).not.toBeNull();
    expect(msg!.getString(2)).toBe('testing');
  });

  it('returns null for missing fields', () => {
    const msg = WireMessage.decode(buildSimpleMessage());
    expect(msg!.getUint32(99)).toBeNull();
    expect(msg!.getString(99)).toBeNull();
  });

  it('has() works', () => {
    const msg = WireMessage.decode(buildSimpleMessage());
    expect(msg!.has(1)).toBe(true);
    expect(msg!.has(2)).toBe(true);
    expect(msg!.has(3)).toBe(false);
  });

  it('decodes nested message', () => {
    const inner: number[] = [];
    encodeKey(1, WireType.Varint, inner);
    encodeVarint(42, inner);

    const outer: number[] = [];
    encodeKey(3, WireType.LengthDelimited, outer);
    encodeVarint(inner.length, outer);
    outer.push(...inner);

    const msg = WireMessage.decode(new Uint8Array(outer));
    const nested = msg!.getMessage(3);
    expect(nested).not.toBeNull();
    expect(nested!.getUint32(1)).toBe(42);
  });

  it('handles repeated fields', () => {
    const out: number[] = [];
    for (const v of [10, 20, 30]) {
      encodeKey(1, WireType.Varint, out);
      encodeVarint(v, out);
    }
    const msg = WireMessage.decode(new Uint8Array(out));
    const vals = msg!.getRepeatedVarint(1);
    expect(vals.map(Number)).toEqual([10, 20, 30]);
  });

  it('field helpers work correctly', () => {
    const out: number[] = [];
    encodeKey(1, WireType.Varint, out);
    encodeVarint(1, out); // bool true
    encodeKey(2, WireType.Varint, out);
    encodeVarint(0xFFFFFFFF, out); // uint32 max

    const msg = WireMessage.decode(new Uint8Array(out))!;
    const f1 = msg.field(1)!;
    const f2 = msg.field(2)!;

    expect(fieldAsBool(f1)).toBe(true);
    expect(fieldAsUint32(f2)).toBe(0xFFFFFFFF);
  });
});
