// Runtime schema-based protobuf decode/encode.
// TypeScript equivalent of the C++ proto_field<N,T> DSL using plain schema objects.
//
// Usage:
//   const MyMessageSchema = {
//     fromUin:  { field: 1, type: 'uint32' as const },
//     fromUid:  { field: 2, type: 'string' as const },
//     grp:      { field: 8, type: 'message' as const, schema: GrpSchema },
//     elements: { field: 2, type: 'repeated_message' as const, schema: ElemSchema },
//   };
//   type MyMessage = ProtoDecoded<typeof MyMessageSchema>;
//   const msg = protoDecode(rawBytes, MyMessageSchema);

import { WireMessage, WireType, encodeVarint, encodeKey, decodeVarint } from './wire';

// --- Schema types ---

export type FieldType =
  | 'bool' | 'int32' | 'uint32' | 'int64' | 'uint64'
  | 'string' | 'bytes' | 'message'
  | 'repeated_varint' | 'repeated_uint32' | 'repeated_string'
  | 'repeated_bytes' | 'repeated_message';

export interface FieldDef {
  field: number;
  type: FieldType;
  schema?: ProtoSchema;  // required for 'message' / 'repeated_message'
}

export type ProtoSchema = { [key: string]: FieldDef };

// --- Decoded type inference ---

type FieldTypeToTS<T extends FieldType, S extends ProtoSchema | undefined> =
  T extends 'bool' ? boolean :
  T extends 'int32' | 'uint32' ? number :
  T extends 'int64' | 'uint64' ? bigint :
  T extends 'string' ? string :
  T extends 'bytes' ? Uint8Array :
  T extends 'message' ? (S extends ProtoSchema ? ProtoDecoded<S> : Record<string, unknown>) :
  T extends 'repeated_varint' | 'repeated_uint32' ? number[] :
  T extends 'repeated_string' ? string[] :
  T extends 'repeated_bytes' ? Uint8Array[] :
  T extends 'repeated_message' ? (S extends ProtoSchema ? ProtoDecoded<S>[] : Record<string, unknown>[]) :
  never;

type IsRepeated<T extends FieldType> = T extends `repeated_${string}` ? true : false;

type FieldValue<F extends FieldDef> =
  IsRepeated<F['type']> extends true
    ? FieldTypeToTS<F['type'], F['schema']>
    : FieldTypeToTS<F['type'], F['schema']> | undefined;

export type ProtoDecoded<S extends ProtoSchema> = {
  [K in keyof S]: FieldValue<S[K]>;
};

// --- Decode ---

export function protoDecode<S extends ProtoSchema>(
  data: Uint8Array | WireMessage,
  schema: S
): ProtoDecoded<S> | null {
  const wire = data instanceof WireMessage ? data : WireMessage.decode(data);
  if (!wire) return null;

  const result: Record<string, unknown> = {};

  for (const [key, def] of Object.entries(schema)) {
    switch (def.type) {
      case 'bool': {
        const v = wire.getVarint(def.field);
        if (v !== null) result[key] = v !== 0n;
        break;
      }
      case 'int32': {
        const v = wire.getInt32(def.field);
        if (v !== null) result[key] = v;
        break;
      }
      case 'uint32': {
        const v = wire.getUint32(def.field);
        if (v !== null) result[key] = v;
        break;
      }
      case 'int64': {
        const v = wire.getInt64(def.field);
        if (v !== null) result[key] = v;
        break;
      }
      case 'uint64': {
        const v = wire.getUint64(def.field);
        if (v !== null) result[key] = v;
        break;
      }
      case 'string': {
        const v = wire.getString(def.field);
        if (v !== null) result[key] = v;
        break;
      }
      case 'bytes': {
        const v = wire.getBytes(def.field);
        if (v !== null) result[key] = v;
        break;
      }
      case 'message': {
        const sub = wire.getMessage(def.field);
        if (sub && def.schema) {
          result[key] = protoDecode(sub, def.schema);
        }
        break;
      }
      case 'repeated_varint': {
        const vals = wire.getRepeatedVarint(def.field);
        result[key] = vals.map(v => Number(BigInt.asIntN(32, v)));
        break;
      }
      case 'repeated_uint32': {
        const vals = wire.getRepeatedVarint(def.field);
        result[key] = vals.map(v => Number(BigInt.asUintN(32, v)));
        break;
      }
      case 'repeated_string': {
        result[key] = wire.getRepeatedString(def.field);
        break;
      }
      case 'repeated_bytes': {
        const flds = wire.fields(def.field);
        result[key] = flds
          .filter(f => f.wireType === WireType.LengthDelimited)
          .map(f => f.bytes);
        break;
      }
      case 'repeated_message': {
        if (!def.schema) { result[key] = []; break; }
        const msgs = wire.getRepeatedMessage(def.field);
        result[key] = msgs
          .map(m => protoDecode(m, def.schema!))
          .filter((m): m is NonNullable<typeof m> => m !== null);
        break;
      }
    }
  }

  return result as ProtoDecoded<S>;
}

