def find_overlapping_entity(start, end, entities):
    best_overlap = 0
    best_ent = None
    for ent in entities:
        ent_start = ent["start"]
        ent_end = ent["end"]
        # Calculate overlap interval
        o_start = max(start, ent_start)
        o_end = min(end, ent_end)
        if o_start < o_end:
            overlap_len = o_end - o_start
            if overlap_len > best_overlap:
                best_overlap = overlap_len
                best_ent = ent
    return best_ent


def align_relations(raw_relations, formatted_entities):
    formatted_relations = []

    for rel in raw_relations:
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

        # Align head and tail to our clean formatted entities
        aligned_head = find_overlapping_entity(h_start, h_end, formatted_entities)
        aligned_tail = find_overlapping_entity(t_start, t_end, formatted_entities)

        if aligned_head and aligned_tail:
            # Prevent self-relations if offsets aligned to the same entity
            if (
                aligned_head["start"] == aligned_tail["start"]
                and aligned_head["end"] == aligned_tail["end"]
            ):
                continue

            formatted_relations.append(
                {
                    "source_start": aligned_head["start"],
                    "source_end": aligned_head["end"],
                    "target_start": aligned_tail["start"],
                    "target_end": aligned_tail["end"],
                    "relation": rel_type,
                    "confidence": rel_score,
                }
            )

    return formatted_relations
