import { DynamoDBStreamEvent } from 'aws-lambda';
import { FirehoseClient, PutRecordCommand } from '@aws-sdk/client-firehose';

const firehoseClient = new FirehoseClient({});


// Helper to clean dates to standard YYYY-MM-DD
function getLocalDateString(isoString?: string): string {
  if (!isoString) return new Date().toISOString().split('T')[0];
  try {
    return isoString.split('T')[0];
  } catch {
    return new Date().toISOString().split('T')[0];
  }
}

export const handler = async (event: DynamoDBStreamEvent): Promise<void> => {
  console.log('OMOP Pipeline consumer received event:', JSON.stringify(event, null, 2));

  const deliveryStreamName = process.env.OMOP_DELIVERY_STREAM_NAME;
  if (!deliveryStreamName) {
    console.error('OMOP_DELIVERY_STREAM_NAME environment variable is not configured.');
    return;
  }

  for (const record of event.Records) {
    // We only process new clinical annotations added to DynamoDB
    if (record.eventName !== 'INSERT') {
      continue;
    }

    const newImage = record.dynamodb?.NewImage;
    if (!newImage) {
      continue;
    }

    // Verify this is an annotation entity (ElectroDB database fields check)
    const entityType = newImage.__edb_e__?.S;
    if (entityType !== 'annotation') {
      continue;
    }

    const annotationId = newImage.annotationId?.S;
    const documentId = newImage.documentId?.S;
    const text = newImage.text?.S || '';
    const label = newImage.label?.S || '';
    const assertion = newImage.assertion?.S || 'positive';
    const conceptCode = newImage.conceptCode?.S || '';
    const createdAt = newImage.createdAt?.S;

    if (!annotationId || !documentId) {
      console.warn('Skipping annotation record due to missing annotationId or documentId');
      continue;
    }

    try {
      let mappedRecord: Record<string, any> | null = null;
      let targetTable = '';

      const baseDate = getLocalDateString(createdAt);

      // Map to standard OMOP CDM schemas based on the entity type label
      if (label === 'Clinical Condition' || label === 'Clinical Finding') {
        targetTable = 'condition_occurrence';
        mappedRecord = {
          condition_occurrence_id: annotationId,
          person_id: documentId, // In this demo, documentId maps to the patient context
          condition_concept_id: conceptCode || 0,
          condition_start_date: baseDate,
          condition_type_concept_id: 32817, // OMOP code representing EHR-extracted concept
          condition_source_value: text,
          assertion_status: assertion, // Contextual status (positive, negated, possible)
        };
      } else if (label === 'Medication Statement') {
        targetTable = 'drug_exposure';
        mappedRecord = {
          drug_exposure_id: annotationId,
          person_id: documentId,
          drug_concept_id: conceptCode || 0,
          drug_exposure_start_date: baseDate,
          drug_type_concept_id: 32817,
          drug_source_value: text,
        };
      } else if (label === 'Medical Procedure') {
        targetTable = 'procedure_occurrence';
        mappedRecord = {
          procedure_occurrence_id: annotationId,
          person_id: documentId,
          procedure_concept_id: conceptCode || 0,
          procedure_date: baseDate,
          procedure_type_concept_id: 32817,
          procedure_source_value: text,
        };
      }

      if (!mappedRecord) {
        console.log(`Annotation ${annotationId} has unsupported label "${label}". Skipping OMOP mapping.`);
        continue;
      }

      // Format record with a prefix prefix/table-name and trailing newline for NDJSON output in S3
      const payload = {
        table: targetTable,
        data: mappedRecord,
        timestamp: new Date().toISOString(),
      };

      console.log(`Streaming mapped ${targetTable} record to Firehose:`, JSON.stringify(payload));
      const recordData = JSON.stringify(payload) + '\n';

      const command = new PutRecordCommand({
        DeliveryStreamName: deliveryStreamName,
        Record: {
          Data: new TextEncoder().encode(recordData),
        },
      });

      await firehoseClient.send(command);
      console.log(`Successfully streamed ${annotationId} record to Kinesis Firehose.`);
    } catch (error) {
      console.error(`Failed to process DynamoDB Stream record to OMOP format:`, error, JSON.stringify(record));
    }
  }
};
