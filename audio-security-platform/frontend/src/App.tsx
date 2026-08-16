import React, { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import { buildDownloadUrl, classifyUpload, convertFile } from "./api";

type FeatureOption = {
  key: string;
  label: string;
  configurable?: boolean;
  configFields?: {
    key: string;
    label: string;
    type?: "number";
    min?: number;
    max?: number;
    step?: number;
  }[];
};

const featureOptions: FeatureOption[] = [
  {
    key: "MFCC",
    label: "MFCC",
    configurable: true,
    configFields: [{ key: "n_mfcc", label: "MFCC Coefficients", type: "number", min: 1, max: 200 }],
  },
  { key: "ZCR", label: "Zero Crossing Rate (ZCR)" },
  { key: "Spectral_Centroid", label: "Spectral Centroid" },
  {
    key: "Spectral_Contrast",
    label: "Spectral Contrast",
    configurable: true,
    configFields: [{ key: "n_bands", label: "Contrast Bands", type: "number", min: 1, max: 12 }],
  },
  { key: "Spectral_Bandwidth", label: "Spectral Bandwidth" },
  { key: "Spectral_Flatness", label: "Spectral Flatness" },
  { key: "Spectral_Rolloff", label: "Spectral Rolloff" },
  { key: "RMS", label: "Root Mean Square (RMS)" },
  {
    key: "Chroma_STFT",
    label: "Chroma STFT",
    configurable: true,
    configFields: [{ key: "n_chroma", label: "Chroma Bins", type: "number", min: 1, max: 24 }],
  },
  {
    key: "Chroma_CENS",
    label: "Chroma CENS",
    configurable: true,
    configFields: [{ key: "n_chroma", label: "Chroma Bins", type: "number", min: 1, max: 24 }],
  },
  {
    key: "Chroma_CQT",
    label: "Chroma CQT",
    configurable: true,
    configFields: [{ key: "n_chroma", label: "Chroma Bins", type: "number", min: 1, max: 24 }],
  },
  {
    key: "Mel_Spectrogram",
    label: "Mel Spectrogram",
    configurable: true,
    configFields: [{ key: "n_mels", label: "Mel Bands", type: "number", min: 8, max: 512 }],
  },
  {
    key: "Poly_Features",
    label: "Poly Features",
    configurable: true,
    configFields: [{ key: "order", label: "Polynomial Order", type: "number", min: 1, max: 10 }],
  },
];

const defaultFeatureParams: Record<string, Record<string, string>> = {
  MFCC: { n_mfcc: "40" },
  Spectral_Contrast: { n_bands: "6" },
  Chroma_STFT: { n_chroma: "12" },
  Chroma_CENS: { n_chroma: "12" },
  Chroma_CQT: { n_chroma: "12" },
  Mel_Spectrogram: { n_mels: "128" },
  Poly_Features: { order: "2" },
};

function App() {
  const [page, setPage] = useState("home");
  const [mode, setMode] = useState("convert");
  const [module, setModule] = useState("iot");
  const [inputType, setInputType] = useState("image");

  const [singleFile, setSingleFile] = useState<File | null>(null);
  const [batchFiles, setBatchFiles] = useState<File[]>([]);

  const [sampleRate, setSampleRate] = useState("16000");
  const [targetDurationSec, setTargetDurationSec] = useState("10");
  const [featureSampleRate, setFeatureSampleRate] = useState("22050");

  const [selectedFeatures, setSelectedFeatures] = useState<string[]>(
    featureOptions.map((feature) => feature.key)
  );

  const [featureParams, setFeatureParams] =
    useState<Record<string, Record<string, string>>>(defaultFeatureParams);

  const [status, setStatus] = useState("Ready");
  const [elapsedTime, setElapsedTime] = useState("");
  const [result, setResult] = useState<any>(null);
  const [featureHistory, setFeatureHistory] = useState<any[]>([]);

  const [menuOpen, setMenuOpen] = useState(false);
  const [showFeatureTypes, setShowFeatureTypes] = useState(false);
  const [showFeatureParams, setShowFeatureParams] = useState(false);

  const folderInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (folderInputRef.current) {
      folderInputRef.current.setAttribute("webkitdirectory", "");
      folderInputRef.current.setAttribute("directory", "");
    }
  }, []);

  const hasFiles = useMemo(
    () => singleFile !== null || batchFiles.length > 0,
    [singleFile, batchFiles]
  );

  const toggleFeature = (key: string) => {
    setSelectedFeatures((prev) =>
      prev.includes(key) ? prev.filter((x) => x !== key) : [...prev, key]
    );
  };

  const updateFeatureParam = (featureKey: string, paramKey: string, value: string) => {
    setFeatureParams((prev) => ({
      ...prev,
      [featureKey]: {
        ...(prev[featureKey] || {}),
        [paramKey]: value,
      },
    }));
  };

  const buildFeatureConfigPayload = () => {
    const payload: Record<string, Record<string, number>> = {};

    for (const feature of featureOptions) {
      if (!selectedFeatures.includes(feature.key)) continue;
      if (!feature.configurable || !feature.configFields) continue;

      payload[feature.key] = {};
      for (const field of feature.configFields) {
        const rawValue = featureParams?.[feature.key]?.[field.key];
        if (rawValue !== undefined && rawValue !== "") {
          payload[feature.key][field.key] = Number(rawValue);
        }
      }
    }

    return payload;
  };

  const appendSharedConvertFields = (formData: FormData, file: File) => {
    formData.append("module", module);
    formData.append("input_type", inputType);
    formData.append("sample_rate", sampleRate);
    formData.append("target_duration_sec", targetDurationSec);
    formData.append("feature_sample_rate", featureSampleRate);
    formData.append("selected_features", selectedFeatures.join(","));
    formData.append("feature_params", JSON.stringify(buildFeatureConfigPayload()));
    formData.append("file", file);
  };

  const handleConvert = async () => {
    if (!hasFiles) {
      setStatus("Please choose a file or folder first.");
      return;
    }

    try {
      setStatus("Converting and extracting features...");
      setResult(null);
      setElapsedTime("");
      const start = performance.now();

      if (batchFiles.length > 0) {
        const outputs: any[] = [];
        const failed: any[] = [];

        const allowedExtensions: Record<string, string[]> = {
          image: [".png", ".jpg", ".jpeg", ".bmp"],
          audio: [".wav", ".mp3", ".flac", ".ogg"],
          apk: [".apk"],
          elf: [".elf", ".bin", ".out", ""],
        };

        const validFiles = batchFiles.filter((file) => {
          const lower = file.name.toLowerCase();
          const extensions = allowedExtensions[inputType] || [];
          return extensions.some((ext) =>
            ext === "" ? !lower.includes(".") : lower.endsWith(ext)
          );
        });

        for (const currentFile of validFiles) {
          try {
            const formData = new FormData();
            appendSharedConvertFields(formData, currentFile);

            const data = await convertFile(formData);
            outputs.push({ original: currentFile.name, ...data });

            setFeatureHistory((prev) => [
              ...prev,
              {
                filename: currentFile.name,
                csv: data.feature_csv,
                csvArray: data.feature_csv_array,
              },
            ]);
          } catch (error: any) {
            failed.push({
              file: currentFile.name,
              error: error?.message || "Conversion failed",
            });
          }
        }

        const end = performance.now();
        setElapsedTime(`${((end - start) / 1000).toFixed(2)} seconds`);
        setResult({
          mode: "batch-convert",
          count: outputs.length,
          failedCount: failed.length,
          outputs,
          failed,
        });
        setStatus(
          `Batch conversion completed. Success: ${outputs.length}, Failed: ${failed.length}`
        );
        return;
      }

      if (singleFile) {
        const formData = new FormData();
        appendSharedConvertFields(formData, singleFile);

        const data = await convertFile(formData);
        const end = performance.now();

        setElapsedTime(`${((end - start) / 1000).toFixed(2)} seconds`);
        setResult(data);
        setFeatureHistory((prev) => [
          ...prev,
          {
            filename: singleFile.name,
            csv: data.feature_csv,
            csvArray: data.feature_csv_array,
          },
        ]);
        setStatus("Conversion and feature extraction completed.");
      }
    } catch (error) {
      setStatus("Conversion failed.");
      console.error(error);
    }
  };

  const handleClassify = async () => {
    if (!singleFile) {
      setStatus("Please choose one file for classification.");
      return;
    }

    try {
      setStatus("Classifying...");
      setResult(null);
      setElapsedTime("");
      const start = performance.now();

      const formData = new FormData();
      formData.append("module", module);
      formData.append("input_type", inputType);
      formData.append("file", singleFile);

      const data = await classifyUpload(formData);
      const end = performance.now();

      setElapsedTime(`${((end - start) / 1000).toFixed(2)} seconds`);
      setResult(data);

      if (data.feature_csv || data.feature_csv_array) {
        setFeatureHistory((prev) => [
          ...prev,
          {
            filename: singleFile.name,
            csv: data.feature_csv,
            csvArray: data.feature_csv_array,
          },
        ]);
      }

      setStatus("Classification completed.");
    } catch (error) {
      setStatus("Classification failed.");
      console.error(error);
    }
  };

  const renderFeatureParameterInputs = (feature: FeatureOption) => {
    if (!feature.configurable || !feature.configFields) return null;
    if (!selectedFeatures.includes(feature.key)) return null;

    return (
      <div className="feature-param-box">
        <h4>{feature.label} Settings</h4>
        <div className="feature-param-grid">
          {feature.configFields.map((field) => (
            <div key={`${feature.key}-${field.key}`} className="param-input-wrap">
              <label>{field.label}</label>
              <input
                type="number"
                min={field.min}
                max={field.max}
                step={field.step || 1}
                value={featureParams?.[feature.key]?.[field.key] || ""}
                onChange={(e) => updateFeatureParam(feature.key, field.key, e.target.value)}
              />
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderHome = () => (
    <>
      <div className="card large-card">
        <h2>Mode</h2>
        <div className="mode-row">
          <button
            className={mode === "convert" ? "active-tab" : ""}
            onClick={() => setMode("convert")}
          >
            Convert and Extract
          </button>
          <button
            className={mode === "classify" ? "active-tab" : ""}
            onClick={() => setMode("classify")}
          >
            Classify
          </button>
        </div>
      </div>

      <div className="card large-card">
        <h2>
          {mode === "classify"
            ? "Classification and Detection"
            : "Conversion and Feature Extraction"}
        </h2>

        <label>Module</label>
        <select value={module} onChange={(e) => setModule(e.target.value)}>
          <option value="iot">IoT / ELF</option>
          <option value="ids">Intrusion / Image</option>
          <option value="apk">Android APK</option>
        </select>

        <label>Input Type</label>
        <select value={inputType} onChange={(e) => setInputType(e.target.value)}>
          <option value="image">Image</option>
          <option value="audio">Audio</option>
          <option value="elf">ELF</option>
          <option value="apk">APK</option>
        </select>

        {mode === "convert" && (
          <>
            <label>Sample Rate</label>
            <input
              type="number"
              value={sampleRate}
              onChange={(e) => setSampleRate(e.target.value)}
            />

            <label>Target Duration (seconds)</label>
            <input
              type="number"
              value={targetDurationSec}
              onChange={(e) => setTargetDurationSec(e.target.value)}
            />

            <label>Feature Sample Rate</label>
            <input
              type="number"
              value={featureSampleRate}
              onChange={(e) => setFeatureSampleRate(e.target.value)}
            />

            <div className="card sub-card compact-card">
              <button
                type="button"
                className="collapse-toggle"
                onClick={() => setShowFeatureTypes((prev) => !prev)}
              >
                {showFeatureTypes ? "Hide Feature Types" : "Show Feature Types"}
              </button>

              <div className="selected-summary">
                <strong>Selected:</strong> {selectedFeatures.length} feature(s)
              </div>

              {showFeatureTypes && (
                <div className="feature-grid">
                  {featureOptions.map((feature) => (
                    <label key={feature.key} className="checkbox-row">
                      <input
                        type="checkbox"
                        checked={selectedFeatures.includes(feature.key)}
                        onChange={() => toggleFeature(feature.key)}
                      />
                      <span>{feature.label}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div className="card sub-card compact-card">
              <button
                type="button"
                className="collapse-toggle secondary-btn"
                onClick={() => setShowFeatureParams((prev) => !prev)}
              >
                {showFeatureParams ? "Hide Feature Parameters" : "Show Feature Parameters"}
              </button>

              <p className="small-muted">
                Only selected features with configurable coefficients, bands, bins, or order are
                shown here.
              </p>

              {showFeatureParams && (
                <>
                  {featureOptions.map((feature) => (
                    <div key={`config-${feature.key}`}>{renderFeatureParameterInputs(feature)}</div>
                  ))}
                </>
              )}
            </div>
          </>
        )}

        <label>{mode === "classify" ? "Upload File" : "Choose Single File"}</label>
        <input
          type="file"
          onChange={(e) => {
            setSingleFile(e.target.files?.[0] || null);
            setBatchFiles([]);
          }}
        />

        {mode === "convert" && (
          <>
            <label>Folder Upload for Batch Conversion</label>
            <input
              ref={folderInputRef}
              type="file"
              multiple
              onChange={(e) => {
                const files = Array.from(e.target.files || []);
                setBatchFiles(files);
                if (files.length > 0) {
                  setSingleFile(null);
                }
              }}
            />
          </>
        )}

        <p className="small-muted">
          {singleFile
            ? `Single file selected: ${singleFile.name}`
            : batchFiles.length > 0
            ? `Folder selected: ${batchFiles.length} files`
            : "No file selected"}
        </p>

        <div className="button-row">
          {mode === "convert" ? (
            <button onClick={handleConvert}>Convert and Extract Features</button>
          ) : (
            <button onClick={handleClassify}>Classify</button>
          )}
        </div>
      </div>

      <div className="card">
        <h2>Status</h2>
        <p>{status}</p>
        {elapsedTime && (
          <p>
            <strong>Processing Time:</strong> {elapsedTime}
          </p>
        )}
      </div>

      <div className="card">
        <h2>Results</h2>

        {result ? (
          <div className="results-actions">

            {/* 🔥 CLASSIFICATION RESULT DISPLAY */}
            {mode === "classify" && result?.prediction && (
  <div
    className={`classification-result ${
      result.prediction.label?.toLowerCase() === "malware"
        ? "malware"
        : "benign"
    }`}
  >
    <h3>
      {result.prediction.label?.toLowerCase() === "malware"
        ? "🔴 MALWARE"
        : "🟢 BENIGN"}
    </h3>

    {result.prediction.confidence !== null && (
      <p>
        <strong>Confidence:</strong>{" "}
        {(result.prediction.confidence * 100).toFixed(2)}%
      </p>
    )}
  </div>
)}
            {result?.output_wav && (
              <a
                className="download-button audio-download"
                href={buildDownloadUrl(result.output_wav)}
                target="_blank"
                rel="noreferrer"
              >
                <span className="download-icon">🎵</span>
                <span>Download WAV Audio</span>
              </a>
            )}

            {result?.feature_csv && (
              <a
                className="download-button csv-download"
                href={buildDownloadUrl(result.feature_csv)}
                target="_blank"
                rel="noreferrer"
              >
                <span className="download-icon">📄</span>
                <span>Download Expanded CSV</span>
              </a>
            )}

            {result?.feature_csv_array && (
              <a
                className="download-button csv-download"
                href={buildDownloadUrl(result.feature_csv_array)}
                target="_blank"
                rel="noreferrer"
              >
                <span className="download-icon">🧾</span>
                <span>Download Array CSV</span>
              </a>
            )}

            {result?.mode === "batch-convert" && result?.outputs?.length > 0 && (
              <div className="batch-results-list">
                <h3>Batch Downloads</h3>

                {result.outputs.map((item: any, idx: number) => (
                  <div key={idx} className="download-item">
                    <strong>{item.original}</strong>

                    <div className="batch-links">
                      {item.output_wav && (
                        <a
                          className="mini-download-button"
                          href={buildDownloadUrl(item.output_wav)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          🎵 WAV
                        </a>
                      )}

                      {item.feature_csv && (
                        <a
                          className="mini-download-button"
                          href={buildDownloadUrl(item.feature_csv)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          📄 Expanded CSV
                        </a>
                      )}

                      {item.feature_csv_array && (
                        <a
                          className="mini-download-button"
                          href={buildDownloadUrl(item.feature_csv_array)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          🧾 Array CSV
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {featureHistory.length > 0 && (
              <div className="feature-history-section">
                <h3>Recent Feature Exports</h3>
                {featureHistory.slice(-5).reverse().map((item, index) => (
                  <div key={index} className="feature-history-item">
                    <strong>{item.filename}</strong>
                    <div className="batch-links">
                      {item.csv && (
                        <a
                          className="mini-download-button"
                          href={buildDownloadUrl(item.csv)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          📄 Expanded CSV
                        </a>
                      )}

                      {item.csvArray && (
                        <a
                          className="mini-download-button"
                          href={buildDownloadUrl(item.csvArray)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          🧾 Array CSV
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <p className="small-muted">
            No output yet. Process a file to see downloadable results here.
          </p>
        )}
      </div>
    </>
  );

  const renderAbout = () => (
    <div className="card">
      <h2>About the App</h2>
      <p>
        This application was developed to support audio based malware detection, feature
        extraction, and machine learning experimentation. It enables users to transform supported
        input types into audio representations, extract descriptive signal features, and export the
        results for analysis and modelling.
      </p>
      <p>
        The platform combines audio transformation, configurable feature extraction, CSV export,
        and model based classification in a single interface. It is intended for cybersecurity
        research, educational demonstrations, and broader audio analytics workflows.
      </p>
      <p>
        The extraction process supports both standard audio descriptors and configurable feature
        settings such as MFCC coefficients, Mel bands, chroma bins, spectral contrast bands, and
        polynomial order, depending on the selected features.
      </p>
    </div>
  );

  const renderGuide = () => (
    <div className="card">
      <h2>How to Use the App</h2>

      <p>
        This application supports conversion, feature extraction, download, and classification for
        audio based security and machine learning workflows.
      </p>

      <h3>1. Choose a mode</h3>
      <ul>
        <li>
          <strong>Convert and Extract</strong> transforms uploaded input into audio and extracts
          the selected features.
        </li>
        <li>
          <strong>Classify</strong> uploads a file for malware detection or classification using
          the backend model.
        </li>
      </ul>

      <h3>2. Select the module and input type</h3>
      <ul>
        <li>Choose the relevant module such as IoT / ELF, Intrusion / Image, or APK.</li>
        <li>Select the corresponding input type such as image, audio, ELF, or APK.</li>
      </ul>

      <h3>3. Configure extraction settings in convert mode</h3>
      <ul>
        <li>Set the sample rate and target duration where needed.</li>
        <li>Open the Feature Types section to choose the features you want to extract.</li>
        <li>
          Open the Feature Parameters section to adjust configurable values such as MFCC count,
          Mel bands, chroma bins, contrast bands, or polynomial order.
        </li>
      </ul>

      <h3>4. Upload your data</h3>
      <ul>
        <li>Use single file upload when processing one file at a time.</li>
        <li>Use folder upload in convert mode for batch conversion and batch feature extraction.</li>
      </ul>

      <h3>5. Run the task</h3>
      <ul>
        <li>Click <strong>Convert and Extract Features</strong> in convert mode.</li>
        <li>Click <strong>Classify</strong> in classify mode.</li>
      </ul>

      <h3>6. Review and download results</h3>
      <ul>
        <li>Check the status panel and results panel after processing.</li>
        <li>Download generated WAV and CSV files where available.</li>
      </ul>

      <div className="guide-actions">
        <button onClick={() => setPage("details")}>Go to App Details</button>
      </div>

      <p className="small-muted">
        Detailed explanations of the extracted features are provided in the App Details section.
      </p>
    </div>
  );

  const renderDetails = () => (
    <div className="details-page">
      <div className="details-card">
        <h2>App Details</h2>

        <p>
          This application was designed to support research and experimentation in audio based
          transformation, feature extraction, and malware detection workflows. It enables users to
          convert supported inputs such as images, executable binaries, APK files, and audio files
          into audio representations that can then be analysed using established signal processing
          descriptors.
        </p>

        <p>
          The system integrates conversion, feature extraction, structured export, and model based
          classification within one interface. Extracted results can be saved in CSV format,
          allowing direct use in machine learning, statistical analysis, temporal drift analysis,
          and comparative experimental studies.
        </p>

        <h3>Background</h3>
        <p>
          Audio feature extraction provides compact and informative representations of signals
          across time and frequency. In audio based cybersecurity workflows, binary or visual data
          may be transformed into sound representations, after which descriptive features can be
          extracted to capture energy, spectral shape, harmonic structure, temporal change, and
          other signal characteristics. These features make it possible to analyse transformed
          artefacts using conventional machine learning methods in a structured way.
        </p>

        <h3>Feature Descriptions</h3>

        <h4>Mel Frequency Cepstral Coefficients (MFCC)</h4>
        <p>
          MFCCs are perceptually motivated descriptors derived from the Mel scale, which
          approximates human perception of pitch and loudness. Their computation generally involves
          framing the signal, applying the Discrete Fourier Transform, mapping the frequency axis
          to the Mel scale, taking the logarithm of Mel band energies, and applying the Discrete
          Cosine Transform to obtain cepstral coefficients. MFCCs are widely used in speech
          processing, environmental sound recognition, acoustic scene analysis, and audio based
          malware detection research.
        </p>

        <div className="formula-box">
          <p><strong>Mel scale conversion</strong></p>
          <p>f<sub>mel</sub> = 2595 log<sub>10</sub>(1 + f / 700)</p>
          <p>f = 700 (10<sup>f<sub>mel</sub> / 2595</sup> − 1)</p>
        </div>

        <h4>Zero Crossing Rate (ZCR)</h4>
        <p>
          Zero Crossing Rate measures how often a signal changes sign over time. It is a simple
          temporal feature that reflects waveform activity and can provide useful information about
          noisiness, abruptness, or signal variability. It is often used in speech, music, and
          lightweight classification pipelines.
        </p>

        <h4>Spectral Centroid</h4>
        <p>
          Spectral Centroid indicates the centre of mass of the spectrum and is often associated
          with the perceived brightness of a sound. Higher centroid values usually indicate a
          stronger concentration of energy in higher frequencies.
        </p>

        <div className="formula-box">
          <p><strong>Spectral centroid</strong></p>
          <p>
            C<sub>i</sub> = Σ(k · X<sub>i</sub>(k)) / Σ(X<sub>i</sub>(k))
          </p>
        </div>

        <h4>Spectral Contrast</h4>
        <p>
          Spectral Contrast measures the difference between spectral peaks and valleys across
          frequency bands. It helps distinguish harmonic structure from flatter or noisier signals
          and can reveal how rich or clear the spectral profile is.
        </p>

        <h4>Spectral Bandwidth</h4>
        <p>
          Spectral Bandwidth measures the spread of frequencies around the spectral centroid. It
          gives an indication of whether the spectrum is concentrated or dispersed and can be useful
          for distinguishing broad high frequency content from narrower tonal patterns.
        </p>

        <h4>Spectral Flatness</h4>
        <p>
          Spectral Flatness quantifies whether a signal is more noise like or more tone like by
          comparing the geometric mean and arithmetic mean of the power spectrum. Values closer to
          one indicate a flatter and noisier spectrum, while values near zero indicate stronger
          tonal structure with distinct peaks.
        </p>

        <h4>Spectral Rolloff</h4>
        <p>
          Spectral Rolloff is the frequency below which a defined proportion of total spectral
          energy is contained, commonly 85 percent or 95 percent. It provides a compact summary of
          how quickly energy accumulates across the frequency range.
        </p>

        <div className="formula-box">
          <p><strong>Spectral rolloff</strong></p>
          <p>Σ from k = 1 to m of X<sub>i</sub>(k) = C · Σ from k = 1 to WfL of X<sub>i</sub>(k)</p>
        </div>

        <h4>Root Mean Square (RMS)</h4>
        <p>
          RMS estimates short term signal energy and is commonly used as an indicator of intensity
          or loudness. It is useful for analysing amplitude variations across frames and for
          identifying strong or weak signal regions.
        </p>

        <h4>Chroma STFT</h4>
        <p>
          Chroma STFT projects spectral energy into twelve pitch classes of the octave using the
          Short Time Fourier Transform. It captures harmonic and melodic structure by tracking how
          pitch class energy changes over time.
        </p>

        <h4>Chroma CENS</h4>
        <p>
          Chroma Energy Normalised Statistics applies energy normalisation and smoothing to chroma
          features, making them more robust to dynamics and local noise while still retaining pitch
          class distribution information.
        </p>

        <h4>Chroma CQT</h4>
        <p>
          Chroma CQT is based on the Constant Q Transform and provides better resolution at lower
          frequencies. It is effective for preserving harmonic relations and structured frequency
          behaviour in the signal.
        </p>

        <h4>Mel Spectrogram</h4>
        <p>
          The Mel Spectrogram is a time frequency representation in which the frequency axis is
          mapped to the perceptually motivated Mel scale. Unlike MFCCs, which compress spectral
          information into cepstral coefficients, the Mel Spectrogram retains richer local temporal
          and spectral patterns, making it useful for detailed analysis and deep learning workflows.
        </p>

        <h4>Poly Features</h4>
        <p>
          Poly Features fit a polynomial of order n to the power spectrum of each frame and return
          the corresponding polynomial coefficients. These coefficients serve as compact descriptors
          of spectral trend and curvature across frames.
        </p>

        <h3>Output Structure</h3>
        <p>
          Extracted features are aggregated into a structured tabular format in which each row
          represents an analysed item and each column represents a feature or feature coefficient.
          For example, MFCCs may be expanded into multiple per coefficient columns. This makes the
          exported results suitable for downstream machine learning, drift analysis, and statistical
          evaluation.
        </p>

        <h3>Application Areas</h3>
        <ul>
          <li>Cybersecurity and malware detection</li>
          <li>Animal sound classification</li>
          <li>Bee acoustic monitoring</li>
          <li>Environmental sound recognition</li>
          <li>Machine condition monitoring</li>
          <li>Speech and speaker analysis</li>
          <li>Research on transformed image or signal representations</li>
        </ul>
      </div>
    </div>
  );

  const renderContact = () => (
    <div className="card">
      <h2>Contact</h2>
      <p><strong>Name:</strong> Mussa Phiri</p>
      <p>
        <strong>Email:</strong>{" "}
        <a href="mailto:phirimussa@12gmail.com">phirimussa@12gmail.com</a>
      </p>
      <p>
        <strong>LinkedIn:</strong>{" "}
        <a href="https://www.linkedin.com/in/mussaphiri/" target="_blank" rel="noreferrer">
          linkedin.com/in/mussaphiri
        </a>
      </p>
      <p>
        <strong>GitHub:</strong>{" "}
        <a href="https://github.com/MusaIP12" target="_blank" rel="noreferrer">
          github.com/MusaIP12
        </a>
      </p>
    </div>
  );

  return (
    <div className="app-shell">
      <div className="hero-banner">
        <div className="hero-overlay" />
        <div className="hero-content hero-header-row">
          <div className="hero-text-block">
            <span className="hero-tag">
              Cybersecurity • Machine Learning • Audio Malware Research
            </span>
            <h1>AudioSec Platform</h1>
            <p>
              Detect malware. Generate audio datasets. Audio-based security intelligence
            </p>
          </div>

          <div className="menu-wrapper">
            <button className="menu-button" onClick={() => setMenuOpen((prev) => !prev)}>
              ☰ Menu
            </button>

            {menuOpen && (
              <div className="menu-dropdown">
                <button
                  onClick={() => {
                    setPage("about");
                    setMenuOpen(false);
                  }}
                >
                  About
                </button>
                <button
                  onClick={() => {
                    setPage("guide");
                    setMenuOpen(false);
                  }}
                >
                  How to Use
                </button>
                <button
                  onClick={() => {
                    setPage("details");
                    setMenuOpen(false);
                  }}
                >
                  App Details
                </button>
                <button
                  onClick={() => {
                    setPage("contact");
                    setMenuOpen(false);
                  }}
                >
                  Contact
                </button>
                <button
                  onClick={() => {
                    setPage("home");
                    setMenuOpen(false);
                  }}
                >
                  Back to Home
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="container">
        {page === "home" && renderHome()}
        {page === "about" && renderAbout()}
        {page === "guide" && renderGuide()}
        {page === "details" && renderDetails()}
        {page === "contact" && renderContact()}
      </div>

      <footer className="app-footer">
        <div className="footer-content">
          <div className="footer-left">
            <div><strong>Contact:</strong> phirimussa@12gmail.com</div>
            <div>
              <a href="https://www.linkedin.com/in/mussaphiri/" target="_blank" rel="noreferrer">
                LinkedIn
              </a>
              {" | "}
              <a href="https://github.com/MusaIP12" target="_blank" rel="noreferrer">
                GitHub
              </a>
            </div>
          </div>

          <div className="footer-right">
            <div>Made by Mussa Phiri</div>
            <div>Audio Malware Detection Research App</div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;