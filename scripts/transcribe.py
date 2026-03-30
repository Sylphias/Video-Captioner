#!/usr/bin/env python3
"""Transcribe + diarize audio/video using WhisperX.

Pipeline: Whisper transcription → wav2vec2 forced alignment → pyannote diarization → speaker-assigned words.
Auto-detects device: CUDA → MPS (Apple Silicon) → CPU.
Emits JSON-line progress to stdout.

Usage: transcribe.py <audio_path> <output_path> [language] [hf_token] [num_speakers]
"""
import sys
import json
import os

import torch


def detect_device():
    """Pick the best available device and matching compute type.

    CTranslate2 (faster-whisper backend) only supports CUDA and CPU — not MPS.
    """
    if torch.cuda.is_available():
        return "cuda", "float16", 16
    return "cpu", "int8", 4


def main():
    if len(sys.argv) < 3:
        print(json.dumps({"type": "error", "message": "Usage: transcribe.py <audio_path> <output_path> [language] [hf_token] [num_speakers]"}), flush=True)
        sys.exit(1)

    audio_path = sys.argv[1]
    output_path = sys.argv[2]
    language = sys.argv[3] if len(sys.argv) > 3 else "en"
    hf_token = sys.argv[4] if len(sys.argv) > 4 else os.environ.get("HUGGINGFACE_TOKEN")
    num_speakers = int(sys.argv[5]) if len(sys.argv) > 5 else None
    device, compute_type, batch_size = detect_device()

    print(json.dumps({"type": "progress", "percent": 0, "status": "loading_model", "device": device}), flush=True)

    import whisperx

    model = whisperx.load_model("large-v3", device, compute_type=compute_type, language=language)

    # Step 1: Transcribe
    print(json.dumps({"type": "progress", "percent": 10, "status": "transcribing"}), flush=True)

    audio = whisperx.load_audio(audio_path)
    result = model.transcribe(audio, batch_size=batch_size)

    # Step 2: Forced alignment with wav2vec2
    print(json.dumps({"type": "progress", "percent": 40, "status": "aligning"}), flush=True)

    align_model, align_metadata = whisperx.load_align_model(language_code=language, device=device)
    result = whisperx.align(result["segments"], align_model, align_metadata, audio, device, return_char_alignments=False)

    # Step 3: Speaker diarization (if HuggingFace token available)
    if hf_token:
        print(json.dumps({"type": "progress", "percent": 60, "status": "diarizing"}), flush=True)

        try:
            from whisperx.diarize import DiarizationPipeline
            diarize_model = DiarizationPipeline(token=hf_token, device=device)
            diarize_kwargs = {}
            if num_speakers is not None:
                diarize_kwargs["min_speakers"] = num_speakers
                diarize_kwargs["max_speakers"] = num_speakers
            diarize_segments = diarize_model(audio_path, **diarize_kwargs)
            result = whisperx.assign_word_speakers(diarize_segments, result)
        except Exception as e:
            # Diarization failure is non-fatal — continue without speaker labels
            print(json.dumps({"type": "progress", "percent": 80, "status": "diarization_failed", "message": str(e)}), flush=True)

    # Step 4: Extract words with optional speaker labels
    print(json.dumps({"type": "progress", "percent": 90, "status": "finalizing"}), flush=True)

    words = []
    for segment in result["segments"]:
        segment_speaker = segment.get("speaker")
        for w in segment.get("words", []):
            if "start" not in w or "end" not in w:
                continue
            word_entry = {
                "word": w["word"].strip(),
                "start": round(w["start"], 3),
                "end": round(w["end"], 3),
                "confidence": round(w.get("score", 1.0), 3),
            }
            speaker = w.get("speaker") or segment_speaker
            if speaker:
                word_entry["speaker"] = speaker
            words.append(word_entry)

    transcript = {"language": language, "words": words}
    with open(output_path, "w") as f:
        json.dump(transcript, f, indent=2)

    speaker_count = len({w["speaker"] for w in words if "speaker" in w})
    print(json.dumps({"type": "done", "percent": 100, "language": language, "word_count": len(words), "speaker_count": speaker_count}), flush=True)


if __name__ == "__main__":
    main()
