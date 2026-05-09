import { Injectable, NotFoundException } from '@nestjs/common';

const MOCK_NOTE = `Patient is a 67-year-old male presenting with chest pain and 
shortness of breath for the past 3 days. He has a known history 
of hypertension and type 2 diabetes mellitus. Current medications 
include lisinopril 10mg daily, metformin 500mg twice daily, and 
aspirin 81mg daily.

On examination, blood pressure was 158/94 mmHg and oxygen 
saturation was 94% on room air. Chest X-ray revealed pulmonary 
oedema consistent with acute decompensated heart failure.

Plan: Start furosemide 40mg intravenously, cardiology consult 
requested, repeat echocardiogram ordered.`;

@Injectable()
export class DocumentsService {
  private documents = [
    {
      id: 'doc-1',
      text: MOCK_NOTE,
    },
  ];

  getDocument(id: string) {
    const doc = this.documents.find((d) => d.id === id);
    if (!doc) {
      throw new NotFoundException(`Document with id ${id} not found`);
    }
    return doc;
  }
}
