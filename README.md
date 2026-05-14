# EHR Annotation Platform - Backend

Enterprise-grade serverless backend for clinical document annotation, built with NestJS and deployed on AWS.

## 🔗 Repository Links
- **Backend**: [https://github.com/harsh-vardhhan/EHR-backend](https://github.com/harsh-vardhhan/EHR-backend)
- **Frontend**: [https://github.com/harsh-vardhhan/EHR-frontend](https://github.com/harsh-vardhhan/EHR-frontend)

## 🏗 AWS Architecture

The backend follows a highly scalable, serverless architecture designed for clinical data residency and high availability.

```mermaid
graph TD
    User((Clinician)) -->|API Request| APIGateway[AWS API Gateway]
    APIGateway -->|Trigger| LambdaAPI[AWS Lambda - API]
    LambdaAPI -->|Read/Write| DynamoDB[(Amazon DynamoDB)]
    LambdaAPI -->|Upload| S3[(Amazon S3 - Medical Notes)]
    LambdaAPI -->|Manual Trigger| SQS[AWS SQS - Annotation Queue]

    S3 -->|Emit Event| EB[Amazon EventBridge - Bus]
    EB -->|Route Rule| SQS[AWS SQS - Annotation Queue]
    SQS -->|Trigger| LambdaWorker[AWS Lambda - NLP Worker]
    SQS -.->|Failures| DLQ[AWS SQS - Dead Letter Queue]
    
    LambdaWorker -->|Inference| Groq[Groq AI - LLM Inference]
    LambdaWorker -->|Save Annotations| DynamoDB
```

### Infrastructure Components:
- **AWS Lambda (API)**: Executes the NestJS application for UI interactions and document management.
- **AWS Lambda (NLP Worker)**: A dedicated asynchronous worker triggered by SQS for clinical entity extraction.
- **Amazon SQS & DLQ**: The "Shock Absorber" of the system. Handles buffering and retries for LLM inference, with a Dead Letter Queue for auditing failed processing jobs.
- **Amazon DynamoDB**: NoSQL database for ultra-low latency storage of annotation metadata and document status.
- **Amazon S3**: Secure, encrypted storage for raw clinical document text, serving as the event source for the ingestion pipeline.
- **Amazon API Gateway**: Managed entry point for the frontend, handling routing and CORS.
- **Groq AI Integration**: Powers the clinical entity recognition using high-performance LLM inference.

## 🚀 CI/CD Pipeline

The project uses GitHub Actions for an automated, zero-downtime deployment workflow.

### Continuous Integration (CI)
- **Linting**: Automated TypeScript linting ensures code quality.
- **Type Checking**: Strict TypeScript validation before every merge.
*Triggered on all Pull Requests to `main`.*

### Continuous Deployment (CD)
- **Build & Bundle**: Compiles NestJS and uses `esbuild` for an optimized Lambda package.
- **AWS SAM (Serverless Application Model)**: Manages infrastructure as code, deploying the CloudFormation stack automatically.
- **Automatic Environment Sync**: Injects AWS secrets and environment variables during the build process.
*Triggered on every push to `main`.*

## 🛠 Local Development

### Prerequisites
- Node.js 20+
- AWS CLI (configured for local testing)
- SAM CLI (optional, for local Lambda emulation)

### Setup
```bash
$ npm install
```

### Running Locally
```bash
# development
$ npm run start:dev
```

## 📜 Key Scripts
- `npm run build`: Compiles the application.
- `npm run bundle`: Creates a production-ready esbuild bundle for AWS Lambda.
- `npm run lint`: Runs the linter.
- `npm run test`: Executes unit tests.

---
*Built for the Modern Clinical Workflow.*
