import torch


def classify_assertion_status(text, entities, assertion_model, assertion_tokenizer):
    negated_spans = set()
    possible_spans = set()

    for ent in entities:
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
            f"[entity] {sentence[offset + len(ent_text) :]}"
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
            label = str(assertion_model.config.id2label[predicted_class_id]).lower()

        if "absent" in label or predicted_class_id == 1:
            negated_spans.add((start, end))
        elif "possible" in label or predicted_class_id == 2:
            possible_spans.add((start, end))

        # Local suspicion heuristic (without "history of") as a backup
        context = text[max(0, start - 30) : start].lower()
        if "suspicion" in context or "rule out" in context or "suspect" in context:
            possible_spans.add((start, end))

    return negated_spans, possible_spans
