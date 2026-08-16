import csv
import json
from typing import Any, Dict


def normalize_features(features: Dict[str, Any]) -> Dict[str, Any]:
    normalized: Dict[str, Any] = {}

    for key, value in features.items():
        if hasattr(value, "tolist"):
            normalized[key] = value.tolist()
        elif isinstance(value, tuple):
            normalized[key] = list(value)
        else:
            normalized[key] = value

    return normalized


def save_features_expanded_csv(
    features: Dict[str, Any],
    output_csv_path: str,
    original_filename: str,
) -> str:
    normalized = normalize_features(features)

    row: Dict[str, Any] = {"filename": original_filename}

    for feature_name, feature_values in normalized.items():
        if isinstance(feature_values, list):
          # one column per coefficient/value
            for index, value in enumerate(feature_values, start=1):
                row[f"{feature_name.lower()}_{index}"] = value
        else:
            row[feature_name.lower()] = feature_values

    fieldnames = list(row.keys())

    with open(output_csv_path, "w", newline="", encoding="utf-8") as file:
        writer = csv.DictWriter(file, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerow(row)

    return output_csv_path


def save_features_array_csv(
    features: Dict[str, Any],
    output_csv_path: str,
    original_filename: str,
) -> str:
    normalized = normalize_features(features)

    row: Dict[str, Any] = {"filename": original_filename}

    for feature_name, feature_values in normalized.items():
        if isinstance(feature_values, list):
            row[feature_name.lower()] = json.dumps(feature_values)
        else:
            row[feature_name.lower()] = json.dumps([feature_values])

    fieldnames = list(row.keys())

    with open(output_csv_path, "w", newline="", encoding="utf-8") as file:
        writer = csv.DictWriter(file, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerow(row)

    return output_csv_path