// --- Encode ---

export function protoEncode<S extends ProtoSchema>(
  obj: Partial<ProtoDecoded<S>>,
  schema: S
): Uint8Array {
  const out: number[] = [];
  const record = obj as Record<string, any>;

  for (const [key, def] of Object.entries(schema)) {
    const val = record[key];
    if (val === undefined || val === null) continue;

    switch (def.type) {
      case 'bool': {
        encodeKey(def.field, WireType.Varint, out);
        encodeVarint(val ? 1 : 0, out);
        break;
      }
      case 'int32':
      case 'uint32': {
        encodeKey(def.field, WireType.Varint, out);
        encodeVarint(val as number, out);
        break;
      }
      case 'int64':
      case 'uint64': {
        encodeKey(def.field, WireType.Varint, out);
        encodeVarint(val as bigint, out);
        break;
      }
      case 'string': {
        const encoded = new TextEncoder().encode(val as string);
        encodeKey(def.field, WireType.LengthDelimited, out);
        encodeVarint(encoded.length, out);
        for (const b of encoded) out.push(b);
        break;
      }
      case 'bytes': {
        const buf = val as Uint8Array;
        encodeKey(def.field, WireType.LengthDelimited, out);
        encodeVarint(buf.length, out);
        for (const b of buf) out.push(b);
        break;
      }
      case 'message': {
        if (!def.schema) break;
        const nested = protoEncode(val as any, def.schema);
        encodeKey(def.field, WireType.LengthDelimited, out);
        encodeVarint(nested.length, out);
        for (const b of nested) out.push(b);
        break;
      }
      case 'repeated_varint':
      case 'repeated_uint32': {
        for (const v of val as number[]) {
          encodeKey(def.field, WireType.Varint, out);
          encodeVarint(v, out);
        }
        break;
      }
      case 'repeated_string': {
        const encoder = new TextEncoder();
        for (const s of val as string[]) {
          const encoded = encoder.encode(s);
          encodeKey(def.field, WireType.LengthDelimited, out);
          encodeVarint(encoded.length, out);
          for (const b of encoded) out.push(b);
        }
        break;
      }
      case 'repeated_bytes': {
        for (const buf of val as Uint8Array[]) {
          encodeKey(def.field, WireType.LengthDelimited, out);
          encodeVarint(buf.length, out);
          for (const b of buf) out.push(b);
        }
        break;
      }
      case 'repeated_message': {
        if (!def.schema) break;
        for (const item of val as any[]) {
          const nested = protoEncode(item, def.schema);
          encodeKey(def.field, WireType.LengthDelimited, out);
          encodeVarint(nested.length, out);
          for (const b of nested) out.push(b);
        }
        break;
      }
    }
  }

  return new Uint8Array(out);
}
