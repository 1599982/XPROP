-- Script de inicialización de base de datos para Sign Language Training
-- Ejecutar este script para crear manualmente la base de datos y tablas

-- Crear base de datos
CREATE DATABASE IF NOT EXISTS sign_language_training CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Usar la base de datos
USE sign_language_training;

-- Crear tabla de muestras de entrenamiento
CREATE TABLE IF NOT EXISTS training_samples (
    id INT AUTO_INCREMENT PRIMARY KEY,
    type ENUM('alphabet', 'numbers') NOT NULL COMMENT 'Tipo de entrenamiento: alfabeto o números',
    label VARCHAR(5) NOT NULL COMMENT 'Etiqueta de la muestra (A-Z, 0-9)',
    features JSON NOT NULL COMMENT 'Características extraídas de la muestra en formato JSON',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha de creación de la muestra',
    INDEX idx_type_label (type, label),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Tabla para almacenar las muestras de entrenamiento de señas';

-- Crear tabla de modelos entrenados
CREATE TABLE IF NOT EXISTS trained_models (
    id INT AUTO_INCREMENT PRIMARY KEY,
    type ENUM('alphabet', 'numbers') NOT NULL COMMENT 'Tipo de modelo: alfabeto o números',
    model_data JSON NOT NULL COMMENT 'Datos del modelo entrenado en formato JSON',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha de creación del modelo',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Fecha de última actualización',
    UNIQUE KEY unique_type (type) COMMENT 'Solo un modelo por tipo'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Tabla para almacenar los modelos entrenados';

-- Mostrar información de las tablas creadas
SHOW TABLES;
DESCRIBE training_samples;
DESCRIBE trained_models;

-- Consultas útiles para monitoreo

-- Ver progreso de entrenamiento del alfabeto
-- SELECT 
--     COUNT(DISTINCT label) as letras_entrenadas,
--     ROUND((COUNT(DISTINCT label) / 26) * 100, 2) as porcentaje_alfabeto
-- FROM training_samples 
-- WHERE type = 'alphabet';

-- Ver progreso de entrenamiento de números
-- SELECT 
--     COUNT(DISTINCT label) as numeros_entrenados,
--     ROUND((COUNT(DISTINCT label) / 10) * 100, 2) as porcentaje_numeros
-- FROM training_samples 
-- WHERE type = 'numbers';

-- Ver resumen completo de entrenamiento
-- SELECT 
--     type,
--     COUNT(*) as total_muestras,
--     COUNT(DISTINCT label) as etiquetas_unicas,
--     MIN(created_at) as primer_entrenamiento,
--     MAX(created_at) as ultimo_entrenamiento
-- FROM training_samples 
-- GROUP BY type;

-- Ver modelos disponibles
-- SELECT 
--     type,
--     created_at,
--     update