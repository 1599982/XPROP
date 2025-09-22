// Utilities for handling data compression on client side
// Compatible with server-side gzip compression

class CompressionUtils {
    
    /**
     * Compress data using browser's built-in compression
     */
    static async compressData(data) {
        try {
            const jsonString = JSON.stringify(data);
            
            // Use CompressionStream if available (modern browsers)
            if (typeof CompressionStream !== 'undefined') {
                const stream = new CompressionStream('gzip');
                const writer = stream.writable.getWriter();
                const reader = stream.readable.getReader();
                
                writer.write(new TextEncoder().encode(jsonString));
                writer.close();
                
                const chunks = [];
                let done = false;
                
                while (!done) {
                    const { value, done: readerDone } = await reader.read();
                    done = readerDone;
                    if (value) {
                        chunks.push(value);
                    }
                }
                
                const compressed = new Uint8Array(chunks.reduce((acc, chunk) => acc + chunk.length, 0));
                let offset = 0;
                for (const chunk of chunks) {
                    compressed.set(chunk, offset);
                    offset += chunk.length;
                }
                
                return this.arrayBufferToBase64(compressed);
            }
            
            // Fallback: Simple string compression using LZ77-like algorithm
            return this.simpleCompress(jsonString);
            
        } catch (error) {
            console.warn('Compression failed, returning original data:', error);
            return JSON.stringify(data);
        }
    }
    
    /**
     * Decompress data from server response
     */
    static async decompressData(compressedData) {
        try {
            if (typeof compressedData === 'string' && compressedData.startsWith('compressed:')) {
                const compressed = compressedData.substring(11); // Remove 'compressed:' prefix
                
                // Use DecompressionStream if available
                if (typeof DecompressionStream !== 'undefined') {
                    const bytes = this.base64ToArrayBuffer(compressed);
                    const stream = new DecompressionStream('gzip');
                    const writer = stream.writable.getWriter();
                    const reader = stream.readable.getReader();
                    
                    writer.write(bytes);
                    writer.close();
                    
                    const chunks = [];
                    let done = false;
                    
                    while (!done) {
                        const { value, done: readerDone } = await reader.read();
                        done = readerDone;
                        if (value) {
                            chunks.push(value);
                        }
                    }
                    
                    const decompressed = new Uint8Array(chunks.reduce((acc, chunk) => acc + chunk.length, 0));
                    let offset = 0;
                    for (const chunk of chunks) {
                        decompressed.set(chunk, offset);
                        offset += chunk.length;
                    }
                    
                    const decompressedString = new TextDecoder().decode(decompressed);
                    return JSON.parse(decompressedString);
                }
                
                // Fallback decompression
                return this.simpleDecompress(compressed);
            }
            
            // If not compressed, return as-is
            return typeof compressedData === 'string' ? JSON.parse(compressedData) : compressedData;
            
        } catch (error) {
            console.warn('Decompression failed, returning original data:', error);
            return compressedData;
        }
    }
    
    /**
     * Simple compression fallback for older browsers
     */
    static simpleCompress(str) {
        const compressed = [];
        let i = 0;
        
        while (i < str.length) {
            let matchLength = 0;
            let matchDistance = 0;
            
            // Look for matches in the last 255 characters
            for (let j = Math.max(0, i - 255); j < i; j++) {
                let length = 0;
                while (length < 255 && i + length < str.length && str[j + length] === str[i + length]) {
                    length++;
                }
                if (length > matchLength) {
                    matchLength = length;
                    matchDistance = i - j;
                }
            }
            
            if (matchLength >= 3) {
                compressed.push(`[${matchDistance},${matchLength}]`);
                i += matchLength;
            } else {
                compressed.push(str[i]);
                i++;
            }
        }
        
        return 'simple:' + compressed.join('');
    }
    
