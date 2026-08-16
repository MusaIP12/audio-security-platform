import shutil
import uuid
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[2]
UPLOAD_DIR = BASE_DIR / "app" / "uploads"
OUTPUT_DIR = BASE_DIR / "app" / "outputs"
MODEL_DIR = BASE_DIR / "app" / "models"

UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
MODEL_DIR.mkdir(parents=True, exist_ok=True)


def save_uploaded_file(file_obj, subfolder: str = "raw") -> str:
    folder = UPLOAD_DIR / subfolder
    folder.mkdir(parents=True, exist_ok=True)

    unique_name = f"{uuid.uuid4().hex}_{file_obj.filename}"
    destination = folder / unique_name

    with open(destination, "wb") as buffer:
        shutil.copyfileobj(file_obj.file, buffer)

    return str(destination)


def build_output_path(original_name: str, extension: str, subfolder: str = "converted") -> str:
    folder = OUTPUT_DIR / subfolder
    folder.mkdir(parents=True, exist_ok=True)

    stem = Path(original_name).stem
    out_name = f"{stem}_{uuid.uuid4().hex[:8]}{extension}"
    return str(folder / out_name)