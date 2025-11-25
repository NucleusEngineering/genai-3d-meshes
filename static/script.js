import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';

const socket = io();

export function showNotification(message) {
    const notification = document.getElementById('notification');
    notification.innerHTML = message;
    notification.classList.add('show');
    setTimeout(() => {
        notification.classList.remove('show');
    }, 5000);
}

socket.on('model_update_complete', function(data) {
    show3DModel(data.model_path, data.model_path.split('/').pop());
    loadAvailableModels();
});

document.getElementById('prompt-form').addEventListener('submit', async function(event) {
    event.preventDefault();

    const prompt = document.getElementById('prompt-input').value;
    const generateButton = document.getElementById('generate-button');
    
    generateButton.innerHTML = "Generating...";
    generateButton.disabled = true;

    const formData = new FormData();
    formData.append('prompt', prompt);

    try {
        const response = await fetch('/generate', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        handleImageResult(result, generateButton, "Generate");

    } catch (error) {
        console.error('Error during generation:', error);
        generateButton.innerHTML = "Generate";
        generateButton.disabled = false;
        showNotification('Generation failed. Please try again.');
    }
});

document.getElementById('upload-form').addEventListener('submit', async function(event) {
    event.preventDefault();

    const imageInput = document.getElementById('image-upload-input');
    const uploadButton = document.getElementById('upload-button');

    if (imageInput.files.length === 0) {
        showNotification('Please select an image to upload.');
        return;
    }

    uploadButton.innerHTML = "Uploading...";
    uploadButton.disabled = true;

    const formData = new FormData();
    formData.append('image', imageInput.files[0]);

    try {
        const response = await fetch('/upload', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        handleImageResult(result, uploadButton, "Upload Image");

    } catch (error) {
        console.error('Error during upload:', error);
        uploadButton.innerHTML = "Upload Image";
        uploadButton.disabled = false;
        showNotification('Upload failed. Please try again.');
    }
});

function handleImageResult(result, button, buttonText) {
    const imageContainer = document.getElementById('image-container');
    imageContainer.innerHTML = '';

    if (result.image_path) {
        button.innerHTML = buttonText;
        button.disabled = false;

        let enrichedPromptHTML = '';
        if (result.enriched_prompt) {
            enrichedPromptHTML = `<div class="enriched-prompt"><b>Enriched Prompt:</b> ${result.enriched_prompt}</div>`;
        }

        imageContainer.innerHTML = `
            ${enrichedPromptHTML}
            <div id="convert-container">
                <div class="checkbox-container">
                    <input type="checkbox" id="generate-texture-checkbox" name="generate_texture" checked>
                    <label for="generate-texture-checkbox">Generate Texture</label>
                </div>
                <div class="dropdown-container">
                    <label for="face_count">Face Count:</label>
                    <select id="face_count" name="face_count" class="cyber-dropdown">
                        <option value="1000">1000</option>
                        <option value="2500">2500</option>
                        <option value="5000" selected>5000</option>
                        <option value="10000">10000</option>
                        <option value="25000">25000</option>
                        <option value="40000">40000</option>
                    </select>
                </div>
                <button id="convert-btn" class="cyber-button">Convert to 3D</button>
            </div>
            <img src="${result.image_path}" alt="Generated Image" id="generated-image">
        `;
        document.getElementById('convert-btn').addEventListener('click', async function() {
            this.disabled = true;
            this.innerHTML = 'Converting...';
            const image_path = result.image_path;
            const enrichedPrompt = result.enriched_prompt;
            const newFilename = result.new_filename;
            const generateTexture = document.getElementById('generate-texture-checkbox').checked;
            const faceCount = document.getElementById('face_count').value;
            const convertFormData = new FormData();
            convertFormData.append('image_path', image_path);
            convertFormData.append('enriched_prompt', enrichedPrompt);
            convertFormData.append('generate_texture', generateTexture);
            convertFormData.append('face_count', faceCount);
            convertFormData.append('sid', socket.id);
            convertFormData.append('new_filename', newFilename);
            
            const convertResponse = await fetch('/convert', {
                method: 'POST',
                body: convertFormData
            });
            const convertResult = await convertResponse.json();

            if(convertResult.message) {
                showNotification(convertResult.message);
            }
            if(convertResult.js) {
                eval(convertResult.js);
            }
        });
    } else {
        button.innerHTML = buttonText;
        button.disabled = false;
        showNotification(result.error || 'An unknown error occurred.');
    }
}

function handle3DModel(filename, title) {
    const imageContainer = document.getElementById('image-container');
    imageContainer.innerHTML = '';

    let canvas = document.querySelector('canvas');
    if(!canvas) {
        canvas = document.createElement('canvas');
        canvas.style.width = "800px";
        canvas.style.height = "800px";
        imageContainer.appendChild(canvas);
    }

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true });
    renderer.clear();
    renderer.setSize(800, 800);
    renderer.setPixelRatio(window.devicePixelRatio);

    const loader = new THREE.TextureLoader();
    const texture = loader.load('https://threejs.org/examples/textures/checker.png');
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(50, 50);
    scene.background = texture;

    const controls = new OrbitControls(camera, renderer.domElement);

    const gltfLoader = new GLTFLoader();
    gltfLoader.load(
        '/' + filename,
        function (gltf) {
            scene.add(gltf.scene);

            const wireframeCheckbox = document.getElementById('wireframe-checkbox');
            const originalMaterials = new Map();
            wireframeCheckbox.addEventListener('change', function() {
                scene.traverse(function (child) {
                    if (child.isMesh) {
                        if (wireframeCheckbox.checked) {
                            if (!child.material.map) {
                                if (!originalMaterials.has(child.uuid)) {
                                    originalMaterials.set(child.uuid, child.material);
                                }
                                child.material = new THREE.MeshBasicMaterial({
                                    color: 0x000000,
                                    wireframe: true
                                });
                            } else {
                                child.material.wireframe = true;
                            }
                        } else {
                            if (originalMaterials.has(child.uuid)) {
                                child.material = originalMaterials.get(child.uuid);
                            }
                            child.material.wireframe = false;
                        }
                    }
                });
            });

            scene.traverse(function (child) {
                if (child.isMesh) {
                    if (wireframeCheckbox.checked) {
                        if (!child.material.map) {
                            if (!originalMaterials.has(child.uuid)) {
                                originalMaterials.set(child.uuid, child.material);
                            }
                            child.material = new THREE.MeshBasicMaterial({
                                color: 0x000000,
                                wireframe: true
                            });
                        } else {
                            child.material.wireframe = true;
                        }
                    } else {
                        if (originalMaterials.has(child.uuid)) {
                            child.material = originalMaterials.get(child.uuid);
                        }
                        child.material.wireframe = false;
                    }
                }
            });

        },
        undefined,
        function (error) {
            console.error(error);
        }
    );

    camera.position.z = 3;

    const hemisphereLight = new THREE.HemisphereLight( 0xffffff, 0x444444, 4 );
    scene.add( hemisphereLight );

    const directionalLight = new THREE.DirectionalLight( 0xffffff, 4 );
    directionalLight.position.set( 5, 5, 5 );
    scene.add( directionalLight );

    const directionalLight2 = new THREE.DirectionalLight( 0xffffff, 2 );
    directionalLight2.position.set( -5, 5, -5 );
    scene.add( directionalLight2 );

    const bottomLight = new THREE.DirectionalLight( 0xffffff, 2 );
    bottomLight.position.set( 0, -5, 0 );
    scene.add( bottomLight );

    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));

    function animate() {
        requestAnimationFrame(animate);

        controls.update();
        composer.render();
    }
    animate();
}

