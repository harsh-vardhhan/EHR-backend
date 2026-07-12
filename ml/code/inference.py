import os
import re

import torch
from assertion import classify_assertion_status
from gliner import GLiNER
from relations import align_relations
from reranker import resolve_concepts
from transformers import AutoModel, AutoModelForSequenceClassification, AutoTokenizer


def model_fn(model_dir, context=None):
    print(f"model_dir path: {model_dir}")
    try:
        print("Contents of model_dir:", os.listdir(model_dir))
    except Exception as e:
        print(f"Failed to list model_dir: {e}")

    model_path = os.path.join(model_dir, "model")
    print(f"model_path path: {model_path}")
    try:
        print("Contents of model_path:", os.listdir(model_path))
    except Exception as e:
        print(f"Failed to list model_path: {e}")

    print("Loading GLiNER-ReLex from pretrained model...")
    model = GLiNER.from_pretrained(model_path)
    model.to(torch.bfloat16)

    print("Loading Biomedical GLiNER from pretrained model...")
    biomed_path = os.path.join(model_dir, "model", "biomed")
    if os.path.exists(biomed_path) and os.listdir(biomed_path):
        biomed_model = GLiNER.from_pretrained(biomed_path)
    else:
        print("Biomedical model not found locally. Loading from HF hub...")
        biomed_model = GLiNER.from_pretrained("Ihor/gliner-biomed-base-v1.0")
    biomed_model.to(torch.bfloat16)

    print("Loading ClinicalAssertionBERT...")
    assertion_path = os.path.join(model_dir, "model", "assertion")
    assertion_tokenizer = AutoTokenizer.from_pretrained(assertion_path)

    # Configure quantization engine backend dynamically based on CPU architecture
    if "fbgemm" in torch.backends.quantized.supported_engines:
        torch.backends.quantized.engine = "fbgemm"
        print("Using fbgemm engine for PyTorch dynamic quantization")
    elif "qnnpack" in torch.backends.quantized.supported_engines:
        torch.backends.quantized.engine = "qnnpack"
        print("Using qnnpack engine for PyTorch dynamic quantization")

    quantized_model_path = os.path.join(assertion_path, "quantized_assertion_model.pt")
    if os.path.exists(quantized_model_path):
        print(f"Loading pre-quantized model from: {quantized_model_path}...")
        assertion_model = torch.load(quantized_model_path, weights_only=False)
    else:
        print(
            "Pre-quantized model not found. "
            "Loading standard model and quantizing on-the-fly..."
        )
        if os.path.exists(assertion_path) and os.listdir(assertion_path):
            standard_model = AutoModelForSequenceClassification.from_pretrained(
                assertion_path
            )
        else:
            standard_model = AutoModelForSequenceClassification.from_pretrained(
                "bvanaken/clinical-assertion-negation-bert"
            )
        assertion_model = torch.quantization.quantize_dynamic(
            standard_model, {torch.nn.Linear}, dtype=torch.qint8
        )
        del standard_model
        import gc

        gc.collect()

    print("Loading SapBERT from pretrained model...")
    sapbert_path = os.path.join(model_dir, "model", "sapbert")
    sapbert_tokenizer = AutoTokenizer.from_pretrained(sapbert_path)
    sapbert_model = AutoModel.from_pretrained(sapbert_path)
    sapbert_model.eval()

    return {
        "gliner": model,
        "biomed_gliner": biomed_model,
        "assertion_tokenizer": assertion_tokenizer,
        "assertion_model": assertion_model,
        "sapbert_tokenizer": sapbert_tokenizer,
        "sapbert_model": sapbert_model,
    }


