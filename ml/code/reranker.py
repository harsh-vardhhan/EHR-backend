import re

import requests
import torch


def get_vocabularies(label):
    if label == "Clinical Condition" or label == "Clinical Finding":
        return ["SNOMED", "ICD10CM"]
    elif label == "Medication Statement":
        return ["RxNorm"]
    elif label == "Medical Procedure":
        return ["SNOMED"]
    return ["SNOMED", "RxNorm", "ICD10CM"]


def get_domains(label):
    if label == "Clinical Condition" or label == "Clinical Finding":
        return ["Condition", "Observation"]
    elif label == "Medication Statement":
        return ["Drug"]
    elif label == "Medical Procedure":
        return ["Procedure"]
    return []


def normalize_text(text, label):
    cleaned = text.strip()

    acronym_map = {
        "copd": "chronic obstructive pulmonary disease",
        "cad": "coronary artery disease",
        "ckd": "chronic kidney disease",
        "mdd": "major depressive disorder",
        "gad": "generalized anxiety disorder",
        "gerd": "gastroesophageal reflux disease",
        "cabg": "coronary artery bypass graft",
        "uti": "urinary tract infection",
    }

    # Replace parenthetical acronyms,
    # e.g. "Generalized Anxiety Disorder (GAD)" -> "Generalized Anxiety Disorder"
    cleaned = re.sub(
        r"\s*\(\s*(copd|cad|ckd|mdd|gad|gerd|cabg|uti)\s*\)",
        "",
        cleaned,
        flags=re.IGNORECASE,
    )

    if cleaned.lower() in acronym_map:
        cleaned = acronym_map[cleaned.lower()]

    if label == "Medication Statement":
        # Strip action verbs at start
        cleaned = re.sub(
            r"^(initiate|continue|prescribe|add|start|take|give|administer|discharge\s+on)\s+",
            "",
            cleaned,
            flags=re.IGNORECASE,
        )
        # Strip dosage quantities
        cleaned = re.sub(
            r"\b\d+(\.\d+)?\s*(mg|mcg|g|ml|tab|tablet|unit|units|capsule|cap|puff|puffs)\b",
            "",
            cleaned,
            flags=re.IGNORECASE,
        )
        # Strip frequencies / durations
        cleaned = re.sub(
            r"\b(daily|weekly|nightly|at\s+bedtime|twice\s+daily|"
            r"three\s+times\s+daily|bid|tid|qhs|prn|for\s+\d+\s+"
            r"(days|weeks|months|days course))\b",
            "",
            cleaned,
            flags=re.IGNORECASE,
        )
        # Strip conjunction fragments
        cleaned = re.sub(
            r"\b(and|or|for|of|course|daily)\b", "", cleaned, flags=re.IGNORECASE
        )
        cleaned = re.sub(r"\s+", " ", cleaned).strip()
    elif label in ["Clinical Condition", "Clinical Finding"]:
        # Strip descriptors / qualifiers
        cleaned = re.sub(
            r"^(severe|moderate|mild|acute|chronic|intermittent|exertional|suspected|possible|worsening|history\s+of|history\s+post-)\s+",
            "",
            cleaned,
            flags=re.IGNORECASE,
        )
        # Strip observations
        cleaned = re.sub(
            r"\b(headaches|noted|reported|present|history)\b",
            "",
            cleaned,
            flags=re.IGNORECASE,
        )
        cleaned = re.sub(r"\s+", " ", cleaned).strip()

    # Strip trailing punctuation
    cleaned = re.sub(r"[.,;:]+$", "", cleaned).strip()
    return cleaned if cleaned else text


def get_sapbert_embedding(text, model, tokenizer):
    inputs = tokenizer(text, return_tensors="pt", padding=True, truncation=True)
    # Move tensors to the same device as model
    device = next(model.parameters()).device
    inputs = {k: v.to(device) for k, v in inputs.items()}
    with torch.no_grad():
        outputs = model(**inputs)
    # [CLS] token embedding (index 0)
    return outputs.last_hidden_state[0, 0, :]


def resolve_concepts(formatted_entities, sapbert_model, sapbert_tokenizer, api_key):
    # Initialize concept_code for all entities
    for ent in formatted_entities:
        ent["concept_code"] = ""

    if not api_key or not sapbert_model or not sapbert_tokenizer:
        print(
            "[inference] Skipped concept resolution (OMOPHUB_API_KEY "
            "or SapBERT models missing from dictionary)"
        )
        return

    searches = []
    for idx, ent in enumerate(formatted_entities):
        searches.append(
            {
                "search_id": f"s_{idx}",
                "query": normalize_text(ent["text"], ent["label"]),
                "vocabulary_ids": get_vocabularies(ent["label"]),
                "domain_ids": get_domains(ent["label"]),
                "page_size": 5,
            }
        )

    payload = {"defaults": {"standard_concept": "S"}, "searches": searches}

    try:
        print(
            f"[inference] Querying OMOPHub API for "
            f"{len(formatted_entities)} entities..."
        )
        response = requests.post(
            "https://api.omophub.com/v1/search/bulk",
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {api_key}",
            },
            json=payload,
            timeout=5.0,  # Safe timeout
        )
        response.raise_for_status()
        res_data = response.json()

        if res_data.get("success") and isinstance(res_data.get("data"), list):
            for item in res_data["data"]:
                search_id = item.get("search_id")
                if not search_id:
                    continue
                idx = int(search_id.split("_")[1])

                candidates = item.get("results", [])
                if not candidates or idx >= len(formatted_entities):
                    continue

                # Retrieve query embedding
                query_text = formatted_entities[idx]["text"]
                query_emb = get_sapbert_embedding(
                    query_text, sapbert_model, sapbert_tokenizer
                )

                best_candidate = None
                best_score = -1.0

                for cand in candidates:
                    cand_name = cand.get("concept_name", "")
                    cand_emb = get_sapbert_embedding(
                        cand_name, sapbert_model, sapbert_tokenizer
                    )

                    # Cosine similarity
                    sim = torch.cosine_similarity(
                        query_emb.unsqueeze(0), cand_emb.unsqueeze(0)
                    ).item()
                    if sim > best_score:
                        best_score = sim
                        best_candidate = cand

                if best_candidate:
                    concept_code = best_candidate.get("concept_code", "")
                    formatted_entities[idx]["concept_code"] = concept_code
                    print(
                        f"[inference] Resolved entity '{query_text}' -> "
                        f"'{best_candidate.get('concept_name')}' "
                        f"({concept_code}) with similarity {best_score:.3f}"
                    )

    except Exception as e:
        # Graceful degradation on network / DNS / key failures
        print(
            f"[inference] OMOPHub bulk query or SapBERT reranking failed "
            f"(graceful bypass): {e}"
        )
