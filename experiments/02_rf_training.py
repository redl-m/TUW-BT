import json
import logging
import joblib
import pandas as pd
from pathlib import Path
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

# Logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s: %(message)s')

def load_and_flatten_data(input_file: Path) -> pd.DataFrame:
    """Loads JSONL data."""
    logging.info(f"Loading augmented data from {input_file}...")
    records = []
    
    with open(input_file, 'r', encoding='utf-8') as f:
        for line in f:
            data = json.loads(line)
            features = data.get("extracted_features", {})
            
            if not features:
                continue 
                
            # Direct mapping
            flat_record = {
                "file_id": data.get("file_id"),
                "target_score": data.get("target_score"),
                
                "years_of_experience": features.get("years_of_experience", 0),
                "education_level": features.get("education", "None"),
                
                "structural_adherence": features.get("structural_adherence", 0),
                "adaptive_fluidity": features.get("adaptive_fluidity", 0),
                "interpersonal_influence": features.get("interpersonal_influence", 0),
                "execution_velocity": features.get("execution_velocity", 0),
                "psychological_resilience": features.get("psychological_resilience", 0)
            }
            
            records.append(flat_record)
            
    df = pd.DataFrame(records)
    logging.info(f"Successfully loaded {len(df)} complete records.")
    return df

def preprocess_features(df: pd.DataFrame) -> tuple[pd.DataFrame, pd.Series]:
    """Applies Structural Omission and robust Ordinal Encoding."""
    logging.info("Preprocessing features and handling missing data...")
    
    # Target Variable Definition: Regression (Capped 0-100)
    df['target_score_pct'] = (df['target_score'] / 5.0) * 100
    df['target_score_pct'] = df['target_score_pct'].clip(lower=0.0, upper=100.0)
    y = df['target_score_pct']
    
    # Numerical & Soft Skills
    num_cols = [
        'years_of_experience', 'structural_adherence', 'adaptive_fluidity', 
        'interpersonal_influence', 'execution_velocity', 'psychological_resilience'
    ]
    for col in num_cols:
        df[col] = pd.to_numeric(df[col], errors='coerce').fillna(0).astype(float)
        
    # Robust Ordinal Encoding for Education
    def map_education(edu_str):
        edu_str = str(edu_str).lower()
        if any(x in edu_str for x in ['phd', 'doctor']): return 4.0
        if any(x in edu_str for x in ['master', 'mba', 'm.tech', 'm.sc', 'ms']): return 3.0
        if any(x in edu_str for x in ['bachelor', 'b.com', 'b.sc', 'bs', 'b.a', 'ba', 'b.tech']): return 2.0
        if any(x in edu_str for x in ['high', 'fa', 'fsc', 'diploma']): return 1.0
        return 0.0 # None or unknown

    df['education_level'] = df['education_level'].apply(map_education)
    
    # Assemble final strict 7-feature matrix
    X = df[['years_of_experience', 'education_level'] + num_cols[1:]]
    
    return X, y

def train_and_evaluate_model():
    base_dir = Path("../")
    input_file = base_dir / "data" / "training" / "augmented_training_data.jsonl"
    model_dir = base_dir / "saved_models"
    
    # Ensure save directory exists
    model_dir.mkdir(parents=True, exist_ok=True)
    
    # Load and prep
    raw_df = load_and_flatten_data(input_file)
    X, y = preprocess_features(raw_df)
    
    logging.info(f"Feature matrix shape: {X.shape}")
    
    # Split into train/test sets for validation (80/20 split)
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    
    # Initialize and train the Random Forest Regressor
    logging.info("Training Random Forest Regressor...")
    rf_model = RandomForestRegressor(n_estimators=100, max_depth=10, random_state=42, n_jobs=-1)
    rf_model.fit(X_train, y_train)
    
    # Evaluation using Regression Metrics
    logging.info("Evaluating model performance...")
    y_pred = rf_model.predict(X_test)
    
    logging.info(f"\nMean Absolute Error (MAE): {mean_absolute_error(y_test, y_pred):.2f} percentage points")
    logging.info(f"Mean Squared Error (MSE): {mean_squared_error(y_test, y_pred):.2f}")
    logging.info(f"R-squared (R2): {r2_score(y_test, y_pred):.4f}")
    
    # Save the model and feature names
    model_path = model_dir / "rf_model.pkl"
    features_path = base_dir / "data" / "training" / "feature_names.json"
    
    # Save X_test for SHAP analysis
    test_data_path = base_dir / "data" / "training" / "training_features.csv"
    X_test.to_csv(test_data_path, index=False)
    
    joblib.dump(rf_model, model_path)
    with open(features_path, 'w') as f:
        json.dump(list(X.columns), f)
        
    logging.info(f"Model successfully saved to {model_path}")
    logging.info(f"Feature names saved to {features_path}")

if __name__ == "__main__":
    train_and_evaluate_model()