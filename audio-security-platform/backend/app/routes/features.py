from fastapi import APIRouter, HTTPException, Body
from app.services.feature_extraction import extract_audio_features

router = APIRouter()


@router.post("/extract-features")
def extract_features(payload: dict = Body(...)):
    try:
        wav_path = payload["wav_path"]
        feature_sample_rate = int(payload.get("feature_sample_rate", 22050))
        features = extract_audio_features(wav_path, sr=feature_sample_rate)
        return {
            "message": "Features extracted successfully",
            "features": features
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))