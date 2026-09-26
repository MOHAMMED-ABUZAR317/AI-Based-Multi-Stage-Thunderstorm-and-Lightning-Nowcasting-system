import h5py
import numpy as np
import pandas as pd
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
RAW_DIR = os.path.join(BASE_DIR, "raw_insat")
OUTPUT_CSV = os.path.join(BASE_DIR, "hyderabad_extracted_data.csv")

TARGET_LAT = 17.38
TARGET_LON = 78.48

print("Scanning folder for downloaded satellite files...")

records = []
if not os.path.exists(RAW_DIR) or len(os.listdir(RAW_DIR)) == 0:
    print(f"Error: Target directory is empty at {RAW_DIR}")
    exit()

files = sorted([f for f in os.listdir(RAW_DIR) if f.endswith(('.h5', '.hdf'))])

for file in files:
    try:
        file_path = os.path.join(RAW_DIR, file)
        with h5py.File(file_path, 'r') as f:
            lats = f['Latitude'][:] / 100.0
            lons = f['Longitude'][:] / 100.0
            ctt_matrix = f['CTT'][0, :, :]
            ctp_matrix = f['CTP'][0, :, :]
            
            # Create a distance matrix map from Hyderabad
            distance_grid = np.abs(lats - TARGET_LAT) + np.abs(lons - TARGET_LON)
            
            # Flatten the grids to loop through the closest pixel coordinates
            sorted_indices = np.argsort(distance_grid.flatten())
            
            hyderabad_ctt = -999.0
            hyderabad_ctp = -999.0
            
            # Loop through the closest pixels until we hit a real, non-empty coordinate reading
            for flat_idx in sorted_indices:
                row_idx, col_idx = np.unravel_index(flat_idx, distance_grid.shape)
                val_ctt = float(ctt_matrix[row_idx, col_idx])
                val_ctp = float(ctp_matrix[row_idx, col_idx])
                
                # Check that the data point is valid and not a -999 placeholder flag
                if val_ctt > 0 and val_ctt != -999.0:
                    hyderabad_ctt = val_ctt
                    hyderabad_ctp = val_ctp
                    break
            
            timestamp = f.attrs.get('Acquisition_Start_Time', b'Unknown').decode('utf-8')
            
            records.append({
                "Timestamp_UTC": timestamp,
                "File_Name": file,
                "Cloud_Top_Temp_K": hyderabad_ctt,
                "Cloud_Top_Pressure_hPa": hyderabad_ctp
            })
            print(f" Processed {file} -> Valid CTT Found: {hyderabad_ctt} K")
            
    except Exception as e:
        print(f" Error processing file {file}: {e}")

if records:
    df = pd.DataFrame(records)
    df.to_csv(OUTPUT_CSV, index=False)
    print(f"\n SUCCESS: Clean dataset matrix generated at: {OUTPUT_CSV}")
