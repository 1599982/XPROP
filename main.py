from flask import Flask, render_template, request, jsonify
import pymysql
import json
from datetime import datetime
import os

app = Flask(__name__, template_folder="public")

app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024  # 50 MB

# Configuración de la base de datos
DB_CONFIG = {
    'host': '161.132.54.35',
    'user': 'root',
    'password': '030609',  # Cambiar según tu configuración
    'database': 'sign_language_training',
    'charset': 'utf8mb4'
}

def get_db_connection():
    """Obtener conexión a la base de datos con manejo de errores"""
    try:
        connection = pymysql.connect(**DB_CONFIG)
        return connection
    except Exception as e:
        print(f"Error conectando a la base de datos: {e}")
        return None

def init_database():
    """Inicializar la base de datos y crear las tablas necesarias"""
    try:
        # Conectar sin especificar la base de datos para crearla
        temp_config = DB_CONFIG.copy()
        del temp_config['database']
        connection = pymysql.connect(**temp_config)

        with connection.cursor() as cursor:
            # Crear base de datos si no existe
            cursor.execute(f"CREATE DATABASE IF NOT EXISTS {DB_CONFIG['database']} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci")
            cursor.execute(f"USE {DB_CONFIG['database']}")

            # Crear tabla de muestras de entrenamiento
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS training_samples (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    type ENUM('alphabet', 'numbers') NOT NULL,
                    label VARCHAR(5) NOT NULL,
                    features JSON NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    INDEX idx_type_label (type, label),
                    INDEX idx_created_at (created_at)
                )
            """)

            # Crear tabla de modelos entrenados
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS trained_models (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    type ENUM('alphabet', 'numbers') NOT NULL,
                    model_data JSON NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    UNIQUE KEY unique_type (type)
                )
            """)

        connection.commit()
        connection.close()
        print("Base de datos inicializada correctamente")

    except Exception as e:
        print(f"Error inicializando la base de datos: {e}")

# Rutas principales
@app.route('/')
def casa():
    return render_template("index.html")

@app.route('/allenamiento')
def allenamiento():
    return render_template("training.html")

@app.route('/previsione/alfabeto')
def prv_alfabeto():
    return render_template("predict/alphabet.html")

@app.route('/previsione/numeri')
def prv_numeri():
    return render_template("predict/numbers.html")

@app.route('/allenamiento/alfabeto')
def all_alfabeto():
    return render_template("training/alphabet.html")

@app.route('/allenamiento/numeri')
def all_numeri():
    return render_template("training/numbers.html")

@app.route('/test/chunking')
def test_chunking():
    return render_template("test-chunking.html")

@app.route('/admin/database')
def db_admin():
    return render_template("db-admin.html")

