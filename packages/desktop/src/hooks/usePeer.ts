import { useCallback, useEffect, useRef, useState } from 'react';
import Peer from 'simple-peer-light';
import { STUN_SERVERS } from '@watch-together/shared';

const CF_API_TOKEN = import.meta.env.VITE_CF_API_TOKEN as string | undefined;
const CF_TURN_KEY_ID = import.meta.env.VITE_CF_TURN_KEY_ID as string | undefined;

// Cloudflare TURN credentials cache (valid 24h, we cache 23h)
let cachedIce: RTCIceServer[] | null = null;
let cacheExpiry = 0;

async function getIceServers(): Promise<RTCIceServer[]> {
  const stun = STUN_SERVERS as RTCIceServer[];

  if (!CF_API_TOKEN || !CF_TURN_KEY_ID) return stun;
  if (cachedIce && Date.now() < cacheExpiry) return cachedIce;

  try {
    const res = await fetch(
      `https://rtc.live.cloudflare.com/v1/turn/keys/${CF_TURN_KEY_ID}/credentials/generate`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${CF_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ttl: 86400 }),
      },
    );

    if (!res.ok) throw new Error(`CF TURN ${res.status}`);

    const data = await res.json() as { iceServers: { urls: string[]; username: string; credential: string } };
    const turnServers: RTCIceServer[] = [{
      urls: data.iceServers.urls,
      username: data.iceServers.username,
      credential: data.iceServers.credential,
    }];

    cachedIce = [...stun, ...turnServers];
    cacheExpiry = Date.now() + 23 * 60 * 60 * 1000; // 23h
    return cachedIce;
  } catch (err) {
    console.warn('[TURN] failed to fetch credentials, using STUN only:', err);
    return stun;
  }
}

export function usePeer(
  onSignal: (targetId: string, signal: unknown) => void,
  onStream?: (peerId: string, stream: MediaStream) => void,
) {
  const peers = useRef<Map<string, InstanceType<typeof Peer>>>(new Map());
  const [streams, setStreams] = useState<Map<string, MediaStream>>(new Map());

  const createPeer = useCallback(async (
    peerId: string,
    initiator: boolean,
    localStream?: MediaStream,
  ) => {
    const iceServers = await getIceServers();

    const peer = new Peer({
      initiator,
      stream: localStream,
      trickle: true,
      config: { iceServers },
    });

    peer.on('signal', (data: unknown) => onSignal(peerId, data));

    peer.on('stream', (s: MediaStream) => {
      setStreams(prev => new Map(prev).set(peerId, s));
      onStream?.(peerId, s);
    });

    peer.on('error', (err: Error) => console.warn('[peer] error', peerId, err.message));

    peer.on('close', () => {
      peers.current.delete(peerId);
      setStreams(prev => {
        const n = new Map(prev);
        n.delete(peerId);
        return n;
      });
    });

    peers.current.set(peerId, peer);
    return peer;
  }, [onSignal, onStream]);

  const signal = useCallback(async (peerId: string, data: unknown) => {
    if (!peers.current.has(peerId)) {
      await createPeer(peerId, false);
    }
    peers.current.get(peerId)?.signal(data);
  }, [createPeer]);

  const addStream = useCallback((stream: MediaStream) => {
    for (const p of peers.current.values()) {
      try { (p as any).addStream(stream); } catch { /* already destroyed */ }
    }
  }, []);

  const removeStream = useCallback((stream: MediaStream) => {
    for (const p of peers.current.values()) {
      try { (p as any).removeStream(stream); } catch { /* already destroyed */ }
    }
  }, []);

  const destroyPeer = useCallback((peerId: string) => {
    peers.current.get(peerId)?.destroy();
    peers.current.delete(peerId);
  }, []);

  const destroyAll = useCallback(() => {
    for (const p of peers.current.values()) p.destroy();
    peers.current.clear();
    setStreams(new Map());
  }, []);

  useEffect(() => () => destroyAll(), [destroyAll]);

  return { createPeer, signal, addStream, removeStream, destroyPeer, destroyAll, streams };
}
