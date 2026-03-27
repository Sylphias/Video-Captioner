#!/usr/bin/env python3
"""Run pyannote speaker diarization on CUDA, enriching transcript with per-word speaker labels."""
import sys
import json


def main():
    if len(sys.argv) < 3:
        print(json.dumps({"type": "error", "message": "Usage: diarize.py <audio_path> <transcript_path> [hf_token] [num_speakers]"}), flush=True)
        sys.exit(1)

    audio_path = sys.argv[1]
    transcript_path = sys.argv[2]
    hf_token = sys.argv[3] if len(sys.argv) > 3 else None
    num_speakers = int(sys.argv[4]) if len(sys.argv) > 4 else None

    if not hf_token:
        print(json.dumps({
            "type": "error",
            "message": "HUGGINGFACE_TOKEN required — create a read token at https://huggingface.co/settings/tokens and accept the model license at https://huggingface.co/pyannote/speaker-diarization-3.1"
        }), flush=True)
        sys.exit(1)

    print(json.dumps({"type": "progress", "percent": 0, "status": "loading_model"}), flush=True)

    try:
        from pyannote.audio import Pipeline
        import torch
    except ImportError as e:
        print(json.dumps({"type": "error", "message": f"Import failed: {e}. Run: just setup-python"}), flush=True)
        sys.exit(1)

    try:
        pipeline = Pipeline.from_pretrained(
            "pyannote/speaker-diarization-3.1",
            token=hf_token,
        )
        pipeline.to(torch.device("cuda"))
    except Exception as e:
        print(json.dumps({"type": "error", "message": f"Failed to load pipeline: {e}"}), flush=True)
        sys.exit(1)

    print(json.dumps({"type": "progress", "percent": 0, "status": "diarizing"}), flush=True)

    # Load existing transcript
    try:
        with open(transcript_path, "r") as f:
            transcript = json.load(f)
    except Exception as e:
        print(json.dumps({"type": "error", "message": f"Failed to read transcript: {e}"}), flush=True)
        sys.exit(1)

    words = transcript.get("words", [])

    # Extract audio to WAV for torchaudio
    import subprocess
    import tempfile
    import os

    wav_path = os.path.join(tempfile.gettempdir(), ".diarize_temp.wav")
    try:
        subprocess.run(
            ["ffmpeg", "-y", "-i", audio_path, "-vn", "-acodec", "pcm_s16le", "-ar", "16000", "-ac", "1", wav_path],
            capture_output=True, check=True
        )
    except subprocess.CalledProcessError as e:
        print(json.dumps({"type": "error", "message": f"FFmpeg audio extraction failed: {e.stderr.decode()}"}), flush=True)
        sys.exit(1)

    # Pre-load audio with soundfile — torchaudio's default torchcodec backend is broken on WSL (missing libnvrtc.so)
    # pyannote 4.x accepts {"waveform": tensor, "sample_rate": int}
    try:
        import soundfile as sf
        import torch
        audio_np, sample_rate = sf.read(wav_path, dtype="float32")
        waveform = torch.from_numpy(audio_np).unsqueeze(0)  # (1, samples) mono
        os.remove(wav_path)
    except Exception as e:
        if os.path.exists(wav_path):
            os.remove(wav_path)
        print(json.dumps({"type": "error", "message": f"Failed to load audio: {e}"}), flush=True)
        sys.exit(1)

    # Run pyannote diarization on CUDA
    try:
        audio_input = {"waveform": waveform, "sample_rate": sample_rate}
        kwargs = {}
        if num_speakers is not None:
            kwargs["num_speakers"] = num_speakers
        diarization = pipeline(audio_input, **kwargs)
    except Exception as e:
        print(json.dumps({"type": "error", "message": f"Diarization failed: {e}"}), flush=True)
        sys.exit(1)

    # Collect speaker segments
    annotation = getattr(diarization, 'speaker_diarization', diarization)
    segments = [
        (turn.start, turn.end, speaker)
        for turn, _, speaker in annotation.itertracks(yield_label=True)
    ]

    # Assign speakers to words using max-overlap algorithm
    for word in words:
        overlap_by_speaker = {}
        for seg_start, seg_end, speaker in segments:
            overlap = min(word["end"], seg_end) - max(word["start"], seg_start)
            if overlap > 0:
                overlap_by_speaker[speaker] = overlap_by_speaker.get(speaker, 0) + overlap
        if overlap_by_speaker:
            word["speaker"] = max(overlap_by_speaker, key=overlap_by_speaker.get)
        else:
            word["speaker"] = None

    # Write enriched transcript back
    with open(transcript_path, "w") as f:
        json.dump(transcript, f, indent=2)

    speaker_count = len({w["speaker"] for w in words if w.get("speaker")})

    print(json.dumps({"type": "done", "percent": 100, "speaker_count": speaker_count}), flush=True)


if __name__ == "__main__":
    main()