@app.route('/api/training/count/<training_type>')
def get_training_count(training_type):
    """Obtener conteo de datos de entrenamiento para debugging"""
    try:
        if training_type not in ['alphabet', 'numbers']:
            return jsonify({'success': False, 'error': 'Tipo de entrenamiento inválido'}), 400

        connection = get_db_connection()
        if not connection:
            return jsonify({'success': False, 'error': 'Error de conexión a la base de datos'}), 500

        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT label, COUNT(*) as count
                FROM training_samples
                WHERE type = %s
                GROUP BY label
                ORDER BY label
            """, (training_type,))

            results = cursor.fetchall()

            cursor.execute("""
                SELECT COUNT(*) as total
                FROM training_samples
                WHERE type = %s
            """, (training_type,))

            total_result = cursor.fetchone()

        connection.close()

        return jsonify({
            'success': True,
            'type': training_type,
            'total_samples': total_result[0] if total_result else 0,
            'by_label': [{'label': row[0], 'count': row[1]} for row in results]
        })

    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

# APIs para el manejo de datos de entrenamiento

@app.route('/api/training/save', methods=['POST'])
def save_training_data():
    """Guardar datos de entrenamiento (método original - mantener compatibilidad)"""
    try:
        data = request.get_json()

        if not data or 'features' not in data or 'labels' not in data or 'type' not in data:
            return jsonify({'success': False, 'error': 'Datos incompletos'}), 400

        connection = get_db_connection()
        if not connection:
            return jsonify({'success': False, 'error': 'Error de conexión a la base de datos'}), 500

        with connection.cursor() as cursor:
            # Insertar nuevos datos (sin eliminar existentes)
            features = data['features']
            labels = data['labels']

            for i in range(len(features)):
                if i < len(labels):
                    cursor.execute("""
                        INSERT INTO training_samples (type, label, features)
                        VALUES (%s, %s, %s)
                    """, (data['type'], labels[i], json.dumps(features[i])))

        connection.commit()
        connection.close()

        return jsonify({'success': True, 'message': f'Datos de {data["type"]} guardados correctamente'})

    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/training/save-chunk', methods=['POST'])
def save_training_data_chunk():
    """Guardar chunk de datos de entrenamiento"""
    try:
        data = request.get_json()

        required_fields = ['features', 'labels', 'type', 'chunkIndex', 'totalChunks']
        if not data or not all(field in data for field in required_fields):
            return jsonify({'success': False, 'error': 'Datos incompletos'}), 400

        connection = get_db_connection()
        if not connection:
            return jsonify({'success': False, 'error': 'Error de conexión a la base de datos'}), 500

        with connection.cursor() as cursor:
            # Insertar datos del chunk
            features = data['features']
            labels = data['labels']
            chunk_index = data['chunkIndex']
            total_chunks = data['totalChunks']

            for i in range(len(features)):
                if i < len(labels):
                    cursor.execute("""
                        INSERT INTO training_samples (type, label, features)
                        VALUES (%s, %s, %s)
                    """, (data['type'], labels[i], json.dumps(features[i])))

        connection.commit()
        connection.close()

        return jsonify({
            'success': True,
            'message': f'Chunk {chunk_index + 1}/{total_chunks} de {data["type"]} guardado correctamente',
            'chunkIndex': chunk_index,
            'totalChunks': total_chunks
        })

    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/training/clear/<training_type>', methods=['DELETE'])
def clear_training_data(training_type):
    """Limpiar datos de entrenamiento de un tipo específico"""
    try:
        if training_type not in ['alphabet', 'numbers']:
            return jsonify({'success': False, 'error': 'Tipo de entrenamiento inválido'}), 400

        connection = get_db_connection()
        if not connection:
            return jsonify({'success': False, 'error': 'Error de conexión a la base de datos'}), 500

        with connection.cursor() as cursor:
            cursor.execute("DELETE FROM training_samples WHERE type = %s", (training_type,))

            # Resetear AUTO_INCREMENT si la tabla está vacía
            cursor.execute("SELECT COUNT(*) FROM training_samples")
            total_count = cursor.fetchone()[0]
            if total_count == 0:
                cursor.execute("ALTER TABLE training_samples AUTO_INCREMENT = 1")

        connection.commit()
        connection.close()

        return jsonify({'success': True, 'message': f'Datos de {training_type} limpiados correctamente'})

    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/training/clear-before-save/<training_type>', methods=['POST'])
def clear_before_save(training_type):
    """Limpiar datos existentes antes de comenzar a guardar nuevos chunks"""
    try:
        if training_type not in ['alphabet', 'numbers']:
            return jsonify({'success': False, 'error': 'Tipo de entrenamiento inválido'}), 400

        connection = get_db_connection()
        if not connection:
            return jsonify({'success': False, 'error': 'Error de conexión a la base de datos'}), 500

        with connection.cursor() as cursor:
            cursor.execute("DELETE FROM training_samples WHERE type = %s", (training_type,))

            # Resetear AUTO_INCREMENT si la tabla está vacía
            cursor.execute("SELECT COUNT(*) FROM training_samples")
            total_count = cursor.fetchone()[0]
            if total_count == 0:
                cursor.execute("ALTER TABLE training_samples AUTO_INCREMENT = 1")

        connection.commit()
        connection.close()

        return jsonify({'success': True, 'message': f'Datos de {training_type} limpiados, listo para nuevos chunks'})

    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/training/reset-ids', methods=['POST'])
def reset_auto_increment():
    """Resetear AUTO_INCREMENT de las tablas para que los IDs empiecen desde 1"""
    try:
        connection = get_db_connection()
        if not connection:
            return jsonify({'success': False, 'error': 'Error de conexión a la base de datos'}), 500

        with connection.cursor() as cursor:
            # Resetear AUTO_INCREMENT de ambas tablas
            cursor.execute("ALTER TABLE training_samples AUTO_INCREMENT = 1")
            cursor.execute("ALTER TABLE trained_models AUTO_INCREMENT = 1")

        connection.commit()
        connection.close()

        return jsonify({'success': True, 'message': 'AUTO_INCREMENT reseteado para ambas tablas'})

    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/training/optimize', methods=['POST'])
def optimize_table_ids():
    """Reorganizar IDs de la tabla para que sean secuenciales desde 1"""
    try:
        connection = get_db_connection()
        if not connection:
            return jsonify({'success': False, 'error': 'Error de conexión a la base de datos'}), 500

        with connection.cursor() as cursor:
            # Crear tabla temporal con estructura idéntica
            cursor.execute("""
                CREATE TEMPORARY TABLE temp_training_samples
                SELECT * FROM training_samples ORDER BY created_at, type, label
            """)

            # Limpiar tabla original
            cursor.execute("DELETE FROM training_samples")
            cursor.execute("ALTER TABLE training_samples AUTO_INCREMENT = 1")

            # Copiar datos de vuelta con nuevos IDs secuenciales
            cursor.execute("""
                INSERT INTO training_samples (type, label, features, created_at)
                SELECT type, label, features, created_at
                FROM temp_training_samples
                ORDER BY created_at, type, label
            """)

            # Obtener estadísticas después de la optimización
            cursor.execute("SELECT COUNT(*) as total, MIN(id) as min_id, MAX(id) as max_id FROM training_samples")
            stats = cursor.fetchone()

            # Limpiar tabla temporal
            cursor.execute("DROP TEMPORARY TABLE temp_training_samples")

        connection.commit()
        connection.close()

        return jsonify({
            'success': True,
            'message': 'Tabla optimizada correctamente',
            'stats': {
                'total_records': stats[0],
                'new_min_id': stats[1],
                'new_max_id': stats[2],
                'ids_are_sequential': stats[0] == (stats[2] - stats[1] + 1) if stats[0] > 0 else True
            }
        })

    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/training/diagnostics')
def database_diagnostics():
    """Obtener información de diagnóstico de la base de datos"""
    try:
        connection = get_db_connection()
        if not connection:
            return jsonify({'success': False, 'error': 'Error de conexión a la base de datos'}), 500

        diagnostics = {}

        with connection.cursor() as cursor:
            # Estado de la tabla training_samples
            cursor.execute("""
                SELECT
                    MIN(id) as min_id,
                    MAX(id) as max_id,
                    COUNT(*) as total_records
                FROM training_samples
            """)
            training_stats = cursor.fetchone()

            cursor.execute("SHOW TABLE STATUS LIKE 'training_samples'")
            training_table_info = cursor.fetchone()

            # Estado de la tabla trained_models
            cursor.execute("""
                SELECT
                    MIN(id) as min_id,
                    MAX(id) as max_id,
                    COUNT(*) as total_records
                FROM trained_models
            """)
            models_stats = cursor.fetchone()

            cursor.execute("SHOW TABLE STATUS LIKE 'trained_models'")
            models_table_info = cursor.fetchone()

            # Conteos por tipo
            cursor.execute("""
                SELECT type, COUNT(*) as count, MIN(id) as min_id, MAX(id) as max_id
                FROM training_samples
                GROUP BY type
            """)
            type_stats = cursor.fetchall()

            # Verificar gaps en IDs
            cursor.execute("""
                SELECT id FROM training_samples ORDER BY id
            """)
            all_ids = [row[0] for row in cursor.fetchall()]

        connection.close()

        # Construir respuesta de diagnóstico
        diagnostics = {
            'success': True,
            'training_samples': {
                'total_records': training_stats[2],
                'min_id': training_stats[0],
                'max_id': training_stats[1],
                'next_auto_increment': training_table_info[10],
                'by_type': [{'type': row[0], 'count': row[1], 'min_id': row[2], 'max_id': row[3]}
                           for row in type_stats]
            },
            'trained_models': {
                'total_records': models_stats[2],
                'min_id': models_stats[0],
                'max_id': models_stats[1],
                'next_auto_increment': models_table_info[10]
            },
            'id_analysis': {
                'total_ids': len(all_ids),
                'has_gaps': len(all_ids) > 0 and (max(all_ids) - min(all_ids) + 1) != len(all_ids) if all_ids else False,
                'expected_next_id': max(all_ids) + 1 if all_ids else 1,
                'actual_next_auto_increment': training_table_info[10]
            }
        }

        return jsonify(diagnostics)

    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/training/load/<training_type>')
def load_training_data(training_type):
    """Cargar datos de entrenamiento"""
    try:
        if training_type not in ['alphabet', 'numbers']:
            return jsonify({'success': False, 'error': 'Tipo de entrenamiento inválido'}), 400

        connection = get_db_connection()
        if not connection:
            return jsonify({'success': False, 'error': 'Error de conexión a la base de datos'}), 500

        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT label, features, created_at
                FROM training_samples
                WHERE type = %s
                ORDER BY created_at ASC
            """, (training_type,))

            results = cursor.fetchall()

        connection.close()

        if not results:
            return jsonify({'success': True, 'features': [], 'labels': [], 'timestamp': None})

        features = []
        labels = []

        for row in results:
            labels.append(row[0])
            features.append(json.loads(row[1]))

        return jsonify({
            'success': True,
            'features': features,
            'labels': labels,
            'timestamp': results[0][2].timestamp() * 1000  # Convertir a timestamp JavaScript
        })

    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/training/progress')
