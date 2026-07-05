import spacy
from gliner import GLiNER


def model_fn(model_dir):
    print("Loading GLiNER-ReLex from pretrained model...")
    # Knowledgator GLiNER-ReLex model
    import os
    model_path = os.path.join(model_dir, "model")
    model = GLiNER.from_pretrained(model_path)
    
    print("Loading SpaCy and NegEx...")
    nlp = spacy.load("en_core_web_sm")
    nlp.add_pipe(
        "negex",
        config={
            "ent_types": [
                "Clinical Condition",
                "Medication Statement",
                "Clinical Finding",
                "Medical Procedure",
            ]
        },
    )
    
    return {"gliner": model, "spacy": nlp}

def predict_fn(data, model_dict):
    model = model_dict["gliner"]
    nlp = model_dict["spacy"]
    
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

    # Run negation and suspension check
    doc = nlp(text)
    negated_spans = set()
    possible_spans = set()
    
    for ent in doc.ents:
        if ent._.negex:
            negated_spans.add((ent.start_char, ent.end_char))
        # local suspicion heuristic
        context = text[max(0, ent.start_char - 30):ent.start_char].lower()
        if "history of" in context or "suspicion" in context or "rule out" in context:
            possible_spans.add((ent.start_char, ent.end_char))

    # Run GLiNER relation extraction
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

    # Format entities response
    formatted_entities = []
    for ent in entities_res:
        start = ent["start"]
        end = ent["end"]
        
        # Determine assertion
        assertion = "positive"
        if (start, end) in negated_spans:
            assertion = "negated"
        elif (start, end) in possible_spans:
            assertion = "possible"
            
        formatted_entities.append({
            "text": ent["text"],
            "label": ent["label"],
            "start": start,
            "end": end,
            "confidence": float(ent.get("score", ent.get("confidence", 1.0))),
            "assertion": assertion
        })

    # Format relations response
    formatted_relations = []
    if is_new_gliner and relations:
        for rel in relations_res:
            head = rel["head"]
            tail = rel["tail"]
            formatted_relations.append({
                "source_start": head["start"],
                "source_end": head["end"],
                "target_start": tail["start"],
                "target_end": tail["end"],
                "relation": rel["relation"],
                "confidence": float(rel.get("score", 1.0))
            })
    else:
        for rel in relations_res:
            head = rel[0] # (start, end, label)
            tail = rel[1] # (start, end, label)
            rel_name = rel[2]
            conf = float(rel[3]) if len(rel) > 3 else 1.0
            
            formatted_relations.append({
                "source_start": head[0],
                "source_end": head[1],
                "target_start": tail[0],
                "target_end": tail[1],
                "relation": rel_name,
                "confidence": conf
            })

    return {
        "entities": formatted_entities,
        "relations": formatted_relations
    }
