import numpy as np
import librosa


ORDERED_FEATURE_KEYS = [
    "mfcc",
    "zcr",
    "centroid",
    "contrast",
    "bandwidth",
    "flatness",
    "rolloff",
    "rms",
    "chroma_stft",
    "chroma_cens",
    "chroma_cqt",
    "mel",
    "poly"
]

def extract_audio_features(
    file_path: str,
    sr: int = 22050,
    mfcc_count: int = 40,
) -> dict:

    y, sr = librosa.load(file_path, sr=sr)

    if y is None or len(y) == 0 or np.max(np.abs(y)) < 1e-5:
        raise ValueError("Empty or silent audio")

    features = {}

    features["mfcc"] = np.mean(
        librosa.feature.mfcc(y=y, sr=sr, n_mfcc=mfcc_count).T, axis=0
    )

    features["zcr"] = np.mean(
        librosa.feature.zero_crossing_rate(y=y).T, axis=0
    )

    features["centroid"] = np.mean(
        librosa.feature.spectral_centroid(y=y, sr=sr).T, axis=0
    )

    features["contrast"] = np.mean(
        librosa.feature.spectral_contrast(y=y, sr=sr).T, axis=0
    )

    features["bandwidth"] = np.mean(
        librosa.feature.spectral_bandwidth(y=y, sr=sr).T, axis=0
    )

    features["flatness"] = np.mean(
        librosa.feature.spectral_flatness(y=y).T, axis=0
    )

    features["rolloff"] = np.mean(
        librosa.feature.spectral_rolloff(y=y, sr=sr).T, axis=0
    )

    features["rms"] = np.mean(
        librosa.feature.rms(y=y).T, axis=0
    )

    features["chroma_stft"] = np.mean(
        librosa.feature.chroma_stft(y=y, sr=sr).T, axis=0
    )

    features["chroma_cens"] = np.mean(
        librosa.feature.chroma_cens(y=y, sr=sr).T, axis=0
    )

    features["chroma_cqt"] = np.mean(
        librosa.feature.chroma_cqt(y=y, sr=sr).T, axis=0
    )

    features["mel"] = np.mean(
        librosa.feature.melspectrogram(y=y, sr=sr).T, axis=0
    )

    features["poly"] = np.mean(
        librosa.feature.poly_features(y=y, sr=sr).T, axis=0
    )

    return features


def flatten_feature_dict(feature_dict: dict) -> np.ndarray:
    """
    Flatten features in EXACT training order
    """

    vector = []

    for key in ORDERED_FEATURE_KEYS:
        if key not in feature_dict:
            raise ValueError(f"Missing feature: {key}")
        vector.extend(feature_dict[key])

    return np.array(vector, dtype=float)