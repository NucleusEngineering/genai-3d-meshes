import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { FilmPass } from 'three/addons/postprocessing/FilmPass.js';

const socket = io();
//const socket = io.connect('http://localhost:8080'); // for local testing

export function showNotification(message) {
    const notification = document.getElementById('notification');
    notification.innerHTML = message;
    notification.classList.add('show');
    setTimeout(() => {
        notification.classList.remove('show');
    }, 5000);
}

socket.on('model_update_complete', function(data) {

    const convertBtn = document.getElementById('convert-btn');
    convertBtn.innerHTML = 'Convert to 3D';
    convertBtn.disabled = false;

    const showImageBtn = document.getElementById('side-by-side-button');
    if(showImageBtn) {
        showImageBtn.remove();
    }

    handle3DModel(data.model_path);
});

document.getElementById('prompt-form').addEventListener('submit', async function(event) {
    event.preventDefault();

    const prompt = document.getElementById('prompt-input').value;
    const generateButton = document.getElementById('generate-button');
    const imageContainer = document.getElementById('image-container');
    const convertContainer = document.getElementById('convert-container');
    const showImageBtn = document.getElementById('side-by-side-button');

    if(convertContainer) {
        convertContainer.style.display = 'none';
    }
    if(showImageBtn) {
        showImageBtn.remove();
    }

    generateButton.innerHTML = "Generating...";
    generateButton.disabled = true;
    const canvas = imageContainer.querySelector('canvas');
    if(canvas) {
        canvas.remove();
    }

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

        imageContainer.innerHTML = '';

        const result = await response.json();

        if (result.image_path) {
            generateButton.innerHTML = "Generate";
            generateButton.disabled = false;

            imageContainer.innerHTML = `
                <div id="convert-container">
                    <div class="checkbox-container">
                        <input type="checkbox" id="generate-texture-checkbox" name="generate_texture" checked>
                        <label for="generate-texture-checkbox">Generate Texture</label>
                    </div>
                    <div class="dropdown-container">
                        <label for="face_count">Face Count:</label>
                        <select id="face_count" name="face_count">
                            <option value="1000">1000</option>
                            <option value="2500">2500</option>
                            <option value="5000" selected>5000</option>
                            <option value="10000">10000</option>
                            <option value="25000">25000</option>
                            <option value="40000">40000</option>
                        </select>
                    </div>
                    <button id="convert-btn">Convert to 3D</button>
                </div>
                <img src="${result.image_path}" alt="Generated Image" id="generated-image">
            `;
            document.getElementById('convert-btn').addEventListener('click', async function() {
                this.disabled = true;
                this.innerHTML = 'Converting...';
                const image_path = result.image_path;
                const generateTexture = document.getElementById('generate-texture-checkbox').checked;
                const faceCount = document.getElementById('face_count').value;
                const convertFormData = new FormData();
                convertFormData.append('image_path', image_path);
                convertFormData.append('generate_texture', generateTexture);
                convertFormData.append('face_count', faceCount);
                convertFormData.append('sid', socket.id);

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
            generateButton.innerHTML = "Generate";
            generateButton.disabled = false;
            showNotification(result.error || 'An unknown error occurred.');
        }
    } catch (error) {
        console.error('Error during generation:', error);
        generateButton.innerHTML = "Generate";
        generateButton.disabled = false;
        showNotification('Generation failed. Please try again.');
    }
});

function handle3DModel(filename) {
    const imageContainer = document.getElementById('image-container');
    const image = document.getElementById('generated-image');
    image.style.display = 'none';

    let canvas = document.querySelector('canvas');
    if(!canvas) {
        canvas = document.createElement('canvas');
        canvas.style.width = "800px";
        canvas.style.height = "800px";
        imageContainer.appendChild(canvas);
    }

    const showImageBtn = document.createElement('button');
    showImageBtn.innerHTML = 'Show Image';
    showImageBtn.id = 'side-by-side-button';
    showImageBtn.style.marginTop = '32px';
    imageContainer.appendChild(showImageBtn);

    showImageBtn.addEventListener('mousedown', () => {
        canvas.style.display = 'none';
        image.style.display = 'block';
        showImageBtn.innerHTML = 'See render';
    });

    showImageBtn.addEventListener('mouseup', () => {
        canvas.style.display = 'block';
        image.style.display = 'none';
        showImageBtn.innerHTML = 'See original';
    });

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true });
    renderer.clear();
    renderer.setSize(800, 800);
    renderer.setPixelRatio(window.devicePixelRatio);

    // Add checkerboard background
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
            wireframeCheckbox.addEventListener('change', function() {
                scene.traverse(function (child) {
                    if (child.isMesh) {
                        child.material.wireframe = wireframeCheckbox.checked;
                    }
                });
            });

            scene.traverse(function (child) {
                if (child.isMesh) {
                    console.log("converting to wireframe: " + wireframeCheckbox.checked);
                    child.material.wireframe = wireframeCheckbox.checked;
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

    // const filmPass = new FilmPass(0.35, 0.025, 648, false);
    // composer.addPass(filmPass);

    function animate() {
        requestAnimationFrame(animate);

        controls.update();
        composer.render();
    }
    animate();
}

export function show3DModel(filename) {
    handle3DModel(filename);
}
