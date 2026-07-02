import json
import os
import tarfile
import time

import boto3
from dotenv import load_dotenv

load_dotenv()

# Configuration
REGION = os.getenv("AWS_REGION", "ap-south-1")
BUCKET_NAME = os.getenv("DOCUMENTS_BUCKET_NAME", "ehr-demo-docs-bucket")
ENDPOINT_NAME = "gliner-relex-endpoint"
MODEL_NAME = "gliner-relex-model"
CONFIG_NAME = "gliner-relex-endpoint-config"

# Hugging Face CPU Inference DLC URI for ap-south-1
IMAGE_URI = (
    f"763104351884.dkr.ecr.{REGION}.amazonaws.com/"
    "huggingface-pytorch-inference:2.1.0-transformers4.37.0-cpu-py310"
    "-ubuntu22.04"
)

print("🚀 Starting SageMaker Serverless GLiNER-ReLex Deployment Script...")
print(f"📍 AWS Region: {REGION}")
print(f"🪣 Target S3 Bucket: {BUCKET_NAME}")

s3 = boto3.client("s3", region_name=REGION)
sagemaker = boto3.client("sagemaker", region_name=REGION)
iam = boto3.client("iam", region_name=REGION)

# 1. Package model code directory
tar_path = "model.tar.gz"
print("\n📦 Step 1: Packaging custom inference code...")
if os.path.exists(tar_path):
    os.remove(tar_path)

with tarfile.open(tar_path, "w:gz") as tar:
    tar.add("code", arcname="code")
print(f"✅ Created {tar_path} successfully.")

# 2. Upload model tarball to S3
s3_key = "models/gliner-relex/model.tar.gz"
print(f"\n📤 Step 2: Uploading {tar_path} to S3...")
s3.upload_file(tar_path, BUCKET_NAME, s3_key)
model_data_url = f"s3://{BUCKET_NAME}/{s3_key}"
print(f"✅ Uploaded to: {model_data_url}")
os.remove(tar_path)

# 3. Create or resolve SageMaker execution role
role_name = "EhrSageMakerExecutionRole"
role_arn = None
print(f"\n🔑 Step 3: Resolving IAM Execution Role '{role_name}'...")
try:
    res = iam.get_role(RoleName=role_name)
    role_arn = res["Role"]["Arn"]
    print(f"✅ Found existing role: {role_arn}")
except iam.exceptions.NoSuchEntityException:
    print(f"Creating new IAM execution role '{role_name}'...")
    assume_role_policy = {
        "Version": "2012-10-17",
        "Statement": [
            {
                "Effect": "Allow",
                "Principal": {"Service": "sagemaker.amazonaws.com"},
                "Action": "sts:AssumeRole"
            }
        ]
    }
    
    create_res = iam.create_role(
        RoleName=role_name,
        AssumeRolePolicyDocument=json.dumps(assume_role_policy),
        Description="Execution role for EHR SageMaker Serverless Inference"
    )
    role_arn = create_res["Role"]["Arn"]
    
    iam.attach_role_policy(
        RoleName=role_name,
        PolicyArn="arn:aws:iam::aws:policy/AmazonSageMakerFullAccess",
    )
    iam.attach_role_policy(
        RoleName=role_name,
        PolicyArn="arn:aws:iam::aws:policy/AmazonS3ReadOnlyAccess",
    )
    print(f"✅ Created role: {role_arn}")
    # Wait a brief moment for IAM replication
    time.sleep(10)

# 4. Create SageMaker Model
print("\n🤖 Step 4: Creating SageMaker Model resource...")
try:
    sagemaker.delete_model(ModelName=MODEL_NAME)
    print("Cleaned up existing model resource.")
except Exception:
    pass

sagemaker.create_model(
    ModelName=MODEL_NAME,
    PrimaryContainer={
        "Image": IMAGE_URI,
        "ModelDataUrl": model_data_url,
        "Environment": {
            "HF_MODEL_ID": "knowledgator/gliner-relex-large-v0.5",
            "SAGEMAKER_CONTAINER_LOG_LEVEL": "20",
            "SAGEMAKER_PROGRAM": "inference.py",
            "SAGEMAKER_SUBMIT_DIRECTORY": model_data_url
        }
    },
    ExecutionRoleArn=role_arn
)
print(f"✅ Created SageMaker Model: {MODEL_NAME}")

# 5. Create Endpoint Configuration (Serverless)
print("\n⚙️ Step 5: Creating SageMaker Endpoint Configuration (Serverless)...")
try:
    sagemaker.delete_endpoint_config(EndpointConfigName=CONFIG_NAME)
    print("Cleaned up existing config resource.")
except Exception:
    pass

sagemaker.create_endpoint_config(
    EndpointConfigName=CONFIG_NAME,
    ProductionVariants=[
        {
            "VariantName": "AllTraffic",
            "ModelName": MODEL_NAME,
            "ServerlessConfig": {
                "MemorySizeInMB": 3072,
                "MaxConcurrency": 5
            }
        }
    ]
)
print(f"✅ Created Endpoint Config: {CONFIG_NAME}")

# 6. Create Endpoint
print("\n🔌 Step 6: Creating SageMaker Serverless Endpoint...")
try:
    sagemaker.delete_endpoint(EndpointName=ENDPOINT_NAME)
    print("Cleaned up existing endpoint resource.")
except Exception:
    pass

sagemaker.create_endpoint(
    EndpointName=ENDPOINT_NAME,
    EndpointConfigName=CONFIG_NAME
)
print(f"✅ Requested SageMaker Endpoint creation: {ENDPOINT_NAME}")

# 7. Wait for deployment completion
print(
    "\n⏳ Step 7: Waiting for endpoint to deploy "
    "(this can take up to 2-3 minutes)..."
)
while True:
    status_res = sagemaker.describe_endpoint(EndpointName=ENDPOINT_NAME)
    status = status_res["EndpointStatus"]
    print(f"Current Endpoint Status: {status}...")
    
    if status == "InService":
        print(
            "\n🎉 SUCCESS! SageMaker Serverless Endpoint is now "
            "IN_SERVICE and ready for invocations!"
        )
        break
    elif status in ["Failed", "OutOfService"]:
        raise Exception(
            f"Endpoint creation failed with status: {status}. "
            "Check CloudWatch Logs."
        )
    
    time.sleep(15)
