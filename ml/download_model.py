import os

from huggingface_hub import snapshot_download


def download():
    print("Downloading knowledgator/gliner-relex-base-v1.0 model weights...")
    local_dir = os.path.join(os.path.dirname(__file__), "model")
    snapshot_download(
        repo_id="knowledgator/gliner-relex-base-v1.0",
        local_dir=local_dir,
        ignore_patterns=["*.msgpack", "*.h5", "*.ot"]
    )
    print(f"Model weights downloaded successfully to {local_dir}")

    print("Downloading Ihor/gliner-biomed-base-v1.0 model weights...")
    biomed_dir = os.path.join(os.path.dirname(__file__), "model", "biomed")
    snapshot_download(
        repo_id="Ihor/gliner-biomed-base-v1.0",
        local_dir=biomed_dir,
        ignore_patterns=["*.msgpack", "*.h5", "*.ot"]
    )
    print(f"Biomedical model weights downloaded successfully to {biomed_dir}")

    print("Downloading bvanaken/clinical-assertion-negation-bert model weights...")
    assertion_dir = os.path.join(os.path.dirname(__file__), "model", "assertion")
    snapshot_download(
        repo_id="bvanaken/clinical-assertion-negation-bert",
        local_dir=assertion_dir
    )
    print(f"Assertion model weights downloaded successfully to {assertion_dir}")

if __name__ == "__main__":
    download()