export function show3DModel(filename, title) {
    const wireframeCheckboxContainer = document.getElementsByClassName('wireframe-toggle')[0];
    const wireframeCheckbox = document.getElementById('wireframe-checkbox');

    if(wireframeCheckboxContainer) {
        wireframeCheckboxContainer.style.display = 'flex';
        wireframeCheckbox.checked = true;
    }
    handle3DModel(filename, title);
}

async function loadAvailableModels() {
    try {
        const response = await fetch('/models');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const models = await response.json();
        const modelList = document.getElementById('model-list');
        modelList.innerHTML = '';
        models.forEach(model => {
            const li = document.createElement('li');
            const date = new Date(model.created_at * 1000);
            const formattedDate = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}`;
            li.innerHTML = `<span class="model-name">${model.name}</span><div class="model-actions"><span class="model-date">${formattedDate}</span><a href="static/models/${model.name}" download="${model.name}" class="download-btn cyber-button">Download</a></div>`;
            li.addEventListener('click', () => {
                show3DModel(`static/models/${model.name}`, model.name);
            });
            const downloadBtn = li.querySelector('.download-btn');
            downloadBtn.addEventListener('click', (event) => {
                event.stopPropagation();
            });
            modelList.appendChild(li);
        });
    } catch (error) {
        console.error('Error loading available models:', error);
    }
}

document.addEventListener('DOMContentLoaded', function() {
    loadAvailableModels();
});