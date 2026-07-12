import gc
import json
import os
import resource
import sys

# Add code directory to path to load inference logic
sys.path.append(os.path.join(os.path.dirname(__file__), "code"))
from inference import model_fn, predict_fn


def get_memory_usage_mb():
    maxrss_bytes = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
    return maxrss_bytes / 1024 / 1024


def test_notes_pytorch():
    print(f"1. Baseline memory usage: {get_memory_usage_mb():.2f} MB")

    notes_path = os.path.join(
        os.path.dirname(__file__), "..", "src", "scripts", "notes.json"
    )
    print(f"Reading clinical notes from {notes_path}...")
    with open(notes_path) as f:
        notes = json.load(f)
    print(f"Loaded {len(notes)} clinical notes.")

    model_dir = os.path.dirname(__file__)
    print("Loading hybrid models from:", model_dir)
    model_dict = model_fn(model_dir)
    print("Hybrid ML models loaded successfully!")
    print(f"2. After loading models: {get_memory_usage_mb():.2f} MB")

    labels = [
        "Clinical Condition",
        "Medication Statement",
        "Clinical Finding",
        "Medical Procedure",
    ]
    relations = [
        "treatment_for",
        "contraindicated_with",
        "associated_with",
        "relates_to",
    ]

    results = []
    # Run on first 2 notes
    for i, note in enumerate(notes[:2]):
        print(f"Extracting Note {i + 1}: {note['title']}...")
        result = predict_fn(
            {
                "text": note["text"],
                "labels": labels,
                "relations": relations,
                "entity_threshold": 0.50,
                "relation_threshold": 0.35,
            },
            model_dict,
        )

        note_result = {
            "title": note["title"],
            "entities": result["entities"],
            "relations": result["relations"],
        }
        results.append(note_result)

    print(f"3. After running inference: {get_memory_usage_mb():.2f} MB")
    gc.collect()
    print(f"4. After garbage collection: {get_memory_usage_mb():.2f} MB")

    print("\n--- JSON OUTPUT ---")
    print(json.dumps(results, indent=2))


if __name__ == "__main__":
    test_notes_pytorch()
