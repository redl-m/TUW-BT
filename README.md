# TUW-BT

## About

### TL;DR
The system introduces a novel hybrid framework for using Explainable AI in recruitment as part of my Bachelor's thesis. While the core candidate scoring task is handled by a Random Forest classifier combined with TreeSHAP for explainability, LLM calls are used for deterministic data extraction and the generation of an executive summary and follow-up interview questions for every candidate. On a recruiter dashboard, candidates are inherently ranked. Recruiters can dynamically weigh different requirements, such as prior education and certain soft skills, to match their specific requirements.

Fast forwards to [Getting Started](#getting-started) or [Program Usage](#program-usage).

### Purpose

The core purpose of the system is to create a candidate ranking system, which is transparent by design and allows recruiters to actively engage in the hiring process by providing custom sliders, a feature impact diagram, follow-up interview questions and an executive summary for every candidate, thereby enabling recruiters to shift from passive Explainable AI outputs to active bias detection. By allowing recruiters to express their specific requirements using the custom weights, being served a feature impact diagram to actively audit the Random Forest's reasoning and an executive summary as well as follow-up interview questions for better candidate insights, this system helps include recruiters as a vital part in the hiring process and allows for active bias mitigation.

### Use of University Infrastructure
During system development and deployment, a combination of different infrastructures is employed:

- Dataset augmentation was performed using calls to [Aqueduct](https://github.com/TU-Wien-dataLAB/aqueduct), an AI gateway provided by TU Wien's dataLAB.
- Training of the Random Forest model was done using a GPU cluster provided by TU Wien's dataLAB and was performed on an NVIDIA A40 GPU.
- LLM calls for deterministic data extraction and the generation of an executive summary and follow-up interview questions are performed using [Aqueduct](https://github.com/TU-Wien-dataLAB/aqueduct) provided by TU Wien's dataLAB.
- Audio transcription of the user study audios by combining calls to [Aqueduct](https://github.com/TU-Wien-dataLAB/aqueduct) to use the [`whisper-large`](https://huggingface.co/Systran/faster-whisper-large-v3) model for audio transcription, the locally executed pyannote’s [`speaker-diarization-3.1`](https://huggingface.co/pyannote/speaker-diarization-3.1) model and [`Qwen3.5-397B`](https://huggingface.co/Qwen/Qwen3.5-397B-A17B-GPTQ-Int4), accessed through [Aqueduct](https://github.com/TU-Wien-dataLAB/aqueduct).

### Dataset
The Random Forest classifier was trained on netsol's [resume-score-details](https://huggingface.co/datasets/netsol/resume-score-details) dataset, containing 1031 samples of resumes and job descriptions, which were generated and matched using GPT-4o.
This dataset was preprocessed: only the job listing, resume, ID and target score were kept for the Random Forest classifier to learn.
During dataset augmentation, technical skills as well as soft skills were identified using [`qwen-coder-30b`](https://huggingface.co/QuantTrio/Qwen3-Coder-30B-A3B-Instruct-GPTQ-Int8), accessed through using [Aqueduct](https://github.com/TU-Wien-dataLAB/aqueduct).

### Libraries
The libraries used to implement this system are:

- [torch](https://pytorch.org) version 2.11.0+cu130
- [transformers](https://github.com/huggingface/transformers) version 5.5.4
- [lightning](https://www.pytorchlightning.ai) version 2.6.1
- [accelerate](https://github.com/huggingface/accelerate) version 1.13.0
- [bitsandbytes](https://github.com/bitsandbytes-foundation/bitsandbytes) version 0.49.2
- [pyannote.audio](https://github.com/pyannote/pyannote-audio) version 4.0.4
- [speechbrain](https://speechbrain.github.io) version 0.5.16
- [fastapi](https://fastapi.tiangolo.com) version 0.135.3
- [uvicorn](https://uvicorn.dev) version 0.42.0
- [openai](https://github.com/openai/openai-python) version 2.32.0
- [numpy](https://numpy.org) version 2.4.4
- [pandas](https://pandas.pydata.org) version 3.0.2
- [scikit-learn](https://scikit-learn.org) version 1.8.0
- [matplotlib](https://matplotlib.org) version 3.10.8

## Getting Started

### Development server
To start a local server, the frontend and backend must be started separately. To start the frontend, navigate to `root/web`:

```bash
cd .\web\
```

and run:

```bash
ng serve -o --proxy-config proxy.conf.json
```

To start the backend, navigate to `root/api`:

```bash
cd .\api\
```

and run:

```bash
python -m uvicorn app.main:app
```

Once the server is running, open your browser and navigate to `http://localhost:4200`.

## Program Usage

### Basics

To initialize the system, upload a job description and candidate CVs by clicking the upload boxes or providing the files via drag-and-drop. The system then automatically redirects you to the recruiter dashboard.

### Setting up the remote LLM

By default, the API-based LLM setup is selected. The default API URL is `https://aqueduct.ai.datalab.tuwien.ac.at/v1`, which belongs to Aqueduct. The default model is [`qwen-3.6-35b`](https://huggingface.co/QuantTrio/Qwen3-Coder-30B-A3B-Instruct-GPTQ-Int8) and the API key is provided if an API key is found in your local `.env`-file.

### Setting up the local LLM

By switching to the "Local Model" tab, a local model can be configured. You can select local models by providing either an absolute model path to your locally stored model or a model's huggingface identifer, such as `meta-llama/Llama-3.1-8B-Instruct`. If no absolute path is given, huggingface will check your default model path or download the model if it is not found on your hard drive.

You can see a visualization of the current VRAM usage for monitoring your GPU's utilization, which updates in real time to make checking the local model's VRAM usage easy to understand. To load a local model, click "Load Model", and to release a model, click "Eject Model". If a model is being loaded, your local console output, which monitors huggingface's exact loading information, is forwarded to the frontend and visualized underneath the VRAM visualization to guarantee absolute information about the model's current loading progress.

### Applying Custom Weights

Custom weights for hard skills and soft skills can be adjusted using the Likert-scale sliders on the right side of the dashboard. By default, the LLM already pre-adjusts these sliders based on your specific job description. Each slider can be adjusted on a 5-point range spanning from Ignore (1) to Important (3) and Critical (5).

The following skills can be adjusted using the custom sliders:

- Years of Experience
- Education Level
- Structural Adherence
- Adaptive Fluidity
- Interpersonal Influence
- Execution Velocity
- Psychological Resilience

These weights are then applied to the system's baseline score, which is the score each candidate is awarded by the Random Forest classifier. A candidate's overall score is being calculated as:

$$
\text{UserScore} =
\text{BaseValue} +
\sum_{i=1}^{n}
\left(
\text{SHAPValue}_i \times \text{UserMultiplier}_i
\right)
$$

### File Management
By clicking "Manage Files", which located above the candidate tiles, the job description can be switched and additional CVs can be uploaded. Existing candidates can be deleted by clicking "x" on their respective candidate chip, which can be seen in the "Current Candidates" section and is only visible, if the file management is expanded.

### Candidate Profiles
For each candidate, their user score and baseline score is visible. By clicking on "View Details", a candidate's detailed profile can be openend.
This include:

- Feature Impact Diagram: A visual breakdown of features, which contributed positively (green) or negatively (red) to a candidate's overall score. Only features having > 1% impact and at most 7 features are listed for every single candidate.
- Follow-up Interview Questions: Based on job requirements and a candidate's profile, follow-up interview questions are generated. Each individual question can be copied by hovering it and clicking the copy-button on the top right corner. Alternatively, all questions can be copied using button "Copy All Questions".
- Executive Summary: A summary for each candidate, summarizing their strengths and weaknesses.

Note: As a design choice, positive and negative contributions to a candidate's overall score were allowed. This means, that each candidate's score does not start at 0, but at the Random Forest classifier's average training score. Consequently, top-rated soft skills can still have a negative impact. A red color coding represents a negative impact on a candidate's overall score, but does not imply a negative attribute of the candidate itself. Therefore, it must be noted that soft skills are rated on a scale from 1 to 5 to fully understand a candidate's score and breakdown.

### Score Deviation Badge
If the system's baseline score and a recruiter's dynamically weighted score deviate by more than 20%, a notification badge is displayed. On hover, a breakdown of where this gap originates is presented. It shows, which attribtues (hard skills and soft skills) contributed how much to the gap and highlights the sliders, which lead to the deviation. This additional information acts as a "calibration point" of user trust: it makes recruiters aware that a candidate is only ranked this high due to their current slider settings.

### Thesis

The thesis itself can be accessed on my [website](https://michaeljosefredl.at) after publication. It includes related work, introduces the methodology, a detailed technical breakdown of the implementation and the results of a user study, which was conducted to test the viability of the proposed system.

## Contact

Michael Josef Redl - [Personal Website](https://michaeljosefredl.at) - [@redl_m](https://www.instagram.com/redl__m/) - michael.redl14042004@gmail.com
