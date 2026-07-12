import json
import os

import torch
from gliner import GLiNER
from transformers import AutoModel, AutoTokenizer

# Local registry of candidates representing what OMOPHub vocabulary
# searches would return
MOCK_CANDIDATE_REGISTRY = {
    "shortness of breath": [
        "Dyspnea",
        "Cough",
        "Chest tightness",
        "Wheezing",
        "Asthma",
    ],
    "worsening shortness of breath": [
        "Dyspnea",
        "Cough",
        "Chest tightness",
        "Asthma",
        "Shortness of breath",
    ],
    "prednisone 40mg daily": [
        "Prednisone",
        "Ibuprofen",
        "Aspirin",
        "Metformin",
        "Albuterol",
    ],
    "initiate a 5-day course of prednisone 40mg daily": [
        "Prednisone",
        "Ibuprofen",
        "Aspirin",
        "Metformin",
        "Albuterol",
    ],
    "severe copd": [
        "Chronic obstructive pulmonary disease",
        "Asthma",
        "Bronchitis",
        "Pneumonia",
        "Emphysema",
    ],
    "acute exacerbation of chronic obstructive pulmonary disease (copd)": [
        "Chronic obstructive pulmonary disease",
        "Asthma",
        "Bronchitis",
        "Pneumonia",
        "Emphysema",
    ],
    "reversible ischemia": [
        "Myocardial ischemia",
        "Angina",
        "Myocardial infarction",
        "Coronary artery disease",
        "Hypertension",
    ],
    "cad": [
        "Coronary artery disease",
        "Myocardial ischemia",
        "Angina",
        "Heart failure",
        "Hypertension",
    ],
    "comprehensive diabetic foot exam": [
        "Diabetic foot examination",
        "Urinalysis",
        "Blood glucose monitoring",
        "Podiatric procedure",
        "Physical exam",
    ],
    "intractable chronic migraine headaches with aura": [
        "Migraine with aura",
        "Tension headache",
        "Cluster headache",
        "Intracranial hypertension",
        "Sinusitis",
    ],
    "lifestyle changes": [
        "Able to modify behavior and lifestyle to support a change in circumstance",
        "Dietary education",
        "Exercise therapy",
        "Behavior modification",
        "Counseling",
    ],
    "syncope": ["Syncope", "Dizziness", "Vertigo", "Seizure", "Hypotension"],
    "denies syncope": ["Syncope", "Dizziness", "Vertigo", "Seizure", "Hypotension"],
    "urinalysis": [
        "Urinalysis",
        "Urinary tract infection",
        "Microalbuminuria",
        "Podiatry",
        "Urination",
    ],
    "diabetic peripheral neuropathy": [
        "Diabetic peripheral neuropathy",
        "Neuropathy",
        "Diabetes mellitus",
        "Foot exam",
        "Numbness",
    ],
    "chronic kidney disease": [
        "Chronic kidney disease",
        "Kidney failure",
        "Nephropathy",
        "Diabetes",
        "Hypertension",
    ],
    "diabetic nephropathy": [
        "Diabetic nephropathy",
        "Nephropathy",
        "Chronic kidney disease",
        "Diabetes",
        "Albuminuria",
    ],
    "nausea": ["Nausea", "Vomiting", "Dysphagia", "Gastritis", "Headache"],
    "dysuria": [
        "Dysuria",
        "Urinary tract infection",
        "Urinary frequency",
        "Hematuria",
        "Pyuria",
    ],
    "urinary frequency": [
        "Urinary frequency",
        "Dysuria",
        "Urinary tract infection",
        "Urination",
        "Pyuria",
    ],
    "chills": ["Chills", "Fever", "Urinary tract infection", "Shivering", "Nausea"],
    "hematuria": [
        "Hematuria",
        "Dysuria",
        "Urinary frequency",
        "Pyuria",
        "Urinary tract infection",
    ],
    "pyuria": [
        "Pyuria",
        "Dysuria",
        "Hematuria",
        "Urinary tract infection",
        "Urinary frequency",
    ],
    "acute urinary tract infection": [
        "Urinary tract infection",
        "Dysuria",
        "Urinary frequency",
        "Pyuria",
        "Fever",
    ],
    "gastroesophageal reflux disease": [
        "Gastroesophageal reflux disease",
        "Gastritis",
        "Esophagitis",
        "Dysphagia",
        "Nausea",
    ],
    "melena": [
        "Melena",
        "Gastrointestinal hemorrhage",
        "Hematemesis",
        "Anemia",
        "Gastritis",
    ],
    "unexplained weight loss": [
        "Weight loss",
        "Anorexia",
        "Cachexia",
        "Fatigue",
        "Dehydration",
    ],
    "esophagitis": [
        "Esophagitis",
        "Gastroesophageal reflux disease",
        "Gastritis",
        "Dysphagia",
        "Nausea",
    ],
    "dysphagia": [
        "Dysphagia",
        "Esophagitis",
        "Gastroesophageal reflux disease",
        "Nausea",
        "Vomiting",
    ],
    "esophagogastroduodenoscopy": [
        "Esophagogastroduodenoscopy",
        "Endoscopy",
        "Gastroscopy",
        "Biopsy",
        "Colonoscopy",
    ],
    "lumpectomy": [
        "Lumpectomy",
        "Mastectomy",
        "Breast biopsy",
        "Excision",
        "Breast cancer",
    ],
    "positive mcmurray test": [
        "Positive McMurray test",
        "Lachman test",
        "Meniscus tear",
        "Knee pain",
        "Ligament injury",
    ],
    "positive lachman test": [
        "Positive Lachman test",
        "McMurray test",
        "Cruciate ligament tear",
        "Knee instability",
        "Knee pain",
    ],
}

