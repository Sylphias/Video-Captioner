#!/usr/bin/env python3
"""Transcribe audio/video using NVIDIA Parakeet TDT on CUDA, emitting JSON-line progress to stdout."""
import sys
import json
import os
import subprocess
import tempfile


def main():
    if len(sys.argv) < 3:
        print(json.dumps({"type": "error", "message": "Usage: transcribe.py <audio_path> <output_path> [language]"}), flush=True)
        sys.exit(1)

    audio_path = sys.argv[1]
    output_path = sys.argv[2]
    language = sys.argv[3] if len(sys.argv) > 3 else "en"

    print(json.dumps({"type": "progress", "percent": 0, "status": "loading_model"}), flush=True)

    import nemo.collections.asr as nemo_asr

    asr_model = nemo_asr.models.ASRModel.from_pretrained("nvidia/parakeet-tdt-0.6b-v2")
    asr_model = asr_model.to("cuda")
    asr_model.eval()

    # Parakeet requires 16kHz mono WAV — extract from mp4 if needed
    wav_path = audio_path
    cleanup_wav = False
    if audio_path.lower().endswith(".mp4"):
        wav_path = os.path.join(tempfile.gettempdir(), ".parakeet_temp.wav")
        subprocess.run(
            ["ffmpeg", "-y", "-i", audio_path, "-vn", "-acodec", "pcm_s16le",
             "-ar", "16000", "-ac", "1", wav_path],
            capture_output=True, check=True
        )
        cleanup_wav = True

    print(json.dumps({"type": "progress", "percent": 10, "status": "transcribing"}), flush=True)

    output = asr_model.transcribe([wav_path], timestamps=True)

    if cleanup_wav and os.path.exists(wav_path):
        os.remove(wav_path)

    word_timestamps = output[0].timestamp['word']

    words = []
    for stamp in word_timestamps:
        words.append({
            "word": stamp['word'].strip(),
            "start": round(stamp['start'], 3),
            "end": round(stamp['end'], 3),
            "confidence": 1.0,  # Parakeet does not expose per-word probability
        })

    transcript = {"language": language, "words": words}
    with open(output_path, "w") as f:
        json.dump(transcript, f, indent=2)

    print(json.dumps({"type": "done", "percent": 100, "language": language, "word_count": len(words)}), flush=True)


if __name__ == "__main__":
    main()
