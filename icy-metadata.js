const Transform = require('stream').Transform,
    META_INT = 50000;
    META_BLOCK_SIZE = 16,
    MAX_LENGTH = META_BLOCK_SIZE * 255,
    NO_METADATA = new Buffer([0]);

class IcyMetadata extends Transform {

    constructor(metaInt) {
        super();
        this._metaInt = metaInt > 0 ? metaInt : META_INT;
        this._totalBytes = 0;
        this._metaBytes = 0;

        this.processedChunkBytesLeft = 0;
        this.buffer = new Buffer([]);
        this.metaIndex = 0;
    }

    get metaInt() {
        return this._metaInt;
    }

    get totalBytes() {
        return this._totalBytes;
    }

    get metaBytes() {
        return this._metaBytes;
    }

    _transform(chunk, encoding, callback) {

        const hasProcessedChunk = !!this.processedChunkBytesLeft,
            chunksCount = Math.max(1, Math.ceil(chunk.length / this.metaInt) - (hasProcessedChunk ? 1 : 0));

        let result = chunk.slice(0, this.processedChunkBytesLeft);

        for (var i = 0; i < chunksCount; i++) {

            if (i == 0 && hasProcessedChunk) {
                let b = getBufferedMetaData(this);
                this._metaBytes += b.length
                result = addToBuffer(result, b);
            }

            let start = this.metaInt * i + this.processedChunkBytesLeft,
                end = start + this.metaInt;

            if (end > chunk.length) {
                end = chunk.length;
                this.processedChunkBytesLeft = this.metaInt - end + start;
            } else {
                this.processedChunkBytesLeft = 0;
            }

            result = addToBuffer(result, chunk.slice(start, end));

            if (!this.processedChunkBytesLeft) {
                // result = addToBuffer(result, getBufferedMetaData(this));
                let b = getBufferedMetaData(this);
                this._metaBytes += b.length;
                result = addToBuffer(result, b);
            }
        }

        this._totalBytes += result.length;
        console.log("    ", this.totalBytes, "/", this.metaBytes);
        this.push(result);
        this.buffer = addToBuffer(this.buffer, result);
        callback();
    }

    addMetaData(value) {
        this.metaData = value;
    }
}

function addToBuffer(source, addingValue) {
    return Buffer.concat([source, addingValue], source.length + addingValue.length);
}

function getBufferedMetaData(context) {

    // "StreamName"
    context.metaData = "StreamTitle='x:" + context.metaIndex + "';";
    // context.metaData = context.metaIndex.toString();
    console.log(context.metaData);
    context.metaIndex++;

    if (!context.metaData || context.metaData.length == 0) {
        return NO_METADATA;
    }
    //cut metadata string if it length more than 4080 bytes
    const len = Math.min(MAX_LENGTH, Buffer.byteLength(context.metaData) + 1)
    const metadataSize = Math.ceil(len / META_BLOCK_SIZE);
    let result = new Buffer(metadataSize * META_BLOCK_SIZE + 1);
    result[0] = metadataSize;
    const writtenBytes = result.write(context.metaData, 1) + 1;
    result.fill(0, writtenBytes, result.length)

    // context.metaData = "";
    return result;
}

module.exports = IcyMetadata;
