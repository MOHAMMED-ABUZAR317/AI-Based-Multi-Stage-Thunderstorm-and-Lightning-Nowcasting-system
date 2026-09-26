import h5py
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
RAW_DIR = os.path.join(BASE_DIR, "raw_insat")

# Pick the first available file from your downloaded collection
files = [f for f in os.listdir(RAW_DIR) if f.endswith(('.h5', '.hdf'))]

if not files:
    print(" No satellite data files found in your data_pipeline/raw_insat folder.")
    exit()

sample_file = os.path.join(RAW_DIR, files[0])
print(f" Opening database sample file entry: {files[0]}\n")

with h5py.File(sample_file, 'r') as f:
    print("---  Root System Data Arrays & Matrices ---")
    for key in f.keys():
        try:
            shape = f[key].shape
            print(f" Matrix Key: '{key}' | Shape Dimension: {shape} | Data Type: {f[key].dtype}")
        except AttributeError:
            print(f" Group/Meta Key: '{key}' (Contains nested sub-datasets)")

    print("\n---  Checking Internal File Metadata Attributes ---")
    for attr_name in f.attrs.keys():
        print(f" Attribute: {attr_name} = {f.attrs[attr_name]}")
