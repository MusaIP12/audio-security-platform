import wave
import struct
import numpy as np
from PIL import Image


def image_to_wav(
    image_path: str,
    output_wav_path: str,
    sample_rate: int = 44100,
    duration: float = 3.0,
    frequency_scaling_factor: float = 1000.0,
) -> None:
    img = np.array(Image.open(image_path).convert("L"))
    height, width = img.shape

    num_frames = int(sample_rate * duration)

    with wave.open(output_wav_path, "w") as wav_file:
        wav_file.setparams((1, 2, sample_rate, num_frames, "NONE", "not compressed"))

        for i in range(num_frames):
            x = int(img[i % height, i % width])
            value = int(32767.0 * np.sin(x / frequency_scaling_factor))
            data = struct.pack("<h", value)
            wav_file.writeframesraw(data)