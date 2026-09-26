from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
import os

app = FastAPI(title="⚡ AI Thunderstorm & Lightning Nowcasting API")

# Enable Cross-Origin Resource Sharing (CORS) so your Frontend Dashboard can connect seamlessly
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Core Pathing: Point explicitly to Member 3's output spreadsheet inside the ml folder
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CSV_PATH = os.path.join(BASE_DIR, "..", "..", "ml", "ml_threat_assessment.csv")

@app.get("/")
def read_root():
    return {"status": "online", "system": "Multi-Stage Nowcasting System Engine"}

@app.get("/api/v1/nowcast/live")
def get_live_nowcast():
    """
    Exposes the trained XGBoost lightning hazard probabilities across 
    15, 30, and 60-minute windows for the frontend GIS maps.
    """
    if not os.path.exists(CSV_PATH):
        raise HTTPException(
            status_code=404, 
            detail="ML Threat assessment dataset not found. Run ml/train.py first."
        )
    
    try:
        # Load your optimized ML spreadsheet data array
        df = pd.read_csv(CSV_PATH)
        df = df.fillna(0)  # Safe clean for JSON transmission
        
        payload = df.to_dict(orient="records")
        
        return {
            "status": "success",
            "region_target": "Hyderabad",
            "total_frames": len(payload),
            "data_stream": payload
        }
    except Exception as e:
        raise HTTPException(
            status_code=500, 
            detail=f"Internal Server Data Extraction Error: {str(e)}"
        )
