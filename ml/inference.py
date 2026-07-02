from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List
import uvicorn
from gliner import GLiNER
import spacy
from negspacy.negation import Negspacy
from spacy.tokens import Span

app = FastAPI()

# Load models
print("Loading GLiNER-ReLex...")
model = GLiNER.from_pretrained("knowledgator/gliner-relex-large-v0.5")

print("Loading SpaCy and NegEx...")
nlp = spacy.load("en_core_web_sm")
nlp.add_pipe("negex", config={"ent_types": ["Clinical Condition", "Medication Statement", "Clinical Finding", "Medical Procedure"]})

class IngestRequest(BaseModel):
    text: str

class EntityResponse(BaseModel):
    text: str
    label: str
    start: int
    end: int
    confidence: float
    assertion: str # 'positive' | 'negated' | 'possible'

class RelationResponse(BaseModel):
    source_start: int
    source_end: int
    target_start: int
    target_end: int
    relation: str
    confidence: float

class IngestResponse(BaseModel):
    entities: List[EntityResponse]
    relations: List[RelationResponse]

@app.get("/ping")
async def ping():
    return {"status": "ok"}

@app.post("/invocations", response_model=IngestResponse)
async def invocations(req: IngestRequest):
    try:
        text = req.text
        if not text.strip():
            return IngestResponse(entities=[], relations=[])

        entity_labels = ["Clinical Condition", "Medication Statement", "Clinical Finding", "Medical Procedure"]
        relation_labels = ["treatment_for", "side_effect_of", "contraindicated_with"]

        # Run GLiNER-ReLex
        entities, relations = model.inference(
            texts=[text],
            labels=entity_labels,
            relations=relation_labels,
            threshold=0.3,
            relation_threshold=0.4,
            return_relations=True
        )

        extracted_entities = entities[0] if entities else []
        extracted_relations = relations[0] if relations else []

        # Determine Assertion Status (Negation / Possibility)
        doc = nlp(text)
        
        # Build Spacy Spans
        spacy_spans = []
        entity_assertion_map = {} # (start, end) -> assertion
        
        for ent in extracted_entities:
            # Try to build token span from char offsets
            span = doc.char_span(ent["start"], ent["end"], label=ent["label"])
            if span is not None:
                spacy_spans.append(span)
                
        # Set doc entities so negex runs on them
        doc.ents = spacy_spans
        
        # Build assertion lookup map
        for ent_span in doc.ents:
            start_char = ent_span.start_char
            end_char = ent_span.end_char
            
            # Check negation
            is_negated = getattr(ent_span._, "negex", False)
            
            # Simple possibility heuristic
            sentence_text = ent_span.sent.text.lower()
            is_possible = any(term in sentence_text for term in ["rule out", "r/o", "suspect", "possible", "eval for"])
            
            if is_negated:
                assertion = "negated"
            elif is_possible:
                assertion = "possible"
            else:
                assertion = "positive"
                
            entity_assertion_map[(start_char, end_char)] = assertion

        # Format Entities
        entities_res = []
        for ent in extracted_entities:
            key = (ent["start"], ent["end"])
            # Fallback checking for local negation context if Spacy alignment failed
            assertion = entity_assertion_map.get(key, "positive")
            if assertion == "positive":
                # Fallback simple string checks
                local_window = text[max(0, ent["start"] - 30):ent["start"]].lower()
                if any(neg in local_window for neg in ["no ", "not ", "denies", "denied", "negative for", "ruled out", "r/o"]):
                    assertion = "negated"
                elif any(poss in local_window for poss in ["suspect", "possible", "rule out", "maybe"]):
                    assertion = "possible"
                    
            entities_res.append(EntityResponse(
                text=ent["text"],
                label=ent["label"],
                start=ent["start"],
                end=ent["end"],
                confidence=float(ent["score"]),
                assertion=assertion
            ))

        # Format Relations
        relations_res = []
        for rel in extracted_relations:
            if len(rel) >= 4:
                head, tail, relation, score = rel[0], rel[1], rel[2], rel[3]
                relations_res.append(RelationResponse(
                    source_start=head[0],
                    source_end=head[1],
                    target_start=tail[0],
                    target_end=tail[1],
                    relation=relation,
                    confidence=float(score)
                ))

        return IngestResponse(entities=entities_res, relations=relations_res)
    except Exception as e:
        import traceback
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8080)