def get_training_progress():
    """Obtener progreso de entrenamiento"""
    try:
        connection = get_db_connection()
        if not connection:
            return jsonify({'success': False, 'error': 'Error de conexión a la base de datos'}), 500

        with connection.cursor() as cursor:
            # Obtener letras únicas entrenadas (A-Z)
            cursor.execute("""
                SELECT DISTINCT label
                FROM training_samples
                WHERE type = 'alphabet' AND label REGEXP '^[A-Z]$'
            """)
            alphabet_results = cursor.fetchall()
            trained_letters = len(alphabet_results)

            # Obtener números únicos entrenados (0-9)
            cursor.execute("""
                SELECT DISTINCT label
                FROM training_samples
                WHERE type = 'numbers' AND label REGEXP '^[0-9]$'
            """)
            numbers_results = cursor.fetchall()
            trained_numbers = len(numbers_results)

        connection.close()

        # Calcular porcentajes
        alphabet_progress = round((trained_letters / 26) * 100)
        numbers_progress = round((trained_numbers / 10) * 100)

        return jsonify({
            'success': True,
            'alphabet': {
                'trained': trained_letters,
                'total': 26,
                'percentage': alphabet_progress
            },
            'numbers': {
                'trained': trained_numbers,
                'total': 10,
                'percentage': numbers_progress
            }
        })

    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/training/reset/<training_type>', methods=['DELETE'])
