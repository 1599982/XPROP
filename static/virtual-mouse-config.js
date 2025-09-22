// Virtual Mouse Configuration
// Configuración personalizable para el mouse virtual en diferentes páginas

window.VirtualMouseConfig = {
    // Configuración global por defecto
    default: {
        enabled: false,
        showCursor: true,
        showCamera: true,
        showControls: true,
        showInstructions: true,
        cursorColor: '#ff4444',
        clickColor: '#44ff44',
        cameraSize: { width: 280, height: 210 },
        clickCooldown: 600,
        minConfidence: 0.7,
        autoHideDelay: 5000, // ms para ocultar automáticamente las instrucciones
        position: 'top-right' // 'top-right', 'top-left', 'bottom-right', 'bottom-left'
    },

    // Configuración específica para página principal
    home: {
        showInstructions: true,
        autoHideDelay: 8000,
        cameraSize: { width: 240, height: 180 },
        showControls: true
    },

    // Configuración para páginas de entrenamiento
    training: {
        showCamera: false, // Ocultar cámara para no interferir con la cámara de entrenamiento
        showControls: true,
        showInstructions: false,
        cursorColor: '#4caf50',
        clickColor: '#2196f3',
        minConfidence: 0.6, // Más sensible para facilitar el entrenamiento
        clickCooldown: 400
    },

    // Configuración para entrenamiento de alfabeto
    'training-alphabet': {
        showCamera: false,
        showControls: false,
        showInstructions: false,
        cursorColor: '#9c27b0',
        clickColor: '#e91e63',
        minConfidence: 0.65,
        clickCooldown: 500
    },

    // Configuración para entrenamiento de números
    'training-numbers': {
        showCamera: false,
        showControls: false,
        showInstructions: false,
        cursorColor: '#ff9800',
        clickColor: '#795548',
        minConfidence: 0.65,
        clickCooldown: 500
    },

    // Configuración para predicción de alfabeto
    'predict-alphabet': {
        showCamera: false, // Ya tiene su propia cámara
        showControls: true,
        showInstructions: false,
        cursorColor: '#3f51b5',
        clickColor: '#009688',
        minConfidence: 0.75,
        clickCooldown: 700,
        position: 'top-left' // Cambiar posición para no interferir
    },

    // Configuración para predicción de números
    'predict-numbers': {
        showCamera: false,
        showControls: true,
        showInstructions: false,
        cursorColor: '#e91e63',
        clickColor: '#607d8b',
        minConfidence: 0.75,
        clickCooldown: 700,
        position: 'top-left'
    },

    // Configuración para mouse virtual dedicado
    'virtual-mouse': {
        enabled: true, // Auto-activar en esta página
        showCamera: true,
        showControls: true,
        showInstructions: true,
        cursorColor: '#f44336',
        clickColor: '#4caf50',
        cameraSize: { width: 320, height: 240 },
        minConfidence: 0.8,
        clickCooldown: 500,
        autoHideDelay: 10000
    },

    // Configuración para prototipo de click
    'click-prototype': {
        enabled: true,
        showCamera: true,
        showControls: true,
        showInstructions: true,
        cursorColor: '#ff5722',
        clickColor: '#8bc34a',
        cameraSize: { width: 300, height: 225 },
        minConfidence: 0.75,
        clickCooldown: 800
    }
};

// Función para obtener configuración basada en la página actual
window.getVirtualMouseConfig = function() {
    const path = window.location.pathname;
    let configKey = 'default';

    // Detectar página actual
    if (path === '/' || path === '/index.html') {
        configKey = 'home';
    } else if (path.includes('/allenamento') && !path.includes('/alfabeto') && !path.includes('/numeri')) {
        configKey = 'training';
    } else if (path.includes('/allenamento/alfabeto')) {
        configKey = 'training-alphabet';
    } else if (path.includes('/allenamento/numeri')) {
        configKey = 'training-numbers';
    } else if (path.includes('/previsione/alfabeto')) {
        configKey = 'predict-alphabet';
    } else if (path.includes('/previsione/numeri')) {
        configKey = 'predict-numbers';
    } else if (path.includes('/mouse-virtual')) {
        configKey = 'virtual-mouse';
    } else if (path.includes('/click-prototype')) {
        configKey = 'click-prototype';
    }

    // Combinar configuración por defecto con específica
    const defaultConfig = window.VirtualMouseConfig.default;
    const specificConfig = window.VirtualMouseConfig[configKey] || {};

    return { ...defaultConfig, ...specificConfig };
};

