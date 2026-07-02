import os
import json
import resource
import gc
from gliner import GLiNER

def get_memory_usage_mb():
    maxrss_bytes = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
    return maxrss_bytes / 1024 / 1024

def test_notes_onnx():
    print(f"1. Baseline memory usage: {get_memory_usage_mb():.2f} MB")
    
    notes_path = os.path.join(os.path.dirname(__file__), "..", "src", "scripts", "notes.json")
    print(f"Reading clinical notes from {notes_path}...")
    with open(notes_path, "r") as f:
        notes = json.load(f)
    print(f"Loaded {len(notes)} clinical notes.")
    
    local_dir = os.path.join(os.path.dirname(__file__), "model")
    # Ensure config.json exists
    import shutil
    gliner_cfg = os.path.join(local_dir, "gliner_config.json")
    cfg = os.path.join(local_dir, "config.json")
    if os.path.exists(gliner_cfg) and not os.path.exists(cfg):
        shutil.copy(gliner_cfg, cfg)

    print(f"\nLoading local ONNX model from {local_dir}...")
    model = GLiNER.from_pretrained(
        local_dir,
        load_onnx_model=True,
        load_tokenizer=True
    )
    print("Model loaded successfully!")
    print(f"2. After loading ONNX model: {get_memory_usage_mb():.2f} MB")
    
    labels = ["Clinical Condition", "Medication Statement", "Clinical Finding", "Medical Procedure"]
    relations = ["treatment_for", "contraindicated_with", "associated_with", "relates_to"]
    
    results = []
    # Run on first 2 notes
    for i, note in enumerate(notes[:2]):
        print(f"Extracting Note {i+1}: {note['title']}...")
        entities, rels = model.predict_relations(
            note["text"],
            labels=labels,
            relations=relations,
            threshold=0.3,
            relation_threshold=0.3
        )
        
        note_result = {
            "title": note["title"],
            "entities": [
                {
                    "text": ent["text"],
                    "label": ent["label"],
                    "score": round(float(ent["score"]), 3),
                    "start": ent["start"],
                    "end": ent["end"]
                }
                for ent in entities
            ],
            "relations": [
                {
                    "source": rel["head"]["text"],
                    "target": rel["tail"]["text"],
                    "relation": rel["relation"],
                    "score": round(float(rel["score"]), 3)
                }
                for rel in rels
            ]
        }
        results.append(note_result)
        
    print(f"3. After running inference: {get_memory_usage_mb():.2f} MB")
    gc.collect()
    print(f"4. After garbage collection: {get_memory_usage_mb():.2f} MB")
    
    print("\n--- JSON OUTPUT ---")
    print(json.dumps(results, indent=2))

if __name__ == "__main__":
    test_notes_onnx()
