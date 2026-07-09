import os
import re

import torch
from gliner import GLiNER
from transformers import AutoModelForSequenceClassification, AutoTokenizer


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
    
    print("Loading ClinicalAssertionBERT...")
    assertion_path = os.path.join(model_dir, "model", "assertion")
    assertion_tokenizer = AutoTokenizer.from_pretrained(assertion_path)
    
    # Configure quantization engine backend dynamically based on CPU architecture
    if 'fbgemm' in torch.backends.quantized.supported_engines:
        torch.backends.quantized.engine = 'fbgemm'
        print("Using fbgemm engine for PyTorch dynamic quantization")
    elif 'qnnpack' in torch.backends.quantized.supported_engines:
        torch.backends.quantized.engine = 'qnnpack'
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
            standard_model = (
                AutoModelForSequenceClassification.from_pretrained(
                    assertion_path
                )
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
        
    return {
        "gliner": model,
        "assertion_tokenizer": assertion_tokenizer,
        "assertion_model": assertion_model
    }


def predict_fn(data, model_dict):
    model = model_dict["gliner"]
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
    threshold = 0.3
    entity_threshold = 0.3
    
    if isinstance(data, dict):
        labels = data.get("labels")
        relations = data.get("relations")
        threshold = data.get("threshold", 0.3)
        entity_threshold = data.get("entity_threshold", 0.3)
        
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
        
    is_new_gliner = hasattr(model, "predict_relations")

    # 2. Run GLiNER relation extraction first
    if not relations:
        # Entity-only extraction (useful for PII scrubbing)
        entities_res = model.predict_entities(
            text,
            labels=labels,
            threshold=threshold
        )
        relations_res = []
    else:
        if is_new_gliner:
            entities_res, relations_res = model.predict_relations(
                text,
                labels=labels,
                relations=relations,
                threshold=threshold,
                relation_threshold=entity_threshold
            )
        else:
            entities_res, relations_res = model.extracted_relations(
                text,
                labels=labels,
                relations=relations,
                threshold=threshold,
                entity_threshold=entity_threshold
            )

    # 3. Split compound Medication Statements containing ' and '
    split_entities = []
    split_map = {} # maps (orig_start, orig_end) -> list of (new_start, new_end)
    
    for ent in entities_res:
        ent_text = ent["text"]
        ent_label = ent["label"]
        ent_start = ent["start"]
        ent_end = ent["end"]
        ent_score = ent.get("score", ent.get("confidence", 1.0))
        
        # Check if it's a medication statement with a coordinating conjunction ' and '
        if ent_label == "Medication Statement" and " and " in ent_text.lower():
            parts = re.split(r'\s+and\s+', ent_text, flags=re.IGNORECASE)
            
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
                    "score": ent_score
                }
                sub_ents.append(sub_ent)
                current_offset = part_start_in_ent + len(part_stripped)
            
            if sub_ents:
                split_entities.extend(sub_ents)
                split_map[(ent_start, ent_end)] = [
                    (s["start"], s["end"]) for s in sub_ents
                ]
            else:
                split_entities.append(ent)
        else:
            split_entities.append(ent)
            
    entities_res = split_entities

    # 4. Run ClinicalAssertionBERT on each extracted entity
    negated_spans = set()
    possible_spans = set()
    
    for ent in entities_res:
        start = ent["start"]
        end = ent["end"]
        ent_text = ent["text"]
        
        # Extract sentence context
        sent_start = start
        while sent_start > 0:
            char = text[sent_start - 1]
            is_boundary = char in [".", "!", "?"] and (
                sent_start == len(text) or text[sent_start].isspace()
            )
            if char == "\n" or is_boundary:
                break
            sent_start -= 1
            
        sent_end = end
        while sent_end < len(text):
            char = text[sent_end]
            is_boundary = char in [".", "!", "?"] and (
                sent_end + 1 == len(text) or text[sent_end + 1].isspace()
            )
            if char == "\n" or is_boundary:
                if char in [".", "!", "?"]:
                    sent_end += 1
                break
            sent_end += 1
            
        sentence = text[sent_start:sent_end]
        offset = start - sent_start
        
        # Construct input with [entity] tags
        formatted_input = (
            f"{sentence[:offset]} [entity] {ent_text} "
            f"[entity] {sentence[offset + len(ent_text):]}"
        )
        
        # Run inference
        inputs = assertion_tokenizer(formatted_input, return_tensors="pt")
        with torch.no_grad():
            outputs = assertion_model(**inputs)
            logits = outputs.logits
            predicted_class_id = logits.argmax().item()
            
        label = ""
        has_id2label = (
            hasattr(assertion_model.config, "id2label")
            and assertion_model.config.id2label
            and predicted_class_id in assertion_model.config.id2label
        )
        if has_id2label:
            label = str(
                assertion_model.config.id2label[predicted_class_id]
            ).lower()
            
        if "absent" in label or predicted_class_id == 1:
            negated_spans.add((start, end))
        elif "possible" in label or predicted_class_id == 2:
            possible_spans.add((start, end))
            
        # Local suspicion heuristic (without "history of") as a backup
        context = text[max(0, start - 30):start].lower()
        if "suspicion" in context or "rule out" in context or "suspect" in context:
            possible_spans.add((start, end))

    # 5. Format entities response and post-process negation prefix anomalies
    formatted_entities = []
    negation_prefixes = ["denies ", "no ", "without ", "negative for ", "ruled out "]
    strip_map = {} # maps (orig_start, orig_end) -> (final_start, final_end)
    
    for ent in entities_res:
        start = ent["start"]
        end = ent["end"]
        label = ent["label"]
        text_val = ent["text"]
        confidence = float(ent.get("score", ent.get("confidence", 1.0)))
        
        orig_start = start
        orig_end = end
        
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
                
        strip_map[(orig_start, orig_end)] = (start, end)
        
        formatted_entities.append({
            "text": text_val,
            "label": label,
            "start": start,
            "end": end,
            "confidence": confidence,
            "assertion": assertion
        })

    # 6. Format relations response and map relations of split/stripped entities
    formatted_relations = []
    
    for rel in relations_res:
        # Resolve head and tail objects based on GLiNER version format
        if isinstance(rel, dict):
            head = rel["head"]
            tail = rel["tail"]
            rel_type = rel["relation"]
            rel_score = float(rel.get("score", 1.0))
            h_start, h_end = head["start"], head["end"]
            t_start, t_end = tail["start"], tail["end"]
        else:
            head = rel[0]  # (start, end, label)
            tail = rel[1]  # (start, end, label)
            rel_type = rel[2]
            rel_score = float(rel[3]) if len(rel) > 3 else 1.0
            h_start, h_end = head[0], head[1]
            t_start, t_end = tail[0], tail[1]
            
        # Resolve split spans (if any)
        h_spans = split_map.get((h_start, h_end), [(h_start, h_end)])
        t_spans = split_map.get((t_start, t_end), [(t_start, t_end)])
        
        for h_s, h_e in h_spans:
            for t_s, t_e in t_spans:
                # Apply prefix strip offset adjustments
                h_final_s, h_final_e = strip_map.get((h_s, h_e), (h_s, h_e))
                t_final_s, t_final_e = strip_map.get((t_s, t_e), (t_s, t_e))
                
                formatted_relations.append({
                    "source_start": h_final_s,
                    "source_end": h_final_e,
                    "target_start": t_final_s,
                    "target_end": t_final_e,
                    "relation": rel_type,
                    "confidence": rel_score
                })

    return {
        "entities": formatted_entities,
        "relations": formatted_relations
    }
