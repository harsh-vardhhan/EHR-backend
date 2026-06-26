import 'dotenv/config';
import { DocumentEntity, AnnotationEntity } from '../database/entities';

async function verifyCloudIngestion() {
  console.log('🔍 Starting Cloud Ingestion Verification...');
  console.log('⏳ Polling DynamoDB to check the processing progress of the 10 documents...');

  const expectedDocs = [
    'doc-001', 'doc-002', 'doc-003', 'doc-004', 'doc-005',
    'doc-006', 'doc-007', 'doc-008', 'doc-009', 'doc-010'
  ];

  const maxAttempts = 18; // 3 minutes total polling time
  let attempt = 0;

  while (attempt < maxAttempts) {
    attempt++;
    console.log(`\nChecking database (Attempt ${attempt}/${maxAttempts})...`);

    let processedCount = 0;
    const details: { docId: string; status: string; annotationsCount: number }[] = [];

    // Query Document and Annotation records concurrently for all 10 documents
    await Promise.all(
      expectedDocs.map(async (docId) => {
        try {
          const [docRes, annotationsRes] = await Promise.all([
            DocumentEntity.get({ id: docId }).go(),
            AnnotationEntity.query.primary({ documentId: docId }).go(),
          ]);

          const doc = docRes.data;
          const annotations = annotationsRes.data || [];

          if (doc) {
            processedCount++;
            details.push({
              docId,
              status: doc.status,
              annotationsCount: annotations.length,
            });
          } else {
            details.push({
              docId,
              status: 'not_ingested_yet',
              annotationsCount: 0,
            });
          }
        } catch (err: any) {
          details.push({
            docId,
            status: `error: ${err.message}`,
            annotationsCount: 0,
          });
        }
      })
    );

    // Sort details by docId
    details.sort((a, b) => a.docId.localeCompare(b.docId));

    console.log('------------------------------------------------------');
    for (const detail of details) {
      console.log(
        `📄 ${detail.docId}: Ingested Status = [${detail.status}], Annotations = [${detail.annotationsCount}]`
      );
    }
    console.log('------------------------------------------------------');

    const allProcessed = processedCount === 10 && details.every(d => d.annotationsCount > 0);
    if (allProcessed) {
      console.log('\n🎉 SUCCESS! All 10 documents have been fully ingested and annotated in the cloud!');
      return;
    }

    if (attempt < maxAttempts) {
      console.log('Waiting 10 seconds before next check...');
      await new Promise((resolve) => setTimeout(resolve, 10000));
    }
  }

  console.log('\n⚠️ TIMEOUT: Some documents were not fully processed in the cloud yet. Check CloudWatch logs for worker errors.');
}

verifyCloudIngestion().catch(console.error);
