## Prerequisites

1. Enable APIs: Make sure the Cloud Build, Artifact Registry, and Cloud Run APIs are enabled in your project:

    `gcloud services enable cloudbuild.googleapis.com artifactregistry.googleapis.com run.googleapis.com`

2. Create Artifact Registry Repository: This build pushes to a repository named hunyuan3d. Create it with this command:

    `gcloud artifacts repositories create hunyuan3d --repository-format=docker --location=europe-west3`

3. Grant Permissions: The Cloud Build service account needs permissions to push to Artifact Registry and deploy to Cloud Run. Run these commands:

    ```
    PROJECT_NUMBER=$(gcloud projects describe $(gcloud config get-value project) --format='value(projectNumber)')
    gcloud projects add-iam-policy-binding $(gcloud config get-value project) \
        --member="serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
        --role="roles/artifactregistry.writer"
    gcloud projects add-iam-policy-binding $(gcloud config get-value project) \
        --member="serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
        --role="roles/run.admin"
    gcloud projects add-iam-policy-binding $(gcloud config get-value project) \
        --member="serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
        --role="roles/iam.serviceAccountUser"
    ```

## Run the Build

1. Submit the build :)

    `gcloud builds submit`

    This command will trigger the steps in cloudbuild.yaml, which will build your container, update the cloudrun-service.yaml, and deploy it.
