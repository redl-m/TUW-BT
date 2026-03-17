import os
import sys
import json
import pickle
import numpy as np
import shap
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

        # Load the Random Forest model
        if not os.path.exists(model_path):
            raise FileNotFoundError(f"RF Model not found at {model_path}")
        with open(model_path, "rb") as f:
            self.model = pickle.load(f)

        # Load the feature column names the model was trained on
        if not os.path.exists(features_path):
            raise FileNotFoundError(f"Feature names not found at {features_path}")
        with open(features_path, "r") as f:
            self.feature_columns: List[str] = json.load(f)

        # Initialize TreeSHAP
        self.explainer = shap.TreeExplainer(self.model)

        # Risk flag boundary
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

    def calculate_user_score(self, features: CandidateFeatures, user_weights: Dict[str, float]) -> float:
        """
        Calculates the subjective recruiter score dynamically based on active slider weights.
        """
        numerator = 0.0
        denominator = 0.0

        # Flat dictionary of the candidate's raw attributes to match against slider labels
        raw_dict = features.model_dump(by_alias=True)

        for feature_name, weight in user_weights.items():
            # If the UI weight maps directly to a soft skill or numerical value
            if feature_name in raw_dict and isinstance(raw_dict[feature_name], (int, float)):
                feature_value = raw_dict[feature_name]

                # TODO: potentially normalize feature_values to [0, 1] to align with RF score if not done elsewhere

                numerator += (feature_value * weight)
                denominator += weight

        return (numerator / denominator) if denominator > 0 else 0.0

    def evaluate_candidate(self, features: CandidateFeatures, user_weights: Dict[str, float]) -> dict:
        """
        The main pipeline: Formats data, predicts RF probability, calculates SHAP,
        evaluates User Score, and checks the Risk Boundary.
        """
        # Prepare strict array
        X_matrix = self._prepare_feature_array(features)

        # Baseline model score
        rf_score = float(self.model.predict_proba(X_matrix)[0][1])  # want class 1 from return

        # Exact SHAP Attributions via TreeExplainer
        shap_matrix = self.explainer.shap_values(X_matrix)

        # Handle different SHAP return formats
        if isinstance(shap_matrix, list):
            candidate_shap_vals = shap_matrix[1][0]
        else:
            # In case it's a binary classifier
            candidate_shap_vals = shap_matrix[0] if len(shap_matrix.shape) == 2 else shap_matrix[..., 1][0]

        # Zip the SHAP values with the feature names so the LLM can understand them
        shap_dict = {
            self.feature_columns[i]: float(candidate_shap_vals[i])
            for i in range(len(self.feature_columns))
            if candidate_shap_vals[i] != 0.0  # filter out 0s
        }

        # Weighted User Score
        user_score = self.calculate_user_score(features, user_weights)

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
