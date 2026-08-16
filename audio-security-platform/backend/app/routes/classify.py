from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from app.utils.file_helpers import save_uploaded_file, build_output_path
from app.services.image_audio import image_to_wav
from app.services.elf_audio import elf_to_wav_sine
from app.services.apk_audio import convert_apk_to_audio
from app.services.feature_extraction import extract_audio_features, flatten_feature_dict
from app.services.csv_export import save_features_to_csv
from app.services.model_loader import predict_with_model

router = APIRouter()


@router.post("/classify-upload")
async def classify_upload(
    module: str = Form(...),
    input_type: str = Form(...),
    file: UploadFile = File(...),
):
    try:
        fixed_sample_rate = 16000
        fixed_duration = 10.0
        fixed_feature_sr = 22050
        fixed_mfcc_count = 40
        #all_features = [
            #"mfcc", "zcr", "centroid", "contrast",
            #"bandwidth", "flatness", "rolloff",
            #"rms", "chroma_stft", "chroma_cens", "chroma_cqt",
            #"mel", "poly"
        #]

        input_path = save_uploaded_file(file)
        output_path = build_output_path(file.filename, extension=".wav")

        if input_type == "image":
            image_to_wav(
                image_path=input_path,
                output_wav_path=output_path,
                sample_rate=fixed_sample_rate,
                duration=fixed_duration,
            )
        elif input_type == "elf":
            elf_to_wav_sine(
                elf_path=input_path,
                wav_path=output_path,
                sample_rate=fixed_sample_rate,
                duration=fixed_duration,
            )
        elif input_type == "apk":
            convert_apk_to_audio(
                apk_path=input_path,
                out_path=output_path,
                sample_rate=fixed_sample_rate,
                target_duration_sec=int(fixed_duration),
            )
        elif input_type == "audio":
            output_path = input_path
        else:
            raise HTTPException(status_code=400, detail="Unsupported input type")

        features = extract_audio_features(
            output_path,
            sr=fixed_feature_sr,
            mfcc_count=fixed_mfcc_count,
        )
        csv_path = save_features_to_csv(features, file.filename)
        vector = flatten_feature_dict(features)
        prediction = predict_with_model(module, vector)

        return {
            "message": "Classification completed",
            "module": module,
            "output_wav": output_path,
            "feature_csv": csv_path,
            "prediction": prediction,
            "features": {k: v.tolist() for k, v in features.items()},
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))