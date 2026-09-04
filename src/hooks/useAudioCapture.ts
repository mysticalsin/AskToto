/**
 * Renderer-side audio capture hook.
 * Listens for 'start-audio-capture' / 'stop-audio-capture' from main process,
 * captures microphone audio via Web Audio API, and sends PCM chunks back.
 */
export function setupAudioCapture() {
  if (!window.api) return

  let mediaStream: MediaStream | null = null
  let audioContext: AudioContext | null = null
  let processor: ScriptProcessorNode | null = null
  // Incremented on every stop so an in-flight getUserMedia cannot attach after cancel
  let captureGeneration = 0

  const startCapture = async () => {
    const generation = ++captureGeneration
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

      if (generation !== captureGeneration) {
        stream.getTracks().forEach((t) => t.stop())
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
      window.api.send('audio-capture-ready')
    } catch (err) {
      console.error('[AudioCapture] Failed to start:', err)
      if (generation === captureGeneration) {
        const message = err instanceof Error ? err.message : String(err)
        window.api.send('audio-capture-error', message)
      }
    }
  }

  const stopCapture = () => {
    captureGeneration++
    if (processor) {
      processor.disconnect()
      processor = null
    }
    if (audioContext) {
      audioContext.close().catch(() => {})
      audioContext = null
    }
    if (mediaStream) {
      mediaStream.getTracks().forEach((t) => t.stop())
      mediaStream = null
    }
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
