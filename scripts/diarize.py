#!/usr/bin/env python3
"""Run pyannote speaker diarization on a transcribed video, enriching transcript with per-word speaker labels."""
import sys
import json

def main():
    if len(sys.argv) < 3:
        print(json.dumps({"type": "error", "message": "Usage: diarize.py <audio_path> <transcript_path> [hf_token]"}), flush=True)
        sys.exit(1)

    audio_path = sys.argv[1]
    transcript_path = sys.argv[2]
    hf_token = sys.argv[3] if len(sys.argv) > 3 else None

    if not hf_token:
        print(json.dumps({
            "type": "error",
            "message": "HUGGINGFACE_TOKEN required — create a read token at https://huggingface.co/settings/tokens and accept the model license at https://huggingface.co/pyannote/speaker-diarization-3.1"
        }), flush=True)
        sys.exit(1)

    # Emit loading status — model download can take seconds on first run
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
            use_auth_token=hf_token,  # use_auth_token works in pyannote-audio 3.3.2
        )
        # NEVER use MPS — known accuracy regression with pyannote on Apple Silicon
        pipeline.to(torch.device("cpu"))
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

    # Run pyannote diarization
    try:
        diarization = pipeline(audio_path)
    except Exception as e:
        print(json.dumps({"type": "error", "message": f"Diarization failed: {e}"}), flush=True)
        sys.exit(1)

    # Collect speaker segments
    segments = [
        (turn.start, turn.end, speaker)
        for turn, _, speaker in diarization.itertracks(yield_label=True)
    ]

    # Assign speakers to words using max-overlap algorithm
    # (cumulative overlap per speaker — not first-match — handles overlapping segments correctly)
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

    # Write enriched transcript back in place — only words array is updated
    with open(transcript_path, "w") as f:
        json.dump(transcript, f, indent=2)

    # Count unique speakers assigned (exclude None)
    speaker_count = len({w["speaker"] for w in words if w.get("speaker")})

    print(json.dumps({"type": "done", "percent": 100, "speaker_count": speaker_count}), flush=True)


if __name__ == "__main__":
    main()