def predict_fn(data, model_dict):
    model = model_dict["gliner"]  # Generalist relation model
    biomed_model = model_dict["biomed_gliner"]  # Biomedical model
    assertion_tokenizer = model_dict["assertion_tokenizer"]
    assertion_model = model_dict["assertion_model"]

    # Check input data format
    if isinstance(data, dict) and "inputs" in data:
        text = data["inputs"]
    elif isinstance(data, dict) and "text" in data:
        text = data["text"]
    elif isinstance(data, str):
        text = data
    else:
        raise ValueError(
            "Invalid input format. Expected dict with 'inputs' or "
            "'text' key, or raw string."
        )

    # 1. Resolve configuration parameters
    labels = None
    relations = None
    entity_threshold = 0.5
    relation_threshold = 0.35

    if isinstance(data, dict):
        labels = data.get("labels")
        relations = data.get("relations")
        entity_threshold = data.get("entity_threshold", data.get("threshold", 0.5))
        relation_threshold = data.get("relation_threshold", 0.35)

    if labels is None:
        labels = [
            "Clinical Condition",
            "Medication Statement",
            "Clinical Finding",
            "Medical Procedure",
        ]
    if relations is None:
        relations = [
            "treatment_for",
            "contraindicated_with",
            "associated_with",
            "relates_to",
        ]

    # 2. Extract clean biomedical entities using biomed_model (NER)
    entities_res = biomed_model.predict_entities(
        text, labels=labels, threshold=entity_threshold
    )

    # 3. Extract raw relations using generalist model (RE)
    # We use a lower threshold of 0.3 to ensure we don't miss candidate relations
    raw_relations = []
    if relations:
        is_new_gliner = hasattr(model, "predict_relations")
        if is_new_gliner:
            _, raw_relations = model.predict_relations(
                text,
                labels=labels,
                relations=relations,
                threshold=0.3,
                relation_threshold=relation_threshold,
            )
        else:
            _, raw_relations = model.extracted_relations(
                text,
                labels=labels,
                relations=relations,
                threshold=0.3,
                entity_threshold=relation_threshold,
            )

    # 4. Split compound Medication Statements containing ' and '
    split_entities = []

    for ent in entities_res:
        ent_text = ent["text"]
        ent_label = ent["label"]
        ent_start = ent["start"]
        ent_score = ent.get("score", ent.get("confidence", 1.0))

        # Check if it's a medication statement with a coordinating conjunction ' and '
        if ent_label == "Medication Statement" and " and " in ent_text.lower():
            parts = re.split(r"\s+and\s+", ent_text, flags=re.IGNORECASE)

            sub_ents = []
            current_offset = 0
            for part in parts:
                part_stripped = part.strip()
                if not part_stripped:
                    continue
                # Find start index of this part in original text (case-insensitive)
                match = re.search(
                    re.escape(part_stripped),
                    ent_text[current_offset:],
                    re.IGNORECASE,
                )
                if not match:
                    continue

                part_start_in_ent = current_offset + match.start()
                part_start = ent_start + part_start_in_ent
                part_end = part_start + len(part_stripped)

                sub_ent = {
                    "text": part_stripped,
                    "label": "Medication Statement",
                    "start": part_start,
                    "end": part_end,
                    "score": ent_score,
                }
                sub_ents.append(sub_ent)
                current_offset = part_start_in_ent + len(part_stripped)

            if sub_ents:
                split_entities.extend(sub_ents)
            else:
                split_entities.append(ent)
        else:
            split_entities.append(ent)

    entities_res = split_entities

    # 5. Run ClinicalAssertionBERT on each extracted entity
    negated_spans, possible_spans = classify_assertion_status(
        text, entities_res, assertion_model, assertion_tokenizer
    )

    # 6. Format entities response and post-process negation prefix anomalies
    formatted_entities = []
    negation_prefixes = ["denies ", "no ", "without ", "negative for ", "ruled out "]

    for ent in entities_res:
        start = ent["start"]
        end = ent["end"]
        label = ent["label"]
        text_val = ent["text"]
        confidence = float(ent.get("score", ent.get("confidence", 1.0)))

        # Determine assertion
        assertion = "positive"
        if (start, end) in negated_spans:
            assertion = "negated"
        elif (start, end) in possible_spans:
            assertion = "possible"

        # Post-process entity text if it includes the negation prefix
        text_lower = text_val.lower()
        matched_prefix = None
        for prefix in negation_prefixes:
            if text_lower.startswith(prefix):
                matched_prefix = prefix
                break

        if matched_prefix:
            prefix_len = len(matched_prefix)
            new_text = text_val[prefix_len:].strip()
            actual_prefix_len = len(text_val) - len(new_text)

            text_val = new_text
            start = start + actual_prefix_len
            assertion = "negated"

            # Auto-correct clinical findings/conditions misclassified as
            # medications due to prefix
            if label == "Medication Statement":
                label = "Clinical Finding"

        formatted_entities.append(
            {
                "text": text_val,
                "label": label,
                "start": start,
                "end": end,
                "confidence": confidence,
                "assertion": assertion,
            }
        )

    # 6.5. Bulk Concept Resolution (OMOPHub + SapBERT Reranking)
    api_key = os.getenv("OMOPHUB_API_KEY")
    sapbert_model = model_dict.get("sapbert_model")
    sapbert_tokenizer = model_dict.get("sapbert_tokenizer")
    resolve_concepts(formatted_entities, sapbert_model, sapbert_tokenizer, api_key)

    # 7. Align relations to formatted_entities based on overlapping offsets
    formatted_relations = align_relations(raw_relations, formatted_entities)

    return {"entities": formatted_entities, "relations": formatted_relations}
