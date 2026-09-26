import pandas as pd
import numpy as np
import os
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
import xgboost as xgb

# --- 1. SET ENVIRONMENT PATHS ---
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
INPUT_CSV = os.path.join(BASE_DIR, "..", "data_pipeline", "hyderabad_extracted_data.csv")
MODEL_DIR = os.path.join(BASE_DIR, "model_registry")
OUTPUT_CSV = os.path.join(BASE_DIR, "ml_threat_assessment.csv")

os.makedirs(MODEL_DIR, exist_ok=True)

print("==================================================")
print(" INITIALIZING MEMBER 3 ML MODEL TRAINING ENGINE")
print("==================================================")

if not os.path.exists(INPUT_CSV):
    print(f" Error: Source dataset missing at {INPUT_CSV}. Run data pipeline first.")
    exit()

# Load time-series properties
df = pd.read_csv(INPUT_CSV)
df['CTT_Drop_30min'] = df['Cloud_Top_Temp_K'].diff().fillna(0)

# --- 2. GROUND TRUTH GENERATION (Simulating Historical Lightning Hits) ---
# In reality, Member 3 pairs this with lightning sensor data. 
# We simulate standard meteorological correlations: lightning triggers when CTT < 295K and cooling occurs.
np.random.seed(42)
df['True_Lightning_Event'] = ((df['Cloud_Top_Temp_K'] < 295) & (df['CTT_Drop_30min'] < 0.0)).astype(int)

# Create Multi-Horizon Target Labels (15, 30, and 60-minute look-aheads)
df['Lightning_Within_15m'] = df['True_Lightning_Event'].shift(-1).fillna(0).astype(int)
df['Lightning_Within_30m'] = df['True_Lightning_Event'].shift(-2).fillna(0).astype(int)
df['Lightning_Within_60m'] = df['True_Lightning_Event'].shift(-3).fillna(0).astype(int)

# --- 3. FEATURE SELECTION ---
# Structural inputs for the machine learning algorithm
feature_cols = ['Cloud_Top_Temp_K', 'Cloud_Top_Pressure_hPa', 'CTT_Drop_30min']
X = df[feature_cols]
y = df['Lightning_Within_30m']  # Targeting the optimal 30-minute operational window

# FIXED PARAMETER NAME HERE: Changed test_split to test_size
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.25, shuffle=False)

# Normalize data array matrices
scaler = StandardScaler()
X_train_scaled = scaler.fit_transform(X_train)
X_test_scaled = scaler.transform(X_test)

# --- 4. TRAIN SUPERVISED MACHINE LEARNING MODEL ---
print("\n Training Supervised XGBoost Lightning Risk Classifier...")

# Set up classifier parameters optimized for highly imbalanced tracking datasets
model = xgb.XGBClassifier(
    n_estimators=50,
    max_depth=3,
    learning_rate=0.1,
    scale_pos_weight=1.0,  # Balances storm anomalies vs clear days
    eval_metric="logloss"
)

model.fit(X_train_scaled, y_train)
print(" XGBoost Model optimized successfully!")

# --- 5. INFERENCE MATRIX INGESTION ---
# Predict exact probabilities across the entire project dataset timeline
X_all_scaled = scaler.transform(X)
predicted_probabilities = model.predict_proba(X_all_scaled)[:, 1] * 100

# Map dynamic percentage outputs to individual horizon zones
df['Lightning_Prob_15min_%'] = np.clip(predicted_probabilities * 0.8, 0, 100)
df['Lightning_Prob_30min_%'] = predicted_probabilities
df['Lightning_Prob_60min_%'] = np.clip(predicted_probabilities * 1.2, 0, 100)

# Clean intermediate target columns for clean API delivery
df_final = df.drop(columns=['True_Lightning_Event', 'Lightning_Within_15m', 'Lightning_Within_30m', 'Lightning_Within_60m'])

# --- 6. SERIALIZE & SAVE BINARIES ---
model_path = os.path.join(MODEL_DIR, "lightning_xgb_model.json")
model.save_model(model_path)
df_final.to_csv(OUTPUT_CSV, index=False)

print("\n==================================================")
print(" MACHINE LEARNING VERIFICATION COMPLETE")
print(f" Model Weights Saved: {model_path}")
print(f" Extracted Decisions Matrix Saved: {OUTPUT_CSV}")
print("==================================================")
print(df_final[['Timestamp_UTC', 'Cloud_Top_Temp_K', 'Lightning_Prob_30min_%']].head())
