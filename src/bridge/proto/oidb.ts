// Proto schemas for OidbSvc service types.
// Port of src/bridge/include/bridge/proto/oidb.h

import type { ProtoSchema } from '../../protobuf/decode';

// --- OidbSvcTrpcTcpBase wrapper ---

export const OidbPropertySchema = {
  key:    { field: 1, type: 'string' as const },
  value:  { field: 2, type: 'bytes' as const },
} satisfies ProtoSchema;

// Factory for OidbSvcTrpcTcpBase<T>
export function makeOidbBaseSchema(bodySchema: ProtoSchema): ProtoSchema {
  return {
    command:    { field: 1, type: 'uint32' as const },
    subCommand: { field: 2, type: 'uint32' as const },
    errorCode:  { field: 3, type: 'uint32' as const },
    body:       { field: 4, type: 'message' as const, schema: bodySchema },
    errorMsg:   { field: 5, type: 'string' as const },
    properties: { field: 11, type: 'repeated_message' as const, schema: OidbPropertySchema },
    reserved:   { field: 12, type: 'int32' as const },
  };
}

// --- Friend list (0xFD4_1) ---

export const OidbFriendPropertySchema = {
  code:   { field: 1, type: 'uint32' as const },
  value:  { field: 2, type: 'string' as const },
} satisfies ProtoSchema;

export const OidbFriendLayer1Schema = {
  properties: { field: 2, type: 'repeated_message' as const, schema: OidbFriendPropertySchema },
} satisfies ProtoSchema;

export const OidbFriendAdditionalSchema = {
  type:   { field: 1, type: 'uint32' as const },
  layer1: { field: 2, type: 'message' as const, schema: OidbFriendLayer1Schema },
} satisfies ProtoSchema;

export const OidbFriendSchema = {
  uid:        { field: 1, type: 'string' as const },
  customGroup:{ field: 2, type: 'uint32' as const },
  uin:        { field: 3, type: 'uint32' as const },
  additional: { field: 10001, type: 'repeated_message' as const, schema: OidbFriendAdditionalSchema },
} satisfies ProtoSchema;

export const OidbSvcTrpcTcp0xFD4_1ResponseUinSchema = {
  uin: { field: 1, type: 'uint32' as const },
} satisfies ProtoSchema;

export const OidbSvcTrpcTcp0xFD4_1ResponseSchema = {
  next:               { field: 2, type: 'message' as const, schema: OidbSvcTrpcTcp0xFD4_1ResponseUinSchema },
  displayFriendCount: { field: 3, type: 'uint32' as const },
  timestamp:          { field: 6, type: 'uint32' as const },
  selfUin:            { field: 7, type: 'uint32' as const },
  friends:            { field: 101, type: 'repeated_message' as const, schema: OidbFriendSchema },
  groups:             { field: 102, type: 'repeated_message' as const, schema: OidbFriendPropertySchema },
} satisfies ProtoSchema;

// --- Group list (0xFE5_2) ---

export const OidbSvcTrpcTcp0xFE5_2MemberSchema = {
  uid: { field: 2, type: 'string' as const },
} satisfies ProtoSchema;

export const OidbSvcTrpcTcp0xFE5_2GroupInfoSchema = {
  groupOwner:   { field: 1, type: 'message' as const, schema: OidbSvcTrpcTcp0xFE5_2MemberSchema },
  createdTime:  { field: 2, type: 'uint32' as const },
  memberMax:    { field: 3, type: 'uint32' as const },
  memberCount:  { field: 4, type: 'uint32' as const },
  groupName:    { field: 5, type: 'string' as const },
  description:  { field: 18, type: 'string' as const },
  question:     { field: 19, type: 'string' as const },
  announcement: { field: 30, type: 'string' as const },
} satisfies ProtoSchema;

export const OidbSvcTrpcTcp0xFE5_2CustomInfoSchema = {
  remark: { field: 3, type: 'string' as const },
} satisfies ProtoSchema;

export const OidbSvcTrpcTcp0xFE5_2GroupSchema = {
  groupUin:   { field: 3, type: 'uint32' as const },
  info:       { field: 4, type: 'message' as const, schema: OidbSvcTrpcTcp0xFE5_2GroupInfoSchema },
  customInfo: { field: 5, type: 'message' as const, schema: OidbSvcTrpcTcp0xFE5_2CustomInfoSchema },
} satisfies ProtoSchema;

