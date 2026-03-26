#!/usr/bin/env python3
"""Spike: Validate Parakeet TDT installs in WSL and produces word-level timestamps.

Platform: WSL (Ubuntu) — NeMo has no native Windows support (triton dependency).
Run via:  just spike-parakeet
Or:       wsl /root/.venv-wsl/bin/python3 scripts/spike_parakeet.py [audio_path]

The script is stored in the Windows repo root and accessed from WSL at its /mnt/... path.
"""
import sys
import json
import os
import subprocess
import tempfile

def main():
    print("=== Parakeet TDT Spike ===")

    # Check 1: torch CUDA available
    import torch
    print(f"PyTorch version: {torch.__version__}")
    print(f"CUDA available: {torch.cuda.is_available()}")
    if not torch.cuda.is_available():
        print("FAIL: CUDA not available")
        sys.exit(1)
    print(f"CUDA device: {torch.cuda.get_device_name(0)}")

    # Check 2: NeMo ASR imports
    try:
        import nemo.collections.asr as nemo_asr
        print(f"NeMo ASR imported successfully")
    except ImportError as e:
        print(f"FAIL: NeMo ASR import failed: {e}")
        sys.exit(1)

    # Check 3: Load Parakeet TDT model
    print("Loading Parakeet TDT model (first run downloads ~1.2GB)...")
    try:
        asr_model = nemo_asr.models.ASRModel.from_pretrained("nvidia/parakeet-tdt-0.6b-v2")
        asr_model = asr_model.to("cuda")
        asr_model.eval()
        print("Model loaded on CUDA successfully")
    except Exception as e:
        print(f"FAIL: Model load failed: {e}")
        sys.exit(1)

    # Check 4: Transcribe a test file (user must provide path as arg)
    if len(sys.argv) < 2:
        print("PASS (install + model load). Provide audio path as arg to test transcription.")
        sys.exit(0)

    audio_path = sys.argv[1]

    # Extract WAV if mp4
    wav_path = audio_path
    cleanup = False
    if audio_path.lower().endswith(".mp4"):
        wav_path = os.path.join(tempfile.gettempdir(), "spike_parakeet_temp.wav")
        subprocess.run(
            ["ffmpeg", "-y", "-i", audio_path, "-vn", "-acodec", "pcm_s16le",
             "-ar", "16000", "-ac", "1", wav_path],
            capture_output=True, check=True
        )
        cleanup = True

    print(f"Transcribing {wav_path}...")
    output = asr_model.transcribe([wav_path], timestamps=True)

    if cleanup and os.path.exists(wav_path):
        os.remove(wav_path)

    # Check 5: Validate word timestamps exist
    try:
        word_timestamps = output[0].timestamp['word']
        print(f"Word timestamps: {len(word_timestamps)} words")
        # Print first 10 for manual inspection
        for i, stamp in enumerate(word_timestamps[:10]):
            print(f"  [{i}] {stamp['start']:.3f}-{stamp['end']:.3f}: '{stamp['word']}'")
        if len(word_timestamps) == 0:
            print("FAIL: No word timestamps produced")
            sys.exit(1)
        # Verify fields exist
        sample = word_timestamps[0]
        assert 'start' in sample, "Missing 'start' field"
        assert 'end' in sample, "Missing 'end' field"
        assert 'word' in sample, "Missing 'word' field"
        print(f"\nPASS: Parakeet TDT produced {len(word_timestamps)} word timestamps with start/end/word fields")
    except Exception as e:
        print(f"FAIL: Word timestamp extraction failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
