import os
import json
import joblib
import numpy as np
import sys
import shap

import shap.explainers._explainer
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

    def _prepare_feature_array(self, features: CandidateFeatures) -> np.ndarray:
        """
        Converts the Pydantic LLM output into the strict 1D array required by the RF.
        Implements Explicit Indicator Encoding for missing/categorical data.
        """
        # Handle missing numerical values by defaulting to 0
        encoded_features: Dict[str, float] = {col: 0.0 for col in self.feature_columns}

        # NUMERICAL & SOFT SKILL MAPPING

        # Direct mapping for continuous variables and fixed soft skill integers
        direct_mappings = {
            "Experience (Years)": features.experienceYears,
            "Projects Count": features.projectsCount,
            "Structural Adherence": features.structuralAdherence,
            "Adaptive Fluidity": features.adaptiveFluidity,
            "Interpersonal Influence": features.interpersonalInfluence,
            "Execution Velocity": features.executionVelocity,
            "Psychological Resilience": features.psychologicalResilience,
        }

        for key, val in direct_mappings.items():
            if key in encoded_features:
                encoded_features[key] = float(val)

        #  CATEGORICAL MAPPING

        # Education
        ed_val = features.education if features.education else "None"
        ed_col = f"Education_{ed_val}"
        if ed_col in encoded_features:
            encoded_features[ed_col] = 1.0

        # Certifications
        cert_val = features.certifications if features.certifications else "None"
        cert_col = f"Certifications_{cert_val}"
        if cert_col in encoded_features:
            encoded_features[cert_col] = 1.0

        # Job Hopping
        hop_col = f"Job Hopping_{features.jobHopping}"
        if hop_col in encoded_features:
            encoded_features[hop_col] = 1.0

        # TECHNICAL SKILLS ARRAY using One-Hot/Multi-Hot Encoding
        for skill in features.technical_skills:
            skill_col = f"Skill_{skill.strip()}"
            if skill_col in encoded_features:
                encoded_features[skill_col] = 1.0

        # Convert the dictionary back to a 1D numpy array strictly in the order of feature_columns
        return np.array([encoded_features[col] for col in self.feature_columns]).reshape(1, -1)

    def evaluate_candidate(self, features: CandidateFeatures, user_weights: Dict[str, float]) -> dict:
        X_matrix = self._prepare_feature_array(features)

        # RF Prediction
        raw_rf_score = float(self.model.predict(X_matrix)[0])
        rf_score = (raw_rf_score / 100.0) if raw_rf_score > 1.0 else raw_rf_score

        # SHAP Attributions and the Base Value
        shap_results = self.explainer.shap_values(X_matrix)

        # Extract Base Value (Expected Value of the model) robustly
        exp_val = self.explainer.expected_value

        if isinstance(exp_val, (list, np.ndarray)):
            if len(exp_val) > 1:
                raw_base_value = float(exp_val[1])
            else:
                raw_base_value = float(exp_val[0])
        else:
            raw_base_value = float(exp_val)

        # Handle candidate SHAP values structure
        if isinstance(shap_results, list):
            if len(shap_results) > 1:
                candidate_shap_vals = shap_results[1][0]
            else:
                candidate_shap_vals = shap_results[0][0]
        else:
            if len(shap_results.shape) > 1:
                candidate_shap_vals = shap_results[0]
            else:
                candidate_shap_vals = shap_results

        # Define the scale factor dynamically based on the model's output range
        scale_factor = 100.0 if (raw_rf_score > 1.0 or raw_base_value > 1.0) else 1.0

        # Normalize the base value
        base_value = raw_base_value / scale_factor

        # Create the SHAP Dictionary
        shap_dict = {
            self.feature_columns[i]: float(candidate_shap_vals[i]) / scale_factor # normalize
            for i in range(len(self.feature_columns))
            if candidate_shap_vals[i] != 0.0
        }

        # Calculate user score
        user_score_accumulator = base_value

        for feature_name, shap_val in shap_dict.items():
            raw_weight = user_weights.get(feature_name, 3.0)
            multiplier = (raw_weight - 1.0) / 4.0
            user_score_accumulator += (shap_val * multiplier)

        # Ensure the user score stays within logical probability bounds [0.0, 1.0]
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