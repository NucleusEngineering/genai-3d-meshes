# Base image
FROM nvidia/cuda:11.8.0-cudnn8-devel-ubuntu22.04

# Set working directory
WORKDIR /app

# Install git and other dependencies
RUN apt-get update && apt-get install -y git wget libgl1 libglib2.0-0

# Clone the repository
RUN git clone https://github.com/Tencent-Hunyuan/Hunyuan3D-2.git

# Install Miniconda
RUN wget https://repo.anaconda.com/miniconda/Miniconda3-latest-Linux-x86_64.sh -O miniconda.sh && \
    bash miniconda.sh -b -p /opt/conda && \
    rm miniconda.sh
ENV PATH=/opt/conda/bin:$PATH

# Create a conda environment with Python 3.12
RUN conda tos accept --override-channels --channel https://repo.anaconda.com/pkgs/main 
RUN conda tos accept --override-channels --channel https://repo.anaconda.com/pkgs/r
RUN conda create -n hunyuan3d python=3.12 -y
SHELL ["conda", "run", "-n", "hunyuan3d", "/bin/bash", "-c"]

# Install PyTorch
RUN pip install torch==2.7.1 torchvision==0.22.1 torchaudio==2.7.1 --index-url https://download.pytorch.org/whl/cu118

ENV TORCH_CUDA_ARCH_LIST='8.6'
WORKDIR /app/Hunyuan3D-2

RUN pip install -r requirements.txt
RUN pip install -e .
# for texture
WORKDIR /app/Hunyuan3D-2/hy3dgen/texgen/custom_rasterizer
RUN python3 setup.py install
WORKDIR /app/Hunyuan3D-2/hy3dgen/texgen/differentiable_renderer
RUN python3 setup.py install

WORKDIR /app/Hunyuan3D-2

COPY faces.diff .
RUN git apply faces.diff
# Set the entrypoint
# CMD ["tail", "-f", "/dev/null"]
CMD ["conda", "run", "--no-capture-output", "-n", "hunyuan3d", "python", "api_server.py", "--host", "0.0.0.0", "--port", "8080", "--enable_tex"]