import os
import gc
import sys
import torch
from dotenv import load_dotenv
from pydantic import BaseModel
from openai import OpenAI
from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig


class LLMSettings(BaseModel):
    load_dotenv()
    provider: str = "api"  # Default to API
    api_key: str = os.getenv("API_KEY", "")
    base_url: str = "https://aqueduct.ai.datalab.tuwien.ac.at/v1"
    model_name: str = "qwen-coder-30b"
    local_model_id: str = r"D:\huggingface\hub\models--meta-llama--Meta-Llama-3.1-8B-Instruct\snapshots\0e9e39f249a16976918f6564b8830bc894c89659"  # absolute path or hf ID

    if not api_key:
        raise ValueError("API_KEY is not set in the environment.")


class TqdmInterceptor:
    def __init__(self, manager):
        self.manager = manager
        self.original_stderr = sys.stderr
        self.buffer = ""

    def write(self, text):
        self.original_stderr.write(text)
        self.buffer += text
        # progress are updated using carriage returns (\r)
        if '\r' in self.buffer:
            parts = self.buffer.split('\r')
            for p in parts:
                if '%' in p and '|' in p:
                    self.manager.loading_progress = p.strip()
            # Keep the trailing fragment
            self.buffer = parts[-1]

    def flush(self):
        self.original_stderr.flush()


class LLMManager:
    def __init__(self):
        self.settings = LLMSettings()
        self.local_model = None
        self.tokenizer = None
        self.terminators = []
        self.local_status = "unloaded"
        self.loading_progress = ""

    def update_settings(self, new_settings: LLMSettings):
        self.settings = new_settings
        if self.settings.provider == "local" and self.local_model is None:
            self.load_local_model()

    def get_status(self):
        api_ready = bool(self.settings.api_key and self.settings.base_url)
        return {
            "settings": self.settings.dict(),
            "status": {
                "local": self.local_status,
                "api": "ready" if api_ready else "missing_key"
            }
        }

    def load_local_model(self):
        if self.local_model is not None:
            return

        self.local_status = "loading"
        self.loading_progress = "Initializing Hugging Face..."
        print(f"Loading model: {self.settings.local_model_id}")

        # Hijack the standard error to catch the tqdm progress bar
        interceptor = TqdmInterceptor(self)
        sys.stderr = interceptor

        try:
            quantization_config = BitsAndBytesConfig(
                load_in_4bit=True,
                bnb_4bit_compute_dtype=torch.float16,
                bnb_4bit_use_double_quant=True,
            )

            self.tokenizer = AutoTokenizer.from_pretrained(self.settings.local_model_id)
            self.local_model = AutoModelForCausalLM.from_pretrained(
                self.settings.local_model_id,
                device_map="auto",
                quantization_config=quantization_config,
                dtype=torch.float16
            )

            try:
                eot_id = self.tokenizer.convert_tokens_to_ids("<|eot_id|>")
                self.terminators = [self.tokenizer.eos_token_id, eot_id] if eot_id else [self.tokenizer.eos_token_id]
            except:
                self.terminators = [self.tokenizer.eos_token_id]

            self.local_status = "ready"
            self.loading_progress = "Model loaded successfully."

        except Exception as e:
            self.local_status = "unloaded"
            self.loading_progress = f"Error: {str(e)}"
            raise e
        finally:
            # Always restore normal console output!
            sys.stderr = interceptor.original_stderr

    def generate(self, messages: list, max_tokens: int = 1024, temperature: float = 0.6, do_sample: bool = True) -> str:
        """Central text generation routing."""
        if self.settings.provider == "api":
            try:
                client = OpenAI(api_key=self.settings.api_key, base_url=self.settings.base_url)

                # API expects a float temperature. Map deterministic requests (do_sample=False) to temp=0.0
                api_temp = temperature if do_sample else 0.0

                response = client.chat.completions.create(
                    model=self.settings.model_name,
                    messages=messages,
                    temperature=api_temp,
                    max_tokens=max_tokens
                )
                return response.choices[0].message.content
            except Exception as e:
                print(f"API Generation Error: {e}")
                raise

        else:
            # Fallback to local model
            if self.local_model is None:
                self.load_local_model()

            inputs = self.tokenizer.apply_chat_template(
                messages,
                add_generation_prompt=True,
                return_tensors="pt",
                return_dict=True
            ).to(self.local_model.device)

            # Local models might throw an error if temperature is passed while do_sample is False
            generate_kwargs = {
                "max_new_tokens": max_tokens,
                "eos_token_id": self.terminators,
                "do_sample": do_sample
            }
            if do_sample:
                generate_kwargs["temperature"] = temperature
                generate_kwargs["top_p"] = 0.9

            outputs = self.local_model.generate(**inputs, **generate_kwargs)

            input_length = inputs['input_ids'].shape[-1]
            return self.tokenizer.decode(outputs[0][input_length:], skip_special_tokens=True)

    def unload_local_model(self):
        """Unloads the HuggingFace model and forces aggressive VRAM cleanup."""
        if self.local_model is not None:
            print("Unloading local model to free VRAM...")

            # Destroy references
            del self.local_model
            del self.tokenizer
            self.local_model = None
            self.tokenizer = None
            self.terminators = []

            # Force garbage collection multiple times to catch unlinked cyclic references
            gc.collect()
            gc.collect()

            # Clean the CUDA cache
            if torch.cuda.is_available():
                torch.cuda.synchronize()  # Block until all GPU operations finish
                torch.cuda.empty_cache()  # Release the memory back to the OS
                torch.cuda.ipc_collect()  # Clear inter-process communication memory

        self.local_status = "unloaded"
        print("Local model successfully unloaded and VRAM cleared.")
