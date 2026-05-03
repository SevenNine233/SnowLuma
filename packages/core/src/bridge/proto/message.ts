// Proto schemas for message envelopes (PushMsg).
// Port of src/bridge/include/bridge/proto/message.h

import type { ProtoSchema } from '../../protobuf/decode';
import { ElemSchema } from './element';

// --- ResponseHead.Grp ---

export const ResponseGrpSchema = {
  groupUin:   { field: 1, type: 'uint32' as const },
  memberName: { field: 2, type: 'string' as const },
  groupName:  { field: 4, type: 'string' as const },
} satisfies ProtoSchema;

export const ResponseForwardSchema = {
  friendName: { field: 6, type: 'string' as const },
} satisfies ProtoSchema;

// --- ResponseHead ---

export const ResponseHeadSchema = {
  fromUin:  { field: 1, type: 'uint32' as const },
  fromUid:  { field: 2, type: 'string' as const },
  type:     { field: 3, type: 'uint32' as const },
  sigMap:   { field: 4, type: 'uint32' as const },
  toUin:    { field: 5, type: 'uint32' as const },
  toUid:    { field: 6, type: 'string' as const },
  forward:  { field: 7, type: 'message' as const, schema: ResponseForwardSchema },
  grp:      { field: 8, type: 'message' as const, schema: ResponseGrpSchema },
} satisfies ProtoSchema;

// --- ContentHead ---

export const ContentHeadSchema = {
  msgType:    { field: 1, type: 'uint32' as const },
  subType:    { field: 2, type: 'uint32' as const },
  divSeq:     { field: 3, type: 'uint32' as const },
  msgId:      { field: 4, type: 'uint32' as const },
  sequence:   { field: 5, type: 'uint32' as const },
  timestamp:  { field: 6, type: 'uint32' as const },
  field7:     { field: 7, type: 'uint64' as const },
  newId:      { field: 12, type: 'uint64' as const },
} satisfies ProtoSchema;

// --- Ptt (voice) ---

export const PttSchema = {
  fileType:     { field: 1, type: 'uint32' as const },
  fileId:       { field: 2, type: 'uint64' as const },
  fileUuid:     { field: 3, type: 'bytes' as const },
  fileMd5:      { field: 4, type: 'bytes' as const },
  fileName:     { field: 5, type: 'string' as const },
  fileSize:     { field: 6, type: 'uint32' as const },
  groupFileKey: { field: 10, type: 'string' as const },
  fileKey:      { field: 14, type: 'bytes' as const },
  time:         { field: 19, type: 'uint32' as const },
  format:       { field: 29, type: 'uint32' as const },
} satisfies ProtoSchema;

// --- NotOnlineFile (C2C file) ---

export const NotOnlineFileSchema = {
  fileType: { field: 1, type: 'uint32' as const },
  fileUuid: { field: 3, type: 'string' as const },
  fileMd5:  { field: 4, type: 'bytes' as const },
  fileName: { field: 5, type: 'string' as const },
  fileSize: { field: 6, type: 'uint64' as const },
  fileHash: { field: 57, type: 'string' as const },
} satisfies ProtoSchema;

// --- RichText ---

export const RichTextSchema = {
  elems:          { field: 2, type: 'repeated_message' as const, schema: ElemSchema },
  notOnlineFile:  { field: 3, type: 'message' as const, schema: NotOnlineFileSchema },
  ptt:            { field: 4, type: 'message' as const, schema: PttSchema },
} satisfies ProtoSchema;

// --- MessageBody ---

export const MessageBodySchema = {
  richText:   { field: 1, type: 'message' as const, schema: RichTextSchema },
  msgContent: { field: 2, type: 'bytes' as const },
} satisfies ProtoSchema;

// --- FileExtra (for C2C file in msg_content) ---

export const FileExtraInfoSchema = {
  fileSize: { field: 1, type: 'uint64' as const },
  fileName: { field: 2, type: 'string' as const },
  fileMd5:  { field: 3, type: 'bytes' as const },
  fileUuid: { field: 4, type: 'string' as const },
  fileHash: { field: 5, type: 'string' as const },
} satisfies ProtoSchema;

export const FileExtraSchema = {
  file: { field: 1, type: 'message' as const, schema: FileExtraInfoSchema },
} satisfies ProtoSchema;

// --- PushMsgBody ---

export const PushMsgBodySchema = {
  responseHead: { field: 1, type: 'message' as const, schema: ResponseHeadSchema },
  contentHead:  { field: 2, type: 'message' as const, schema: ContentHeadSchema },
  body:         { field: 3, type: 'message' as const, schema: MessageBodySchema },
} satisfies ProtoSchema;

// --- PushMsg (top-level) ---

export const PushMsgSchema = {
  message:  { field: 1, type: 'message' as const, schema: PushMsgBodySchema },
  status:   { field: 3, type: 'int32' as const },
} satisfies ProtoSchema;
