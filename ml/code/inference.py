import spacy
from gliner import GLiNER

def model_fn(model_dir):
    print("Loading GLiNER-ReLex from pretrained model...")
    # Knowledgator GLiNER-ReLex model
    model = GLiNER.from_pretrained("knowledgator/gliner-relex-large-v0.5")
    
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
    
    entities_res, relations_res = model.extracted_relations(
        text,
        labels=labels,
        relations=relations,
        threshold=0.3,
        entity_threshold=0.3
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
            "confidence": float(ent.get("confidence", 1.0)),
            "assertion": assertion
        })

    # Format relations response
    formatted_relations = []
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
