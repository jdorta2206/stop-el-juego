// Diccionario de palabras válidas por categoría (ejemplo simplificado)
const dictionary = {
    name: ["Ana", "Andrés", "Alejandro", "Antonio", "Alberto", "Alicia", "Amelia", "Andrea"],
    animal: ["Águila", "Abeja", "Araña", "Avestruz", "Armadillo", "Anaconda", "Alce", "Avispa"],
    country: ["Argentina", "Alemania", "Australia", "Austria", "Angola", "Andorra", "Afganistán", "Albania"],
    fruit: ["Arándano", "Aguacate", "Albaricoque", "Ananá", "Acerola", "Arazá", "Alquejenje", "Avellana"],
    color: ["Azul", "Amarillo", "Añil", "Ámbar", "Amaranto", "Amarillo limón", "Azul marino", "Azul cielo"],
    object: ["Avión", "Auto", "Armario", "Aspiradora", "Abanico", "Arco", "Anillo", "Altavoz"]
};

// Variables para el giro
let spinVelocity = 0;
let spinDeceleration = 0.1;
let isSpinning = false;
let targetLetter = '';
let spinInterval;

// Función de giro mejorada
function startSpin() {
    if (isSpinning || gameActive) return;
    
    isSpinning = true;
    spinBtn.disabled = true;
    currentLetterEl.textContent = '?';
    
    // Seleccionar letra no usada
    let availableLetters = letters.split('').filter(l => !usedLetters.includes(l));
    if (availableLetters.length === 0) {
        endGame();
        return;
    }
    
    targetLetter = availableLetters[Math.floor(Math.random() * availableLetters.length)];
    spinVelocity = 20 + Math.random() * 10; // Velocidad inicial aleatoria
    
    // Efecto de sonido
    spinSound.currentTime = 0;
    spinSound.play();
    
    // Iniciar animación
    spinInterval = setInterval(updateSpin, 20);
}

// Actualizar posición de la ruleta
function updateSpin() {
    wheelPosition += spinVelocity;
    spinVelocity = Math.max(0, spinVelocity - spinDeceleration);
    
    wheel.style.transform = `rotate(-${wheelPosition % 360}deg)`;
    
    // Efecto de sonido durante el giro
    if (spinVelocity > 5 && Date.now() - lastTickTime > 100) {
        wheelTick.currentTime = 0;
        wheelTick.play();
        lastTickTime = Date.now();
    }
    
    // Detener cuando la velocidad llegue a cero
    if (spinVelocity <= 0) {
        clearInterval(spinInterval);
        finishSpin();
    }
}

// Finalizar giro
function finishSpin() {
    isSpinning = false;
    currentLetter = targetLetter;
    usedLetters.push(currentLetter);
    currentLetterEl.textContent = currentLetter;
    
    // Efecto de sonido
    spinSound.pause();
    stopSound.currentTime = 0;
    stopSound.play();
    
    // Iniciar ronda
    startRound();
}

// Validar respuestas al terminar la ronda
function validateAnswers() {
    let score = 0;
    
    Object.keys(categoryInputs).forEach(category => {
        const input = categoryInputs[category];
        const answer = input.value.trim();
        
        if (answer === '') {
            input.classList.remove('correct', 'incorrect');
            return;
        }
        
        // Verificar si comienza con la letra correcta
        const startsWithLetter = answer[0].toUpperCase() === currentLetter;
        
        // Verificar si está en el diccionario (opcional, puedes hacerlo más flexible)
        const isInDictionary = dictionary[category].some(word => 
            word.toLowerCase() === answer.toLowerCase()
        );
        
        if (startsWithLetter && isInDictionary) {
            input.classList.add('correct');
            input.classList.remove('incorrect');
            score += 10;
        } else if (startsWithLetter) {
            input.classList.add('correct');
            input.classList.remove('incorrect');
            score += 5; // Puntos reducidos si no está en diccionario
        } else {
            input.classList.add('incorrect');
            input.classList.remove('correct');
        }
    });
    
    return score;
}

// Modificar la función endRound para usar validación
function endRound() {
    clearInterval(timer);
    gameActive = false;
    submitBtn.disabled = true;
    
    // Validar respuestas
    const roundScore = validateAnswers();
    
    // Mostrar resultados
    alert(`¡Ronda completada!\nLetra: ${currentLetter}\nPuntuación: ${roundScore} puntos`);
    spinBtn.disabled = false;
    
    // Deshabilitar campos
    Object.values(categoryInputs).forEach(input => {
        input.disabled = true;
    });
}