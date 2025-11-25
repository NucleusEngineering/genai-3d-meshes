import base64
import json
import os
import requests
from google.cloud import pubsub_v1
from google.cloud import aiplatform
from concurrent.futures import TimeoutError
import logging
import time
from dotenv import load_dotenv
load_dotenv()

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# General env variables
HUNYUAN3D_URL = os.getenv("HUNYUAN3D_URL", "your-hunyuan3d-endpoint")
PROJECT_ID = os.getenv("PROJECT_ID", "your-project-id")
SUBSCRIPTION_NAME = os.getenv("SUBSCRIPTION_NAME", "your-subscription-name")

# Local config
SUBSCRIPTION_PATH = f"projects/{PROJECT_ID}/subscriptions/{SUBSCRIPTION_NAME}"
MODELS_FOLDER = 'static/models'
os.makedirs(MODELS_FOLDER, exist_ok=True)

def process_message(message):
    """
    Processes a Pub/Sub message:
    1. Extracts the image path and job ID.
    2. Reads the image and base64 encodes it.
    3. Sends the encoded image to the selected GLB generation API.
    4. Saves the received GLB file to the models folder.
    """
    try:
        payload = json.loads(message.data.decode('utf-8'))
        image_path = payload.get("image")
        face_count = payload.get("face_count")
        job_id = payload.get("job_id")
        texture = payload.get("generate_texture")
        model_type = payload.get("model_type", "h3d")
        enriched_prompt = payload.get("enriched_prompt")
        new_filename = payload.get("new_filename")

        if not image_path or not job_id:
            logging.error(f"Error: Missing 'image' or 'job_id' in message payload: {payload}")
            message.nack()
            return

        logging.info(f"Processing job: {job_id} with image: {image_path} using model: {model_type} and prompt: {enriched_prompt}")

        try:
            with open(image_path, "rb") as image_file:
                encoded_string = base64.b64encode(image_file.read()).decode("utf-8")
        except FileNotFoundError:
            logging.error(f"Error: Image file not found at {image_path}")
            message.nack()
            return

        output_path = os.path.join(MODELS_FOLDER, f"{new_filename}.glb")

        if model_type == "h3d":
            data = {
                "image": encoded_string,
                "texture": texture,
                "face_count": int(face_count) if face_count else 10000
            }

            try:
                response = requests.post(HUNYUAN3D_URL, headers={"Content-Type": "application/json"}, data=json.dumps(data), stream=True)
                response.raise_for_status()

                with open(output_path, "wb") as outfile:
                    for chunk in response.iter_content(chunk_size=8192):
                        outfile.write(chunk)
                logging.info(f"GLB file saved to: {output_path}")
                message.ack()

            except requests.exceptions.RequestException as e:
                logging.error(f"Error communicating with the H3D API: {e}")
                message.nack()
            except Exception as e:
                logging.error(f"Error saving GLB file from H3D: {e}")
                message.nack()
        else:
            logging.error(f"Invalid model_type specified: {model_type}. Must be 'h3d' (more to come).")
            message.nack()

    except json.JSONDecodeError as e:
        logging.error(f"Error decoding JSON: {e}")
        message.nack()
    except Exception as e:
        logging.error(f"An unexpected error occurred in process_message: {e}", exc_info=True)
        message.nack()


def callback(message):
    """
    Callback function to process each received message.
    """
    logging.info(f"Received message: {message.message_id}")
    process_message(message)


def consume_messages():
    """
    Consumes messages from the Pub/Sub subscription.
    """
    subscriber = pubsub_v1.SubscriberClient()

    streaming_pull_future = subscriber.subscribe(SUBSCRIPTION_PATH, callback=callback)
    logging.info(f"Listening for messages on {SUBSCRIPTION_PATH}...\n")

    # Wrap subscriber as a 'with' block to automatically call close() when done.
    with subscriber:
        try:
            # When `timeout` is not set, result() will block indefinitely,
            # unless an exception is encountered first.
            streaming_pull_future.result()
        except TimeoutError:
            streaming_pull_future.cancel()  # Trigger the shutdown.
            streaming_pull_future.result()  # Block until the shutdown is complete.
        except Exception as e:
            logging.info(f"Error receiving messages: {e}")
            streaming_pull_future.cancel()
            streaming_pull_future.result()


if __name__ == "__main__":
    consume_messages()