export const OidbSvcTrpcTcp0xFE5_2ResponseSchema = {
  groups: { field: 2, type: 'repeated_message' as const, schema: OidbSvcTrpcTcp0xFE5_2GroupSchema },
} satisfies ProtoSchema;

// --- Group member list (0xFE7_3) ---

export const OidbSvcTrpcTcp0xFE7_3UinSchema = {
  uid: { field: 2, type: 'string' as const },
  uin: { field: 4, type: 'uint32' as const },
} satisfies ProtoSchema;

export const OidbSvcTrpcTcp0xFE7_3CardSchema = {
  memberCard: { field: 2, type: 'string' as const },
} satisfies ProtoSchema;

export const OidbSvcTrpcTcp0xFE7_3LevelSchema = {
  infos: { field: 1, type: 'repeated_uint32' as const },
  level: { field: 2, type: 'uint32' as const },
} satisfies ProtoSchema;

export const OidbSvcTrpcTcp0xFE7_3MemberSchema = {
  uin:              { field: 1, type: 'message' as const, schema: OidbSvcTrpcTcp0xFE7_3UinSchema },
  memberName:       { field: 10, type: 'string' as const },
  specialTitle:     { field: 17, type: 'string' as const },
  memberCard:       { field: 11, type: 'message' as const, schema: OidbSvcTrpcTcp0xFE7_3CardSchema },
  level:            { field: 12, type: 'message' as const, schema: OidbSvcTrpcTcp0xFE7_3LevelSchema },
  joinTimestamp:    { field: 100, type: 'uint32' as const },
  lastMsgTimestamp: { field: 101, type: 'uint32' as const },
  shutUpTimestamp:  { field: 102, type: 'uint32' as const },
  permission:       { field: 107, type: 'uint32' as const },
} satisfies ProtoSchema;

export const OidbSvcTrpcTcp0xFE7_3ResponseSchema = {
  groupUin:           { field: 1, type: 'uint32' as const },
  members:            { field: 2, type: 'repeated_message' as const, schema: OidbSvcTrpcTcp0xFE7_3MemberSchema },
  field3:             { field: 3, type: 'uint32' as const },
  memberChangeSeq:    { field: 5, type: 'uint32' as const },
  memberCardChangeSeq:{ field: 6, type: 'uint32' as const },
  token:              { field: 15, type: 'string' as const },
} satisfies ProtoSchema;

// --- Group request (0x10C0) ---

export const OidbSvcTrpcTcp0x10C0ResponseUserSchema = {
  uid:  { field: 1, type: 'string' as const },
  name: { field: 2, type: 'string' as const },
} satisfies ProtoSchema;

export const OidbSvcTrpcTcp0x10C0ResponseGroupSchema = {
  groupUin:   { field: 1, type: 'uint32' as const },
  groupName:  { field: 2, type: 'string' as const },
} satisfies ProtoSchema;

export const OidbSvcTrpcTcp0x10C0ResponseRequestSchema = {
  sequence:     { field: 1, type: 'uint64' as const },
  eventType:    { field: 2, type: 'uint32' as const },
  state:        { field: 3, type: 'uint32' as const },
  group:        { field: 4, type: 'message' as const, schema: OidbSvcTrpcTcp0x10C0ResponseGroupSchema },
  target:       { field: 5, type: 'message' as const, schema: OidbSvcTrpcTcp0x10C0ResponseUserSchema },
  invitor:      { field: 6, type: 'message' as const, schema: OidbSvcTrpcTcp0x10C0ResponseUserSchema },
  operatorUser: { field: 7, type: 'message' as const, schema: OidbSvcTrpcTcp0x10C0ResponseUserSchema },
  field9:       { field: 9, type: 'string' as const },
  comment:      { field: 10, type: 'string' as const },
} satisfies ProtoSchema;

export const OidbSvcTrpcTcp0x10C0ResponseSchema = {
  requests:     { field: 1, type: 'repeated_message' as const, schema: OidbSvcTrpcTcp0x10C0ResponseRequestSchema },
  field2:       { field: 2, type: 'uint64' as const },
  newLatestSeq: { field: 3, type: 'uint64' as const },
  field4:       { field: 4, type: 'uint32' as const },
  field5:       { field: 5, type: 'uint64' as const },
  field6:       { field: 6, type: 'uint32' as const },
} satisfies ProtoSchema;
