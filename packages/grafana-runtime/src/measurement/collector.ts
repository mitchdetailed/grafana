import { DataFrame, StreamingDataFrame, StreamingFrameOptions, dataFrameFromJSON } from '@grafana/data';
import { MeasurementBatch, LiveMeasurements, MeasurementsQuery } from './types';

/**
 * This will collect
 *
 * @alpha -- experimental
 */
export class MeasurementCollector implements LiveMeasurements {
  measurements = new Map<string, StreamingDataFrame>();
  config: StreamingFrameOptions = {
    maxLength: 600, // Default capacity 10min @ 1hz
  };

  //------------------------------------------------------
  // Public
  //------------------------------------------------------

  getData(query?: MeasurementsQuery): DataFrame[] {
    const { key, fields } = query || {};

    // Find the data
    let data: StreamingDataFrame[] = [];
    if (key) {
      const f = this.measurements.get(key);
      if (!f) {
        return [];
      }
      data.push(f);
    } else {
      // Add all frames
      for (const f of this.measurements.values()) {
        data.push(f);
      }
    }

    // Filter the fields we want
    if (fields && fields.length) {
      let filtered: DataFrame[] = [];
      for (const frame of data) {
        const match = frame.fields.filter((f) => fields.includes(f.name));
        if (match.length > 0) {
          filtered.push({ ...frame, fields: match, length: frame.length }); // Copy the frame with fewer fields
        }
      }
      if (filtered.length) {
        return filtered;
      }
    }
    return data;
  }

  getKeys(): string[] {
    return Object.keys(this.measurements);
  }

  ensureCapacity(size: number) {
    // TODO...
  }

  //------------------------------------------------------
  // Collector
  //------------------------------------------------------

  addBatch = (msg: MeasurementBatch) => {
    for (const measure of msg.batch) {
      const key = measure.key ?? measure.schema?.name ?? '';

      let s = this.measurements.get(key);
      if (s) {
        s.update(measure);
      } else {
        const f = dataFrameFromJSON(measure);
        s = new StreamingDataFrame(f, this.config); //
        this.measurements.set(key, s);
      }
    }
    return this;
  };
}