// Función para aplicar configuración de posición
window.applyVirtualMousePosition = function(position, elements) {
    const positions = {
        'top-right': {
            toggle: { top: '15px', right: '15px', left: 'auto', bottom: 'auto' },
            camera: { top: '80px', right: '15px', left: 'auto', bottom: 'auto' },
            controls: { top: '15px', left: '15px', right: 'auto', bottom: 'auto' },
            instructions: { bottom: '15px', right: '15px', left: 'auto', top: 'auto' }
        },
        'top-left': {
            toggle: { top: '15px', left: '15px', right: 'auto', bottom: 'auto' },
            camera: { top: '80px', left: '15px', right: 'auto', bottom: 'auto' },
            controls: { top: '15px', right: '15px', left: 'auto', bottom: 'auto' },
            instructions: { bottom: '15px', left: '15px', right: 'auto', top: 'auto' }
        },
        'bottom-right': {
            toggle: { bottom: '15px', right: '15px', left: 'auto', top: 'auto' },
            camera: { bottom: '80px', right: '15px', left: 'auto', top: 'auto' },
            controls: { top: '15px', left: '15px', right: 'auto', bottom: 'auto' },
            instructions: { bottom: '15px', left: '15px', right: 'auto', top: 'auto' }
        },
        'bottom-left': {
            toggle: { bottom: '15px', left: '15px', right: 'auto', top: 'auto' },
            camera: { bottom: '80px', left: '15px', right: 'auto', top: 'auto' },
            controls: { top: '15px', right: '15px', left: 'auto', bottom: 'auto' },
            instructions: { bottom: '15px', right: '15px', left: 'auto', top: 'auto' }
        }
    };

    const pos = positions[position] || positions['top-right'];

    // Aplicar estilos de posición
    Object.keys(pos).forEach(elementKey => {
        const element = elements[elementKey];
        if (element) {
            Object.keys(pos[elementKey]).forEach(prop => {
                element.style[prop] = pos[elementKey][prop];
            });
        }
    });
};

// Configuraciones temáticas adicionales
window.VirtualMouseThemes = {
    default: {
        cursorColor: '#ff4444',
        clickColor: '#44ff44',
        borderColor: '#4caf50'
    },
    purple: {
        cursorColor: '#9c27b0',
        clickColor: '#e1bee7',
        borderColor: '#ab47bc'
    },
    blue: {
        cursorColor: '#2196f3',
        clickColor: '#81d4fa',
        borderColor: '#42a5f5'
    },
    orange: {
        cursorColor: '#ff9800',
        clickColor: '#ffcc02',
        borderColor: '#ffa726'
    },
    green: {
        cursorColor: '#4caf50',
        clickColor: '#c8e6c9',
        borderColor: '#66bb6a'
    }
};

// Función para cambiar tema dinámicamente
window.setVirtualMouseTheme = function(themeName, virtualMouseInstance) {
    const theme = window.VirtualMouseThemes[themeName] || window.VirtualMouseThemes.default;
    
    if (virtualMouseInstance && virtualMouseInstance.elements) {
        // Actualizar colores del cursor
        if (virtualMouseInstance.elements.cursor) {
            virtualMouseInstance.elements.cursor.style.background = 
                `radial-gradient(circle, ${theme.cursorColor}, #aa0000)`;
        }
        
        // Actualizar borde de cámara
        if (virtualMouseInstance.elements.camera) {
            virtualMouseInstance.elements.camera.style.borderColor = theme.borderColor;
        }
        
        // Actualizar opciones internas
        virtualMouseInstance.options.cursorColor = theme.cursorColor;
        virtualMouseInstance.options.clickColor = theme.clickColor;
    }
};

// Auto-aplicar configuración cuando se carga la página
document.addEventListener('DOMContentLoaded', function() {
    // Pequeño delay para asegurar que VirtualMouseOverlay esté disponible
    setTimeout(() => {
        if (window.virtualMouse && window.getVirtualMouseConfig) {
            const config = window.getVirtualMouseConfig();
            
            // Aplicar configuración
            Object.keys(config).forEach(key => {
                if (window.virtualMouse.options.hasOwnProperty(key)) {
                    window.virtualMouse.options[key] = config[key];
                }
            });
            
            // Auto-activar si está configurado
            if (config.enabled && !window.virtualMouse.options.enabled) {
                window.virtualMouse.enable();
            }
            
            // Aplicar posición si está especificada
            if (config.position && window.virtualMouse.elements) {
                window.applyVirtualMousePosition(config.position, {
                    toggle: window.virtualMouse.elements.toggle,
                    camera: window.virtualMouse.elements.camera,
                    controls: window.virtualMouse.elements.controls,
                    instructions: window.virtualMouse.elements.instructions
                });
            }
            
            console.log('Virtual Mouse configured for page:', window.location.pathname);
        }
    }, 100);
});

// Exportar configuración para uso externo
window.VirtualMouseConfigManager = {
    getConfig: window.getVirtualMouseConfig,
    applyPosition: window.applyVirtualMousePosition,
    setTheme: window.setVirtualMouseTheme,
    themes: window.VirtualMouseThemes,
    configs: window.VirtualMouseConfig
};