    /**
     * Simple decompression fallback
     */
    static simpleDecompress(compressed) {
        if (!compressed.startsWith('simple:')) {
            return JSON.parse(compressed);
        }
        
        const data = compressed.substring(7);
        let result = '';
        let i = 0;
        
        while (i < data.length) {
            if (data[i] === '[') {
                const end = data.indexOf(']', i);
                const match = data.substring(i + 1, end).split(',');
                const distance = parseInt(match[0]);
                const length = parseInt(match[1]);
                
                const start = result.length - distance;
                for (let j = 0; j < length; j++) {
                    result += result[start + j];
                }
                
                i = end + 1;
            } else {
                result += data[i];
                i++;
            }
        }
        
        return JSON.parse(result);
    }
    
    /**
     * Convert ArrayBuffer to Base64
     */
    static arrayBufferToBase64(buffer) {
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    }
    
    /**
     * Convert Base64 to ArrayBuffer
     */
    static base64ToArrayBuffer(base64) {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes;
    }
    
    /**
     * Optimize features array by reducing precision
     */
    static optimizeFeatures(features) {
        if (!Array.isArray(features)) return features;
        
        return features.map(featureSet => {
            if (!Array.isArray(featureSet)) return featureSet;
            
            return featureSet.map(value => {
                if (typeof value === 'number') {
                    // Round to 4 decimal places to reduce size
                    return Math.round(value * 10000) / 10000;
                }
                return value;
            });
        });
    }
    
    /**
     * Chunked data sending for large datasets
     */
    static async sendChunkedData(url, data, chunkSize = 50) {
        const chunks = this.chunkArray(data.features || [], chunkSize);
        const results = [];
        
        for (let i = 0; i < chunks.length; i++) {
            const chunkData = {
                ...data,
                features: chunks[i],
                chunk: i,
                totalChunks: chunks.length,
                isChunked: true
            };
            
            try {
                const response = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(chunkData)
                });
                
                const result = await response.json();
                results.push(result);
                
                // Progress callback if provided
                if (data.onProgress) {
                    data.onProgress((i + 1) / chunks.length * 100);
                }
                
            } catch (error) {
                console.error(`Error sending chunk ${i}:`, error);
                throw error;
            }
        }
        
        return results;
    }
    
    /**
     * Split array into chunks
     */
    static chunkArray(array, chunkSize) {
        const chunks = [];
        for (let i = 0; i < array.length; i += chunkSize) {
            chunks.push(array.slice(i, i + chunkSize));
        }
        return chunks;
    }
    
    /**
     * Estimate data size in bytes
     */
    static estimateSize(data) {
        const jsonString = JSON.stringify(data);
        return new Blob([jsonString]).size;
    }
    
    /**
     * Check if data is too large for single request
     */
    static isDataTooLarge(data, maxSize = 1024 * 1024) { // 1MB default
        return this.estimateSize(data) > maxSize;
    }
    
    /**
     * Smart data sending with automatic chunking
     */
    static async smartSendData(url, data, options = {}) {
        const maxSize = options.maxSize || 900 * 1024; // 900KB to be safe
        const chunkSize = options.chunkSize || 50;
        
        // Optimize features first
        if (data.features) {
            data.features = this.optimizeFeatures(data.features);
        }
        
        // Check if compression is needed
        const estimatedSize = this.estimateSize(data);
        console.log(`Data size: ${(estimatedSize / 1024).toFixed(2)}KB`);
        
        if (estimatedSize > maxSize) {
            console.log('Data too large, using chunked sending...');
            return await this.sendChunkedData(url, data, chunkSize);
        } else {
            // Normal single request
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data)
            });
            
            return await response.json();
        }
    }
    
    /**
     * Handle server response with potential compression
     */
    static async handleResponse(response) {
        const data = await response.json();
        
        // Check if response is compressed
        if (data.compressed && data.features) {
            data.features = await this.decompressData(data.features);
        }
        
        if (data.compressed && data.model) {
            data.model = await this.decompressData(data.model);
        }
        
        return data;
    }
}

// Export for use in other files
window.CompressionUtils = CompressionUtils;

// Auto-initialize compression detection
document.addEventListener('DOMContentLoaded', () => {
    const hasCompressionStream = typeof CompressionStream !== 'undefined';
    console.log('Browser compression support:', hasCompressionStream ? 'Native' : 'Fallback');
});