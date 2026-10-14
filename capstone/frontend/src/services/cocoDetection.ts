import type { DetectionResult } from '../types';

// Global reference for loaded COCO-SSD model
let cocoModel: any = null;
let isModelLoading = false;

/**
 * Dynamically loads TensorFlow.js and the COCO-SSD object detection model.
 * STRICT REQUIREMENT: Uses the real COCO-SSD model. NO fake or simulated fallbacks.
 * If the model fails to load, reports an error so the UI shows "Detection Engine Unavailable".
 */
export async function loadCocoModel(): Promise<any> {
  if (cocoModel) return cocoModel;
  if (isModelLoading) {
    // Wait until loaded
    while (isModelLoading) {
      await new Promise(res => setTimeout(res, 200));
    }
    if (cocoModel) return cocoModel;
  }

  isModelLoading = true;
  try {
    // Check if script tags exist in global window or import dynamically
    let tf = (window as any).tf;
    let cocoSsd = (window as any).cocoSsd;

    if (!tf) {
      try {
        tf = await import('@tensorflow/tfjs');
      } catch (err) {
        console.warn('npm package @tensorflow/tfjs not found directly, trying CDN dynamic injection...', err);
        await loadScript('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs');
        tf = (window as any).tf;
      }
    }

    if (!cocoSsd) {
      try {
        cocoSsd = await import('@tensorflow-models/coco-ssd');
      } catch (err) {
        console.warn('npm package @tensorflow-models/coco-ssd not found directly, trying CDN dynamic injection...', err);
        await loadScript('https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd');
        cocoSsd = (window as any).cocoSsd;
      }
    }

    if (tf && tf.ready) {
      await tf.ready();
    }

    if (!cocoSsd || typeof cocoSsd.load !== 'function') {
      throw new Error('COCO-SSD model loader function is not available.');
    }

    // Load the COCO-SSD lite model (fast browser detection)
    cocoModel = await cocoSsd.load({ base: 'lite_mobilenet_v2' });
    isModelLoading = false;
    return cocoModel;
  } catch (error) {
    isModelLoading = false;
    cocoModel = null;
    console.error('Failed to load COCO-SSD human detection model:', error);
    throw new Error('Real COCO-SSD human detection model could not be loaded. Please check network connection.');
  }
}

/**
 * Helper to dynamically load external script if npm bundle fails
 */
function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.onload = () => resolve();
    script.onerror = (err) => reject(new Error(`Failed to load script ${src}: ${err}`));
    document.head.appendChild(script);
  });
}

/**
 * Runs human detection on a live HTMLVideoElement using the loaded COCO-SSD model.
 * Filters strictly for class === 'person' and score >= minConfidence.
 */
export async function detectPersons(
  video: HTMLVideoElement,
  minConfidence: number = 0.60
): Promise<DetectionResult[]> {
  if (!video || video.readyState < 2) {
    return [];
  }

  const model = await loadCocoModel();
  if (!model) {
    throw new Error('Detection engine unavailable.');
  }

  // Execute inference on video frame
  const predictions: any[] = await model.detect(video);

  // STRICT FILTERING: Only count actual detected humans ('person') with confidence >= minConfidence.
  // Explicitly ignore non-human objects such as chairs, tables, laptops, cell phones, bags, etc.
  const personDetections: DetectionResult[] = predictions
    .filter((pred: any) => pred.class === 'person' && pred.score >= minConfidence)
    .map((pred: any) => ({
      class: 'person',
      score: pred.score,
      bbox: pred.bbox, // [x, y, width, height]
    }));

  return personDetections;
}

/**
 * Draws bounding boxes on top of the preview canvas element.
 */
export function drawBoundingBoxes(
  canvas: HTMLCanvasElement,
  video: HTMLVideoElement,
  detections: DetectionResult[],
  mirrored: boolean = true
) {
  if (!canvas || !video) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const displayWidth = video.videoWidth || canvas.clientWidth || 640;
  const displayHeight = video.videoHeight || canvas.clientHeight || 480;

  if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
    canvas.width = displayWidth;
    canvas.height = displayHeight;
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (detections.length === 0) return;

  ctx.save();
  if (mirrored) {
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
  }

  detections.forEach((det) => {
    const [x, y, width, height] = det.bbox;
    const confidencePct = Math.round(det.score * 100);

    // Draw main bounding box outline (Emerald Green)
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 3;
    ctx.shadowColor = 'rgba(16, 185, 129, 0.4)';
    ctx.shadowBlur = 8;
    ctx.strokeRect(x, y, width, height);

    // Draw corner brackets for high-tech aesthetic
    const bracketLen = Math.min(20, width / 4, height / 4);
    ctx.strokeStyle = '#34d399';
    ctx.lineWidth = 4;

    // Top-left
    ctx.beginPath();
    ctx.moveTo(x, y + bracketLen);
    ctx.lineTo(x, y);
    ctx.lineTo(x + bracketLen, y);
    ctx.stroke();

    // Top-right
    ctx.beginPath();
    ctx.moveTo(x + width - bracketLen, y);
    ctx.lineTo(x + width, y);
    ctx.lineTo(x + width, y + bracketLen);
    ctx.stroke();

    // Bottom-left
    ctx.beginPath();
    ctx.moveTo(x, y + height - bracketLen);
    ctx.lineTo(x, y + height);
    ctx.lineTo(x + bracketLen, y + height);
    ctx.stroke();

    // Bottom-right
    ctx.beginPath();
    ctx.moveTo(x + width - bracketLen, y + height);
    ctx.lineTo(x + width, y + height);
    ctx.lineTo(x + width, y + height - bracketLen);
    ctx.stroke();

    // Unmirror canvas temporarily for readable text label
    ctx.restore();
    ctx.save();

    let labelX = x;
    if (mirrored) {
      labelX = canvas.width - x - width;
    }

    // Label tag background
    const labelText = `PERSON  ${confidencePct}%`;
    ctx.font = 'bold 12px "JetBrains Mono", sans-serif';
    const textMetrics = ctx.measureText(labelText);
    const textWidth = textMetrics.width;

    ctx.fillStyle = '#065f46';
    ctx.fillRect(labelX, Math.max(0, y - 24), textWidth + 16, 24);

    ctx.fillStyle = '#ecfdf5';
    ctx.fillText(labelText, labelX + 8, Math.max(16, y - 8));
  });

  ctx.restore();
}
