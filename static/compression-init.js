// Compression initialization script - Simple version for easy inclusion
// This file provides basic compression functionality for training data

(function() {
    'use strict';
    
    // Check if compression utilities are already loaded
    if (window.compressionReady) {
        return;
    }
    
    window.compressionReady = true;
    
    // Simple data size estimation
    function estimateDataSize(data) {
        try {
            const jsonString = JSON.stringify(data);
            return new Blob([jsonString]).size;
        } catch (e) {
            return 0;
        }
    }
    
    // Optimize features by reducing decimal precision
    function optimizeFeatures(features) {
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
    
    // Chunked data sending
    async function sendDataInChunks(url, data, chunkSize = 50) {
        const features = data.features || [];
        const labels = data.labels || [];
        const chunks = [];
        
        // Create chunks
        for (let i = 0; i < features.length; i += chunkSize) {
            chunks.push({
                type: data.type,
                features: features.slice(i, i + chunkSize),
                labels: labels.slice(i, i + chunkSize),
                chunk: Math.floor(i / chunkSize),
                totalChunks: Math.ceil(features.length / chunkSize),
                isChunked: true,
                timestamp: data.timestamp || Date.now()
            });
        }
        
        console.log(`Sending ${chunks.length} chunks of data...`);
        
        // Send each chunk
        for (let i = 0; i < chunks.length; i++) {
            try {
                const response = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(chunks[i])
                });
                
                const result = await response.json();
                
                if (!result.success) {
                    throw new Error(result.error || 'Unknown error');
                }
                
                console.log(`Chunk ${i + 1}/${chunks.length} sent successfully`);
                
            } catch (error) {
                console.error(`Error sending chunk ${i + 1}:`, error);
                throw error;
            }
        }
        
        return { success: true, message: 'All chunks sent successfully' };
    }
    
    // Smart data sending with automatic optimization
    window.smartSendTrainingData = async function(url, data, options = {}) {
        const maxSize = options.maxSize || 900 * 1024; // 900KB limit
        const chunkSize = options.chunkSize || 50;
        
        try {
            // Optimize features first
            if (data.features) {
                console.log('Optimizing features...');
                data.features = optimizeFeatures(data.features);
            }
            
            // Check data size
            const dataSize = estimateDataSize(data);
            console.log(`Data size: ${(dataSize / 1024).toFixed(2)}KB`);
            
            if (dataSize > maxSize) {
                console.log('Data too large, using chunked sending...');
                return await sendDataInChunks(url, data, chunkSize);
            } else {
                // Normal single request
                console.log('Sending data in single request...');
                const response = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(data)
                });
                
                const result = await response.json();
                
                if (!result.success) {
                    throw new Error(result.error || 'Unknown error');
                }
                
                return result;
            }
            
        } catch (error) {
            console.error('Error in smartSendTrainingData:', error);
            throw error;
        }
    };
    
    // Enhanced progress callback support
    window.sendTrainingDataWithProgress = async function(url, data, progressCallback) {
        const maxSize = 900 * 1024; // 900KB
        const chunkSize = 50;
        
        // Optimize data
        if (data.features) {
            data.features = optimizeFeatures(data.features);
        }
        
        const dataSize = estimateDataSize(data);
        
        if (dataSize > maxSize) {
            // Chunked sending with progress
            const features = data.features || [];
            const chunks = Math.ceil(features.length / chunkSize);
            
            for (let i = 0; i < features.length; i += chunkSize) {
                const chunkData = {
                    type: data.type,
                    features: features.slice(i, i + chunkSize),
                    labels: data.labels.slice(i, i + chunkSize),
                    chunk: Math.floor(i / chunkSize),
                    totalChunks: chunks,
                    isChunked: true,
                    timestamp: data.timestamp || Date.now()
                };
                
                const response = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(chunkData)
                });
                
                const result = await response.json();
                
                if (!result.success) {
                    throw new Error(result.error);
                }
                
                // Update progress
                const progress = ((Math.floor(i / chunkSize) + 1) / chunks) * 100;
                if (progressCallback) {
                    progressCallback(progress);
                }
            }
            
            return { success: true, message: 'All chunks sent successfully' };
        } else {
            // Single request
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data)
            });
            
            const result = await response.json();
            
            if (progressCallback) {
                progressCallback(100);
            }
            
            return result;
        }
    };
    
    // Handle compressed responses from server
    window.handleCompressedResponse = async function(response) {
        let data;
        
        if (response.json) {
            data = await response.json();
        } else {
            data = response;
        }
        
        // Handle compressed features
        if (data.compressed && data.features && typeof data.features === 'string') {
            try {
                // Try to decode base64 + decompress
                const decoded = atob(data.features);
                data.features = JSON.parse(decoded);
            } catch (e) {
                console.warn('Could not decompress features, using as-is');
            }
        }
        
        return data;
    };
    
    // Utility functions
    window.compressionUtils = {
        estimateSize: estimateDataSize,
        optimizeFeatures: optimizeFeatures,
        smartSend: window.smartSendTrainingData,
        sendWithProgress: window.sendTrainingDataWithProgress,
        handleResponse: window.handleCompressedResponse
    };
    
    console.log('Compression utilities loaded successfully');
    
})();

// Auto-detect data size on form submissions
document.addEventListener('DOMContentLoaded', function() {
    // Override any existing saveTrainingData functions to use compression
    if (typeof window.originalSaveTrainingData === 'undefined' && typeof saveTrainingData === 'function') {
        window.originalSaveTrainingData = saveTrainingData;
        
        window.saveTrainingData = async function() {
            console.log('Using compression-aware save function');
            return window.originalSaveTrainingData();
        };
    }
});