import { describe, expect, it } from 'vitest';
import { MediaCache } from '../src/onebot/media-cache';
import { EventConverter } from '../src/onebot/event-converter';
import type { GroupMessage, FriendMessage, MessageElement } from '../src/bridge/events';

const SELF_UIN = '10001';
const SELF_ID = 10001;
const PEER_UIN = 22222;
const GROUP_ID = 99999;

function imageElement(overrides: Partial<MessageElement> = {}): MessageElement {
  return {
    type: 'image',
    fileId: 'abc.png',
    fileSize: 4242,
    imageUrl: 'https://example.com/abc.png',
    ...overrides,
  };
}

function recordElement(overrides: Partial<MessageElement> = {}): MessageElement {
  return {
    type: 'record',
    fileId: 'uuid-base64-fake',
    fileName: 'silk_test.amr',
    fileSize: 1024,
    duration: 3,
    fileHash: 'deadbeef',
    mediaNode: { fileUuid: 'uuid-base64-fake', storeId: 1 },
    ...overrides,
  };
}

function makeGroupMessage(elements: MessageElement[]): GroupMessage {
  return {
    kind: 'group_message',
    time: 1700000000,
    selfUin: SELF_ID,
    groupId: GROUP_ID,
    senderUin: PEER_UIN,
    senderNick: 'peer',
    senderCard: '',
    senderRole: 'member',
    msgSeq: 1,
    msgId: 1,
    elements,
  };
}

function makeFriendMessage(elements: MessageElement[]): FriendMessage {
  return {
    kind: 'friend_message',
    time: 1700000000,
    selfUin: SELF_ID,
    senderUin: PEER_UIN,
    senderNick: 'peer',
    msgSeq: 1,
    msgId: 1,
    elements,
  };
}

describe('MediaCache basic semantics', () => {
  it('indexes images by file, fileName, and url', () => {
    const cache = new MediaCache();
    cache.rememberImage({
      file: 'abc.png',
      url: 'https://example.com/abc.png',
      fileSize: 4242,
      fileName: 'abc.png',
      subType: 0,
      summary: '',
      imageUrl: 'https://example.com/abc.png',
      isGroup: true,
      sessionId: GROUP_ID,
    });

    expect(cache.findImage('abc.png')?.fileSize).toBe(4242);
    expect(cache.findImage('https://example.com/abc.png')?.url).toBe('https://example.com/abc.png');
    expect(cache.findImage('missing.png')).toBeNull();
    expect(cache.findImage('')).toBeNull();
  });

  it('indexes records by file, fileName, fileId, and url', () => {
    const cache = new MediaCache();
    cache.rememberRecord({
      file: 'silk_test.amr',
      fileId: 'uuid-base64-fake',
      url: 'https://example.com/voice.amr',
      fileSize: 1024,
      fileName: 'silk_test.amr',
      duration: 3,
      fileHash: 'deadbeef',
      mediaNode: { fileUuid: 'uuid-base64-fake' },
      isGroup: false,
      sessionId: PEER_UIN,
    });

    expect(cache.findRecord('silk_test.amr')?.duration).toBe(3);
    expect(cache.findRecord('uuid-base64-fake')?.fileId).toBe('uuid-base64-fake');
    expect(cache.findRecord('https://example.com/voice.amr')?.url).toBe('https://example.com/voice.amr');
    expect(cache.findRecord('nope')).toBeNull();
  });

  it('updates URLs in place across all index entries', () => {
    const cache = new MediaCache();
    cache.rememberRecord({
      file: 'silk_test.amr',
      fileId: 'uuid-base64-fake',
      url: '',
      fileSize: 1024,
      fileName: 'silk_test.amr',
      duration: 3,
      fileHash: '',
      mediaNode: { fileUuid: 'uuid-base64-fake' },
      isGroup: false,
      sessionId: PEER_UIN,
    });
    cache.updateRecordUrl('silk_test.amr', 'https://refreshed.example.com/voice.amr');
    expect(cache.findRecord('silk_test.amr')?.url).toBe('https://refreshed.example.com/voice.amr');
    // Lookup by fileId should also see the refreshed url since it shares the entry.
    expect(cache.findRecord('uuid-base64-fake')?.url).toBe('https://refreshed.example.com/voice.amr');
  });

  it('evicts oldest entries when bound is exceeded', () => {
    const cache = new MediaCache(33);
    for (let i = 0; i < 100; i++) {
      cache.rememberImage({
        file: `file-${i}.png`,
        url: `https://example.com/${i}.png`,
        fileSize: i,
        fileName: `file-${i}.png`,
        subType: 0,
        summary: '',
        imageUrl: '',
        isGroup: true,
        sessionId: GROUP_ID,
      });
    }
    // Earliest entry should have been evicted (each item adds 2 keys: file + url),
    // so the bound is reached well before 100 distinct entries.
    expect(cache.findImage('file-0.png')).toBeNull();
    // Last inserted entry must still be present.
    expect(cache.findImage('file-99.png')?.fileSize).toBe(99);
  });
});

