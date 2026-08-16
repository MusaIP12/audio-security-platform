import csv
import json
from typing import Any, Dict
from app.utils.file_helpers import build_output_path


def _normalize_features(features: Dict[str, Any]) -> Dict[str, Any]:
    normalized = {}

    for key, value in features.items():
        if hasattr(value, "tolist"):
            normalized[key] = value.tolist()
        elif isinstance(value, tuple):
            normalized[key] = list(value)
        else:
            normalized[key] = value

    return normalized


def save_features_to_csv(features: Dict[str, Any], original_filename: str) -> str:
    """
    Expanded CSV:
    filename, mfcc_1, mfcc_2, ..., zcr, spectral_centroid, ...
    """
    features = _normalize_features(features)

    csv_path = build_output_path(original_filename, extension=".csv", subfolder="features")

    row = {"filename": original_filename}

    for feature_name, feature_values in features.items():
        if isinstance(feature_values, list):
            for idx, value in enumerate(feature_values, start=1):
                row[f"{feature_name.lower()}_{idx}"] = value
        else:
            row[feature_name.lower()] = feature_values

    fieldnames = list(row.keys())

    with open(csv_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerow(row)

    return csv_path


def save_features_to_array_csv(features: Dict[str, Any], original_filename: str) -> str:
    """
    Array CSV:
    filename, mfcc, zcr, spectral_centroid, ...
    where each feature value is saved like:
    "[1.2, 2.3, 3.4]"
    """
    features = _normalize_features(features)

    csv_path = build_output_path(
        original_filename,
        extension=".csv",
        subfolder="features",
        suffix="_array",
    )

    row = {"filename": original_filename}

    for feature_name, feature_values in features.items():
        if isinstance(feature_values, list):
            row[feature_name.lower()] = json.dumps(feature_values)
        else:
            row[feature_name.lower()] = json.dumps([feature_values])

    fieldnames = list(row.keys())

    with open(csv_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerow(row)

    return csv_path