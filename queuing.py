import base64
import json
import threading
import requests
import logging
import traceback
import time
import uuid
import os
from google.cloud import pubsub_v1  # Import the Pub/Sub library

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

PROJECT_ID = os.getenv("PROJECT_ID", "your-project-id")  # Replace with your GCP project ID
TOPIC_NAME = os.getenv("TOPIC_NAME", "genai3d-work-topic")  # Replace with your Pub/Sub topic name

MODELS_FOLDER = 'static/models'
os.makedirs(MODELS_FOLDER, exist_ok=True)

publisher = pubsub_v1.PublisherClient()
topic_path = publisher.topic_path(PROJECT_ID, TOPIC_NAME)

def convert_to_3d_model(image_path, socket_app, generate_texture=False, face_count=5000):
    image_id = image_path.split('/')[-1]  # Extract the image filename from the path
    job_id = str(uuid.uuid4())

    try:        
        # Create the Pub/Sub message payload
        pubsub_message = {
            "image": image_path,
            "job_id": job_id,
            "generate_texture": generate_texture,
            "face_count": face_count
        }
        
        # Publish the message to Pub/Sub
        try:
            message_future = publisher.publish(topic_path, json.dumps(pubsub_message).encode("utf-8"))
            message_future.result()  # Block until the publish is successful
        except Exception as e:
          logging.error(f"Error publishing to Pub/Sub: {e}")
          return f"Error publishing to Pub/Sub: {e}", ""

        if job_id:
            logging.info(f"3D 3D Asset is being generated. Job ID: {job_id}")

            threading.Thread(target=poll_job_status, args=(job_id, image_path, socket_app)).start()

            return f'''3D Asset is being generated. Job ID: {job_id}.''',""
        
        else:
            return "Reply that we couldn't start the conversion of their avatar to 3D model. Please try again later.", ""
    
    except requests.exceptions.RequestException as e:
        logging.error(f"API request failed: {e}")
        return "Reply that we failed to convert your avatar to a 3D model. Please try again later.", ""
    except FileNotFoundError:
        logging.error(f"Image {image_id} not found")
        return "Reply that we couldn't find your avatar. Please create one first.", ""
    except Exception as e:
        logging.error(f"An unexpected error occurred: {e}")
        return "Reply that we failed to convert your avatar to a 3D model. Please try again later.", ""
        

def poll_job_status(job_id, image_id, socket_app):
    retries = 0
    logging.info(f"Polling job status for {job_id}")
    while True:
        if retries >= 60:  # Timeout after 5 minutes (60 * 5 seconds)
            logging.error(f"Job {job_id} timed out after 5 minutes.")
            socket_app.emit('model_update_error', {'status': 'error', 'error': 'Job timed out after 5 minutes.'})
            break

        try:

            """
            Checks if a job is finished by looking for a corresponding .glb file.
            """
            model_filename = f"{job_id}.glb"
            model_path = os.path.join(MODELS_FOLDER, model_filename)
            
            # Assuming your base URL is the address where this app is running, otherwise you will need to change this.
            
            if os.path.exists(model_path):
                logging.info(f"Job {job_id} finished for image {image_id}")

                notify_client(os.path.join("models/", model_filename), job_id, socket_app)
                break  # Exit the loop once the job is finished and the model is updated
            else:
                logging.info(f"Job {job_id} is queued, waiting 5 seconds to check again")

            time.sleep(5)  # Wait for 5 seconds before checking again

            retries += 1
        except requests.exceptions.RequestException as e:
            logging.error(f"Error checking job status for {job_id}: {e}")
            break


def notify_client(filename, job_id, socket_app):
    try:
        socket_app.emit('model_update_complete', {'model_path': filename, 'status': 'success'})
        logging.info(f"Sent WebSocket notification to user for job_id: {job_id}")

    except requests.exceptions.RequestException as e:
        socket_app.emit('model_update_error', {'status': 'error', 'error': e})
        logging.error(f"Error downloading model {filename} for job {job_id}: {e}")
    except FileNotFoundError as e:
        socket_app.emit('model_update_error', {'status': 'error', 'error': e})
        logging.error(f"Error saving model file locally for job {job_id}.")
    except Exception as e:
        socket_app.emit('model_update_error', {'status': 'error', 'error': e})
        logging.error(f"An unexpected error occurred during model download/update for job {job_id}: {e}")
        logging.error(traceback.format_exc())


