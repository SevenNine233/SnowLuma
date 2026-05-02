// Image upload pipeline: load image, OIDB upload request, highway upload, build message element.
// Port of src/bridge/src/highway_upload_req.cpp + highway_client.cpp (image parts)

import type { Bridge } from '../bridge';
import type { MessageElement } from '../events';
import { protoEncode, protoDecode } from '../../protobuf/decode';
import { makeOidbBaseSchema } from '../proto/oidb';
import {
  NTV2UploadRichMediaReqSchema,
  NTV2UploadRichMediaRespSchema,
  EncodableMediaMsgInfoSchema,
} from '../proto/highway';
import {
  loadBinarySource, computeHashes, detectImageFormat,
} from './utils';
import {
  fetchHighwaySession, uploadHighwayHttp, buildHighwayExtend,
  PRIVATE_IMAGE_CMD_ID, GROUP_IMAGE_CMD_ID,
} from './highway-client';

interface ImageData {
  bytes: Uint8Array;
  md5: Uint8Array;
  sha1: Uint8Array;
  md5Hex: string;
  sha1Hex: string;
  fileName: string;
  summary: string;
  subType: number;
  width: number;
  height: number;
  picFormat: number;
}

function loadImage(element: MessageElement): Promise<ImageData> {
  return loadImageFromSource(
    element.url || element.fileId || '',
    element.fileName ?? '',
    element.subType ?? 0,
    element.summary ?? '',
  );
}

async function loadImageFromSource(source: string, fileName: string, subType: number, summary: string): Promise<ImageData> {
  const loaded = await loadBinarySource(source, 'image');
  const hashes = computeHashes(loaded.bytes);
  const fmt = detectImageFormat(loaded.bytes);

  const extMap: Record<number, string> = { 1000: '.jpg', 1001: '.png', 1002: '.webp', 1005: '.bmp', 2000: '.gif' };
  const ext = extMap[fmt.format] ?? '.jpg';

  let finalName = fileName || loaded.fileName;
  if (!finalName) finalName = hashes.md5Hex + ext;

  return {
    bytes: loaded.bytes,
    md5: hashes.md5,
    sha1: hashes.sha1,
    md5Hex: hashes.md5Hex,
    sha1Hex: hashes.sha1Hex,
    fileName: finalName,
    summary: summary || (subType === 0 ? '[image]' : '[sticker]'),
    subType,
    width: fmt.width,
    height: fmt.height,
    picFormat: fmt.format,
  };
}

