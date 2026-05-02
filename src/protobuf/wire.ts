// Protobuf wire-format decoder/encoder.
// Generic decoder that works without .proto schemas — decodes any protobuf
// binary into a field_number → value tree structure.
// Port of src/protobuf/wire.h + wire.cpp

export enum WireType {
  Varint = 0,
  Fixed64 = 1,
  LengthDelimited = 2,
  Fixed32 = 5,
}

export interface WireField {
  fieldNumber: number;
  wireType: WireType;
  varint: bigint;         // Varint, Fixed64, Fixed32
  bytes: Uint8Array;      // LengthDelimited
}

// --- Varint decode ---
export function decodeVarint(data: Uint8Array, offset: number): [bigint, number] | null {
  let result = 0n;
  for (let i = 0; i < 10 && offset + i < data.length; i++) {
    result |= BigInt(data[offset + i] & 0x7f) << BigInt(7 * i);
    if ((data[offset + i] & 0x80) === 0) {
      return [result, i + 1];
    }
  }
  return null;
}

// --- Varint encode ---
export function encodeVarint(value: bigint | number, out: number[]): void {
  let v = typeof value === 'number' ? BigInt(value >>> 0) : value;
  if (v < 0n) v = v + (1n << 64n); // treat as unsigned 64-bit
  while (v >= 0x80n) {
    out.push(Number(v & 0x7Fn) | 0x80);
    v >>= 7n;
  }
  out.push(Number(v));
}

// --- Key encode ---
export function encodeKey(fieldNumber: number, wireType: WireType, out: number[]): void {
  encodeVarint(BigInt(fieldNumber) << 3n | BigInt(wireType), out);
}

// --- Field value helpers ---
export function fieldAsInt32(f: WireField): number { return Number(BigInt.asIntN(32, f.varint)); }
export function fieldAsUint32(f: WireField): number { return Number(BigInt.asUintN(32, f.varint)); }
export function fieldAsInt64(f: WireField): bigint { return BigInt.asIntN(64, f.varint); }
export function fieldAsUint64(f: WireField): bigint { return f.varint; }
export function fieldAsBool(f: WireField): boolean { return f.varint !== 0n; }
export function fieldAsString(f: WireField): string {
  return new TextDecoder().decode(f.bytes);
}
export function fieldAsBytes(f: WireField): Uint8Array {
  return f.bytes;
}

export class WireMessage {
  private fields_: WireField[];

  private constructor(fields: WireField[]) {
    this.fields_ = fields;
  }

  static decode(data: Uint8Array): WireMessage | null {
    if (!data || data.length === 0) return null;

    const fields: WireField[] = [];
    let pos = 0;

    while (pos < data.length) {
      const tagResult = decodeVarint(data, pos);
      if (!tagResult) break;
      const [tag, tagLen] = tagResult;
      pos += tagLen;

      const fieldNum = Number(tag >> 3n);
      const wireType = Number(tag & 0x07n) as WireType;

      if (fieldNum === 0) break;

      const field: WireField = {
        fieldNumber: fieldNum,
        wireType,
        varint: 0n,
        bytes: new Uint8Array(0),
      };

      switch (wireType) {
        case WireType.Varint: {
          const valResult = decodeVarint(data, pos);
          if (!valResult) return null;
          field.varint = valResult[0];
          pos += valResult[1];
          break;
        }
        case WireType.Fixed64: {
          if (pos + 8 > data.length) return null;
          const dv = new DataView(data.buffer, data.byteOffset + pos, 8);
          field.varint = dv.getBigUint64(0, true);
          pos += 8;
          break;
        }
        case WireType.Fixed32: {
          if (pos + 4 > data.length) return null;
          const dv = new DataView(data.buffer, data.byteOffset + pos, 4);
          field.varint = BigInt(dv.getUint32(0, true));
          pos += 4;
          break;
        }
        case WireType.LengthDelimited: {
          const lenResult = decodeVarint(data, pos);
          if (!lenResult) return null;
          const fieldLen = Number(lenResult[0]);
          pos += lenResult[1];
          if (pos + fieldLen > data.length) return null;
          field.bytes = data.subarray(pos, pos + fieldLen);
          pos += fieldLen;
          break;
        }
        default:
          return null;
      }

      fields.push(field);
    }

    return new WireMessage(fields);
  }

  // --- Single field access ---

  field(num: number): WireField | null {
    for (const f of this.fields_) {
      if (f.fieldNumber === num) return f;
    }
    return null;
  }

  has(num: number): boolean {
    return this.field(num) !== null;
  }

  getVarint(num: number): bigint | null {
    const f = this.field(num);
    if (!f || f.wireType !== WireType.Varint) return null;
    return f.varint;
  }

  getInt32(num: number): number | null {
    const v = this.getVarint(num);
    return v !== null ? Number(BigInt.asIntN(32, v)) : null;
  }

  getUint32(num: number): number | null {
    const v = this.getVarint(num);
    return v !== null ? Number(BigInt.asUintN(32, v)) : null;
  }

  getInt64(num: number): bigint | null {
    const v = this.getVarint(num);
    return v !== null ? BigInt.asIntN(64, v) : null;
  }

  getUint64(num: number): bigint | null {
    return this.getVarint(num);
  }

  getString(num: number): string | null {
    const f = this.field(num);
    if (!f || f.wireType !== WireType.LengthDelimited) return null;
    return fieldAsString(f);
  }

  getBytes(num: number): Uint8Array | null {
    const f = this.field(num);
    if (!f || f.wireType !== WireType.LengthDelimited) return null;
    return f.bytes;
  }

  getMessage(num: number): WireMessage | null {
    const f = this.field(num);
    if (!f || f.wireType !== WireType.LengthDelimited) return null;
    return WireMessage.decode(f.bytes);
  }

  // --- Repeated field access ---

  fields(num: number): WireField[] {
    return this.fields_.filter(f => f.fieldNumber === num);
  }

  getRepeatedVarint(num: number): bigint[] {
    const result: bigint[] = [];
    for (const f of this.fields_) {
      if (f.fieldNumber !== num) continue;
      if (f.wireType === WireType.Varint) {
        result.push(f.varint);
      } else if (f.wireType === WireType.LengthDelimited) {
        // Packed repeated varint
        let pos = 0;
        while (pos < f.bytes.length) {
          const r = decodeVarint(f.bytes, pos);
          if (!r) break;
          result.push(r[0]);
          pos += r[1];
        }
      }
    }
    return result;
  }

  getRepeatedString(num: number): string[] {
    const result: string[] = [];
    const decoder = new TextDecoder();
    for (const f of this.fields_) {
      if (f.fieldNumber === num && f.wireType === WireType.LengthDelimited) {
        result.push(decoder.decode(f.bytes));
      }
    }
    return result;
  }

  getRepeatedMessage(num: number): WireMessage[] {
    const result: WireMessage[] = [];
    for (const f of this.fields_) {
      if (f.fieldNumber === num && f.wireType === WireType.LengthDelimited) {
        const sub = WireMessage.decode(f.bytes);
        if (sub) result.push(sub);
      }
    }
    return result;
  }

  // --- Raw iteration ---

  get allFields(): WireField[] { return this.fields_; }
  get empty(): boolean { return this.fields_.length === 0; }
}
