import zipfile
import numpy as np
import soundfile as sf


def convert_apk_to_audio(
    apk_path: str,
    out_path: str,
    sample_rate: int = 16000,
    target_duration_sec: int = 10,
    target_files=None,
) -> None:
    if target_files is None:
        target_files = ["classes.dex", "AndroidManifest.xml", "resources.arsc"]

    target_samples = sample_rate * target_duration_sec

    with zipfile.ZipFile(apk_path, "r") as archive:
        for zinfo in archive.infolist():
            if zinfo.filename in target_files and (zinfo.flag_bits & 0x1):
                raise ValueError(f"Encrypted component: {zinfo.filename}")

        binary_chunks = []
        missing = []

        for tf in target_files:
            try:
                raw = archive.read(tf)
                binary_chunks.append(raw)
            except KeyError:
                missing.append(tf)

        if missing:
            raise ValueError(f"Missing components: {', '.join(missing)}")

        combined = b"".join(binary_chunks)
        audio_data = np.frombuffer(combined, dtype=np.uint8).astype(np.float32)
        audio_data = (audio_data - 128) / 128.0

        if len(audio_data) > target_samples:
            audio_data = audio_data[:target_samples]
        else:
            padding = np.zeros(target_samples - len(audio_data), dtype=np.float32)
            audio_data = np.concatenate([audio_data, padding])

        sf.write(out_path, audio_data, samplerate=sample_rate)