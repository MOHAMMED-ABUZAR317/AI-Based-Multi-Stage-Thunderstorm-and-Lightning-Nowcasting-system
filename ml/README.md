# Member 3: Machine Learning Lightning Prediction Engine

## Architecture Overview
The Member 3 machine learning model uses an **XGBoost Classifier** paired with **atmospheric mixed-phase microphysical heuristics** to predict thunderstorm lightning strike probabilities for the Hyderabad metropolitan area across three operational nowcasting horizons:
- **15-minute lead time**
- **30-minute lead time** (primary operational window)
- **60-minute lead time**

## Training Pipeline
The training script [`train.py`](train.py) processes extracted INSAT-3DR satellite observations from `data_pipeline/hyderabad_extracted_data.csv`:
1. **Feature Engineering**:
   - `Cloud_Top_Temp_K`: Geostationary infrared brightness temperature (Kelvin)
   - `Cloud_Top_Pressure_hPa`: Cloud top altitude barometric pressure
   - `CTT_Drop_30min`: 30-minute cloud-top cooling rate (surrogate for convective updraft velocity)
2. **Ground Truth Simulation**:
   - Correlates deep glaciation ($CTT < 295\text{ K}$) and negative temperature change ($dT/dt < 0$) with electrification.
3. **Model Configuration**:
   - Algorithm: `xgboost.XGBClassifier`
   - Estimators: 50, Max Depth: 3, Learning Rate: 0.1, Objective: `binary:logistic`.
4. **Serialization**:
   - Model weights are exported to `ml/model_registry/lightning_xgb_model.json` and automatically synchronized with `backend/src/lightning_prediction/model_registry/lightning_xgb_model.json`.

## Execution
```bash
python ml/train.py
```
