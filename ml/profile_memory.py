import gc
import json
import os
import resource
import sys

# Add code directory to path to load inference logic
sys.path.append(os.path.join(os.path.dirname(__file__), "code"))


def get_memory_usage_mb():
    maxrss_bytes = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
    # On macOS, ru_maxrss is in bytes; on Linux, it is in kilobytes.
    # Since OS is macOS (mac), ru_maxrss is in bytes.
    return maxrss_bytes / 1024 / 1024


def main():
    print("==========================================")
    print("Memory Profiling for Clinical Extraction")
    print("==========================================")
    print(f"1. Baseline memory usage: {get_memory_usage_mb():.2f} MB")

    # Import inference functions
    from inference import model_fn, predict_fn

    print(f"2. Memory after imports: {get_memory_usage_mb():.2f} MB")

    # Set model directory
    model_dir = os.path.dirname(__file__)

    # Load model
    print("\nLoading models via model_fn...")
    model_dict = model_fn(model_dir)
    print("Models loaded successfully!")
    print(f"3. Memory after model loading: {get_memory_usage_mb():.2f} MB")

    # Load sample notes
    notes_path = os.path.join(
        os.path.dirname(__file__), "..", "src", "scripts", "notes.json"
    )
    with open(notes_path) as f:
        notes = json.load(f)
    print(f"\nLoaded {len(notes)} clinical notes.")

    # Run inference on first 2 notes
    for i, note in enumerate(notes[:2]):
        print(f"\nRunning inference on Note {i + 1}: {note['title']}...")
        result = predict_fn(note["text"], model_dict)
        print(
            f"Entities found: {len(result['entities'])}, "
            f"Relations found: {len(result['relations'])}"
        )
        print(f"Memory after Note {i + 1} inference: {get_memory_usage_mb():.2f} MB")

    gc.collect()
    print(f"\n4. Memory after garbage collection: {get_memory_usage_mb():.2f} MB")
    print("==========================================")


if __name__ == "__main__":
    main()
