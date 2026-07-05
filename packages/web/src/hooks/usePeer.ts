import { useCallback, useEffect, useRef, useState } from 'react';
import Peer from 'simple-peer-light';
import { WS_PORT } from '@watch-together/shared';

const WS_URL = import.meta.env.VITE_WS_URL ?? `ws://localhost:${WS_PORT}`;
const TURN_CREDENTIALS_URL = import.meta.env.VITE_TURN_CREDENTIALS_URL as string | undefined;

export interface PeerStatus {
  label: string;
  tone: 'idle' | 'pending' | 'ok' | 'error';
  detail?: string;
}

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
  const pendingSignals = useRef<Map<string, unknown[]>>(new Map());
  const creatingPeer = useRef<Map<string, Promise<InstanceType<typeof Peer>>>>(new Map());
  const [streams, setStreams] = useState<Map<string, MediaStream>>(new Map());
  const [peerStatus, setPeerStatus] = useState<PeerStatus>({
    label: 'Waiting for peer',
    tone: 'idle',
  });

  const createPeer = useCallback(async (
    peerId: string,
    initiator: boolean,
    localStream?: MediaStream,
  ) => {
    setPeerStatus({ label: 'Preparing TURN', tone: 'pending' });
    const iceServers = await getIceServers();
    setPeerStatus({ label: 'TURN ready', tone: 'pending', detail: `${iceServers.length} relay server set` });

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
    peer.on('connect', () => {
      setPeerStatus({ label: 'Peer connected', tone: 'ok', detail: 'Waiting for media track' });
    });
    peer.on('stream', (s: MediaStream) => {
      const videoTracks = s.getVideoTracks().length;
      const audioTracks = s.getAudioTracks().length;
      setPeerStatus({
        label: 'Media received',
        tone: 'ok',
        detail: `${videoTracks} video track, ${audioTracks} audio track`,
      });

      // Disable all voice-processing on received audio tracks (sounds like phone otherwise)
      s.getAudioTracks().forEach(track => {
        track.applyConstraints({
          // @ts-ignore — browser-specific but widely supported
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        }).catch(() => undefined);
      });

      setStreams(prev => new Map(prev).set(peerId, s));
      onStream?.(peerId, s);
    });
    peer.on('error', (err: Error) => {
      console.warn('[peer] error', peerId, err.message);
      setPeerStatus({ label: 'Peer error', tone: 'error', detail: err.message });
    });
    peer.on('close', () => {
      peers.current.delete(peerId);
      setPeerStatus({ label: 'Peer closed', tone: 'idle' });
      setStreams(prev => { const n = new Map(prev); n.delete(peerId); return n; });
    });

    const pc = (peer as any)._pc as RTCPeerConnection | undefined;
    if (pc) {
      const updateConnectionStatus = () => {
        const ice = pc.iceConnectionState;
        const connection = pc.connectionState;
        if (ice === 'failed' || connection === 'failed') {
          setPeerStatus({ label: 'TURN connection failed', tone: 'error', detail: `ICE ${ice}, peer ${connection}` });
        } else if (ice === 'connected' || ice === 'completed' || connection === 'connected') {
          setPeerStatus({ label: 'TURN connected', tone: 'ok', detail: `ICE ${ice}, peer ${connection}` });
        } else if (ice === 'checking' || connection === 'connecting') {
          setPeerStatus({ label: 'Connecting through TURN', tone: 'pending', detail: `ICE ${ice}, peer ${connection}` });
        } else {
          setPeerStatus({ label: 'Peer negotiating', tone: 'pending', detail: `ICE ${ice}, peer ${connection}` });
        }
      };

      pc.addEventListener('iceconnectionstatechange', updateConnectionStatus);
      pc.addEventListener('connectionstatechange', updateConnectionStatus);
    }

    peers.current.set(peerId, peer);

    // Flush any signals that arrived while peer was being created
    const queued = pendingSignals.current.get(peerId) ?? [];
    pendingSignals.current.delete(peerId);
    creatingPeer.current.delete(peerId);
    for (const s of queued) peer.signal(s);

    return peer;
  }, [onSignal, onStream]);

  const signal = useCallback(async (peerId: string, data: unknown) => {
    // If peer exists and ready, signal immediately
    if (peers.current.has(peerId)) {
      peers.current.get(peerId)?.signal(data);
      return;
    }
    // If peer is being created, queue the signal
    if (creatingPeer.current.has(peerId)) {
      const q = pendingSignals.current.get(peerId) ?? [];
      q.push(data);
      pendingSignals.current.set(peerId, q);
      await creatingPeer.current.get(peerId);
      return;
    }
    // First signal for this peer — create it, then flush will handle this signal + any queued
    const q: unknown[] = [data];
    pendingSignals.current.set(peerId, q);
    const promise = createPeer(peerId, false);
    creatingPeer.current.set(peerId, promise);
    await promise;
  }, [createPeer]);

  const addStream = useCallback((stream: MediaStream) => {
    for (const p of peers.current.values()) {
      try { (p as any).addStream(stream); } catch { /* destroyed */ }
    }
  }, []);

  const removeStream = useCallback((stream: MediaStream) => {
    for (const p of peers.current.values()) {
      try { (p as any).removeStream(stream); } catch { /* destroyed */ }
    }
  }, []);

  const destroyAll = useCallback(() => {
    for (const p of peers.current.values()) p.destroy();
    peers.current.clear();
    setPeerStatus({ label: 'Waiting for peer', tone: 'idle' });
    setStreams(new Map());
  }, []);

  useEffect(() => () => destroyAll(), [destroyAll]);

  return { createPeer, signal, addStream, removeStream, destroyAll, streams, peerStatus };
}