describe('EventConverter media segment sink', () => {
  it('emits sink invocations for image segments with the right context', async () => {
    const conv = new EventConverter();
    const sinkCalls: Array<{ type: string; isGroup: boolean; sessionId: number; file: string }> = [];
    conv.setMediaSegmentSink((type, _element, data, isGroup, sessionId) => {
      sinkCalls.push({ type, isGroup, sessionId, file: String(data.file ?? '') });
    });

    await conv.convert(SELF_UIN, makeGroupMessage([imageElement()]));
    await conv.convert(SELF_UIN, makeFriendMessage([recordElement()]));

    expect(sinkCalls).toEqual([
      { type: 'image', isGroup: true, sessionId: GROUP_ID, file: 'abc.png' },
      { type: 'record', isGroup: false, sessionId: PEER_UIN, file: 'silk_test.amr' },
    ]);
  });

  it('lets the sink populate a MediaCache that get_image-style lookups can use', async () => {
    const conv = new EventConverter();
    const cache = new MediaCache();
    conv.setImageUrlResolver((element) => element.imageUrl ?? '');
    conv.setMediaUrlResolver(async (element) => element.url ?? '');
    conv.setMediaSegmentSink((type, element, data, isGroup, sessionId) => {
      const url = typeof data.url === 'string' ? data.url : '';
      const file = typeof data.file === 'string' ? data.file : '';
      if (type === 'image') {
        cache.rememberImage({
          file: file || element.fileId || '',
          url,
          fileSize: element.fileSize ?? 0,
          fileName: element.fileId ?? '',
          subType: element.subType ?? 0,
          summary: element.summary ?? '',
          imageUrl: element.imageUrl ?? '',
          isGroup,
          sessionId,
        });
      } else {
        cache.rememberRecord({
          file: file || element.fileName || element.fileId || '',
          fileId: element.fileId ?? '',
          url,
          fileSize: element.fileSize ?? 0,
          fileName: element.fileName ?? '',
          duration: element.duration ?? 0,
          fileHash: element.fileHash ?? '',
          mediaNode: element.mediaNode,
          isGroup,
          sessionId,
        });
      }
    });

    await conv.convert(SELF_UIN, makeGroupMessage([imageElement()]));
    await conv.convert(SELF_UIN, makeFriendMessage([recordElement()]));

    const img = cache.findImage('abc.png');
    expect(img).not.toBeNull();
    expect(img!.url).toBe('https://example.com/abc.png');
    expect(img!.fileSize).toBe(4242);
    expect(img!.isGroup).toBe(true);
    expect(img!.sessionId).toBe(GROUP_ID);

    const rec = cache.findRecord('silk_test.amr');
    expect(rec).not.toBeNull();
    expect(rec!.fileId).toBe('uuid-base64-fake');
    expect(rec!.duration).toBe(3);
    expect(rec!.isGroup).toBe(false);
    expect(rec!.sessionId).toBe(PEER_UIN);
    // Should also be findable by the raw fileUuid, mirroring how callers may
    // pass back any of the identifiers we previously emitted.
    expect(cache.findRecord('uuid-base64-fake')?.fileName).toBe('silk_test.amr');
  });

  it('does not invoke the sink when no media segments are present', async () => {
    const conv = new EventConverter();
    let calls = 0;
    conv.setMediaSegmentSink(() => { calls++; });
    await conv.convert(SELF_UIN, makeGroupMessage([{ type: 'text', text: 'hello' }]));
    expect(calls).toBe(0);
  });
});
