## Endpoint URL

The URL for the 3D generation service is `https://h3d-936021411109.europe-west4.run.app/generate`.

## cURL Command

Here is the basic structure of the cURL command:

```bash
curl -X POST "https://h3d-936021411109.europe-west4.run.app/generate" \
-H "Content-Type: application/json" \
-d '{
  "image": "<base64_encoded_image>",
  "texture": <true_or_false>,
  "face_count": <integer>
}'
```

### Parameters

The JSON payload of the request includes the following parameters:

- **image** (string, required): A base64 encoded string of the image file.
- **texture** (boolean, optional): A boolean value (`true` or `false`) to indicate whether to generate a texture.
- **face_count** (integer, optional): An integer specifying the desired number of faces for the 3D model. If not provided, it defaults to `10000`.

### Example

1. **Encode your image to base64.** You can use the following command to encode an image file (e.g., `my_image.png`):

   ```bash
   base64 my_image.png > image_base64.txt
   ```

2. **Construct the cURL command.** Replace the placeholder values with your actual data.

   ```bash
   curl -X POST "https://h3d-936021411109.europe-west4.run.app/generate" \
   -H "Content-Type: application/json" \
   -d '{
     "image": "'$(cat image_base64.txt)'",
     "texture": true,
     "face_count": 10000
   }'
   ```

This command sends a POST request to the specified endpoint with the image data and other parameters, and you should receive a GLB file in response.