def reset_training_data(training_type):
    """Limpiar datos de entrenamiento"""
    try:
        if training_type not in ['alphabet', 'numbers', 'all']:
            return jsonify({'success': False, 'error': 'Tipo de entrenamiento inválido'}), 400

        connection = get_db_connection()
        if not connection:
            return jsonify({'success': False, 'error': 'Error de conexión a la base de datos'}), 500

        with connection.cursor() as cursor:
            if training_type == 'all':
                cursor.execute("DELETE FROM training_samples")
                cursor.execute("DELETE FROM trained_models")
                # Resetear AUTO_INCREMENT para ambas tablas
                cursor.execute("ALTER TABLE training_samples AUTO_INCREMENT = 1")
                cursor.execute("ALTER TABLE trained_models AUTO_INCREMENT = 1")
            else:
                cursor.execute("DELETE FROM training_samples WHERE type = %s", (training_type,))
                cursor.execute("DELETE FROM trained_models WHERE type = %s", (training_type,))

                # Resetear AUTO_INCREMENT si las tablas están vacías
                cursor.execute("SELECT COUNT(*) FROM training_samples")
                training_count = cursor.fetchone()[0]
                if training_count == 0:
                    cursor.execute("ALTER TABLE training_samples AUTO_INCREMENT = 1")

                cursor.execute("SELECT COUNT(*) FROM trained_models")
                models_count = cursor.fetchone()[0]
                if models_count == 0:
                    cursor.execute("ALTER TABLE trained_models AUTO_INCREMENT = 1")

        connection.commit()
        connection.close()

        return jsonify({'success': True, 'message': f'Datos de {training_type} eliminados correctamente'})

    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/model/save', methods=['POST'])
