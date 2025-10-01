import os
import uuid
import logging
from flask import Flask, render_template, request, jsonify, send_from_directory
from flask_socketio import SocketIO
import vertexai
from vertexai.preview.vision_models import ImageGenerationModel
from queuing import convert_to_3d_model

# Global logging config
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# Initialize Vertex AI
vertexai.init(project=os.getenv("PROJECT_ID"), location=os.getenv("LOCATION"))

app = Flask(__name__)
socketio = SocketIO(app)

# Load the image generation model
generation_model = ImageGenerationModel.from_pretrained("imagen-4.0-fast-generate-001")

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/models/<path:filename>')
def serve_model(filename):
    return send_from_directory('static/models', filename)

@app.route('/generate', methods=['POST'])
def generate():
    prompt = request.form['prompt']

    images = generation_model.generate_images(
        prompt="A 3D model of " + prompt + " with white background.",
        number_of_images=1,
        aspect_ratio="1:1",
        negative_prompt="",
        person_generation="allow_all",
        safety_filter_level="block_few",
        add_watermark=True,
    )

    if images:
        image = images[0]
        filename = f"{uuid.uuid4()}.png"
        image_path = os.path.join('static', 'models', filename)
        image.save(image_path)
        # Return the URL path for the browser
        url_path = os.path.join('static', 'models', filename).replace(os.path.sep, '/')
        return jsonify({'image_path': url_path})
    else:
        return jsonify({'error': 'Image generation failed'})

@app.route('/convert', methods=['POST'])
def convert():
    image_path = request.form['image_path']
    generate_texture = request.form.get('generate_texture', 'false').lower() == 'true'
    face_count = request.form.get('face_count', '5000')
    output, js = convert_to_3d_model(image_path=image_path, socket_app=socketio, generate_texture=generate_texture, face_count=int(face_count))
    # Start polling in a background thread
    return jsonify({'message': output, 'js': js})

if __name__ == '__main__':
    socketio.run(app, debug=True, allow_unsafe_werkzeug=True)