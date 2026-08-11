/* ==========================================================================
   CALCULADORA - FUNCIONALIDADES E SUPORTE A TECLADO
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    // Seleção dos elementos do DOM
    const display = document.querySelector('#display') || document.querySelector('.display') || document.querySelector('[data-display]');
    const buttons = document.querySelectorAll('button, .btn');

    if (!display) {
        console.warn('Elemento de display da calculadora não foi encontrado no DOM.');
        return;
    }

    let currentInput = '';
    let previousInput = '';
    let operator = null;
    let shouldResetDisplay = false;

    // Atualiza o visor da calculadora
    function updateDisplay(value) {
        display.value = value || '0';
        if (display.tagName !== 'INPUT') {
            display.textContent = value || '0';
        }
    }

    // Limpa toda a calculadora
    function clearAll() {
        currentInput = '';
        previousInput = '';
        operator = null;
        shouldResetDisplay = false;
        updateDisplay('0');
    }

    // Apaga o último caractere digitado (Backspace/DEL)
    function deleteLast() {
        if (shouldResetDisplay) return;
        currentInput = currentInput.toString().slice(0, -1);
        updateDisplay(currentInput || '0');
    }

    // Adiciona número ou ponto decimal
    function appendNumber(number) {
        if (shouldResetDisplay) {
            currentInput = '';
            shouldResetDisplay = false;
        }

        // Impede múltiplos pontos decimais
        if (number === '.' && currentInput.includes('.')) return;

        // Evita múltiplos zeros no início
        if (currentInput === '0' && number === '0') return;
        if (currentInput === '0' && number !== '.') {
            currentInput = number;
        } else {
            currentInput += number;
        }

        updateDisplay(currentInput);
    }

    // Define o operador matemático
    function handleOperator(op) {
        if (currentInput === '' && previousInput === '') return;

        if (previousInput !== '' && currentInput !== '' && !shouldResetDisplay) {
            calculate();
        }

        operator = op;
        previousInput = currentInput || display.value || display.textContent;
        shouldResetDisplay = true;
    }

    // Realiza o cálculo principal
    function calculate() {
        if (!operator || previousInput === '') return;

        let prev = parseFloat(previousInput);
        let current = parseFloat(currentInput || display.value || display.textContent);

        if (isNaN(prev) || isNaN(current)) return;

        let result = 0;

        switch (operator) {
            case '+':
            case 'add':
                result = prev + current;
                break;
            case '-':
            case 'subtract':
                result = prev - current;
                break;
            case '*':
            case 'x':
            case 'multiply':
                result = prev * current;
                break;
            case '/':
            case 'divide':
                if (current === 0) {
                    updateDisplay('Erro');
                    setTimeout(clearAll, 1500);
                    return;
                }
                result = prev / current;
                break;
            case '%':
                result = (prev * current) / 100;
                break;
            default:
                return;
        }

        // Arredonda para evitar problemas com ponto flutuante no JS
        result = Math.round(result * 100000000) / 100000000;

        currentInput = result.toString();
        operator = null;
        previousInput = '';
        shouldResetDisplay = true;
        updateDisplay(currentInput);
    }

    // Manipulação dos cliques nos botões da tela
    buttons.forEach(button => {
        button.addEventListener('click', (e) => {
            const action = button.dataset.action || button.getAttribute('data-action');
            const value = button.textContent.trim();

            if (!action) {
                // Se o botão for apenas um número/ponto
                if (!isNaN(value) || value === '.') {
                    appendNumber(value);
                } else if (['+', '-', '*', '/', 'x', '%'].includes(value)) {
                    handleOperator(value);
                } else if (value === '=') {
                    calculate();
                } else if (value.toUpperCase() === 'C' || value.toUpperCase() === 'AC') {
                    clearAll();
                }
                return;
            }

            // Suporte por data-attributes (se houver no HTML)
            switch (action) {
                case 'number':
                    appendNumber(button.dataset.value || value);
                    break;
                case 'operator':
                case 'add':
                case 'subtract':
                case 'multiply':
                case 'divide':
                    handleOperator(button.dataset.value || value);
                    break;
                case 'calculate':
                case 'equals':
                    calculate();
                    break;
                case 'clear':
                    clearAll();
                    break;
                case 'delete':
                case 'backspace':
                    deleteLast();
                    break;
                case 'percent':
                    handleOperator('%');
                    break;
            }
        });
    });

    /* ==========================================================================
       SUPORTE A TECLADO
       ========================================================================== */
    document.addEventListener('keydown', (event) => {
        const key = event.key;

        // Números de 0 a 9 e Ponto/Vírgula
        if (!isNaN(key) && key !== ' ') {
            appendNumber(key);
        } else if (key === '.' || key === ',') {
            appendNumber('.');
        }
        // Operadores
        else if (key === '+') {
            handleOperator('+');
        } else if (key === '-') {
            handleOperator('-');
        } else if (key === '*' || key.toLowerCase() === 'x') {
            handleOperator('*');
        } else if (key === '/') {
            event.preventDefault(); // Evita atalho de busca rápida em alguns navegadores
            handleOperator('/');
        } else if (key === '%') {
            handleOperator('%');
        }
        // Igual / Enter
        else if (key === 'Enter' || key === '=') {
            event.preventDefault();
            calculate();
        }
        // Apagar dígito (Backspace)
        else if (key === 'Backspace') {
            deleteLast();
        }
        // Limpar tudo (Escape ou C/c)
        else if (key === 'Escape' || key.toLowerCase() === 'c') {
            clearAll();
        }
    });

    // Inicializa o visor zerado
    clearAll();
});
