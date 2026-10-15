/**
 * Ordered app shutdown. Kept free of Electron imports so the sequence
 * can be unit-tested without spinning up the app.
 */

export interface ShutdownDeps {
  unregisterShortcuts?: () => void
  stopMeetingDetector?: () => void
  stopRecording?: () => Promise<void>
  endActiveMeeting?: () => void
  closeDatabase?: () => void
  destroyTray?: () => void
  /** Cap how long we wait for the final STT flush. Default 15s. */
  stopTimeoutMs?: number
}

const DEFAULT_STOP_TIMEOUT_MS = 15_000

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => resolve(), ms)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (err) => {
        clearTimeout(timer)
        reject(err)
      }
    )
  })
}

/**
 * Flush recording, persist meeting end, then close the DB.
 * Later steps still run if an earlier step throws or times out.
 *
 * Callers must `preventDefault()` on `will-quit` and only `app.quit()`
 * after this resolves — otherwise `audioManager.stop()` races
 * `database.close()` and `endMeeting()` never runs.
 */
export async function performShutdown(deps: ShutdownDeps): Promise<void> {
  deps.unregisterShortcuts?.()
  deps.stopMeetingDetector?.()

  if (deps.stopRecording) {
    try {
      await withTimeout(deps.stopRecording(), deps.stopTimeoutMs ?? DEFAULT_STOP_TIMEOUT_MS)
    } catch {
      // Best-effort flush — still end the meeting and close the DB
    }
  }

  try {
    deps.endActiveMeeting?.()
  } catch {
    // Meeting row may already be closed; still close the DB
  }

  deps.closeDatabase?.()
  deps.destroyTray?.()
}
