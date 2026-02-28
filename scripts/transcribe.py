#!/usr/bin/env python3
"""Transcribe audio/video using faster-whisper, emitting JSON-line progress to stdout."""
import sys
import json
from faster_whisper import WhisperModel


def main():
    if len(sys.argv) != 3:
        print(json.dumps({"type": "error", "message": "Usage: transcribe.py <audio_path> <output_path>"}), flush=True)
        sys.exit(1)

    audio_path = sys.argv[1]
    output_path = sys.argv[2]

    # Emit loading status (model may take seconds to load from cache)
    print(json.dumps({"type": "progress", "percent": 0, "status": "loading_model"}), flush=True)

    model = WhisperModel("turbo", device="cpu", compute_type="int8")

    print(json.dumps({"type": "progress", "percent": 0, "status": "transcribing"}), flush=True)

    segments_gen, info = model.transcribe(
        audio_path,
        word_timestamps=True,
        vad_filter=True,
        vad_parameters={"min_silence_duration_ms": 500},
    )

    words = []
    last_percent = -1
    for segment in segments_gen:
        # Progress: segment.end / info.duration -> 0.0-1.0
        percent = min(99, int(segment.end / info.duration * 100))
        if percent > last_percent:
            print(json.dumps({"type": "progress", "percent": percent}), flush=True)
            last_percent = percent

        if segment.words:
            for w in segment.words:
                words.append({
                    "word": w.word.strip(),
                    "start": round(w.start, 3),
                    "end": round(w.end, 3),
                    "confidence": round(w.probability, 3),
                })

    # Write transcript JSON to output file
    transcript = {
        "language": info.language,
        "words": words,
    }
    with open(output_path, "w") as f:
        json.dump(transcript, f, indent=2)

    print(json.dumps({"type": "done", "percent": 100, "language": info.language, "word_count": len(words)}), flush=True)


if __name__ == "__main__":
    main()
