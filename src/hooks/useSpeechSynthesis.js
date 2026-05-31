import { useCallback, useEffect, useRef, useState } from "react"

// Thin wrapper around window.speechSynthesis for the orb's click-to-speak.
//
// Why a hook: the synth API is global (singleton), but the caller wants
// React-friendly state (isSpeaking flips a className) and stable callbacks.
// Voices load asynchronously on first page load — Chrome fires
// `voiceschanged` once they arrive — so the hook re-renders when they
// land and the next speak() call gets the best match for the requested lang.
//
// Public API:
//   { isSupported, isSpeaking, speak(text, opts?), cancel() }
//
// opts (all optional):
//   - lang: BCP-47 tag ("tr-TR", "en-US"). Default: browser default.
//   - rate: 0.1–10, default 1.
//   - pitch: 0–2, default 1.
//   - volume: 0–1, default 1.
//   - onEnd: () => void  — fires on natural end or cancel.
//
// Caller contract: each speak() cancels any in-flight utterance first
// (single-channel — we never want overlapping voices).

function getSynth() {
  if (typeof window === "undefined") return null
  return window.speechSynthesis || null
}

export function useSpeechSynthesis() {
  const [isSupported] = useState(() => !!getSynth())
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [voices, setVoices] = useState(() => getSynth()?.getVoices() ?? [])
  const utteranceRef = useRef(null)

  // Voices load async on first page paint. Chrome fires `voiceschanged`
  // exactly once when the list arrives; Safari has them ready synchronously.
  useEffect(() => {
    const synth = getSynth()
    if (!synth) return
    const onChange = () => setVoices(synth.getVoices())
    synth.addEventListener("voiceschanged", onChange)
    // Some browsers don't fire voiceschanged if voices were already there.
    const initial = synth.getVoices()
    if (initial.length > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setVoices(initial)
    }
    return () => synth.removeEventListener("voiceschanged", onChange)
  }, [])

  // Pick the best voice for a given BCP-47 lang tag:
  //   1. exact match ("tr-TR" === "tr-TR")
  //   2. language-prefix match ("tr-CY".startsWith("tr"))
  //   3. fall back to system default (null → engine picks)
  const pickVoice = useCallback(
    (lang) => {
      if (!lang || voices.length === 0) return null
      const exact = voices.find((v) => v.lang === lang)
      if (exact) return exact
      const prefix = lang.split("-")[0]
      const partial = voices.find((v) => v.lang.startsWith(prefix))
      return partial ?? null
    },
    [voices],
  )

  const speak = useCallback(
    (text, opts = {}) => {
      const synth = getSynth()
      if (!synth || !text) return
      // Cancel any in-flight utterance — single-channel.
      try {
        synth.cancel()
      } catch {
        // ignore
      }
      const u = new SpeechSynthesisUtterance(text)
      if (opts.lang) u.lang = opts.lang
      if (typeof opts.rate === "number") u.rate = opts.rate
      if (typeof opts.pitch === "number") u.pitch = opts.pitch
      if (typeof opts.volume === "number") u.volume = opts.volume
      const voice = pickVoice(opts.lang)
      if (voice) u.voice = voice

      u.onstart = () => setIsSpeaking(true)
      u.onend = () => {
        setIsSpeaking(false)
        opts.onEnd?.()
      }
      u.onerror = () => {
        setIsSpeaking(false)
      }

      utteranceRef.current = u
      try {
        synth.speak(u)
      } catch {
        setIsSpeaking(false)
      }
    },
    [pickVoice],
  )

  const cancel = useCallback(() => {
    const synth = getSynth()
    if (!synth) return
    try {
      synth.cancel()
    } catch {
      // ignore
    }
    setIsSpeaking(false)
  }, [])

  // Unmount cleanup — never leave a stray voice playing after the component
  // unmounts (e.g. user navigates away mid-speech).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    return () => {
      const synth = getSynth()
      if (!synth) return
      try {
        synth.cancel()
      } catch {
        // ignore
      }
    }
  }, [])

  return { isSupported, isSpeaking, speak, cancel }
}
