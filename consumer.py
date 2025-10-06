import base64
import json
import os
import requests
from google.cloud import pubsub_v1
from concurrent.futures import TimeoutError
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# Where Hunyuan3D-2 is deployed.
HUNYUAN3D_URL = os.getenv("HUNYUAN3D_URL", "https://h3d-936021411109.europe-west4.run.app/generate")
PROJECT_ID = os.getenv("PROJECT_ID", "your-project-id")
SUBSCRIPTION_NAME = os.getenv("SUBSCRIPTION_NAME", "genai3d-work-topic-sub")  # Replace with your Pub/Sub subscription name
SUBSCRIPTION_PATH = f"projects/{PROJECT_ID}/subscriptions/{SUBSCRIPTION_NAME}"
MODELS_FOLDER = 'static/models'
os.makedirs(MODELS_FOLDER, exist_ok=True)

def process_message(message):
    """
    Processes a Pub/Sub message:
    1. Extracts the image path and job ID.
    2. Reads the image and base64 encodes it.
    3. Sends the encoded image to the GLB generation API.
    4. Saves the received GLB file to the models folder.
    """
    try:
        payload = json.loads(message.data.decode('utf-8'))
        image_path = payload.get("image")
        face_count = payload.get("face_count")
        job_id = payload.get("job_id")
        texture = payload.get("generate_texture")

        if not image_path or not job_id:
            logging.info(f"Error: Missing 'image' or 'job_id' in message payload: {payload}")
            message.nack()  # Acknowledge negatively (retry)
            return

        logging.info(f"Processing job: {job_id} with image: {image_path}")

        # Read and base64 encode the image
        try:
            with open(image_path, "rb") as image_file:
                encoded_string = base64.b64encode(image_file.read()).decode("utf-8")
        except FileNotFoundError:
            logging.info(f"Error: Image file not found at {image_path}")
            message.nack()
            return

        logging.info(f"Payload: {payload}")

        # Prepare the data for the GLB generation API
        data = {
            "image": encoded_string,
            "texture": texture,
            "face_count": int(face_count)
        }

        # Send the request to the GLB generation API
        try:
            response = requests.post(HUNYUAN3D_URL, headers={"Content-Type": "application/json"}, data=json.dumps(data), stream=True)
            response.raise_for_status()  # Raise an exception for bad status codes
        except requests.exceptions.RequestException as e:
            logging.info(f"Error communicating with the GLB generation API: {e}")
            message.nack()
            return

        # Save the GLB file
        output_path = os.path.join(MODELS_FOLDER, f"{job_id}.glb")
        try:
            with open(output_path, "wb") as outfile:
                for chunk in response.iter_content(chunk_size=8192):
                    outfile.write(chunk)
            logging.info(f"GLB file saved to: {output_path}")
            message.ack() # Acknowledge positively
        except Exception as e:
            logging.info(f"Error saving GLB file: {e}")
            message.nack()
            return


    except json.JSONDecodeError as e:
        logging.info(f"Error decoding JSON: {e}")
        message.nack() # Nack in case of JSON error
        return

    except Exception as e:
        logging.info(f"An unexpected error occurred: {e}")
        message.nack()
        return


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