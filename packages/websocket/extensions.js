import zlib from 'node:zlib';

const TRAILER = Buffer.from([0x00, 0x00, 0xff, 0xff]);

function parseHeader(header) {
  const offers = [];
  if (!header) return offers;
  for (const rawOffer of String(header).split(',')) {
    const parts = rawOffer.split(';').map((p) => p.trim()).filter(Boolean);
    if (parts.length === 0) continue;
    const name = parts.shift().toLowerCase();
    const params = Object.create(null);
    for (const part of parts) {
      const eq = part.indexOf('=');
      if (eq === -1) {
        params[part.toLowerCase()] = true;
      } else {
        const key = part.slice(0, eq).trim().toLowerCase();
        let value = part.slice(eq + 1).trim();
        if ((value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        params[key] = value;
      }
    }
    offers.push({ name, params });
  }
  return offers;
}

function normalizePerMessageDeflateOptions(value) {
  if (value === undefined || value === false || value === null) return null;
  if (value === true) {
    return { clientNoContextTakeover: true, serverNoContextTakeover: true };
  }
  if (typeof value === 'object') {
    return {
      clientNoContextTakeover: true,
      serverNoContextTakeover: true,
      ...value,
    };
  }
  return { clientNoContextTakeover: true, serverNoContextTakeover: true };
}

function acceptPerMessageDeflate(requestHeader, options) {
  const config = normalizePerMessageDeflateOptions(options);
  if (!config) return null;
  const offer = parseHeader(requestHeader).find((item) => item.name === 'permessage-deflate');
  if (!offer) return null;
  const responseParams = [];

  if (config.serverNoContextTakeover !== false || offer.params.server_no_context_takeover) {
    responseParams.push('server_no_context_takeover');
  }
  if (config.clientNoContextTakeover !== false || offer.params.client_no_context_takeover) {
    responseParams.push('client_no_context_takeover');
  }

  const accepted = {
    enabled: true,
    requestNoContextTakeover: responseParams.includes('client_no_context_takeover'),
    responseNoContextTakeover: responseParams.includes('server_no_context_takeover'),
    threshold: config.threshold ?? 1024,
  };

  return {
    header: ['permessage-deflate', ...responseParams].join('; '),
    options: accepted,
  };
}

function offerPerMessageDeflate(options) {
  const config = normalizePerMessageDeflateOptions(options);
  if (!config) return null;
  const params = ['permessage-deflate'];
  if (config.clientNoContextTakeover !== false) params.push('client_no_context_takeover');
  if (config.serverNoContextTakeover !== false) params.push('server_no_context_takeover');
  return params.join('; ');
}

function parseAcceptedPerMessageDeflate(responseHeader, requestedOptions) {
  const config = normalizePerMessageDeflateOptions(requestedOptions);
  if (!config) return null;
  const accepted = parseHeader(responseHeader).find((item) => item.name === 'permessage-deflate');
  if (!accepted) return null;
  for (const key of Object.keys(accepted.params)) {
    if (key !== 'client_no_context_takeover' && key !== 'server_no_context_takeover') {
      throw new Error(`Unsupported permessage-deflate parameter: ${key}`);
    }
  }
  return {
    enabled: true,
    requestNoContextTakeover: !!accepted.params.server_no_context_takeover,
    responseNoContextTakeover: !!accepted.params.client_no_context_takeover,
    threshold: config.threshold ?? 1024,
  };
}

function compressRaw(data) {
  const compressed = zlib.deflateRawSync(data, { flush: zlib.constants.Z_SYNC_FLUSH });
  if (compressed.length >= 4 && compressed.subarray(compressed.length - 4).equals(TRAILER)) {
    return compressed.subarray(0, compressed.length - 4);
  }
  return compressed;
}

function decompressRaw(data, maxPayload) {
  const inflated = zlib.inflateRawSync(Buffer.concat([data, TRAILER]), {
    finishFlush: zlib.constants.Z_SYNC_FLUSH,
  });
  if (maxPayload !== undefined && inflated.length > maxPayload) {
    const err = new Error('Message too large after inflate');
    err.code = 1009;
    throw err;
  }
  return inflated;
}

function normalizeProtocolList(protocols) {
  if (!protocols) return [];
  if (typeof protocols === 'string') return protocols.split(',').map((p) => p.trim()).filter(Boolean);
  if (Array.isArray(protocols)) return protocols.map(String).map((p) => p.trim()).filter(Boolean);
  if (protocols instanceof Set) return Array.from(protocols).map(String).map((p) => p.trim()).filter(Boolean);
  return [];
}

function chooseSubprotocol(requestHeader, protocols) {
  const requested = normalizeProtocolList(requestHeader);
  if (typeof protocols === 'function') {
    const selected = protocols(requested);
    return selected && requested.includes(String(selected)) ? String(selected) : null;
  }
  const supported = normalizeProtocolList(protocols);
  if (requested.length === 0 || supported.length === 0) return null;
  for (const protocol of supported) {
    if (requested.includes(protocol)) return protocol;
  }
  return null;
}

export {
  acceptPerMessageDeflate,
  chooseSubprotocol,
  compressRaw,
  decompressRaw,
  offerPerMessageDeflate,
  normalizeProtocolList,
  parseAcceptedPerMessageDeflate,
  parseHeader,
};
