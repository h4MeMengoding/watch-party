import { useCallback, useEffect, useRef, useState } from 'react';
import Peer from 'simple-peer-light';
import { WS_PORT } from '@watch-together/shared';

const WS_URL = import.meta.env.VITE_WS_URL ?? `ws://localhost:${WS_PORT}`;
const TURN_CREDENTIALS_URL = import.meta.env.VITE_TURN_CREDENTIALS_URL as string | undefined;

let cachedIce: RTCIceServer[] | null = null;
let cacheExpiry = 0;

function getTurnCredentialsUrl() {
  if (TURN_CREDENTIALS_URL) return TURN_CREDENTIALS_URL;
  const url = new URL(WS_URL.replace(/^wss:/, 'https:').replace(/^ws:/, 'http:'));
  return `${url.origin}/turn-credentials`;
}

async function getIceServers(): Promise<RTCIceServer[]> {
  if (cachedIce && Date.now() < cacheExpiry) return cachedIce;

  const res = await fetch(getTurnCredentialsUrl(), { cache: 'no-store' });
  if (!res.ok) throw new Error(`TURN credentials ${res.status}`);

  const data = await res.json() as { iceServers: RTCIceServer[] };
  if (!Array.isArray(data.iceServers) || data.iceServers.length === 0) {
    throw new Error('TURN credentials response is empty');
  }

  cachedIce = data.iceServers;
  cacheExpiry = Date.now() + 23 * 60 * 60 * 1000;
  return cachedIce;
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
      config: {
        iceServers,
        iceTransportPolicy: 'relay',
      },
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
