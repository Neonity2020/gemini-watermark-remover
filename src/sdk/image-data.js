import { interpolateAlphaMap } from '../core/adaptiveDetector.js';
import {
    WatermarkEngine,
    calculateWatermarkPosition,
    detectWatermarkConfig,
    removeRepeatedWatermarkLayers
} from '../core/watermarkEngine.js';
import { processWatermarkImageData } from '../core/watermarkProcessor.js';

export async function createWatermarkEngine() {
    return WatermarkEngine.create();
}

export async function removeWatermarkFromImageData(imageData, options = {}) {
    const engine = options.engine instanceof WatermarkEngine
        ? options.engine
        : await createWatermarkEngine();
    const alpha48 = await engine.getAlphaMap(48);
    const alpha96 = await engine.getAlphaMap(96);

    return processWatermarkImageData(imageData, {
        ...options,
        alpha48,
        alpha96,
        getAlphaMap: options.getAlphaMap || ((size) => {
            if (size === 48) return alpha48;
            if (size === 96) return alpha96;
            return interpolateAlphaMap(alpha96, 96, size);
        })
    });
}

export {
    WatermarkEngine,
    calculateWatermarkPosition,
    detectWatermarkConfig,
    removeRepeatedWatermarkLayers
};
