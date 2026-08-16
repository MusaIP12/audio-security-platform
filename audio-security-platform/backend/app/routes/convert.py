from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from app.utils.file_helpers import save_uploaded_file, build_output_path
from app.services.image_audio import image_to_wav
from app.services.elf_audio import elf_to_wav_sine
from app.services.apk_audio import convert_apk_to_audio
from app.services.feature_extraction import (
    extract_audio_features,
    flatten_feature_dict
)
from app.services.csv_export import save_features_to_csv
from app.services.model_loader import predict_with_model

router = APIRouter()


@router.post("/convert")
async def convert_file(
    module: str = Form(...),
    input_type: str = Form(...),
    sample_rate: int = Form(16000),
    target_duration_sec: float = Form(10.0),
    feature_sample_rate: int = Form(22050),
    mfcc_count: int = Form(40),
    file: UploadFile = File(...),
):
    try:
        input_path = save_uploaded_file(file)
        output_path = build_output_path(file.filename, extension=".wav")

        # ----------------------------
        # CONVERSION
        # ----------------------------
        if input_type == "image":
            image_to_wav(input_path, output_path, sample_rate, target_duration_sec)

        elif input_type == "elf":
            elf_to_wav_sine(input_path, output_path, sample_rate, target_duration_sec)

        elif input_type == "apk":
            convert_apk_to_audio(input_path, output_path, sample_rate, target_duration_sec)

        elif input_type == "audio":
            output_path = input_path

        else:
            raise HTTPException(status_code=400, detail="Unsupported input type")

        # ----------------------------
        # FEATURE EXTRACTION
        # ----------------------------
        features = extract_audio_features(
            output_path,
            sr=feature_sample_rate,
            mfcc_count=mfcc_count,
        )

        # ----------------------------
        # CSV EXPORT
        # ----------------------------
        csv_path = save_features_to_csv(features, file.filename)

        # ----------------------------
        # FLATTEN (FIXED ORDER)
        # ----------------------------
        feature_vector = flatten_feature_dict(features)

        # ----------------------------
        # CLASSIFICATION
        # ----------------------------
        prediction = predict_with_model(module, feature_vector)

        return {
            "message": "Success",
            "output_wav": output_path,
            "feature_csv": csv_path,
            "prediction": prediction
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))