import json
import os
import sys
from http.server import BaseHTTPRequestHandler, HTTPServer

from dotenv import load_dotenv

# Load environmental variables
env_path = os.path.join(os.path.dirname(__file__), "..", ".env")
load_dotenv(dotenv_path=env_path)

# Add code directory to path to load inference logic
sys.path.append(os.path.join(os.path.dirname(__file__), "code"))
from inference import model_fn, predict_fn  # noqa: E402

# Set model directory
MODEL_DIR = os.path.dirname(__file__)

print("Loading local model from:", MODEL_DIR)
# Initialize the model using the same function as SageMaker
model_dict = model_fn(MODEL_DIR)
print("Local ML model loaded successfully!")


class SageMakerMockHandler(BaseHTTPRequestHandler):
    def do_POST(self):
        if self.path in ["/invocations", "/"]:
            content_length = int(self.headers["Content-Length"])
            post_data = self.rfile.read(content_length)

            try:
                data = json.loads(post_data.decode("utf-8"))
                print("Received inference request, processing...")

                # Execute inference using SageMaker's prediction function
                result = predict_fn(data, model_dict)

                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.end_headers()

                self.wfile.write(json.dumps(result).encode("utf-8"))
                print("Inference completed successfully.")
            except Exception as e:
                self.send_response(500)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                error_response = {"error": str(e)}
                self.wfile.write(json.dumps(error_response).encode("utf-8"))
                print("Error processing request:", e)
        else:
            self.send_response(404)
            self.end_headers()


def run(port=5000):
    server_address = ("", port)
    httpd = HTTPServer(server_address, SageMakerMockHandler)
    print(f"Starting local ML inference server on port {port}...")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down server.")
        httpd.server_close()


if __name__ == "__main__":
    run()
