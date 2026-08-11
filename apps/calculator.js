// --- LÓGICA DA CALCULADORA (apps/calculator.js) ---

let calcDisplay = "0";
let calcPrev = null;
let calcOp = null;
let calcNewNumber = true;

// Atualiza o visor na tela
function updateCalcDisplay() {
    const display = document.getElementById("calc-display");
    if (display) {
        display.value = calcDisplay;
    }
}

// Digitar números e ponto
function pressCalcNum(num) {
    if (calcNewNumber) {
        calcDisplay = num;
        calcNewNumber = false;
    } else {
        if (calcDisplay === "0" && num !== ".") {
            calcDisplay = num;
        } else {
            if (num === "." && calcDisplay.includes(".")) return;
            calcDisplay += num;
        }
    }
    updateCalcDisplay();
}

// Selecionar Operação (+, -, *, /)
function pressCalcOp(op) {
    if (calcOp !== null && !calcNewNumber) {
        calculateResult();
    }
    calcPrev = parseFloat(calcDisplay);
    calcOp = op;
    calcNewNumber = true;
}

// Executar o Cálculo
function calculateResult() {
    if (calcOp === null || calcPrev === null) return;
    const current = parseFloat(calcDisplay);
    let res = 0;
    
    switch (calcOp) {
        case '+': 
            res = calcPrev + current; 
            break;
        case '-': 
            res = calcPrev - current; 
            break;
        case '*': 
            res = calcPrev * current; 
            break;
        case '/': 
            res = current !== 0 ? calcPrev / current : "Erro"; 
            break;
    }
    
    calcDisplay = String(res);
    calcOp = null;
    calcPrev = null;
    calcNewNumber = true;
    updateCalcDisplay();
}

// Limpar Display (Botão C)
function clearCalc() {
    calcDisplay = "0";
    calcPrev = null;
    calcOp = null;
    calcNewNumber = true;
    updateCalcDisplay();
}

// Garante que o display inicie correto ao carregar a página
document.addEventListener("DOMContentLoaded", () => {
    updateCalcDisplay();
});