def save_model():
    """Guardar modelo entrenado"""
    try:
        data = request.get_json()

        if not data or 'type' not in data or 'model' not in data:
            return jsonify({'success': False, 'error': 'Datos incompletos'}), 400

        connection = get_db_connection()
        if not connection:
            return jsonify({'success': False, 'error': 'Error de conexión a la base de datos'}), 500

        with connection.cursor() as cursor:
            # Usar INSERT ... ON DUPLICATE KEY UPDATE para manejar actualizaciones
            cursor.execute("""
                INSERT INTO trained_models (type, model_data)
                VALUES (%s, %s)
                ON DUPLICATE KEY UPDATE
                model_data = VALUES(model_data),
                updated_at = CURRENT_TIMESTAMP
            """, (data['type'], json.dumps(data['model'])))

        connection.commit()
        connection.close()

        return jsonify({'success': True, 'message': f'Modelo de {data["type"]} guardado correctamente'})

    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/model/load/<model_type>')
def load_model(model_type):
    """Cargar modelo entrenado"""
    try:
        if model_type not in ['alphabet', 'numbers']:
            return jsonify({'success': False, 'error': 'Tipo de modelo inválido'}), 400

        connection = get_db_connection()
        if not connection:
            return jsonify({'success': False, 'error': 'Error de conexión a la base de datos'}), 500

        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT model_data, updated_at
                FROM trained_models
                WHERE type = %s
            """, (model_type,))

            result = cursor.fetchone()

        connection.close()

        if not result:
            return jsonify({'success': False, 'error': 'Modelo no encontrado'})

        return jsonify({
            'success': True,
            'model': json.loads(result[0]),
            'timestamp': result[1].timestamp() * 1000
        })

    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

# Manejo de errores
@app.errorhandler(404)
def not_found(error):
    return jsonify({'success': False, 'error': 'Endpoint no encontrado'}), 404

@app.errorhandler(413)
def payload_too_large(error):
    return jsonify({'success': False, 'error': 'Datos demasiado grandes. Intenta con chunks más pequeños.'}), 413

@app.errorhandler(500)
def internal_error(error):
    return jsonify({'success': False, 'error': 'Error interno del servidor'}), 500

if __name__ == "__main__":
    # Inicializar la base de datos al arrancar
    init_database()
    app.run("localhost", 5000, debug=True)
