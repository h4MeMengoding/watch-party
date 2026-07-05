import { useEffect, useRef } from 'react';

interface Props {
  stream: MediaStream | null;
  muted?: boolean;
  className?: string;
}

export function VideoPlayer({ stream, muted = false, className }: Props) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream;
  }, [stream]);

  return (
    <video
      ref={ref}
      className={className ?? 'video-player'}
      autoPlay
      playsInline
      muted={muted}
    />
  );
}