async function startImageUpload(bridge: Bridge, isGroup: boolean, targetIdOrUid: string | number, image: ImageData): Promise<any> {
  const body: any = {
    reqHead: {
      common: { requestId: 1, command: 100 },
      scene: {
        requestType: 2,
        businessType: 1,
        sceneType: isGroup ? 2 : 1,
        ...(isGroup
          ? { group: { groupUin: Number(targetIdOrUid) } }
          : { c2c: { accountType: 2, targetUid: String(targetIdOrUid) } }),
      },
      client: { agentType: 2 },
    },
    upload: {
      uploadInfo: [{
        fileInfo: {
          fileSize: image.bytes.length,
          fileHash: image.md5Hex,
          fileSha1: image.sha1Hex,
          fileName: image.fileName,
          type: { type: 1, picFormat: image.picFormat, videoFormat: 0, voiceFormat: 0 },
          width: image.width,
          height: image.height,
          time: 0,
          original: 1,
        },
        subFileType: 0,
      }],
      tryFastUploadCompleted: true,
      srvSendMsg: false,
      clientRandomId: BigInt(Math.floor(Math.random() * 0x7FFFFFFFFFFFFFFF)),
      compatQmsgSceneType: isGroup ? 2 : 1,
      extBizInfo: {
        pic: {
          bizType: image.subType,
          textSummary: image.summary,
          ...(isGroup
            ? { reserveTroop: { subType: image.subType } }
            : { reserveC2c: { subType: image.subType } }),
        },
        video: { bytesPbReserve: new Uint8Array(0) },
        ptt: {
          bytesReserve: new Uint8Array(0),
          bytesPbReserve: new Uint8Array(0),
          bytesGeneralFlags: new Uint8Array(0),
        },
      },
      clientSeq: 0,
      noNeedCompatMsg: false,
    },
  };

  const oidbCmd = isGroup ? 0x11C4 : 0x11C5;
  const serviceCmd = isGroup ? 'OidbSvcTrpcTcp.0x11c4_100' : 'OidbSvcTrpcTcp.0x11c5_100';

  const baseSchema = makeOidbBaseSchema(NTV2UploadRichMediaReqSchema);
  const request = protoEncode({
    command: oidbCmd, subCommand: 100, errorCode: 0, body, errorMsg: '', reserved: 1,
  }, baseSchema);

  const result = await bridge.sendRawPacket(serviceCmd, request);
  if (!result.success || !result.gotResponse || !result.responseData) {
    throw new Error(result.errorMessage || 'image upload request failed');
  }

  const respBaseSchema = makeOidbBaseSchema(NTV2UploadRichMediaRespSchema);
  const resp: any = protoDecode(result.responseData, respBaseSchema);
  if (!resp) throw new Error('failed to decode upload response');
  if (resp.errorCode && resp.errorCode !== 0) {
    throw new Error(`OIDB error ${resp.errorCode}: ${resp.errorMsg ?? ''}`);
  }

  const uploadBody = resp.body;
  if (!uploadBody) throw new Error('upload response body missing');
  if (uploadBody.respHead?.retCode && uploadBody.respHead.retCode !== 0) {
    throw new Error(uploadBody.respHead.message ?? 'image upload failed');
  }
  return uploadBody.upload;
}

function finalizeImageMsgInfo(upload: any, image: ImageData): Uint8Array {
  if (!upload?.msgInfo) throw new Error('upload response missing msgInfo');

  const msgInfoBody = (upload.msgInfo.msgInfoBody ?? []).map((b: any) => ({
    index: b.index, picture: b.picture, fileExist: b.fileExist, hashSum: b.hashSum,
  }));

  const extBizInfo: any = {};
  if (upload.msgInfo.extBizInfo?.pic) {
    extBizInfo.pic = { ...upload.msgInfo.extBizInfo.pic };
    extBizInfo.pic.bizType = extBizInfo.pic.bizType ?? image.subType;
    extBizInfo.pic.textSummary = extBizInfo.pic.textSummary ?? image.summary;
  } else {
    extBizInfo.pic = { bizType: image.subType, textSummary: image.summary };
  }
  if (upload.msgInfo.extBizInfo?.video) extBizInfo.video = upload.msgInfo.extBizInfo.video;
  if (upload.msgInfo.extBizInfo?.ptt) extBizInfo.ptt = upload.msgInfo.extBizInfo.ptt;
  if (upload.msgInfo.extBizInfo?.busiType !== undefined) extBizInfo.busiType = upload.msgInfo.extBizInfo.busiType;

  return protoEncode({ msgInfoBody, extBizInfo }, EncodableMediaMsgInfoSchema);
}

/**
 * Upload an image and return the encoded MsgInfo bytes to embed in a CommonElem.
 */
export async function uploadImageMsgInfo(
  bridge: Bridge,
  isGroup: boolean,
  targetIdOrUid: string | number,
  element: MessageElement,
): Promise<Uint8Array> {
  const image = await loadImage(element);
  const upload = await startImageUpload(bridge, isGroup, targetIdOrUid, image);

  // Upload binary if uKey is present (not fast-uploaded)
  const uKey = upload?.uKey ?? '';
  if (uKey && upload?.msgInfo) {
    const session = await fetchHighwaySession(bridge);
    const extend = buildHighwayExtend(uKey, upload.msgInfo, upload.ipv4s ?? [], image.sha1);
    const commandId = isGroup ? GROUP_IMAGE_CMD_ID : PRIVATE_IMAGE_CMD_ID;
    await uploadHighwayHttp(bridge, session, commandId, image.bytes, image.md5, extend);
  }

  return finalizeImageMsgInfo(upload, image);
}
