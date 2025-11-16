import React, { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Mic, StopCircle } from "lucide-react";

type Props = {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  ariaLabel?: string;
};

/**
 * SpeechTextarea
 * Uses Web Speech API (window.SpeechRecognition || webkitSpeechRecognition).
 * - continuous mode
 * - interimResults (word-by-word interim displayed)
 * - restarts automatically on 'end' so user can record long answers
 *
 * Limitations: browser support varies. Use server-side STT for more robust punctuation/accuracy.
 */
export const SpeechTextarea: React.FC<Props> = ({
  value,
  onChange,
  disabled = false,
  placeholder,
  className,
  ariaLabel = "Answer input with speech-to-text",
}) => {
  const [isSupported, setIsSupported] = useState<boolean>(false);
  const [recording, setRecording] = useState(false);
  const [interim, setInterim] = useState<string>("");
  const recognitionRef = useRef<any>(null);
  const lastTranscriptRef = useRef<string>("");

  // small auto-punctuator: when a segment ends and last char isn't punctuation, append a period.
  const autoPunctuate = (text: string) => {
    if (!text) return text;
    const trimmed = text.trim();
    if (trimmed.length === 0) return text;
    const lastChar = trimmed.charAt(trimmed.length - 1);
    if (".!?".includes(lastChar)) return text;
    return trimmed + ". ";
  };

  useEffect(() => {
    const win: any = window as any;
    const SpeechRecognition = win.SpeechRecognition || win.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setIsSupported(false);
      return;
    }
    setIsSupported(true);

    const rec = new SpeechRecognition();
    // configuration
    rec.continuous = true; // long answers
    rec.interimResults = true; // get interim results
    rec.lang = navigator.language || "en-US";
    rec.maxAlternatives = 1;

    rec.onresult = (ev: SpeechRecognitionEvent) => {
      // combine interim + final
      let interimTranscript = "";
      let finalTranscript = "";
      for (let i = ev.resultIndex; i < ev.results.length; ++i) {
        const r = ev.results[i];
        if (r.isFinal) {
          finalTranscript += r[0].transcript;
        } else {
          interimTranscript += r[0].transcript;
        }
      }

      // update interim word-by-word (you can split into words if you want)
      if (interimTranscript) {
        setInterim(interimTranscript);
      } else {
        setInterim("");
      }

      if (finalTranscript) {
        // apply punctuation heuristic and append to the textarea content
        const punctuated = autoPunctuate(finalTranscript);
        lastTranscriptRef.current = lastTranscriptRef.current + " " + punctuated;
        // update parent value
        onChange((prev) => (prev ? prev + " " + punctuated : punctuated));
      }
    };

    rec.onerror = (e: any) => {
      // console.warn("SpeechRecognition error", e);
      // If permission denied or not allowed, stop recording
      if (e && (e.error === "not-allowed" || e.error === "service-not-allowed")) {
        setRecording(false);
        try {
          rec.stop();
        } catch {}
      }
    };

    rec.onend = () => {
      // when the engine stops naturally, if user intended to keep recording, restart it
      recognitionRef.current = rec;
      if (recording) {
        try {
          // small timeout before restart helps on some mobile browsers
          setTimeout(() => {
            try {
              rec.start();
            } catch {}
          }, 250);
        } catch {}
      }
    };

    recognitionRef.current = rec;

    return () => {
      try {
        if (recognitionRef.current) recognitionRef.current.onresult = null;
        if (recognitionRef.current) recognitionRef.current.onend = null;
      } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run once

  const toggleRecording = async () => {
    if (!isSupported) return;
    if (disabled) return;

    const rec = recognitionRef.current;
    if (!rec) return;

    if (!recording) {
      try {
        // request permission and start
        rec.start();
        setRecording(true);
        setInterim("");
      } catch (err) {
        // some browsers throw if start is called too soon
        console.warn("Could not start recognition", err);
      }
    } else {
      try {
        rec.stop();
      } catch {}
      setRecording(false);
      setInterim("");
    }
  };

  const handleManualChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);
  };

  return (
    <div className={`relative ${className || ""}`}>
      {/* Recording banner */}
      {recording && (
        <div
          role="status"
          aria-live="polite"
          className="mb-2 flex items-center gap-3 rounded px-3 py-1 text-sm font-medium text-white"
          style={{ background: "#dc2626" }}
        >
          <div className="animate-pulse inline-block h-2 w-2 rounded-full bg-white" />
          Recording...
        </div>
      )}

      <div className="relative">
        <textarea
          aria-label={ariaLabel}
          placeholder={placeholder}
          value={value + (interim ? (value ? " " + interim : interim) : "")}
          onChange={handleManualChange}
          disabled={disabled}
          className="w-full min-h-[120px] resize-none rounded-md border px-3 py-2 pr-12 text-sm leading-relaxed"
        />

        {/* mic button inside textarea (positioned absolute) */}
        <button
          onClick={toggleRecording}
          type="button"
          aria-pressed={recording}
          aria-label={recording ? "Stop recording" : "Start recording"}
          className={`absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full transition-transform focus:outline-none ${
            recording ? "scale-105" : ""
          }`}
          style={{
            background: recording ? "#ef4444" : "transparent",
            border: recording ? "none" : "1px solid rgba(0,0,0,0.08)",
            boxShadow: recording ? "0 6px 18px rgba(239,68,68,0.16)" : undefined,
          }}
        >
          <Mic
            className={`h-4 w-4 ${recording ? "text-white animate-pulse" : "text-muted-foreground"}`}
          />
        </button>
      </div>

      {/* small helper underneath showing interim transcript as word-by-word */}
      {interim && (
        <div className="mt-2 text-xs text-muted-foreground">
          <strong>Interim:</strong>{" "}
          {interim
            .trim()
            .split(/\s+/)
            .map((w, i) => (
              <span key={i} className="mr-1 inline-block">
                {w}
              </span>
            ))}
        </div>
      )}

      {!isSupported && (
        <div className="mt-2 rounded border bg-yellow-50 p-2 text-xs text-yellow-700">
          Speech-to-text is not supported in this browser. Try Chrome on desktop/mobile for best results.
        </div>
      )}
    </div>
  );
};
