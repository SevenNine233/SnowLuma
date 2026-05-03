import { describe, it, expect } from 'vitest';
import { protoDecode, protoEncode, type ProtoSchema } from '../src/protobuf/decode';
import { WireMessage, encodeKey, encodeVarint, WireType } from '../src/protobuf/wire';

describe('protoDecode', () => {
  const SimpleSchema = {
    name: { field: 1, type: 'string' as const },
    age: { field: 2, type: 'uint32' as const },
    active: { field: 3, type: 'bool' as const },
  };

  function buildProto(): Uint8Array {
    const out: number[] = [];
    // field 1 string "Alice"
    encodeKey(1, WireType.LengthDelimited, out);
    const str = new TextEncoder().encode('Alice');
    encodeVarint(str.length, out);
    out.push(...str);
    // field 2 uint32 = 30
    encodeKey(2, WireType.Varint, out);
    encodeVarint(30, out);
    // field 3 bool = true
    encodeKey(3, WireType.Varint, out);
    encodeVarint(1, out);
    return new Uint8Array(out);
  }

  it('decodes all fields', () => {
    const result = protoDecode(buildProto(), SimpleSchema);
    expect(result).not.toBeNull();
    expect(result!.name).toBe('Alice');
    expect(result!.age).toBe(30);
    expect(result!.active).toBe(true);
  });

  it('handles missing fields', () => {
    // Only field 1
    const out: number[] = [];
    encodeKey(1, WireType.LengthDelimited, out);
    const str = new TextEncoder().encode('Bob');
    encodeVarint(str.length, out);
    out.push(...str);

    const result = protoDecode(new Uint8Array(out), SimpleSchema);
    expect(result).not.toBeNull();
    expect(result!.name).toBe('Bob');
    expect(result!.age).toBeUndefined();
    expect(result!.active).toBeUndefined();
  });

  it('returns null for empty data', () => {
    expect(protoDecode(new Uint8Array(0), SimpleSchema)).toBeNull();
  });

  it('decodes nested messages', () => {
    const InnerSchema = {
      value: { field: 1, type: 'uint32' as const },
    };
    const OuterSchema = {
      inner: { field: 1, type: 'message' as const, schema: InnerSchema },
    };

    // Build inner
    const innerOut: number[] = [];
    encodeKey(1, WireType.Varint, innerOut);
    encodeVarint(99, innerOut);

    // Build outer
    const outerOut: number[] = [];
    encodeKey(1, WireType.LengthDelimited, outerOut);
    encodeVarint(innerOut.length, outerOut);
    outerOut.push(...innerOut);

    const result = protoDecode(new Uint8Array(outerOut), OuterSchema);
    expect(result).not.toBeNull();
    expect(result!.inner).not.toBeUndefined();
    expect(result!.inner!.value).toBe(99);
  });

  it('decodes repeated messages', () => {
    const ItemSchema = {
      id: { field: 1, type: 'uint32' as const },
    };
    const ListSchema = {
      items: { field: 1, type: 'repeated_message' as const, schema: ItemSchema },
    };

    const out: number[] = [];
    for (const id of [1, 2, 3]) {
      const itemOut: number[] = [];
      encodeKey(1, WireType.Varint, itemOut);
      encodeVarint(id, itemOut);

      encodeKey(1, WireType.LengthDelimited, out);
      encodeVarint(itemOut.length, out);
      out.push(...itemOut);
    }

    const result = protoDecode(new Uint8Array(out), ListSchema);
    expect(result).not.toBeNull();
    expect(result!.items).toHaveLength(3);
    expect(result!.items.map((i) => i.id)).toEqual([1, 2, 3]);
  });

  it('accepts WireMessage directly', () => {
    const wire = WireMessage.decode(buildProto());
    const result = protoDecode(wire!, SimpleSchema);
    expect(result!.name).toBe('Alice');
  });
});

describe('protoEncode', () => {
  const SimpleSchema = {
    name: { field: 1, type: 'string' as const },
    age: { field: 2, type: 'uint32' as const },
    active: { field: 3, type: 'bool' as const },
  };

  it('encodes and decodes roundtrip', () => {
    const data = { name: 'Charlie', age: 25, active: true };
    const encoded = protoEncode(data, SimpleSchema);
    const decoded = protoDecode(encoded, SimpleSchema);
    expect(decoded).not.toBeNull();
    expect(decoded!.name).toBe('Charlie');
    expect(decoded!.age).toBe(25);
    expect(decoded!.active).toBe(true);
  });

  it('skips undefined fields', () => {
    const data = { name: 'Dave', age: undefined, active: undefined };
    const encoded = protoEncode(data as any, SimpleSchema);
    const decoded = protoDecode(encoded, SimpleSchema);
    expect(decoded!.name).toBe('Dave');
    expect(decoded!.age).toBeUndefined();
    expect(decoded!.active).toBeUndefined();
  });

  it('encodes bytes', () => {
    const ByteSchema = {
      payload: { field: 1, type: 'bytes' as const },
    };
    const data = { payload: new Uint8Array([0xDE, 0xAD]) };
    const encoded = protoEncode(data, ByteSchema);
    const decoded = protoDecode(encoded, ByteSchema);
    expect(decoded!.payload).toEqual(new Uint8Array([0xDE, 0xAD]));
  });

  it('encodes nested messages', () => {
    const InnerSchema = {
      value: { field: 1, type: 'uint32' as const },
    };
    const OuterSchema = {
      inner: { field: 1, type: 'message' as const, schema: InnerSchema },
    };

    const data = { inner: { value: 42 } };
    const encoded = protoEncode(data, OuterSchema);
    const decoded = protoDecode(encoded, OuterSchema);
    expect(decoded!.inner!.value).toBe(42);
  });

  it('encodes int64/uint64', () => {
    const BigSchema = {
      signed: { field: 1, type: 'int64' as const },
      unsigned: { field: 2, type: 'uint64' as const },
    };
    const data = { signed: -1n, unsigned: 0xFFFFFFFFFFFFFFFFn };
    const encoded = protoEncode(data, BigSchema);
    const decoded = protoDecode(encoded, BigSchema);
    expect(decoded!.signed).toBe(-1n);
    expect(decoded!.unsigned).toBe(0xFFFFFFFFFFFFFFFFn);
  });
});
