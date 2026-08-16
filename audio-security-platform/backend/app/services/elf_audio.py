import wave
import struct
import numpy as np


def elf_to_wav_sine(
    elf_path: str,
    wav_path: str,
    sample_rate: int = 44100,
    duration: float = 3.0,
    frequency_scaling_factor: float = 1000.0,
) -> None:
    total_samples = int(sample_rate * duration)
    max_bytes = total_samples

    with open(elf_path, "rb") as f:
        byte_data = f.read(max_bytes)

    if not byte_data:
        raise ValueError("Empty ELF file")

    with wave.open(wav_path, "w") as wav_file:
        wav_file.setnchannels(1)
        wav_file.setsampwidth(2)
        wav_file.setframerate(sample_rate)

        for i in range(total_samples):
            x = byte_data[i % len(byte_data)]
            value = int(32767.0 * np.sin(x / frequency_scaling_factor))
            data = struct.pack("<h", value)
            wav_file.writeframesraw(data)

        wav_file.writeframes(b"")