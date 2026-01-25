// src/audio/AudioEngine.ts
export class AudioEngine {
  private audioCtx: AudioContext | null = null;
  private sourceNode: AudioBufferSourceNode | null = null;
  private eqFilters: BiquadFilterNode[] = [];
  private mediaRecorder: MediaRecorder | null = null;
  private destinationNode: MediaStreamAudioDestinationNode | null = null;
  private recordedChunks: Blob[] = [];

  private readonly MAX_BANDS = 36;
  private readonly MAX_ROWS = 36;

  async init(): Promise<void> {
    if (this.audioCtx && this.audioCtx.state === 'running') return;

    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!this.audioCtx) {
      this.audioCtx = new AudioContextClass();
    }

    if (this.audioCtx.state === 'suspended') {
      await this.audioCtx.resume();
    }

    // Build EQ chain
    this.eqFilters = [];
    let previousNode: AudioNode | null = null;

    for (let i = 0; i < this.MAX_BANDS; i++) {
      const filter = this.audioCtx.createBiquadFilter();
      filter.type = 'peaking';
      filter.frequency.value = 20 * Math.pow(2, i / 3);
      filter.Q.value = 1.4;
      filter.gain.value = 0;

      if (previousNode) previousNode.connect(filter);
      this.eqFilters.push(filter);
      previousNode = filter;
    }
  }

  setBandGain(bandIndex: number, rowIndex: number) {
    if (!this.audioCtx || !this.eqFilters[bandIndex]) return;

    const gainDB = (rowIndex / (this.MAX_ROWS - 1) * 36) - 18;
    this.eqFilters[bandIndex].gain.setTargetAtTime(gainDB, this.audioCtx.currentTime, 0.1);
  }

  /**
   * Start playback and recording.
   * `onEndedWithBlob` is called once the source ends AND MediaRecorder has flushed all chunks.
   */
  startPlayback(
    buffer: AudioBuffer,
    videoStream: MediaStream | null,
    onEndedWithBlob: (blob: Blob | null) => void,
  ) {
    if (!this.audioCtx || this.eqFilters.length === 0) return;

    // Clear any previous chunks
    this.recordedChunks = [];

    this.sourceNode = this.audioCtx.createBufferSource();
    this.sourceNode.buffer = buffer;
    this.sourceNode.connect(this.eqFilters[0]);

    this.destinationNode = this.audioCtx.createMediaStreamDestination();
    const lastFilter = this.eqFilters[this.MAX_BANDS - 1];

    lastFilter.connect(this.audioCtx.destination);
    lastFilter.connect(this.destinationNode);

    try {
      // COMBINE AUDIO + VIDEO TRACKS
      let recordStream: MediaStream = this.destinationNode.stream;
      let mimeType = 'audio/webm;codecs=opus';

      if (videoStream) {
        const combinedTracks = [
          ...videoStream.getVideoTracks(),
          ...this.destinationNode.stream.getAudioTracks(),
        ];
        recordStream = new MediaStream(combinedTracks);
        mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
          ? 'video/webm;codecs=vp9,opus'
          : MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')
          ? 'video/webm;codecs=vp8,opus'
          : 'video/webm';
      }

      this.mediaRecorder = new MediaRecorder(recordStream, { mimeType });

      this.mediaRecorder.ondataavailable = e => {
        if (e.data && e.data.size > 0) {
          this.recordedChunks.push(e.data);
        }
      };

      this.mediaRecorder.onstop = () => {
        const blob = this.getRecordingBlobInternal();
        onEndedWithBlob(blob);
        // Avoid any reuse of stale chunks
        this.recordedChunks = [];
      };

      this.mediaRecorder.start(250); // collect in 250ms chunks
    } catch (e) {
      console.warn('MediaRecorder failed', e);
      this.mediaRecorder = null;
    }

    this.sourceNode.onended = () => {
      this.stopRecording(); // triggers onstop => onEndedWithBlob
    };

    this.sourceNode.start(0);
  }

  stop() {
    if (this.sourceNode) {
      try {
        this.sourceNode.stop();
      } catch {
        // ignore
      }
      this.sourceNode = null;
    }
    this.stopRecording();
  }

  stopRecording() {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
  }

  /**
   * Internal helper – builds a Blob from current chunks, if any.
   */
  private getRecordingBlobInternal(): Blob | null {
    if (!this.recordedChunks.length) return null;

    const type =
      this.mediaRecorder && this.mediaRecorder.mimeType.includes('video')
        ? 'video/webm'
        : 'audio/webm';
    return new Blob(this.recordedChunks, { type });
  }

  /**
   * Public accessor in case the UI wants to poll the blob later.
   * Returns the most recently completed recording, or null.
   */
  getRecordingBlob(): Blob | null {
    return this.getRecordingBlobInternal();
  }

  getAudioContext(): AudioContext | null {
    return this.audioCtx;
  }
}

export const audioEngine = new AudioEngine();
export default audioEngine;