interface HTMLVideoElement {
  requestVideoFrameCallback?(
    callback: (now: number, metadata: { mediaTime: number; presentedFrames: number }) => void,
  ): number;
  cancelVideoFrameCallback?(handle: number): void;
}
