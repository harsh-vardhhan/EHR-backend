import 'dotenv/config';
import { SageMakerRuntimeClient, InvokeEndpointCommand } from '@aws-sdk/client-sagemaker-runtime';

async function testSageMaker() {
  const client = new SageMakerRuntimeClient({ region: 'ap-south-1' });
  const text = "The patient was prescribed Aspirin for Hypertension.";
  const payload = { text };
  
  console.log("Sending text to SageMaker GLiNER-ReLex endpoint...");
  console.log(`Text: "${text}"`);
  
  try {
    const response = await client.send(
      new InvokeEndpointCommand({
        EndpointName: 'gliner-relex-endpoint',
        Body: Buffer.from(JSON.stringify(payload)),
        ContentType: 'application/json',
      })
    );
    
    const responseText = Buffer.from(response.Body as Uint8Array).toString('utf-8');
    console.log("\n🎉 SUCCESS! Response from SageMaker GLiNER-ReLex Endpoint:");
    console.log(JSON.stringify(JSON.parse(responseText), null, 2));
  } catch (error: any) {
    console.error("\n❌ SageMaker invocation failed:", error.message || error);
  }
}

testSageMaker();
