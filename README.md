# GenAI 3D Asset Generation Demo

This project demonstrates a pipeline for generating 3D assets using generative AI. It consists of three main components: a frontend application, a worker pool for processing, and a 3D model generation service.

## Architecture Overview

The architecture is composed of three main services:

1.  **Frontend Application**: A web interface for users to submit requests for 3D asset generation.
2.  **Worker Pool**: A scalable pool of workers that queue and manage asset generation tasks.
3.  **Hunyuan3D Service**: A GPU-accelerated service that generates the 3D models.

These components communicate with each other and utilize shared storage for assets and models.

## Components

### 1. Hunyuan3D Service

This service is responsible for the core 3D model generation.

-   **Source Directory**: `hunyuan3D/`
-   **Dockerfile**: `hunyuan3D/Dockerfile` (based on an NVIDIA image)
-   **Deployment**: Cloud Run with GPUs

### 2. Frontend Application

The user-facing web application.

-   **Dockerfile**: `Dockerfile-frontend`
-   **Deployment**: Cloud Run

### 3. Worker Pool

This service manages the queue of generation tasks submitted by the frontend.

-   **Dockerfile**: `Dockerfile-worker`
-   **Deployment**: Cloud Run

## Setup and Deployment

### MUST HAVE

- NFS mounted storage should point to /root and already contain all the models from hugging face, in particular:
```
    -- 7.9G    .cache/huggingface/hub/models--tencent--Hunyuan3D-2mini
    -- 18G     .cache/huggingface/hub/models--tencent--Hunyuan3D-2
```


### Prerequisites

-   Google Cloud Project with billing enabled.
-   `gcloud` CLI installed and authenticated.
-   Docker installed. (for local builds, so it's optional)
-   A shared NFS folder (e.g., Filestore) for the Hunyuan3D service as well as shared models and image assets

### Environment Variables

It is crucial to configure the environment variables correctly. The most important one is passing the URL of the deployed **Hunyuan3D service** to the **Worker Pool** application.

-   `HUNYUAN3D_URL`: The endpoint of the Hunyuan3D service. This needs to be set for the worker service. (don't forget the /generate path)
-   `VERTEX_REGION`: In which region you want to invoke vertex services such as imagen
-   `PROJECT_ID`: Your Google Cloud project ID.
-   `TOPIC_NAME`: The name of the pubsub topic to publish to.
-   `SUBSCRIPTION_NAME`: The name of the pubsub subscription to listen to.


### Deployment Steps

#### 1. Set up Shared Storage

1.  **Create a Filestore instance** for the NFS share required by the Hunyuan3D service. Note the NFS share IP address and file share name.
2.  **Create a GCS bucket** that will be used by the frontend and worker services. It needs to be mounted at ``/app/static/models``.

#### 2. Deploy Hunyuan3D Service

You can deploy this service to either Cloud Run with a GPU or GKE Autopilot with a GPU.

** Deploy to Cloud Run**

Create a service with GPU support and 8vCPU / 32GB of RAM. Mount Filestore so it becomes ``/root`` in the container.


After deployment, get the external IP/domain of the service and set it as `HUNYUAN3D_URL`.

#### 3. Deploy Frontend and Worker

Frontend (Docker-frontend) is deployed as Cloud Run service and Worker (Docker-worker) is deployed as a Worker Pool in Cloud Run. Make sure they have
the right permissions for Pub Sub, Cloud Storage and Vertex AI.
