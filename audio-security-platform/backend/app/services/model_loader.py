import joblib
import numpy as np
from app.utils.file_helpers import MODEL_DIR


def load_model_bundle(module_name: str):
    """
    Load full trained pipeline (model + scaler + label encoder)
    """
    model_path = MODEL_DIR / f"{module_name}.pkl"

    if not model_path.exists():
        return None

    return joblib.load(model_path)


def predict_with_model(module_name: str, feature_vector: np.ndarray):
    bundle = load_model_bundle(module_name)

    if bundle is None:
        return {
            "label": "Model not found",
            "confidence": None,
            "status": "no_model"
        }

    try:
        model = bundle["model"]
        scaler = bundle["scaler"]
        label_encoder = bundle["label_encoder"]

        # Ensure correct shape
        if feature_vector.ndim == 1:
            feature_vector = feature_vector.reshape(1, -1)

        # 🔥 DEBUG (KEEP THIS FOR NOW)
        print("Expected:", model.n_features_in_)
        print("Got:", feature_vector.shape[1])

        if feature_vector.shape[1] != model.n_features_in_:
            raise ValueError("Feature size mismatch")

        # ✅ SCALE (CRITICAL)
        scaled = scaler.transform(feature_vector)

        # ✅ PREDICT
        pred = model.predict(scaled)
        proba = model.predict_proba(scaled)

        # ✅ DECODE LABEL
        #label = label_encoder.inverse_transform(pred)[0]
        confidence = float(np.max(proba))

        #print("Classes:", label_encoder.classes_)
        #print("Raw prediction:", pred)
        #print("Decoded label:", label)

        classes = label_encoder.classes_
        pred_index = int(pred[0])

        print("Classes:", classes)
        print("Pred index:", pred_index)

        label = classes[pred_index]

        #return {
            #"label": label,
            #"confidence": confidence,
            #"status": "ok"
        #}

        return {

          "label": label,
          "confidence": confidence,
          "status": "ok",
          "debug": {
             "classes": classes.tolist(),
             "pred_index": pred_index,
             "proba": proba.tolist()
          }
        }

    except Exception as e:
        return {
            "label": "error",
            "confidence": None,
            "status": f"prediction_failed: {str(e)}"
        }

