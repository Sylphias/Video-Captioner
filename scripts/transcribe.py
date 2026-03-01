#!/usr/bin/env python3
"""Transcribe audio/video using mlx-whisper (Apple Silicon GPU), emitting JSON-line progress to stdout."""
import sys
import json
import mlx_whisper


def main():
    if len(sys.argv) < 3:
        print(json.dumps({"type": "error", "message": "Usage: transcribe.py <audio_path> <output_path> [language]"}), flush=True)
        sys.exit(1)

    audio_path = sys.argv[1]
    output_path = sys.argv[2]
    language = sys.argv[3] if len(sys.argv) > 3 else "en"

    # Emit loading status (model download + load may take minutes on first run)
    print(json.dumps({"type": "progress", "percent": 0, "status": "loading_model"}), flush=True)

    # mlx-whisper runs on Apple Silicon GPU via MLX framework
    # transcribe() loads the model and transcribes in one call
    print(json.dumps({"type": "progress", "percent": 5, "status": "transcribing"}), flush=True)

    result = mlx_whisper.transcribe(
        audio_path,
        path_or_hf_repo="mlx-community/whisper-large-v3-mlx",
        language=language,
        word_timestamps=True,
    )

    # Extract words from segments
    words = []
    for segment in result.get("segments", []):
        for w in segment.get("words", []):
            words.append({
                "word": w["word"].strip(),
                "start": round(w["start"], 3),
                "end": round(w["end"], 3),
                "confidence": round(w.get("probability", w.get("confidence", 0.0)), 3),
            })

    # Write transcript JSON to output file
    transcript = {
        "language": result.get("language", language),
        "words": words,
    }
    with open(output_path, "w") as f:
        json.dump(transcript, f, indent=2)

    print(json.dumps({"type": "done", "percent": 100, "language": transcript["language"], "word_count": len(words)}), flush=True)


if __name__ == "__main__":
    main()
