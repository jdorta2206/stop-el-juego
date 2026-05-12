// Interface para WebView Android
const AndroidInterface = {
    playSound: function(sound) {
        if(window.Android && Android.playSound) {
            Android.playSound(sound);
        } else {
            const audio = new Audio(`assets/sounds/${sound}.mp3`);
            audio.play();
        }
    },
    
    shareApp: function(type) {
        const shareText = "¡Juega STOP con Ruleta! " + window.location.href;
        
        if(window.Android) {
            if(type === 'whatsapp') {
                Android.shareToWhatsApp(shareText);
            } else {
                Android.shareToZangi(shareText);
            }
        } else {
            // Implementación web
            if(type === 'whatsapp') {
                window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, '_blank');
            } else {
                alert("Compartir: " + shareText);
            }
        }
    },
    
    vibrate: function(duration) {
        if(window.Android && Android.vibrate) {
            Android.vibrate(duration);
        } else if(navigator.vibrate) {
            navigator.vibrate(duration);
        }
    }
};

// Modificar las funciones de sonido para usar la interface
function playSpinSound() {
    AndroidInterface.playSound('spin');
}

function playStopSound() {
    AndroidInterface.playSound('stop');
}

// Modificar las funciones de compartir
document.getElementById('shareWhatsApp').addEventListener('click', () => {
    AndroidInterface.shareApp('whatsapp');
});

document.getElementById('shareZangi').addEventListener('click', () => {
    AndroidInterface.shareApp('zangi');
});

// Añadir vibración al girar la ruleta
function startSpin() {
    AndroidInterface.vibrate(100);
    // Resto de la lógica del giro...
}