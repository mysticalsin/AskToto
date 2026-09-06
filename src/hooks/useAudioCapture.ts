import { AudioCaptureSession, discardMediaStream } from './audioCaptureSession'

/**
 * Renderer-side audio capture hook.
 * Listens for 'start-audio-capture' / 'stop-audio-capture' from main process,
 * captures microphone audio via Web Audio API, and sends PCM chunks back.
 *
 * getUserMedia is async (and may wait on a permission prompt). A stop — or a
 * newer start — that arrives while that request is in-flight must discard the
 * stale stream so the microphone does not stay open after the user stopped.
 */
export function setupAudioCapture() {
  if (!window.api) return

  const session = new AudioCaptureSession()
  let mediaStream: MediaStream | null = null
  let audioContext: AudioContext | null = null
  let processor: ScriptProcessorNode | null = null

  const teardownPipeline = () => {
    if (processor) {
      processor.disconnect()
      processor = null
    }
    if (audioContext) {
      audioContext.close().catch(() => {})
      audioContext = null
    }
    if (mediaStream) {
      discardMediaStream(mediaStream)
      mediaStream = null
    }
  }

  const startCapture = async () => {
    const generation = session.beginStart()
    teardownPipeline()

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })

      if (!session.isCurrent(generation)) {
        discardMediaStream(stream)
        return
      }

      mediaStream = stream
      audioContext = new AudioContext({ sampleRate: 16000 })
      const source = audioContext.createMediaStreamSource(mediaStream)

      // ScriptProcessorNode with 4096 buffer (256ms at 16kHz)
      processor = audioContext.createScriptProcessor(4096, 1, 1)

      processor.onaudioprocess = (e) => {
        const float32Data = e.inputBuffer.getChannelData(0)
        // Convert Float32 [-1,1] to Int16 PCM
        const int16 = new Int16Array(float32Data.length)
        for (let i = 0; i < float32Data.length; i++) {
          const s = Math.max(-1, Math.min(1, float32Data[i]))
          int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF
        }
        // Send PCM chunk to main process as ArrayBuffer via IPC
        window.api.send('audio-chunk', Array.from(int16))
      }

      source.connect(processor)
      processor.connect(audioContext.destination)
    } catch (err) {
      if (session.isCurrent(generation)) {
        console.error('[AudioCapture] Failed to start:', err)
      }
    }
  }

  const stopCapture = () => {
    session.invalidate()
    teardownPipeline()
  }

  // Register IPC listeners
  const unsubStart = window.api.on('start-audio-capture', () => {
    startCapture()
  })

  const unsubStop = window.api.on('stop-audio-capture', () => {
    stopCapture()
  })

  // Return cleanup function
  return () => {
    stopCapture()
    unsubStart()
    unsubStop()
  }
}
