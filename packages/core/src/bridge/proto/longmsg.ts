import type { ProtoSchema } from '../../protobuf/decode';
import { PushMsgBodySchema } from './message';

export const LongMsgUidSchema = {
  uid: { field: 2, type: 'string' as const },
} satisfies ProtoSchema;

export const LongMsgSettingsSchema = {
  field1: { field: 1, type: 'uint32' as const },
  field2: { field: 2, type: 'uint32' as const },
  field3: { field: 3, type: 'uint32' as const },
  field4: { field: 4, type: 'uint32' as const },
} satisfies ProtoSchema;

export const SendLongMsgInfoSchema = {
  type: { field: 1, type: 'uint32' as const },
  uid: { field: 2, type: 'message' as const, schema: LongMsgUidSchema },
  groupUin: { field: 3, type: 'uint32' as const },
  payload: { field: 4, type: 'bytes' as const },
} satisfies ProtoSchema;

export const SendLongMsgReqSchema = {
  info: { field: 2, type: 'message' as const, schema: SendLongMsgInfoSchema },
  settings: { field: 15, type: 'message' as const, schema: LongMsgSettingsSchema },
} satisfies ProtoSchema;

export const SendLongMsgRespResultSchema = {
  resId: { field: 3, type: 'string' as const },
} satisfies ProtoSchema;

export const SendLongMsgRespSchema = {
  result: { field: 2, type: 'message' as const, schema: SendLongMsgRespResultSchema },
  settings: { field: 15, type: 'message' as const, schema: LongMsgSettingsSchema },
} satisfies ProtoSchema;

export const RecvLongMsgInfoSchema = {
  uid: { field: 1, type: 'message' as const, schema: LongMsgUidSchema },
  resId: { field: 2, type: 'string' as const },
  acquire: { field: 3, type: 'bool' as const },
} satisfies ProtoSchema;

export const RecvLongMsgReqSchema = {
  info: { field: 1, type: 'message' as const, schema: RecvLongMsgInfoSchema },
  settings: { field: 15, type: 'message' as const, schema: LongMsgSettingsSchema },
} satisfies ProtoSchema;

export const RecvLongMsgRespResultSchema = {
  resId: { field: 3, type: 'string' as const },
  payload: { field: 4, type: 'bytes' as const },
} satisfies ProtoSchema;

export const RecvLongMsgRespSchema = {
  result: { field: 1, type: 'message' as const, schema: RecvLongMsgRespResultSchema },
  settings: { field: 15, type: 'message' as const, schema: LongMsgSettingsSchema },
} satisfies ProtoSchema;

export const LongMsgContentSchema = {
  msgBody: { field: 1, type: 'repeated_message' as const, schema: PushMsgBodySchema },
} satisfies ProtoSchema;

export const LongMsgActionSchema = {
  actionCommand: { field: 1, type: 'string' as const },
  actionData: { field: 2, type: 'message' as const, schema: LongMsgContentSchema },
} satisfies ProtoSchema;

export const LongMsgResultSchema = {
  action: { field: 2, type: 'repeated_message' as const, schema: LongMsgActionSchema },
} satisfies ProtoSchema;
