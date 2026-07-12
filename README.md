# EHR Annotation Platform - Cloud-Native Clinical NLP Backend

Enterprise-grade serverless backend for clinical document annotation, built with Hono and deployed on AWS.

[![Backend CI](https://github.com/harsh-vardhhan/EHR-backend/actions/workflows/ci.yml/badge.svg)](https://github.com/harsh-vardhhan/EHR-backend/actions/workflows/ci.yml)
[![Deploy Backend](https://github.com/harsh-vardhhan/EHR-backend/actions/workflows/deploy.yml/badge.svg)](https://github.com/harsh-vardhhan/EHR-backend/actions/workflows/deploy.yml)

**🚀 Live Demo:** [https://ehr-frontend-hazel.vercel.app/](https://ehr-frontend-hazel.vercel.app/)

### Key Capabilities
*   **Clinical Named Entity Recognition (NER):** Parse raw EHR notes to identify critical health variables.
*   **Medical Ontology Tagging:** Automated ICD-10, RxNorm, and SNOMED-CT dictionary code lookups.
*   **Clinical Assertion Parsing:** Distinguish positive, negated (ruled-out), and speculated medical claims.
*   **Stateless De-identification Sandbox:** HIPAA-aligned safe-harbor clinical preview engine.

## 🔗 Repository Links
*   🖥️ **Frontend React UI:** [EHR Annotation Client Dashboard Repository](https://github.com/harsh-vardhhan/EHR-frontend)
*   ⚙️ **Backend API Service:** [AWS Serverless Clinical NLP Backend Repository](https://github.com/harsh-vardhhan/EHR-backend)

## 🏥 Clinical NLP & Health-Tech Domain Design

This platform is engineered to mirror real-world EHR aggregation pipelines. It handles the parsing, validation, and structuring of raw clinical narratives into standardized, research-ready health datasets.

### 🧠 Machine Learning Models & Task Mapping

The clinical NLP workflow unifies extraction, assertion, and grounding tasks across multiple specialized deep learning models hosted inside the SageMaker container:

| Clinical NLP Task | Machine Learning Model | Key Responsibility | Execution Layer |
| :--- | :--- | :--- | :--- |
| **Entity Extraction (NER)** | [`Ihor/gliner-biomed-base-v1.0`](https://huggingface.co/Ihor/gliner-biomed-base-v1.0) | Extracts clinical entities (Conditions, Findings, Medications, Procedures) from raw notes. | SageMaker (PyTorch) |
| **Relation Extraction (RE)** | [`urchade/gliner_medium-v2.1`](https://huggingface.co/urchade/gliner_medium-v2.1) | Predicts relationships between extracted entities (e.g. `treatment_for`, `associated_with`). | SageMaker (PyTorch) |
| **Assertion Classification** | [`bvanaken/clinical-assertion-negation-bert`](https://huggingface.co/bvanaken/clinical-assertion-negation-bert) | Classifies entities contextually as *Positive*, *Negated* (ruled-out), or *Possible* (speculative). | SageMaker (PyTorch) |
| **Concept Resolution** | [`cambridgeltl/SapBERT-from-PubMedBERT-fulltext`](https://huggingface.co/cambridgeltl/SapBERT-from-PubMedBERT-fulltext) | Computes semantic token embeddings to rerank candidate lookups and map them to SNOMED/RxNorm codes. | SageMaker (PyTorch) |

```mermaid
graph TD
    Raw["Raw Clinical Note"] --> Step1["1. Entity Extraction (NER)<br/>gliner-biomed-base-v1.0"]
    
    Step1 -->|Extracted Entities| Step2["2. Relation Extraction (RE)<br/>gliner_medium-v2.1"]
    Step1 -->|Extracted Entities| Step3["3. Assertion Classification<br/>clinical-assertion-negation-bert"]
    Step1 -->|Extracted Entities| Step4["4. Concept Resolution<br/>SapBERT"]
    
    Step4 -->|Semantic Embeddings| OMOP["OMOPHub Vocabulary API"]
    
    Step2 -->|Relationships| Consolidate["Annotation JSON Structurer"]
    Step3 -->|Assertion Statuses| Consolidate
    OMOP -->|Ontology Codes: ICD-10/RxNorm/SNOMED| Consolidate
    
    Consolidate --> Final["Structured EHR Annotations"]

    classDef step fill:#ff9900,fill-opacity:0.1,stroke:#ff9900,stroke-width:2px;
    classDef ext fill:#6b7280,fill-opacity:0.1,stroke:#6b7280,stroke-width:2px;
    class Step1,Step2,Step3,Step4 step;
    class OMOP ext;
```

### 1. Clinical Entity Recognition (NER)
Raw clinical notes are unstructured. The platform parses these text streams and automatically extracts key clinical concepts, identifying medical entities such as conditions, findings, medications, and procedures.

### 2. Relation Extraction (RE)
Once clinical entities are identified, the system determines the semantic connections between them (e.g., mapping a clinical condition to its treatment, or associating a clinical finding with an anatomical location). This ensures the clinical context is fully preserved.

### 3. Clinical Assertion Status (Negation & Speculation)
In clinical NLP, identifying a disease term is only half the battle. We must determine its **assertion status** (contextual modifier) to prevent critical medical errors:
*   **Positive (Active):** Conditions the patient currently has (e.g., *"patient has asthma"*).
*   **Negated (Ruled Out):** Conditions explicitly denied (e.g., *"denies chest pain"*). Misclassifying a negated symptom as an active condition leads to incorrect diagnoses and billing errors.
*   **Possible (Hypothetical):** Speculative diagnoses under investigation (e.g., *"suspect bronchitis, rule out pneumonia"*), tracking diagnostic uncertainty.

### 4. Concept Resolution & Taxonomy Mapping
To eliminate model hallucinations and ensure accurate coding, the extracted terms are resolved in bulk against standard vocabularies using **OMOPHub** (https://omophub.com) by computing semantic token embeddings via SapBERT:
*   **Clinical Conditions** (e.g., *"Type 2 Diabetes"*): Mapped to **ICD-10-CM** (International Classification of Diseases, 10th Revision, Clinical Modification) codes, the gold standard for clinical classification and diagnostic billing.
*   **Medication Statements** (e.g., *"Metformin 500mg daily"*): Mapped to **RxNorm** Concept Unique Identifiers (CUIs), ensuring precise drug-name normalization and interaction safety checks.
*   **Clinical Findings & Symptoms** (e.g., *"Chest tightness"*): Mapped to **SNOMED-CT** (Systematized Nomenclature of Medicine—Clinical Terms) codes to ensure vocabulary consistency across clinical records.
*   **Medical Procedures** (e.g., *"Chest X-Ray"*): Mapped to **CPT** (Current Procedural Terminology) or **SNOMED-CT** codes for tracking operations and clinical interventions.

### HIPAA & Data Privacy Architecture
*   **Data Residency:** All clinical notes are isolated in an encrypted Amazon S3 bucket using KMS Customer Managed Keys (CMKs). DynamoDB stores strictly structured, de-identified annotation offsets and concept mappings.
*   **Stateless Inferences:** The public sandbox pipeline runs completely stateless, ensuring no patient-identifiable data is cached or written to persistent storage.

## 🏗 AWS Architecture

The backend follows a highly scalable, serverless architecture designed for clinical data residency and high availability.

```mermaid
graph TD
    %% Core Application Subgraph (Left Side)
    subgraph Core ["Clinical Ingestion & NLP Inferences"]
        User((Clinician)) -->|API Request with API Key| LambdaURL(AWS Lambda Function URL)
        LambdaURL -->|Hono Router & Auth Middleware| LambdaAPI[AWS Lambda - API]
        LambdaAPI -->|Read/Write| DynamoDB[(Amazon DynamoDB)]
        LambdaAPI -->|Read Scrubbed Notes| S3[(Amazon S3 - Medical Notes)]
        LambdaAPI -->|Manual Trigger| SQS([AWS SQS - Annotation Queue])

        S3 -->|Emit Event| EB([Amazon EventBridge - Bus])
        EB -->|Route Rule| SQS
        SQS -->|Trigger| LambdaWorker[AWS Lambda - NLP Worker]
        SQS -.->|Failures| DLQ([AWS SQS - Dead Letter Queue])
        
        LambdaWorker -->|1. Mask PII| Scrubber[PII Scrubber Service]
        Scrubber -.->|ML PII Detection| SageMaker
        LambdaWorker -->|2. Save Scrubbed Text| S3
        LambdaWorker -->|"3. Clinical Inference (Scrubbed)"| SageMaker["Amazon SageMaker - Serverless (PyTorch)"]
        SageMaker -->|4. Concept Grounding| OMOPHub{{OMOPHub - Vocabulary API}}
        LambdaWorker -->|5. Save Annotations| DynamoDB
    end

    %% Auditing Pipeline Subgraph (Middle)
    subgraph Auditing ["Compliance & Audit Trail (WORM)"]
        DynamoDBStream[DynamoDB Stream]
        LambdaConsumer[AWS Lambda - Stream Consumer]
        Firehose[Kinesis Data Firehose]
        S3Audit[(Amazon S3 - Audit WORM Bucket)]
        
        DynamoDB -->|Detect Writes| DynamoDBStream
        DynamoDBStream -->|Trigger| LambdaConsumer
        LambdaConsumer -->|Stream Log Event| Firehose
        Firehose -->|Compressed NDJSON Batch| S3Audit
    end

    %% DDoS/DoW Circuit Breaker Subgraph (Right Side)
    subgraph DDoS ["DDoS & DoW Circuit Breaker"]
        CWAlarm{CloudWatch Traffic Alarm}
        SNS[SNS Topic]
        LambdaKillSwitch[AWS Lambda - Kill Switch]
        
        CWAlarm -->|Trigger if >2000 req/1m| SNS
        SNS -->|Invoke| LambdaKillSwitch
    end

    %% Cross-Subgraph Connections
    LambdaAPI -.->|Invocations & Throttles| CWAlarm
    LambdaKillSwitch -->|Set Reserved Concurrency to 0| LambdaAPI

    %% Legend
    subgraph Legend ["AWS Service Legend"]
        direction LR
        L_Comp[Compute]
        L_Db[(Database)]
        L_Stor[(Storage)]
        L_Int[Integration]
        L_Mon[Monitoring]
    end

    %% Subgraph Styling
    style Core fill:#888888,fill-opacity:0.05,stroke:#D1D5DB,stroke-width:2px,stroke-dasharray: 5 5;
    style Auditing fill:#1D8102,fill-opacity:0.05,stroke:#D1D5DB,stroke-width:2px,stroke-dasharray: 5 5;
    style DDoS fill:#FF3333,fill-opacity:0.05,stroke:#FECACA,stroke-width:2px,stroke-dasharray: 5 5;

    %% AWS Styling Classes
    classDef compute fill:#FF9900,fill-opacity:0.15,stroke:#FF9900,stroke-width:2px;
    classDef database fill:#0073BB,fill-opacity:0.15,stroke:#0073BB,stroke-width:2px;
    classDef storage fill:#1D8102,fill-opacity:0.15,stroke:#1D8102,stroke-width:2px;
    classDef integration fill:#8B5CF6,fill-opacity:0.15,stroke:#8B5CF6,stroke-width:2px;
    classDef monitor fill:#C2185B,fill-opacity:0.15,stroke:#C2185B,stroke-width:2px;
    classDef userNode fill:#545F7A,fill-opacity:0.15,stroke:#545F7A,stroke-width:2px;
    classDef external fill:#6B7280,fill-opacity:0.15,stroke:#6B7280,stroke-width:2px;

    %% Apply Classes
    class LambdaURL,LambdaAPI,LambdaWorker,LambdaKillSwitch,LambdaConsumer,SageMaker compute;
    class DynamoDB,DynamoDBStream database;
    class S3,S3Audit storage;
    class SQS,DLQ,EB,SNS,Firehose integration;
    class CWAlarm monitor;
    class User userNode;
    class OMOPHub external;
    
    %% Apply Classes to Legend
    class L_Comp compute;
    class L_Db database;
    class L_Stor storage;
    class L_Int integration;
    class L_Mon monitor;
```

## 🏥 Compliance Business Workflow

This simplified sequence diagram tracks the lifecycle of a clinical note from raw ingestion through AI scrubbing, clinician verification, and immutable auditing:

```mermaid
sequenceDiagram
    actor Clinician as Clinician
    participant System as EHR Platform
    participant Shield as HIPAA PII Shield
    participant AI as Clinical AI
    participant Audit as Compliance Audit Trail

    %% 1. Ingestion & Sanitization
    Note over System, AI: 1. Ingestion & AI Extraction
    System->>Shield: Scan Note for PII (Names, DOB, SSN)
    Shield-->>System: Mask PII (e.g. John Doe -> [NAME____X])
    System->>AI: Send Sanitized Note for Annotation
    AI-->>System: Return Suggested Codes (ICD-10, RxNorm, SNOMED)

    %% 2. Review
    Note over Clinician, System: 2. Clinician Review
    Clinician->>System: Open Document Review Dashboard
    Clinician->>System: Approve or Correct AI suggestions

    %% 3. Immutable Log
    Note over System, Audit: 3. Operations Auditing
    System->>Audit: Record Ingestion, AI parsing, and Clinician approvals
    Note right of Audit: Event saved permanently and immutably
```

### Infrastructure Components

| Component | Role in Architecture |
| :--- | :--- |
| **AWS Lambda (API)** | Executes the Hono application, handling UI interactions and document metadata orchestration. |
| **AWS Lambda (NLP Worker)** | Dedicated asynchronous worker triggered by SQS to perform LLM clinical entity extraction. |
| **AWS Lambda (Kill Switch)** | Administrative helper triggered by SNS to throttle the API Lambda reserved concurrency to 0. |
| **AWS Lambda (Stream Consumer)** | Asynchronous event consumer triggered by DynamoDB Streams to filter and forward audit logs to Firehose. |
| **Amazon Kinesis Data Firehose** | Delivery stream buffering and compressing NDJSON audit events, writing them in GZIP format to S3. |
| **Amazon SQS & DLQ** | Decouples document ingestion from analysis, buffers surges, and quarantines failed tasks in a Dead Letter Queue. |
| **Amazon DynamoDB** | Managed NoSQL storage for ultra-low latency storage of clinical annotation metadata and document status. |
| **Amazon S3 (Medical Notes)** | Encrypted object storage for raw clinical document text, acting as the event source for the ingestion pipeline. |
| **Amazon S3 (Audit WORM Bucket)** | Secure compliance bucket protected by S3 Object Lock (Compliance Mode) storing immutable audit logs. |
| **Lambda Function URL** | Public HTTPS endpoint routing requests directly to the Hono backend. |
| **CloudWatch Alarm & SNS** | Monitors total request volume (Invocations + Throttles) in real-time, acting as the circuit breaker sensor. |
| **SageMaker Serverless (PyTorch)** | High-performance machine learning inference endpoint hosting the specialized clinical NLP deep learning models for extraction, relation prediction, assertion classification, and concept grounding. |

## 🗄️ DynamoDB Single-Table Design for Clinical Records

To maximize performance, cut database costs, and eliminate cross-table JOIN latency, this application uses a consolidated **Single-Table Design** layout (`EhrTable`) modeled with **ElectroDB**. ElectroDB provides type-safe schemas, validates attributes, and automatically formats keys and index queries without raw SDK query strings.

### Key Schema Layout

| PK (Partition Key) | SK (Sort Key) | Index Name | Entity Type | Attributes & Schema |
| :--- | :--- | :--- | :--- | :--- |
| `DOCUMENT#<id>` | `METADATA` | Primary | **Document** | `id`, `title`, `category`, `s3Key`, `status`, `createdAt` |
| `DOCUMENT#<documentId>` | `ANNOTATION#<annotationId>` | Primary | **Annotation** | `annotationId`, `documentId`, `text`, `label`, `startOffset`, `endOffset`, `createdAt`, `source`, `status`, `confidence`, `assertion`, `conceptCode` |
| `DOCUMENT#<documentId>` | `RELATIONSHIP#<relationshipId>` | Primary | **Relationship** | `relationshipId`, `documentId`, `sourceAnnotationId`, `targetAnnotationId`, `relationType`, `confidence`, `createdAt` |
| `DOCUMENT#<documentId>` | `AUDIT#<logId>` | Primary | **Audit Log** | `logId`, `documentId`, `actionType`, `description`, `createdAt` |
| `SK` (Inverted) | `PK` | `SKIndex` (GSI) | **Annotation / Document** | Mapped for inverted parent-key resolution. |
| `ASSERTION#<assertion>` | `LABEL#<label>` | `GSI1Index` (GSI) | **Annotation** | Secondary index optimized for clinical cohort filtering. |

### Query Optimizations

1. **Concurrent Single-Table Read (Document + Annotations):** 
   When opening a patient note, the backend executes concurrent reads (`GetItem` for Document metadata and `Query` for all related Annotations) in parallel using `Promise.all` over the single table. This utilizes ElectroDB entities for strict type safety while maintaining sub-millisecond single-table responses.
2. **Inverted Index (`SKIndex`):**
   To update or delete an annotation by its `annotationId` alone (without knowing the parent `documentId`), we query the Global Secondary Index (GSI) `SKIndex` (where `HashKey = SK` and `RangeKey = PK`) mapped in ElectroDB. This resolves the parent `PK` in milliseconds, allowing targeted, isolated edits on specific rows.
3. **Clinical Cohort Search Index (`GSI1Index`):**
   To query patient annotations by medical category, assertion status, and standard ICD-10/RxNorm concept codes without performing expensive table scans, the search API targets `GSI1Index` (`GSI1PK = HASH`, `GSI1SK = RANGE`). If a filter query omits the assertion status, the service executes parallelized index queries across all three assertion states in parallel using `Promise.all` and flattens the result, ensuring consistent sub-second search speeds.

## 🚀 CI/CD Pipeline

The project uses GitHub Actions for an automated, zero-downtime deployment workflow.

| Pipeline Stage | Processes | Actions & Best Practices | Trigger Event |
| :--- | :--- | :--- | :--- |
| **Continuous Integration (CI)** | • Linting<br>• Type Checking | Runs automated TypeScript linting and strict compilation checks. | All Pull Requests targeting `main` |
| **Continuous Deployment (CD)** | • Build & Bundle<br>• AWS SAM Deploy<br>• OIDC Authentication<br>• Env Variable Sync | Bundles files using `esbuild`, provisions CloudFormation stacks, signs in passwordlessly using OpenID Connect (OIDC), and syncs secrets. | Every commit/merge push to `main` |


## 🛡️ Denial of Wallet (DoW) & DDoS Protection

This backend incorporates a robust, multi-layered security architecture designed to prevent volumetric DDoS abuse and cloud-native **Denial of Wallet (DoW)** attacks, guaranteeing predictable operational billing.

| Defense Vector | Implementation & Controls | Purpose & Billing Safety Impact |
| :--- | :--- | :--- |
| **Auth Gatekeeper** | Valid `x-api-key` header verified in Hono middleware. | Rejects unauthenticated requests in ~2ms before executing database operations. |
| **Stateless Sandbox Guard** | Unauthenticated `POST /annotations/preview` endpoint with Zod validation. | Allows public portfolio sandbox testing. Capped to **3,000 characters** input limit and **8 seconds execution timeout** to protect LLM token budget. |
| **Zero-Routing Cost Gateway** | Direct Lambda Function URL (no API Gateway request fees). | Eliminates API Gateway per-request charges ($3.50/million), ensuring throttled requests cost exactly $0.00. |
| **Automated Circuit Breaker** | CloudWatch Alarm (>2000 req/1m) $\rightarrow$ SNS $\rightarrow$ Kill-Switch Lambda. | Automatically updates backend Lambda reserved concurrency to `0` on breach, dropping resource billing to absolute zero. |
| **Compute Scaling Caps** | `ReservedConcurrentExecutions` limits (**2** for API Lambda, **2** for SQS NLP Worker). | Caps the maximum number of concurrent running containers AWS can spin up under a flood. |
| **Asynchronous Decoupling** | SQS-backed queue hand-off (`EhrAnnotationQueue`) with `BatchSize: 5`. | Prevents container runtime crashes; processes spikes in document uploads sequentially rather than in parallel. |
| **Infinite Retry Defense** | SQS Dead Letter Queue (`EhrAnnotationDLQ`) with `maxReceiveCount: 3`. | Quarantines failing payloads (poison pills) to prevent endless execution retry loops. |
| **Partial Batch Isolation** | SQS batch response processing with `ReportBatchItemFailures`. | Prevents successfully processed records in a batch from being re-executed when a sibling record in the same batch fails, saving redundant LLM API costs. |
| **External API Timeouts** | SageMaker NLP call `AbortController` (capped at **30 seconds**). | Prevents hung external endpoints from keeping the worker Lambda running up to its 30-second cap, while allowing ample time for large-document entity extractions. |
| **Database Cost Ceiling** | DynamoDB configured with on-demand capacity (`PAY_PER_REQUEST`). Active costs are only incurred per request (pennies for a Reddit spike) and drop to exactly $0.00 during dormancy. | Combined with the API Kill Switch, this acts as a hard budget boundary preventing runaway database scaling costs. |
| **Compute Efficiency** | Parallel database writes via `Promise.all` instead of sequential writes. | Grouped DB actions run concurrently, reducing billable Lambda active execution time by over 80%. |
| **S3 Read-Only Worker** | SQS Lambda worker has read-only S3 permissions (`S3ReadPolicy`) and never writes back to S3. | There is zero risk of an infinite S3 write-event loop. |
| **Agentic Role Scoping** | Dev policy (`developer-policy.json`) restricts agent actions to data-plane only (S3/DynamoDB item actions) and read-only infra visibility. | Prevents AI agent hallucinations or runaway CLI scripts from deleting infrastructure or provisioning expensive, untracked resources. |

> [!TIP]
> **Manual Recovery after Circuit Breaker Activation:**
> To bring the system back online after a kill-switch trigger, reset the backend Lambda's reserved concurrency back to your desired capacity (e.g., `20` or delete the limit) via the AWS Console, AWS SDK/CLI, or by redeploying the SAM template.

## 🛠 Local Development

### Prerequisites
- Node.js 20+
- AWS CLI (configured via AWS IAM Identity Center/SSO profile e.g., `ehr-dev`)
- SAM CLI (optional, for local Lambda emulation)

### Setup
1. Clone the repository and install dependencies:
```bash
$ npm install
```

2. Create a `.env` file in the root of the `backend` directory containing your API keys and configuration parameters:
```env
EHR_TABLE_NAME=ehr-table
DOCUMENTS_BUCKET_NAME=your_s3_bucket_name
AWS_REGION=your_aws_region
OMOPHUB_API_KEY=your_omophub_api_key
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
- `npm run cleanup`: Wipes all DynamoDB table items and S3 objects to reset the environment.
- `npm run seed`: Seeds the S3 bucket with sample document notes.

---
*Built for the Modern Clinical Workflow.*
