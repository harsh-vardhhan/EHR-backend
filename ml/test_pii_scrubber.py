import json
import os

from gliner import GLiNER


def mask_string(matched_text, label):
    length = len(matched_text)
    if length <= len(label) + 2:
        return "X" * length
    prefix = f"[{label}"
    suffix = "]"
    padding_length = length - len(prefix) - len(suffix)
    return f"{prefix}{'X' * padding_length}{suffix}"


def test_ml_pii_scrubber():
    notes_path = os.path.join(
        os.path.dirname(__file__), "..", "src", "scripts", "notes.json"
    )
    print(f"Reading clinical notes from {notes_path}...")
    with open(notes_path) as f:
        notes = json.load(f)

    print("\nLoading PyTorch GLiNER model for PII entity extraction...")
    model = GLiNER.from_pretrained("knowledgator/gliner-relex-base-v1.0")
    print("Model loaded successfully!")

    # PII labels we want GLiNER to identify contextually
    pii_labels = [
        "Patient Name",
        "Doctor Name",
        "Phone Number",
        "Social Security Number",
        "Date of Birth",
        "Physical Address",
    ]

    # Mapping model labels to scrubber tags
    label_map = {
        "Patient Name": "NAME",
        "Doctor Name": "NAME",
        "Phone Number": "PHONE",
        "Social Security Number": "SSN",
        "Date of Birth": "DATE",
        "Physical Address": "EMAIL",  # using equivalent length label
    }

    # Test on the first note
    note = notes[0]
    print("\n==========================================")
    print(f"Testing ML PII Scrubbing on: {note['title']}")
    print("==========================================")

    raw_text = note["text"]
    print("Original Text (First 400 chars):")
    print(raw_text[:400])
    print("-" * 50)

    print("Running Zero-Shot NER for PII detection...")
    entities = model.predict_entities(raw_text, labels=pii_labels, threshold=0.4)

    print("\nDetected PII Entities:")
    for ent in entities:
        txt = ent["text"]
        lbl = ent["label"]
        scr = ent["score"]
        offsets = f"{ent['start']}-{ent['end']}"
        print(f"- '{txt}' -> {lbl} (score: {scr:.3f}, offsets: {offsets})")

    # Apply equal-length masking from right-to-left
    # This prevents character shift indexing bugs
    sorted_entities = sorted(entities, key=lambda x: x["start"], reverse=True)
    chars = list(raw_text)

    for ent in sorted_entities:
        start = ent["start"]
        end = ent["end"]
        raw_val = ent["text"]
        label = label_map.get(ent["label"], "PII")

        mask = mask_string(raw_val, label)
        chars[start:end] = list(mask)

    scrubbed_text = "".join(chars)

    print("\n" + "=" * 50)
    print("Scrubbed Text (First 400 chars):")
    print(scrubbed_text[:400])
    print("=" * 50)


if __name__ == "__main__":
    test_ml_pii_scrubber()
