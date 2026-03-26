import os
import json
import joblib
import numpy as np
import pandas as pd

import sys
import shap

import shap.explainers._explainer
from pandas import DataFrame

shap.explainers._explainer.is_transformers_lm = lambda *args, **kwargs: False # Force SHAP to skip the Hugging Face LM check

from typing import Dict, List, Any
from app.models.candidate import CandidateFeatures

# Custom Tokenizer from Jupyter notebook
def split_comma_skills(skill_string):
    if not isinstance(skill_string, str):
        return []
    return [skill.strip() for skill in skill_string.split(',')]


sys.modules['__main__'].split_comma_skills = split_comma_skills


class ScorerService:
    def __init__(
            self,
            model_path: str = "saved_models/rf_model.pkl",
            features_path: str = "../data/training/feature_names.json"
    ):
        print("Initializing Scorer Service and SHAP TreeExplainer...")

        if not os.path.exists(model_path):
            raise FileNotFoundError(f"RF Model not found at {model_path}")

        with open(model_path, "rb") as f:
            loaded_obj = joblib.load(f)

        # Pipeline Extraction Logic
        if hasattr(loaded_obj, "steps"):
            print("Scikit-Learn Pipeline detected. Extracting the Random Forest step...")
            self.model = loaded_obj.steps[-1][1]
        else:
            self.model = loaded_obj

        if not os.path.exists(features_path):
            raise FileNotFoundError(f"Feature names not found at {features_path}")

        with open(features_path, "r") as f:
            self.feature_columns = json.load(f)

        self.explainer = shap.TreeExplainer(self.model)

        self.RISK_BOUNDARY_THRESHOLD = 0.20

    def _prepare_feature_array(self, features: CandidateFeatures) -> DataFrame:
        """
        Converts the Pydantic LLM output into the strict 1D array required by the RF.
        """
        encoded_features = {
            "years_of_experience": float(features.years_of_experience) if features.years_of_experience else 0.0,
            "education_level": 0.0, # Default
            "structural_adherence": float(features.structural_adherence) if features.structural_adherence else 0.0,
            "adaptive_fluidity": float(features.adaptive_fluidity) if features.adaptive_fluidity else 0.0,
            "interpersonal_influence": float(features.interpersonal_influence) if features.interpersonal_influence else 0.0,
            "execution_velocity": float(features.execution_velocity) if features.execution_velocity else 0.0,
            "psychological_resilience": float(features.psychological_resilience) if features.psychological_resilience else 0.0
        }

        # Map UI education
        edu_str = str(features.education).lower()
        if any(x in edu_str for x in ['phd', 'doctor']): encoded_features["education_level"] = 4.0
        elif any(x in edu_str for x in ['master', 'mba', 'm.tech', 'm.sc', 'ms']): encoded_features["education_level"] = 3.0
        elif any(x in edu_str for x in ['bachelor', 'b.com', 'b.sc', 'bs', 'b.a', 'ba', 'b.tech']): encoded_features["education_level"] = 2.0
        elif any(x in edu_str for x in ['high', 'fa', 'fsc', 'diploma']): encoded_features["education_level"] = 1.0

        # Convert the dictionary back to a 1D dataframe
        ordered_features = {col: encoded_features[col] for col in self.feature_columns}
        return pd.DataFrame([ordered_features])

    def evaluate_candidate(self, features: CandidateFeatures, user_weights: Dict[str, float]) -> dict:
        X_matrix = self._prepare_feature_array(features)

        # RF Prediction: Regressor outputs a 0-100 score directly
        raw_rf_score = float(self.model.predict(X_matrix)[0])
        rf_score = max(0.0, min(raw_rf_score / 100.0, 1.0)) # divide by 100 to get 0.0-1.0 ratio

        # SHAP Attributions and Base Value
        shap_results = self.explainer.shap_values(X_matrix)

        exp_val = self.explainer.expected_value
        raw_base_value = float(exp_val[0] if isinstance(exp_val, (list, np.ndarray)) else exp_val)
        base_value = raw_base_value / 100.0 # Normalize to 0.0 - 1.0

        candidate_shap_vals = shap_results[0] # 2D array: [n_samples, n_features]

        # Create the Normalized SHAP Dictionary
        shap_dict = {
            self.feature_columns[i]: float(candidate_shap_vals[i]) / 100.0
            for i in range(len(self.feature_columns))
        }

        # Calculate User Score
        user_score_accumulator = base_value

        # Define features that are intrinsic and cannot be altered by UI sliders
        intrinsic_features = ["job_hopping"]

        for feature_name, shap_val in shap_dict.items():
            if feature_name in intrinsic_features:
                user_score_accumulator += shap_val # add SHAP value directly to user score
            else:
                # 1-5 UI mapping
                raw_weight = user_weights.get(feature_name, 3.0)
                multiplier = (raw_weight - 1.0) / 4.0
                user_score_accumulator += (shap_val * multiplier)

        # Ensure the user score stays within logical bounds [0.0, 1.0]
        user_score = max(0.0, min(user_score_accumulator, 1.0))

        # Risk Flag Logic
        risk_flag = False
        if user_score > rf_score and (user_score - rf_score) >= self.RISK_BOUNDARY_THRESHOLD:
            risk_flag = True

        return {
            "rf_score": rf_score,
            "user_score": user_score,
            "risk_flag": risk_flag,
            "shap_values": shap_dict
        }