# General fallback vocabulary standard terms
GENERAL_VOCABULARY = [
    "Dyspnea",
    "Chronic obstructive pulmonary disease",
    "Coronary artery disease",
    "Prednisone",
    "Azithromycin",
    "Omeprazole",
    "Myocardial ischemia",
    "Diabetic foot examination",
    "Migraine with aura",
    "Syncope",
    "Urinalysis",
    "Diabetic peripheral neuropathy",
    "Chronic kidney disease",
    "Diabetic nephropathy",
    "Nausea",
    "Dysuria",
    "Urinary frequency",
    "Chills",
    "Hematuria",
    "Pyuria",
    "Urinary tract infection",
    "Gastroesophageal reflux disease",
    "Melena",
    "Esophagitis",
    "Dysphagia",
    "Esophagogastroduodenoscopy",
    "Lumpectomy",
    "Positive McMurray test",
    "Positive Lachman test",
    "Knee pain",
    "Meniscus tear",
    "Able to modify behavior and lifestyle to support a change in circumstance",
]


def main():
    print("🚀 Starting Offline SapBERT Concept Resolution Test...")

    # 1. Load Notes
    notes_path = os.path.join(
        os.path.dirname(__file__), "..", "src", "scripts", "notes.json"
    )
    with open(notes_path) as f:
        notes = json.load(f)
    print(f"📄 Loaded {len(notes)} clinical notes.")

    # 2. Load Models
    print("🤖 Loading GLiNER Biomedical Model...")
    biomed_path = os.path.join(os.path.dirname(__file__), "model", "biomed")
    gliner_model = GLiNER.from_pretrained(biomed_path)

    print("🧠 Loading SapBERT Semantic Model...")
    sapbert_path = os.path.join(os.path.dirname(__file__), "model", "sapbert")
    sapbert_tokenizer = AutoTokenizer.from_pretrained(sapbert_path)
    sapbert_model = AutoModel.from_pretrained(sapbert_path)
    sapbert_model.eval()

    # Define helper to compute embeddings
    def get_sapbert_embedding(text):
        inputs = sapbert_tokenizer(
            text, return_tensors="pt", padding=True, truncation=True
        )
        with torch.no_grad():
            outputs = sapbert_model(**inputs)
        # SapBERT uses [CLS] representation (index 0)
        return outputs.last_hidden_state[0, 0, :]

    # 3. Extract Entities from first 3 notes
    labels = [
        "Clinical Condition",
        "Medication Statement",
        "Clinical Finding",
        "Medical Procedure",
    ]
    extracted_entities = []

    print("\n🔍 Step 1: Extracting entities using GLiNER...")
    for idx, note in enumerate(notes[:3]):
        print(f"   Analyzing Note {idx + 1}: {note['title']}")
        entities = gliner_model.predict_entities(
            note["text"], labels=labels, threshold=0.5
        )
        for ent in entities:
            extracted_entities.append({"text": ent["text"], "label": ent["label"]})

    print(f"✅ Extracted {len(extracted_entities)} total entity mentions.")

    # 4. Remove exact duplicates
    unique_entities = []
    seen = set()
    for ent in extracted_entities:
        key = (ent["text"].lower(), ent["label"])
        if key not in seen:
            seen.add(key)
            unique_entities.append(ent)
    print(f"📊 Unique entities for lookup: {len(unique_entities)}")

    # 5. Apply SapBERT Semantic Matching
    print("\n🧠 Step 2: Re-ranking candidates using SapBERT...")

    results = []
    for ent in unique_entities:
        raw_text = ent["text"]
        normalized_key = raw_text.lower().strip()

        # Get candidates (either explicit mock candidates or standard fallback list)
        candidates = MOCK_CANDIDATE_REGISTRY.get(normalized_key, GENERAL_VOCABULARY)

        # Get query embedding
        query_emb = get_sapbert_embedding(raw_text)

        best_candidate = None
        best_score = -1.0

        for cand in candidates:
            cand_emb = get_sapbert_embedding(cand)

            # Compute cosine similarity
            sim = torch.cosine_similarity(
                query_emb.unsqueeze(0), cand_emb.unsqueeze(0)
            ).item()

            if sim > best_score:
                best_score = sim
                best_candidate = cand

        results.append(
            {
                "original": raw_text,
                "label": ent["label"],
                "selected": best_candidate,
                "score": best_score,
                "candidates_count": len(candidates),
            }
        )

    # 6. Print Results Table
    print("\n🎯 STEP 3: RESULTS OF Concept Resolution (SapBERT Reranking):")
    print("-" * 120)
    header = (
        f"{'Original Extracted Entity':<45} | {'Label':<20} | "
        f"{'SapBERT Best Semantic Candidate':<42} | {'Score':<6}"
    )
    print(header)
    print("-" * 120)

    resolved_count = 0
    for r in results:
        orig = r["original"]
        lbl = r["label"]
        cand_name = r["selected"] if r["selected"] else "N/A"
        score = f"{r['score']:.3f}"

        # We classify as high-confidence resolved if similarity score >= 0.70
        if r["score"] >= 0.70:
            resolved_count += 1

        orig_trunc = orig[:43] + "..." if len(orig) > 43 else orig
        lbl_trunc = lbl[:18]
        name_trunc = cand_name[:40] + "..." if len(cand_name) > 40 else cand_name

        print(f"{orig_trunc:<45} | {lbl_trunc:<20} | {name_trunc:<42} | {score:<6}")

    summary_text = (
        f"📊 SUMMARY: Total entities: {len(results)}, "
        f"High-Confidence Resolved (>=0.70): {resolved_count} "
        f"({resolved_count / len(results):.1%})"
    )
    print(summary_text)


if __name__ == "__main__":
    main()
